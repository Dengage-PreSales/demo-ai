/* ============================================================================
   The short form Dynamic Content assets: the ones SMS and web push consume.

     node factory/build-snippets.mjs             write them
     node factory/build-snippets.mjs --check     fail if a committed one is stale
     node factory/build-snippets.mjs --preview    resolve everything against a real demo

   WHAT AN SMS OR A PUSH ACTUALLY NEEDS, which is less than an email needs and in a
   different shape. An email is one paste of raw HTML that carries its own query, so a
   scenario email needs nothing in the panel. Neither SMS nor push has anywhere to put a
   query: an SMS Message field counts every character of one against 450, and a push Title
   is a title. Both take a **reference to a saved asset**, which is why these exist.

   SO THE DIVISION IS: THE ASSET CARRIES THE DATA, THE MESSAGE FIELD CARRIES THE WORDS.
   An asset emits one value and no sentence around it. "Still in your basket: " is typed
   into the field, because only the field knows which channel it is and a comma after a
   phrase belongs to the sentence rather than to the data. Salil, 10 August 2026, asking
   for this to be clean and understandable: a phrase per table and the wording in the
   panel is the smallest thing that is both.

   WHY PER TABLE AND NOT PER SCENARIO. Seven scenarios, five tables. Checkout rescue and
   basket building both read the cart; browse abandonment and win-back both read page
   views. One asset per scenario would mean twenty one objects to create in the panel and
   three copies of the cart replay. factory/emails/folds.mjs holds one fold per table and
   the scenario emails use the same five, so a correction lands in one place.

   THE FOUR SHAPES, and every asset here is one of them:

     line    Oxford Shirt and 3 more items
     image   https://.../demos/<slug>/images/push/p2.jpg, the 1200x600 banner
     term    waterproof jacket, the words somebody typed
     url     https://.../demos/<slug>/index.html?open=checkout

   ONE OUTPUT TAG EACH, AND NO TRAILING NEWLINE, which is a real constraint rather than
   tidiness. The first version of the line asset assembled its phrase across five tags on
   five physical lines, so its output opened and closed with a newline: invisible in an SMS
   body, and not invisible in an email preheader, where a comma follows the snippet and
   `Oxford Shirt and 3 more items , one press from checkout.` is the first thing a
   recipient sees. So the value is computed inside the block and emitted once.

   THE ABANDONED CART IS THE EXCEPTION, DELIBERATELY. Three hand written assets cover it
   already, they are live in the panel with their ids in factory/sandbox.json, and it is
   the one flow confirmed working end to end in all three channels. Re-pasting them to
   gain nothing a recipient can see is churn on the only thing that works. So this writes
   eleven files and those three are not among them. What stops them drifting apart is
   factory/snippets.test.mjs: it builds the cart pair from this source in memory and
   asserts the output matches the live files on the same event log, so a change to the
   resolution block that would have left the cart behind fails a test rather than a call.

   AND THE MESSAGES THEMSELVES ARE HERE TOO, in MESSAGES: the seven SMS bodies and the
   seven push messages, composed from these assets. Wording in a document cannot be
   resolved, so nobody finds out that a body overruns 450 characters once its tags expand
   or that a phrase reads badly after a real product name. --preview renders every one of
   them against a committed demo's catalogue, which is the SMS and push equivalent of the
   .preview.html beside each scenario email. factory/panel/SMS-AND-PUSH.md is the same
   thing for a human to follow, and the test holds the two together.
   ========================================================================== */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoWithProducts, asProductRows, ORIGIN } from './catalogue.mjs';
import { resolveBlock } from './emails/resolve.mjs';
import { FOLDS } from './emails/folds.mjs';
import { render, arrayFrom } from './emails/dengage-template.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'factory', 'panel', 'content', '_dynamic');

/* HOW MANY PRODUCTS TO RESOLVE. Twenty, and the same number for both limits: an email
   looks up more than it shows because it renders a grid, and none of these renders
   anything. A line needs the newest name and a count of the rest, so `show` would only
   ever cut the count short. */
const CAP = 20;

/* THE NAME LENGTH, AND 48 IS NOT ARBITRARY. It is what the live abandoned cart asset
   uses, and matching it is what makes the equivalence check in snippets.test.mjs possible.
   It also happens to be the right answer for these channels: a push title truncates at
   about forty characters on Android and an SMS pays for every one. */
