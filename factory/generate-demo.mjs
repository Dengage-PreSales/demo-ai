/* ============================================================================
   THE GENERATOR. One URL in, one demo folder out.

     node factory/generate-demo.mjs --url https://www.example.com
     node factory/generate-demo.mjs --url https://www.example.com --slug acme
     node factory/generate-demo.mjs --url https://www.example.com --csv products.csv
     node factory/generate-demo.mjs --url https://www.example.com --json report.json

   Handoff 7. It scrapes the catalogue, extracts the theme, then hands the copy
   and substitution to factory/build-demo.sh rather than repeating it, because
   that script already owns the one thing that must not be got wrong twice: the
   application identity and the slug going into the markup. A second copy of that
   logic is a second place for the two to disagree.

   WHAT CHANGED, 8 AUGUST 2026. Real product images are now downloaded at build
   time, compressed, and committed into the demo folder, which reverses handoff
   7.3 on the owner's explicit instruction. Non-negotiable 4 always described
   this mechanism: downloaded, compressed and committed, never fetched from a
   third party at call time. factory/scrape/images.mjs owns the whole of it,
   including the robots check, the size caps and the batch budget; a product
   whose image could not be fetched keeps its drawn artwork, so a demo can
   still never 404 mid call. --no-images turns the download off entirely.

   EVERY FAILURE IS A MESSAGE FOR A SALESPERSON. The --json report is what the
   workflow turns into an issue comment, so each outcome carries prose that says
   what happened and what to do about it. A stack trace on an issue is a defect
   in this file, not in the site being read.
   ========================================================================== */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { catalogue, PRODUCT_CAP } from './scrape/catalogue.mjs';
import { downloadImages, stripImageUrls } from './scrape/images.mjs';
import { theme, LOADABLE } from './scrape/theme.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEMO_DAYS = 90;

/* -------------------------------------------------------------------------- */
/* Arguments                                                                  */

function args(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (!token.startsWith('--')) continue;
        const name = token.slice(2);
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('--')) { out[name] = true; continue; }
        out[name] = next;
        i++;
    }
    return out;
}

function usage(message) {
    console.error(message);
    console.error('\nusage: node factory/generate-demo.mjs --url <prospect url> [--slug s]' +
                  ' [--csv file] [--currency USD] [--name "Store Name"]' +
                  ' [--no-generate] [--no-images] [--no-stock] [--json report.json]');
    process.exit(2);
}

/* -------------------------------------------------------------------------- */
/* Slug                                                                       */

/* The slug is a URL path, a storage namespace and part of every order id, so it
   is derived conservatively and then checked against what already exists. */
export function slugFromUrl(url) {
    const host = new URL(url).hostname.toLowerCase()
        .replace(/^www\./, '')
        .replace(/\.(com|co|net|org|shop|store|io|ai)(\.[a-z]{2})?$/, '');
    /* The trailing trim runs AFTER the truncation, not only before it. Cutting a
       long domain at 34 characters can land the cut on a hyphen, and a slug ending
       in one is not a legal slug: it becomes a URL path, a storage namespace and
       part of every order id, and build-demo.sh refuses it. A domain long enough
       to hit the limit is exactly the case nobody tries by hand. */
    const slug = host.replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 34)
        .replace(/-+$/, '');
    return slug.length >= 3 ? slug : 'demo-' + slug;
}

/* THE NAME THAT ENDS UP IN THE BROWSER TAB, when nothing better was supplied.
   The issue title is the good source, because a person typed it and got the
   capitalisation right, and this is the floor under it: a hand run of the
   generator, or a title that did not survive readName.

   The domain gives riopneus and this gives RioPneus only by luck, so it does
   not try to be clever about internal capitals. It title cases each word, which is
   right for "northfield outdoor" and merely plain for a run-together name. Plain
   and correct beats clever and wrong on a shared screen. */