const NAME = 48;

/* -------------------------------------------------------------------------- */
/* The four shapes. Each returns the tail of the block and the name of the one value      */
/* the asset emits, so the caller can write `%}{%= <value> %}` and nothing else.          */

/* THE PHRASE. One shape for every table, with only the fallback changing, and that is
   worth keeping: the same wording appears in five channels, so a phrase that reads
   differently per table would read differently per channel too.

   THE COUNT IS OF ACTIVE PRODUCTS, not of rows. `cards` is already what survived the
   catalogue: a product withdrawn since the visit is not in it, so "and 3 more items"
   cannot promise something that is no longer buyable. */
function lineShape(fallback) {
    return {
        value: 'line',
        tail: [
            'var name = cards.length ? clamp(cards[0].row.title, ' + NAME + ') : "";',
            'var count = cards.length;',
            'var line = ' + JSON.stringify(fallback) + ';',
            'if (name !== "") {',
            '  line = name;',
            '  if (count > 2) { line = line + " and " + (count - 1) + " more items"; }',
            '  else if (count === 2) { line = line + " and 1 more item"; }',
            '}'
        ]
    };
}

/* THE PICTURE, AS THE 2:1 BANNER RATHER THAN THE PRODUCT TILE. The push editor's Media
   band is 2:1, a studio product shot is whatever aspect the prospect used and is mostly
   background, and fitting the file fits its whitespace too. factory/make-push-images.mjs
   writes a trimmed 1200x600 crop beside every committed photograph and
   factory/push-images.test.mjs fails a build that commits one without.

   IT FALLS BACK TO THE PHOTOGRAPH, and only then. `card.banner` is empty when the address
   is not where a banner would be, which is a real case for a catalogue whose images came
   from somewhere unexpected, and a smaller picture beats no picture.

   AN `http` PHOTOGRAPH IS SKIPPED ENTIRELY. card.image is already https-only, so a mixed
   content address arrives as "" and the loop moves to the next product rather than handing
   the browser something it will refuse to show. */
function imageShape() {
    return {
        value: 'image',
        tail: [
            'var image = "";',
            'for (var i = 0; cards.length > i; i++) {',
            '  if (cards[i].image === "") { continue; }',
            '  image = cards[i].banner !== "" ? cards[i].banner : cards[i].image;',
            '  break;',
            '}'
        ]
    };
}

/* THE WORDS SOMEBODY TYPED, which is the one asset that resolves text rather than a
   catalogue. It carries its own fallback for the same reason the line does: a field
   reading "Still looking for ?" is worse than one reading a general phrase. */
function termShape() {
    return {
        value: 'line',
        tail: [
            'var words = clamp(ctx.term, ' + NAME + ');',
            'var line = words !== "" ? words : "something you searched for";'
        ]
    };
}

/* THE ADDRESS OF ONE OVERLAY ON ONE DEMO, and it reads page_view_events rather than the
   scenario's own table on purpose. Every page of every demo fires pageView, so page views
   are the widest possible evidence of which demo a contact used: a contact who searched
   and never added anything to a basket still has them. CLAUDE.md section 1b.

   EMPTY WHEN NO DEMO RESOLVED, and that is deliberate rather than a gap. There is no
   address that is correct for every demo, and a push that lands on another prospect's
   storefront is worse on a call than a push nobody sent. */
function urlShape(suffix) {
    return {
        value: 'link',
        /* NO FOLD, AND THAT IS WHAT `stop` MEANS. A fold turns event rows into product
           ids, and there is no product in an address. So a url asset declares the table it
           reads rather than a fold, and the block returns as soon as the demo is known. */
        stop: 'root',
        tail: [
            'var link = root !== "" ? root + ' + JSON.stringify(suffix) + ' : "";',
            "if (link.indexOf('https://') !== 0) { link = \"\"; }"
        ]
    };
}

/* -------------------------------------------------------------------------- */

/* Everything written to disk, and the two that are not. `panel` is what to call the asset
   when creating it; `scenarios` is what reads it, which is what the panel document turns
   into its own tables. */
export const SNIPPETS = [
    {
        file: 'view-line.txt', panel: 'dps view line', fold: 'view',
        shape: lineShape('the things you were looking at'),
        emits: 'Oxford Shirt and 3 more items',
        scenarios: ['browse', 'winback']
    },
    {
        file: 'view-image.txt', panel: 'dps view image', fold: 'view',
        shape: imageShape(),
        emits: 'the newest viewed product, as a 1200x600 banner',
        scenarios: ['browse', 'winback']
    },
    {
        file: 'saved-line.txt', panel: 'dps saved line', fold: 'saved',
        shape: lineShape('the items you saved for later'),
        emits: 'Oxford Shirt and 3 more items',
        scenarios: ['wishlist']
    },
    {
        file: 'saved-image.txt', panel: 'dps saved image', fold: 'saved',
        shape: imageShape(),
        emits: 'the newest saved product, as a 1200x600 banner',
        scenarios: ['wishlist']
    },
    {
        file: 'order-line.txt', panel: 'dps order line', fold: 'order',
        shape: lineShape('what you ordered last time'),
        emits: 'Oxford Shirt and 2 more items',
        scenarios: ['replenish']
    },
    {
        file: 'order-image.txt', panel: 'dps order image', fold: 'order',
        shape: imageShape(),
        emits: 'a product from the newest order, as a 1200x600 banner',
        scenarios: ['replenish']
    },
    {
        file: 'search-term.txt', panel: 'dps search term', fold: 'search',
        shape: termShape(),
        emits: 'waterproof jacket',
        scenarios: ['search']
    },
    {
        file: 'url-home.txt', panel: 'dps url home', table: 'page_view_events',
        shape: urlShape('index.html'),
        emits: 'https://dengage-presales.github.io/demo-ai/demos/<slug>/index.html',
        scenarios: ['browse', 'replenish', 'winback']
    },
    {
        file: 'url-checkout.txt', panel: 'dps url checkout', table: 'page_view_events',
        shape: urlShape('index.html?open=checkout'),
        emits: 'https://dengage-presales.github.io/demo-ai/demos/<slug>/index.html?open=checkout',
        scenarios: ['checkout']
    },
    {
        file: 'url-wishlist.txt', panel: 'dps url wishlist', table: 'page_view_events',
        shape: urlShape('index.html?open=wishlist'),
        emits: 'https://dengage-presales.github.io/demo-ai/demos/<slug>/index.html?open=wishlist',
        scenarios: ['wishlist']
    },
    {
        file: 'url-search.txt', panel: 'dps url search', table: 'page_view_events',
        shape: urlShape('index.html?open=search'),
        emits: 'https://dengage-presales.github.io/demo-ai/demos/<slug>/index.html?open=search',
        scenarios: ['search']
    }
];

/* THE THREE THAT ARE ALREADY LIVE, hand written, and not regenerated. See the header for
   why: the abandoned cart is the one flow confirmed working end to end in all three
   channels, its ids are in factory/sandbox.json, and re-pasting a live asset to gain
   nothing a recipient can see is churn on the only thing that works.

   TWO OF THE THREE CARRY A SHAPE, which is what makes the drift alarm possible: snippets
   test builds them from this source, runs both against the same event log and requires the
   same output. THE FALLBACK PHRASE AND THE NAME LENGTH MATCH THE LIVE FILES EXACTLY, and
   both are load bearing for that proof rather than a style choice.

   THE URL ASSET HAS NO SHAPE HERE, because the live one reads shopping_cart_events and the
   generated url assets read page_view_events. That is a real difference rather than drift:
   page views are the wider evidence, since every page of every demo fires pageView. It
   makes no difference to a basket triggered campaign, which has cart rows by definition. */
export const LIVE = [
    {
        file: 'abandoned-cart.txt', panel: 'dps abandoned cart line', fold: 'cart',
        shape: lineShape('the items you saved'),
        emits: 'Oxford Shirt and 3 more items'
    },
    {
        file: 'abandoned-cart-image.txt', panel: 'dps abandoned cart image', fold: 'cart',
        shape: imageShape(),
        emits: 'the newest basket product, as a 1200x600 banner'
    },
    {
        file: 'abandoned-cart-url.txt', panel: 'dps abandoned cart url',
        emits: 'https://dengage-presales.github.io/demo-ai/demos/<slug>/index.html?open=cart'
    }
];