export function storeNameFromUrl(url) {
    const slug = slugFromUrl(url);
    return slug.split('-')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/* Handoff 7.1: two demos requested for the same domain must not overwrite each
   other silently, which happens the moment a demo expires and is rebuilt for a
   second call. The suffix is reported so the issue comment can say so. */
function freeSlug(base) {
    if (!existsSync(join(ROOT, 'demos', base))) return { slug: base, suffixed: false };
    for (let n = 2; n < 50; n++) {
        const candidate = base + '-' + n;
        if (!existsSync(join(ROOT, 'demos', candidate))) return { slug: candidate, suffixed: true };
    }
    return { slug: base + '-' + Date.now().toString(36), suffixed: true };
}

/* -------------------------------------------------------------------------- */
/* Currency                                                                   */

/* Only currencies whose symbol is unambiguous in one column of a product grid.
   Anything else falls back to the code itself, which is honest and readable:
   "1,299.00 SEK" reads correctly, and an invented symbol does not. */
const SYMBOLS = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', TRY: '₺',
    INR: '₹', AUD: '$', CAD: '$', CHF: 'CHF', SEK: 'kr', NOK: 'kr',
    DKK: 'kr', PLN: 'zł', AED: 'AED', SAR: 'SAR', BRL: 'R$', MXN: '$',
    ZAR: 'R', SGD: '$', NZD: '$', HKD: '$'
};

/* GROUPING IS A SEPARATE QUESTION FROM THE SYMBOL. Every demo is in English, so
   en-US grouping is right for almost everything: 264,500.00. India groups the same
   digits as 2,64,500.00, and a rupee price shown the American way reads as wrong to
   the only audience that matters, the prospect who knows their own prices.

   Listed rather than derived, and only where it differs from en-US, because a
   currency does not imply a locale: EUR is grouped one way in Ireland and another
   in Germany, and this file has no basis for choosing between them. Add an entry
   when a store proves one is needed.

   BRL added 7 August 2026, when a Brazilian store proved it: Brazil writes
   R$ 1.234,56, so the American reading of the same digits, R$1,234.56, is not a
   near miss but a different number to the one person whose opinion counts. */
const NUMBER_LOCALE = { INR: 'en-IN', BRL: 'pt-BR' };

function currencyBlock(code) {
    const upper = String(code || 'USD').toUpperCase();
    const known = /^[A-Z]{3}$/.test(upper) ? upper : 'USD';
    return {
        language: 'en',
        currency: known,
        currencySymbol: SYMBOLS[known] || known,
        numberLocale: NUMBER_LOCALE[known] || 'en-US'
    };
}

/* THE COUNTRY IN THE ADDRESS, AND ONLY AS A LAST RESORT. Reached when the issue
   did not say, the store could not be read, and the CSV carried bare numbers: a
   store that blocks automated readers and is rescued by an export is exactly that
   case, and it is the case that shipped riopneus.com.br priced in dollars on
   7 August 2026.

   A country code in the address is weak evidence, so it ranks below everything the
   store or the file actually said, and it is only ever consulted for the LAST
   label. That is all a country code is: riopneus.com.br and a hypothetical
   riopneus.br both end in br, so nothing here has to know the shape of a
   country's second level domains.

   ONLY COUNTRIES WHOSE DOMAIN IS ACTUALLY USED BY LOCAL SHOPS. .io, .co, .ai, .me,
   .tv and .ly are country codes sold worldwide as generic names, and a store on one
   of them is no more likely to price in that country's money than in any other, so
   they are deliberately absent. Absent means the USD fallback, which is at least a
   known default rather than a wrong specific. Add a country when a real request
   proves one is missing. */