/* The two of them this source can build, which is what the drift alarm compares. */
export const CART_EQUIVALENTS = LIVE.filter((asset) => asset.shape);

/* Every asset either builder or the panel document may name, by file. */
export const ALL = SNIPPETS.concat(LIVE);
export function assetOf(file) {
    const found = ALL.filter((asset) => asset.file === file)[0];
    if (!found) throw new Error('build-snippets: no asset called ' + file);
    return found;
}

/* -------------------------------------------------------------------------- */
/* The messages themselves, which are the thing somebody actually types into the panel.    */

/* WHY THE WORDING LIVES HERE AND NOT ONLY IN THE DOCUMENT. A composition written only in
   prose cannot be resolved, so nobody finds out that a phrase reads badly, that a body
   overruns 450 characters once its tags expand, or that it references an asset that was
   renamed. `--preview` renders every one of these against a real demo's catalogue and
   snippets.test.mjs measures them, which is the same reason each scenario email has a
   .preview.html beside it.

   THE PHRASE ALWAYS FOLLOWS A COLON OR A QUESTION MARK, and that is a grammar decision
   rather than a style one. "Oxford Shirt and 3 more items are waiting" reads correctly and
   "Oxford Shirt are waiting" does not, so no sentence here puts a verb after the snippet.
   One item and nine items have to read equally well, and only the recipient knows which
   they are.

   NOTHING WITH $Contact IN IT. A demo sets the contact key and no attributes, so every
   other contact field is empty for every contact a demo creates, and a name in a message
   renders as "Hi ," on a call. What a demo genuinely has is behaviour, which is what all of
   these use. */
/* `name` IS WHAT TO CALL THE MESSAGE IN THE PANEL, and it is the SAME name the scenario
   email uses. Three channels under one name is what lets somebody building a campaign find
   all three of a scenario's messages together, and factory/snippets.test.mjs holds the two
   documents to it. `journey` is the longer description the email set uses for the same
   scenario, kept so the two can be lined up. */
const A = (file) => ({ asset: file });

export const MESSAGES = [
    {
        id: 'checkout', journey: 'Checkout rescue',
        name: 'DPS - Checkout rescue',
        sms: ['Still in your basket: ', A('abandoned-cart.txt'),
              '. Finish checkout: ', A('url-checkout.txt')],
        alternate: 'Your basket is still saved. Finish checkout whenever you are ready.',
        push: {
            title: 'You were one step away',
            message: ['Still in your basket: ', A('abandoned-cart.txt')],
            media: A('abandoned-cart-image.txt'),
            url: A('url-checkout.txt')
        }
    },
    {
        id: 'browse', journey: 'Browse abandonment',
        name: 'DPS - Browse abandonment',
        sms: ['Still thinking about it? ', A('view-line.txt'),
              '. Take another look: ', A('url-home.txt')],
        alternate: 'The things you were looking at are still here.',
        push: {
            title: 'Still thinking about it?',
            message: ['You were looking at: ', A('view-line.txt')],
            media: A('view-image.txt'),
            url: A('url-home.txt')
        }
    },
    {
        id: 'search', journey: 'Failed search recovery',
        name: 'DPS - Failed search',
        sms: ['Still looking for ', A('search-term.txt'),
              '? Search again here: ', A('url-search.txt')],
        alternate: 'Search again and we will help you find it.',
        /* THE ONE WITH NO PICTURE, and it is a Standard notification rather than a Rich
           one. A failed search resolved no product, so there is nothing honest to show:
           padding it with a popular product under a personal headline is the mistake the
           search email refuses to make in its own copy. */
        push: {
            title: 'Still looking?',
            message: ['Your search: ', A('search-term.txt')],
            media: null,
            url: A('url-search.txt')
        }
    },
    {
        id: 'wishlist', journey: 'Wishlist triggers',
        name: 'DPS - Wishlist',
        sms: ['Still saved for you: ', A('saved-line.txt'),
              '. Open your list: ', A('url-wishlist.txt')],
        alternate: 'Your saved items are waiting whenever you want them.',
        push: {
            title: 'Something you saved',
            message: ['Still saved for you: ', A('saved-line.txt')],
            media: A('saved-image.txt'),
            url: A('url-wishlist.txt')
        }
    },
    {
        id: 'basket', journey: 'Basket building',
        name: 'DPS - Basket building',
        /* IT NAMES THE BASKET RATHER THAN THE PAIRING, and that is deliberate. The email
           queries the catalogue by the basket's own categories to offer what is not in it
           yet, which is a grid, and a text message has nowhere to put a grid. What a text
           can do honestly is name what they chose and take them to it, and the storefront's
           own recommendation rail does the pairing on arrival. */
        sms: ['In your basket: ', A('abandoned-cart.txt'),
              '. See what goes with it: ', A('abandoned-cart-url.txt')],
        alternate: 'A few things pair well with what is in your basket.',
        push: {
            title: 'Goes with what you picked',
            message: ['In your basket: ', A('abandoned-cart.txt')],
            media: A('abandoned-cart-image.txt'),
            url: A('abandoned-cart-url.txt')
        }
    },
    {
        id: 'replenish', journey: 'Replenishment',
        name: 'DPS - Replenishment',
        /* NOTHING ABOUT TIMING, in any channel. A replenishment message usually claims you
           are about to run out, which needs a consumption rate nothing here has. What is
           true is what was bought and that reordering is one press. The campaign's own
           trigger owns the timing. */
        sms: ['Order it again in one press: ', A('order-line.txt'), '. ', A('url-home.txt')],
        alternate: 'What you bought last time is ready to reorder.',
        push: {
            title: 'Order it again',
            message: ['Last time you bought: ', A('order-line.txt')],
            media: A('order-image.txt'),
            url: A('url-home.txt')
        }
    },
    {
        id: 'winback', journey: 'Win-back',
        name: 'DPS - Win-back',
        /* THE SAME TWO ASSETS AS BROWSE ABANDONMENT, and saying so is better than
           inventing a difference. What makes a message a win-back is the trigger, which is
           how long it has been, and the email says the same thing about itself: an email
           that restates its trigger's threshold goes wrong the day the threshold changes.
           So the wording differs and the data does not. */
        sms: ['New in since you were last here: ', A('view-line.txt'),
              '. Take a look: ', A('url-home.txt')],
        alternate: 'There is new stock in the range since you were last here.',
        push: {
            title: 'Worth another look',
            message: ['Still here: ', A('view-line.txt')],
            media: A('view-image.txt'),
            url: A('url-home.txt')
        }
    }
];

/* THE FIELD LIMIT THE PANEL ENFORCES, and it enforces it on the RESOLVED length rather
   than on the tag's. The editor says so beside Alternate Message: a message whose tags
   expand past the limit is not delivered and the alternate is sent instead. So the
   alternate wants to be a usable version of the same message rather than a footer. */
export const SMS_LIMIT = 450;

/* One composition into the text a send would carry, given each asset's resolved value. */
export function compose(parts, resolved) {
    const list = Array.isArray(parts) ? parts : [parts];
    return list.map((part) => {
        if (part === null || part === undefined) return '';
        if (typeof part === 'string') return part;
        if (!(part.asset in resolved)) throw new Error('nothing resolved for ' + part.asset);
        return resolved[part.asset];
    }).join('');
}

/* Every asset a composition refers to, so a rename cannot leave a message pointing at
   nothing and so the panel document can list what each scenario needs. */
export function assetsUsedBy(message) {
    const seen = [];
    const walk = (parts) => {
        for (const part of (Array.isArray(parts) ? parts : [parts])) {
            if (part && typeof part === 'object' && part.asset && seen.indexOf(part.asset) === -1) {
                seen.push(part.asset);
            }
        }
    };
    walk(message.sms);
    walk(message.push.message);
    walk(message.push.media);
    walk(message.push.url);
    return seen;
}

/* -------------------------------------------------------------------------- */

/* EITHER A FOLD OR A TABLE, never both. A fold names one of the five in folds.mjs and
   brings its table with it; a url asset has no fold to run, so it names the table itself.
   Anything else is a snippet that has not decided what it reads. */