const TLD_CURRENCY = {
    br: 'BRL', mx: 'MXN', ar: 'ARS', cl: 'CLP', pe: 'PEN',
    uk: 'GBP', ie: 'EUR', de: 'EUR', fr: 'EUR', it: 'EUR', es: 'EUR',
    nl: 'EUR', be: 'EUR', at: 'EUR', pt: 'EUR', fi: 'EUR', gr: 'EUR',
    sk: 'EUR', si: 'EUR', ee: 'EUR', lv: 'EUR', lt: 'EUR', lu: 'EUR',
    cy: 'EUR', mt: 'EUR', eu: 'EUR',
    se: 'SEK', no: 'NOK', dk: 'DKK', pl: 'PLN', cz: 'CZK', hu: 'HUF',
    ro: 'RON', ch: 'CHF', tr: 'TRY', ru: 'RUB', ua: 'UAH',
    in: 'INR', jp: 'JPY', kr: 'KRW', cn: 'CNY', tw: 'TWD', hk: 'HKD',
    sg: 'SGD', my: 'MYR', th: 'THB', id: 'IDR', ph: 'PHP', vn: 'VND',
    au: 'AUD', nz: 'NZD', ca: 'CAD', us: 'USD',
    ae: 'AED', sa: 'SAR', qa: 'QAR', kw: 'KWD', bh: 'BHD', om: 'OMR',
    jo: 'JOD', il: 'ILS', eg: 'EGP', ma: 'MAD', za: 'ZAR', ng: 'NGN',
    ke: 'KES'
};

export /* THE COUNTRY IN THE NAME, WHEN IT IS NOT IN THE SUFFIX. saudi.examplescents.com
   built on 7 August 2026 priced a Saudi perfume house in dollars: the store
   publishes no currency of its own, and .com says nothing, so the fallback decided.
   The word "saudi" was the first label of the host the whole time.

   Read only as a WHOLE LABEL, or a whole hyphen separated part of one, which is
   what keeps "india" out of "indianapolis" and "oman" out of "romantic". Three
   letters is the floor, so "uk" and "ch" cannot be found inside a brand name.

   Same standing as the suffix: last resort, reported as inferred, and overridden by
   anything the store, the file or the issue actually said. */
const COUNTRY_CURRENCY = {
    saudi: 'SAR', ksa: 'SAR', uae: 'AED', emirates: 'AED', dubai: 'AED',
    abudhabi: 'AED', qatar: 'QAR', doha: 'QAR', kuwait: 'KWD', bahrain: 'BHD',
    oman: 'OMR', muscat: 'OMR', egypt: 'EGP', cairo: 'EGP', jordan: 'JOD',
    amman: 'JOD', lebanon: 'LBP', morocco: 'MAD', israel: 'ILS',
    turkey: 'TRY', turkiye: 'TRY', india: 'INR', bharat: 'INR',
    brasil: 'BRL', brazil: 'BRL', mexico: 'MXN', argentina: 'ARS', chile: 'CLP',
    colombia: 'COP', peru: 'PEN',
    japan: 'JPY', korea: 'KRW', china: 'CNY', taiwan: 'TWD', hongkong: 'HKD',
    singapore: 'SGD', malaysia: 'MYR', thailand: 'THB', indonesia: 'IDR',
    philippines: 'PHP', vietnam: 'VND', pakistan: 'PKR', bangladesh: 'BDT',
    australia: 'AUD', newzealand: 'NZD', canada: 'CAD',
    nigeria: 'NGN', kenya: 'KES', southafrica: 'ZAR', ghana: 'GHS',
    britain: 'GBP', england: 'GBP', scotland: 'GBP',
    germany: 'EUR', deutschland: 'EUR', france: 'EUR', spain: 'EUR',
    espana: 'EUR', italy: 'EUR', italia: 'EUR', netherlands: 'EUR',
    nederland: 'EUR', portugal: 'EUR', ireland: 'EUR', austria: 'EUR',
    belgium: 'EUR', greece: 'EUR', finland: 'EUR',
    poland: 'PLN', polska: 'PLN', sweden: 'SEK', sverige: 'SEK',
    norway: 'NOK', norge: 'NOK', denmark: 'DKK', danmark: 'DKK',
    switzerland: 'CHF', schweiz: 'CHF', suisse: 'CHF',
    czech: 'CZK', hungary: 'HUF', romania: 'RON', ukraine: 'UAH'
};

export function currencyFromHost(url) {
    let host;
    try { host = new URL(url).hostname.toLowerCase(); } catch (err) { return null; }

    /* The suffix first. A country code top level domain is a registration fact and
       a word in a name is only a choice of name. */
    const suffix = TLD_CURRENCY[host.split('.').pop()];
    if (suffix) return suffix;

    for (const part of host.split(/[.\-_]+/)) {
        if (part.length < 3) continue;
        if (COUNTRY_CURRENCY[part]) return COUNTRY_CURRENCY[part];
    }
    return null;
}