export function tableOf(snippet) {
    if (snippet.fold) {
        const fold = FOLDS[snippet.fold];
        if (!fold) throw new Error('build-snippets: no fold named ' + snippet.fold);
        return fold.table;
    }
    if (!snippet.table) {
        throw new Error('build-snippets: ' + snippet.file + ' names neither a fold nor a table');
    }
    return snippet.table;
}

export function snippetSource(snippet) {
    const shape = snippet.shape;
    const table = tableOf(snippet);

    const block = shape.stop === 'root'
        ? resolveBlock({ table, stop: 'root' })
        : resolveBlock({ table, fold: FOLDS[snippet.fold].fold, cap: CAP, show: CAP });

    const tail = shape.tail.map((l) => (l === '' ? '' : '  ' + l)).join('\n');
    /* NO NEWLINE AFTER THE OUTPUT TAG. A file that ends with one emits it, and the header
       says what that costs in an email preheader. The live assets end the same way and
       snippets.test.mjs asserts the last byte of every one of these. */
    return '{%\n' + block + '\n' + tail + '\n%}{%= ' + shape.value + ' %}';
}

/* -------------------------------------------------------------------------- */
/* Resolving every asset against a real demo, which is what --preview prints                */

/* ONE EVENT LOG PER TABLE, not per scenario, because these assets are per table. Synthetic,
   and it says so: these are not rows from Dengage, they are the smallest history that makes
   each table resolve, so a preview shows what a real send would say rather than an empty
   field. Every timestamp is fixed so two runs print the same thing.

   THE HOME PAGE VIEW COMES FIRST AND IS NOT OPTIONAL. The slug lives in page_url and
   nowhere else, so a log with no page view resolves no demo, every address comes out empty
   and the preview would be a preview of the degraded case. CLAUDE.md section 1b. */
export function previewLog(slug, cat) {
    const base = ORIGIN + 'demos/' + slug + '/';
    const withImage = cat.filter((p) => p.image_link);
    const pick = (withImage.length >= 4 ? withImage : cat).slice(0, 4);
    const at = (n) => '2026-08-10T10:0' + n + ':00Z';

    return {
        master_device: [{ device_id: 'preview-device', contact_key: 'DPS-1' }],
        dps_product: cat,
        page_view_events: [{
            key: 'preview-device', session_id: 'preview-session',
            event_date: '2026-08-10T09:00:00Z', page_url: base + 'index.html',
            page_title: 'Home', product_id: null, category_path: '', price: null
        }].concat(pick.map((p, i) => ({
            key: 'preview-device', session_id: 'preview-session',
            event_date: '2026-08-10T09:0' + (i + 1) + ':00Z', page_url: p.link,
            page_title: p.title, product_id: p.product_id,
            category_path: p.category_path, price: p.price
        }))),
        shopping_cart_events: pick.map((p, i) => ({
            id: 100 + i, key: 'preview-device', session_id: 'preview-session',
            event_date: at(i), event_type: 'add_to_cart', product_id: p.product_id,
            quantity: i === 1 ? 2 : 1, unit_price: p.price, discounted_price: p.discounted_price
        })),
        wishlist_events: pick.map((p, i) => ({
            event_id: 'w' + i, key: 'preview-device', session_id: 'preview-session',
            event_date: at(i), event_type: 'add', product_id: p.product_id,
            list_name: 'favorites', price: p.price, discounted_price: null
        })),
        search_events: [{
            key: 'preview-device', session_id: 'preview-session',
            event_date: at(0), keywords: 'wireless mouse', result_count: 0, filters: null
        }],
        order_events_detail: pick.slice(0, 3).map((p, i) => ({
            key: 'preview-device', session_id: 'preview-session', event_date: at(0),
            order_id: 'DPS-ORDER-4471', product_id: p.product_id,
            quantity: i === 0 ? 2 : 1, unit_price: p.price,
            discounted_price: null, event_type: 'order'
        }))
    };
}

/* Every asset's own output, from the committed file where there is one and from this source
   otherwise. THE COMMITTED FILE IS PREFERRED ON PURPOSE for the three live assets: they are
   what the panel holds, so a preview built from anything else would be a preview of
   something nobody has pasted. */