/* ONE PLACE DECIDES, AND IT REPORTS WHY. The order is strongest evidence first,
   and the source travels into the issue comment so that a salesperson can see at a
   glance whether the currency was read or inferred. A demo priced in a guessed
   currency is fine to show; one priced in a guessed currency that claims to have
   been read from the store is not. */
export function chooseCurrency(given, found, origin) {
    const asked = given && given !== true ? String(given).trim() : '';
    if (/^[A-Za-z]{3}$/.test(asked)) return { code: asked.toUpperCase(), source: 'issue' };
    if (found.currency) {
        return { code: found.currency, source: found.tier === 'csv' ? 'csv' : 'store' };
    }
    const host = currencyFromHost(origin);
    if (host) return { code: host, source: 'address' };
    return { code: 'USD', source: 'fallback' };
}

/* -------------------------------------------------------------------------- */
/* Fonts on the page                                                          */

/* The stylesheet link in the head names the families, and js/boot.js applies them
   from demo.config.json. Both halves are needed: without the link the family is
   named but never downloaded, and the browser silently renders the fallback,
   which is the failure that looks like the theme did not apply.

   Only families in theme.mjs's LOADABLE set reach here, so the weights below are
   known to exist for each one and the request cannot 404 on a weight. */
function fontLink(displayFont, bodyFont) {
    const families = [];
    const add = (name, weights) => {
        if (!LOADABLE.includes(name)) return;
        const spec = name.replace(/ /g, '+') + ':wght@' + weights;
        if (!families.some((f) => f.startsWith(name.replace(/ /g, '+') + ':'))) families.push(spec);
    };
    add(displayFont, '600;700');
    add(bodyFont, '400;500;600;700');
    if (!families.length) { add('Sora', '600;700'); add('Inter', '400;500;600;700'); }
    return 'https://fonts.googleapis.com/css2?family=' + families.join('&family=') + '&display=swap';
}

/* THE CHECK IS THAT THE LINK WAS FOUND, NOT THAT THE TEXT CHANGED, and the
   difference is not academic. The template's own default is Sora with Inter, so
   any prospect that maps to those two produces a replacement identical to what
   is already there. Comparing before and after therefore reported "the link did
   not match" for a rewrite that was entirely correct, and rolled the whole demo
   back over it. */
const FONT_LINK = /(<link\s+href=")https:\/\/fonts\.googleapis\.com\/css2\?[^"]*(")/;

function rewriteFontLink(path, href) {
    const html = readFileSync(path, 'utf8');
    if (!FONT_LINK.test(html)) {
        throw new Error('no Google Fonts link to rewrite in ' + path);
    }
    writeFileSync(path, html.replace(FONT_LINK, (match, before, after) => before + href + after));
}

/* -------------------------------------------------------------------------- */
/* Plain language                                                             */

/* Handoff 8: the failure message is a product surface, read by a salesperson.
   Each of these says what happened and what to do next, and none of them names
   an HTTP status or a module. */
const WHY = {
    blocked:
        'This store would not let an automated reader see its catalogue. That is ' +
        'common for larger retailers and it is not something we can change from ' +
        'our side.',
    robots:
        'This store asks automated readers not to fetch its product pages, and we ' +
        'respect that request.',
    'not-found':
        'We reached this store but could not find a product catalogue in a format ' +
        'we can read automatically.',
    network:
        'We could not reach this store. It may have been briefly unavailable.',
    server:
        'This store returned an error while we were reading it. It may have been ' +
        'briefly unavailable.',
    'wrong-type':
        'We reached this store but what it returned was not a product catalogue.',
    'too-big':
        'This store\'s catalogue file is larger than we can read in one pass.'
};

const NEXT_STEP =
    'Attach a CSV of 20 to 30 products to the issue and comment "retry". ' +
    'One row per product, with a heading row containing at least a name column ' +
    'and a price column. A category column and a sale price column are used if ' +
    'they are there.';

/* Said to somebody who has already done what was asked. The tone matters here more
   than anywhere else in this file: they attached a file, it was refused, and being
   told again to attach a file is the worst possible answer. */
const CSV_WHY = {
    headings:
        'The CSV came through, but we could not tell which column is the product ' +
        'name and which is the price. The heading row is what we read, and one of ' +
        'those two is missing or is named something we did not recognise.',
    empty:
        'The CSV came through but had no rows in it apart from the headings.',
    unreadable:
        'The CSV came through but we could not read it.'
};

const CSV_NEXT_STEP =
    'Rename the heading row so the name column reads "name" and the price column ' +
    'reads "price", then attach it again and comment "retry". Those two are the ' +
    'only ones that must be right. "category", "sale price" and "stock" are used ' +
    'if they are there and ignored if they are not. Accents, capitals, ' +
    'underscores and a unit in brackets all make no difference, so "Preco" and ' +
    '"Price (BRL)" are both read correctly.';

function catalogueFailure(found) {
    /* A CSV THAT WAS SUPPLIED AND REFUSED IS THE ONLY THING WORTH SAYING, and this
       function used to bury it. The reasons below are ranked, the csv tier's reasons
       were not in the ranking at all, so a rejected CSV fell through to whatever the
       website tiers had said and the operator was told the store blocks automated
       readers. Which it does, and which is why they attached a CSV in the first
       place. On 7 August 2026 that sent a real request round in a circle: attach a
       CSV, get told to attach a CSV.

       So a csv attempt that failed is reported first and on its own terms. */
    const csv = (found.attempts || []).find((attempt) => attempt.tier === 'csv');
    if (csv && !csv.ok) {
        return {
            reason: 'csv-' + (csv.reason || 'unreadable'),
            message: CSV_WHY[csv.reason] || CSV_WHY.unreadable,
            nextStep: CSV_NEXT_STEP
        };
    }

    /* Too few products is its own answer, and a more useful one than the reason
       any single tier gave: it says we DID read the store and what we got was not
       enough, which is what makes the CSV request sound reasonable rather than
       arbitrary. */
    if (found.thin > 0) {
        return {
            reason: 'thin',
            message: 'We read this store but could only find ' + found.thin +
                ' product' + (found.thin === 1 ? '' : 's') + '. A demo needs at least ' +
                found.floor + ' to look like a real storefront, so this one would show ' +
                'an almost empty grid on the call.',
            nextStep: NEXT_STEP
        };
    }
    /* Otherwise the most specific reason across the tiers, because "we could not
       find a catalogue" is less useful than "they asked us not to". */
    const order = ['robots', 'blocked', 'wrong-type', 'too-big', 'server', 'network', 'not-found'];
    const reasons = (found.attempts || []).map((attempt) => attempt.reason).filter(Boolean);
    const picked = order.find((reason) => reasons.includes(reason)) || 'not-found';
    return { reason: picked, message: WHY[picked] || WHY['not-found'], nextStep: NEXT_STEP };
}

/* -------------------------------------------------------------------------- */
/* Build                                                                      */

function isoDate(offsetDays) {
    const now = new Date();
    now.setUTCDate(now.getUTCDate() + (offsetDays || 0));
    return now.toISOString().slice(0, 10);
}

function report(path, body) {
    const text = JSON.stringify(body, null, 2);
    if (path && typeof path === 'string') writeFileSync(path, text);
    return body;
}

async function main() {
    const options = args(process.argv.slice(2));
    if (!options.url || options.url === true) usage('A prospect URL is required.');

    let url;
    try {
        url = new URL(options.url);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('scheme');
    } catch (err) {
        usage('That does not look like a website address: ' + options.url);
    }
    const origin = url.origin;

    const csvText = options.csv && options.csv !== true && existsSync(options.csv)
        ? readFileSync(options.csv, 'utf8')
        : null;

    console.error('Reading ' + origin);

    /* The store's name is needed before the catalogue, not after: it is the better
       half of the hint that picks a vertical when a store cannot be read at all. A
       domain says pneus and a title says RioPneus, and either can be the one that
       carries the clue. */
    const storeName = options.name && options.name !== true
        ? String(options.name).trim()
        : storeNameFromUrl(origin);

    /* The catalogue decides whether there is a demo at all, so it runs first and
       the theme is not fetched if there is nothing to theme.

       generateIfUnreadable is what stops a blocked store becoming a request that
       waits for a person. It is passed explicitly rather than defaulted on, so the
       decision to ship a made up catalogue is visible at this one call site. --csv
       and --no-generate both turn it off: an attached CSV means somebody already
       supplied the real catalogue, and a generated one must never quietly win over
       it. */
    const found = await catalogue(origin, csvText, {
        generateIfUnreadable: !csvText && !options['no-generate'],
        hint: origin + ' ' + storeName
    });
    if (!found.ok) {
        const failure = catalogueFailure(found);
        console.error('No catalogue: ' + failure.reason);
        report(options.json, {
            ok: false, url: origin, stage: 'catalogue',
            attempts: found.attempts, ...failure
        });
        process.exit(1);
    }
    console.error('Catalogue: ' + found.products.length + ' products via ' + found.tier +
                  ', categories ' + found.categories.join(', '));

    const templateConfig = JSON.parse(readFileSync(join(ROOT, 'template', 'demo.config.json'), 'utf8'));
    const extracted = await theme(origin, templateConfig.theme);
    console.error('Theme: primary ' + extracted.theme.primary + ', accent ' + extracted.theme.accent +
                  ', ' + extracted.theme.displayFont + '/' + extracted.theme.bodyFont);

    const base = options.slug && options.slug !== true ? String(options.slug) : slugFromUrl(origin);
    if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(base)) {
        usage('A slug must be lowercase letters, digits and hyphens, 3 to 40 characters: ' + base);
    }
    const { slug, suffixed } = freeSlug(base);

    /* Decided before the demo is written and reported afterwards, so the config and
       the issue comment cannot disagree about which currency was used or where it
       came from. */
    const chosenCurrency = chooseCurrency(options.currency, found, origin);

    /* build-demo.sh owns the copy and the identity substitution. It refuses to
       overwrite, which is why a free slug is chosen before calling it. */
    execFileSync('bash', [join(ROOT, 'factory', 'build-demo.sh'), slug, storeName], {
        cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit']
    });

    const dest = join(ROOT, 'demos', slug);

    /* Reported even when the download is off or fails, so the --json report and
       the issue comment always have a number rather than a hole. */
    let images = { downloaded: 0, failed: 0, skipped: 0, bytes: 0, compressor: 'off' };
    let stock = { filled: 0, failed: 0, skipped: 0, reason: 'off' };

    try {
        const configPath = join(dest, 'demo.config.json');
        const config = JSON.parse(readFileSync(configPath, 'utf8'));

        config.sourceUrl = origin;
        config.createdAt = isoDate(0);
        config.expiresAt = isoDate(DEMO_DAYS);
        config.theme = extracted.theme;
        config.locale = currencyBlock(chosenCurrency.code);
        config.categories = found.categories;
        config.productCount = found.products.length;
        /* THE DEMO ITSELF RECORDS WHERE ITS CATALOGUE CAME FROM. An issue comment is
           read once and scrolls away; this travels with the demo for its whole 90
           days, so the question "were these real products" always has an answer at
           the address rather than in a thread. */
        config.catalogueSource = found.tier === 'generated' ? 'generated' : 'store';
        /* displayName is always the Dengage demo name and never the prospect's
           (non-negotiable 3), so build-demo.sh's value is left exactly as it is. */
        writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

        /* REAL PRODUCT IMAGES, before products.json is written, because the
           download rewrites each product's image to the committed relative path
           (demos/<slug>/images/, the location the guard's image-locations check
           expects). It is allowed to fail without costing the demo: a product
           whose image did not arrive keeps its drawn artwork, which is the same
           page every demo shipped before 8 August 2026. */
        if (!options['no-images']) {
            try {
                images = await downloadImages(found.products, join(dest, 'images'));
                console.error('Images: ' + images.downloaded + ' downloaded, ' +
                              images.failed + ' failed, ' + images.skipped +
                              ' skipped, via ' + images.compressor);
            } catch (err) {
                console.error('Images: none downloaded (' + err.message +
                              '). Every tile draws artwork instead.');
            }

            /* STOCK PHOTOGRAPHS FILL WHAT THE STORE DID NOT, and only that.
               Salil's instruction, 8 August 2026: fallback only. The module
               refuses to touch a tile that carries a real photograph, does
               nothing at all without an UNSPLASH_ACCESS_KEY in the environment,
               and hands every file it picks to the same downloader the real
               photographs went through. --no-stock turns it off for one run. */
            if (!options['no-stock']) {
                try {
                    const { stockImages } = await import('./scrape/stock.mjs');
                    stock = await stockImages(found.products, join(dest, 'images'));
                    if (stock.filled || stock.reason !== 'no-key') {
                        console.error('Stock: ' + stock.filled + ' filled from Unsplash' +
                                      (stock.reason ? ' (' + stock.reason + ')' : ''));
                    }
                } catch (err) {
                    console.error('Stock: none (' + err.message + ')');
                }
            }
        }

        /* Whatever happened above, products.json must never carry an absolute
           third party URL: it is committed and published, and the smoke test
           hunts hotlinks. */
        stripImageUrls(found.products);

        writeFileSync(join(dest, 'products.json'),
            JSON.stringify({ products: found.products }, null, 2) + '\n');

        const href = fontLink(extracted.theme.displayFont, extracted.theme.bodyFont);
        rewriteFontLink(join(dest, 'index.html'), href);
        rewriteFontLink(join(dest, 'product.html'), href);

        /* THE EMAIL SET. Built from the config and products.json just written, so it
           carries this demo's own palette, typography, catalogue and currency.

           Two files per journey: the panel file with live {%= %} tags and $from
           queries to paste into the Dengage Code Editor, and a resolved preview so
           the set can be shown on a call without a send. Plus the AMP variant of
           the cart message for the panel's AMP tab.

           It is not allowed to fail the build. A demo with no email set is still a
           working demo, and losing one over a template that can be rebuilt with one
           command afterwards would be the wrong trade. */
        try {
            const { buildEmails } = await import('./emails/build-emails.mjs');
            const emails = buildEmails(slug);
            console.error('Emails: ' + emails.count + ' journeys, ' + emails.amp +
                ' AMP, themed on ' + emails.palette.brand +
                (emails.palette.dark ? ' (dark)' : ''));
        } catch (err) {
            console.error('Emails: none (' + err.message + ')');
            console.error('Run this afterwards:  node factory/emails/build-emails.mjs --slug ' + slug);
        }

        /* THE BEEFREE TEMPLATE, IN ITS OWN STEP, AND THAT IS THE WHOLE REASON IT IS
           HERE TWICE. buildEmails calls it too, but buildEmails is allowed to fail and
           currently does on the journeys that still ask an event table for a product
           name. Inside that try block, one broken journey would take the template with
           it and a new demo would arrive with nothing to upload. This is the one
           deliverable a salesperson opens the Email Builder for. */
        try {
            const { buildBeefree } = await import('./emails/build-beefree.mjs');
            const beefree = buildBeefree(slug);
            console.error('Email Builder: template for ' + beefree.rows + ' rows, ' +
                (beefree.resolved ? 'snippet ids applied'
                                  : 'Dynamic Content left for the panel to attach'));
        } catch (err) {
            console.error('Email Builder: none (' + err.message + ')');
            console.error('Run this afterwards:  node factory/emails/build-beefree.mjs --slug ' + slug);
        }

        /* THE SHORT FORM CONTENT PACK, for the five channels that are not email.
           Same shape as the email set: panel copy with live tags, a preview deck for
           the call, and every field measured against the limit that applies. It
           reports anything over rather than writing it silently, and like the email
           set it is not allowed to fail the build. */
        try {
            const { buildMessages } = await import('./messages/build-messages.mjs');
            const pack = buildMessages(slug);
            console.error('Messages: ' + pack.messages + ' across ' + pack.journeys +
                ' journeys' + (pack.problems.length
                    ? ', ' + pack.problems.length + ' OVER LIMIT' : ', all within limits'));
            for (const problem of pack.problems) {
                console.error('   over: ' + problem.journey + ' / ' + problem.channel +
                    ' / ' + problem.field + ' ' + problem.cost + ' of ' + problem.max);
            }
        } catch (err) {
            console.error('Messages: none (' + err.message + ')');
            console.error('Run this afterwards:  node factory/messages/build-messages.mjs --slug ' + slug);
        }

        /* THE MOTIF PASS AND THE FEED, in that order, because the feed reads what
           the motif pass writes.

           The motif pass runs a browser, which is the only way to ask the real
           classifier in template/js/artwork.js rather than reimplementing it. It
           annotates this demo's products.json with the motif each product draws, so
           the feed can point Dengage at the same silhouette the page renders.

           Neither is allowed to fail the build. A demo with no feed row is still a
           demo: the storefront works, every widget fires, and only the Dengage
           rendered recommendation surfaces are affected. Losing a working demo over
           a catalogue file that can be rebuilt with one command afterwards would be
           the wrong trade. Both say so loudly instead. */
        try {
            execFileSync('node', [join(ROOT, 'factory', 'make-motif-images.mjs'), '--slug', slug],
                { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'] });
            execFileSync('node', [join(ROOT, 'factory', 'build-feed.mjs')],
                { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'] });
        } catch (err) {
            console.error('\nThe demo is built, but the product feed was not updated: ' +
                err.message);
            console.error('Run this afterwards:  node factory/make-motif-images.mjs && ' +
                'node factory/build-feed.mjs\n');
        }
    } catch (err) {
        /* A half written demo folder is worse than none: it would publish, and it
           would look like a build that worked. */
        rmSync(dest, { recursive: true, force: true });
        console.error('Could not finish the demo: ' + err.message);
        report(options.json, {
            /* THIS MESSAGE IS PUBLISHED, so it says what happened and what comes
               next, and nothing about where the fault sits. It used to end "This one
               is ours to fix", which is true, useless to the reader, and permanent
               on a public Issues tab. The detail below still carries the real error
               to the run log, where whoever is fixing it is already looking. */
            ok: false, url: origin, stage: 'build', slug,
            reason: 'build', message: 'We read this store but could not finish building the demo.',
            nextStep: 'The factory picks this up from here. Comment "retry" if you want ' +
                      'to run it again in the meantime.',
            detail: err.message
        });
        process.exit(1);
    }

    const liveUrl = 'https://dengage-presales.github.io/demo-ai/demos/' + slug + '/';
    console.error('Built demos/' + slug);

    report(options.json, {
        ok: true,
        url: origin,
        slug,
        suffixed,
        liveUrl,
        tier: found.tier,
        vertical: found.vertical,
        productCount: found.products.length,
        cap: PRODUCT_CAP,
        images: {
            downloaded: images.downloaded,
            failed: images.failed,
            skipped: images.skipped,
            stock: stock.filled
        },
        categories: found.categories,
        currency: config_currency(dest),
        currencySource: chosenCurrency.source,
        storeName,
        theme: extracted.theme,
        themeFound: extracted.found,
        /* On a success too, not only a failure. When the generated fallback ships,
           the demo builds fine and the report used to say nothing about WHY every
           real tier came back empty, so the person asking "why did this store need
           a stand in catalogue" had to re-run the generator to find out. The
           attempts are the answer to that question and they are already computed. */
        attempts: found.attempts,
        createdAt: isoDate(0),
        expiresAt: isoDate(DEMO_DAYS)
    });
    console.log(liveUrl);
}

function config_currency(dest) {
    return JSON.parse(readFileSync(join(dest, 'demo.config.json'), 'utf8')).locale.currency;
}

/* ONLY WHEN RUN AS A SCRIPT. Without this guard, importing anything from here
   runs the whole pipeline: the first test that wanted slugFromUrl got the usage
   message and a non-zero exit instead. A module that cannot be imported cannot be
   tested, and the parts of this file most worth testing are the pure ones. */
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((err) => {
        console.error(err && err.stack ? err.stack : String(err));
        process.exit(1);
    });
}