export function resolveAll(tables) {
    const $from = arrayFrom(tables);
    const $Contact = { contact_key: 'DPS-1' };
    const resolved = {};
    for (const asset of ALL) {
        const path = join(OUT, asset.file);
        const source = existsSync(path) ? readFileSync(path, 'utf8') : snippetSource(asset);
        resolved[asset.file] = render(source, { $from, $Contact });
    }
    return resolved;
}

/* -------------------------------------------------------------------------- */

const INVOKED = process.argv[1] &&
    join(process.argv[1]) === join(fileURLToPath(import.meta.url));

if (INVOKED) {
    const check = process.argv.includes('--check');
    const preview = process.argv.includes('--preview');
    const pad = (v, n) => String(v).padEnd(n);

    /* --preview WRITES NOTHING. It resolves every asset and every composed message against
       a committed demo's real catalogue and prints them, which is the SMS and push
       equivalent of the .preview.html beside each scenario email. It is the answer to "what
       will this actually say" without pasting anything into the panel.

       IT IS STILL NOT A SEND. Dengage owns the real engine and the real rows, and an HTTP
       200 from the event endpoint means accepted rather than stored. What this proves is
       that the query compiles, the fold resolves, the phrase reads and the body fits. */
    if (preview) {
        const demo = demoWithProducts();
        if (!demo) {
            console.error('No demo with products to resolve against. Build a demo first.');
            process.exit(1);
        }
        const cat = asProductRows(demo.slug, demo.list);
        const resolved = resolveAll(previewLog(demo.slug, cat));

        console.log('Resolved against ' + demo.slug + ', ' + cat.length + ' products.\n');
        console.log('  Every asset, and what it emits:\n');
        for (const asset of ALL) {
            console.log('  ' + pad(asset.file, 26) + resolved[asset.file]);
        }

        console.log('\n  The SMS body per scenario, against the ' + SMS_LIMIT +
                    ' character field:\n');
        for (const message of MESSAGES) {
            const body = compose(message.sms, resolved);
            const room = SMS_LIMIT - body.length;
            console.log('  ' + pad(message.id, 11) + pad(body.length + ' chars', 11) +
                        (room >= 0 ? pad(room + ' spare', 12) : 'OVER by ' + -room) + body);
        }

        console.log('\n  The web push per scenario:\n');
        for (const message of MESSAGES) {
            const media = compose(message.push.media, resolved);
            console.log('  ' + message.id);
            console.log('    Title    ' + message.push.title);
            console.log('    Message  ' + compose(message.push.message, resolved));
            console.log('    Media    ' + (media === ''
                ? '(none, so a Standard notification rather than Rich)' : media));
            console.log('    Open     ' + compose(message.push.url, resolved));
        }
        process.exit(0);
    }

    mkdirSync(OUT, { recursive: true });

    const stale = [];
    const report = [];
    for (const snippet of SNIPPETS) {
        const source = snippetSource(snippet);
        const path = join(OUT, snippet.file);
        const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
        if (check) {
            if (current !== source) stale.push(snippet.file);
        } else if (current !== source) {
            writeFileSync(path, source);
        }
        report.push({
            file: snippet.file, panel: snippet.panel, reads: tableOf(snippet),
            bytes: source.length, used: snippet.scenarios.join(', ')
        });
    }

    if (check) {
        if (stale.length) {
            console.error('These committed assets are not what the generator produces now:\n');
            for (const file of stale) console.error('  factory/panel/content/_dynamic/' + file);
            console.error('\nRun: node factory/build-snippets.mjs');
            process.exit(1);
        }
        console.log('All ' + SNIPPETS.length + ' short form assets are current.');
    } else {
        console.log('Short form assets, into factory/panel/content/_dynamic/\n');
        console.log('  ' + pad('file', 20) + pad('create it as', 24) +
                    pad('reads', 22) + pad('bytes', 7) + 'used by');
        for (const r of report) {
            console.log('  ' + pad(r.file, 20) + pad(r.panel, 24) +
                        pad(r.reads, 22) + pad(r.bytes, 7) + r.used);
        }
        console.log('\n  The three abandoned cart assets are not written here on purpose. ' +
                    'They are live in\n  the panel and factory/snippets.test.mjs holds this ' +
                    'source to the same output on\n  the same event log. ' +
                    'Run with --preview to see what every message actually says.');
    }
}
