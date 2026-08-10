/* ============================================================================
   Builds one demo's short form content pack.

     node factory/messages/build-messages.mjs --slug <slug>
     node factory/messages/build-messages.mjs --all

   Writes factory/panel/content/<slug>/messages/:
     index.html      a deck showing every message as it will appear, with its
                     measured length against the limit that applies, and a copy
                     button per channel that puts the panel copy on the clipboard
     messages.json   the same content as data, for pasting or for the content API

   NOT UNDER demos/, DELIBERATELY: pages.yml
   serves demos/ publicly, and a deck naming panel locations and listing character
   limits is setup material rather than something a prospect should be able to load.

   WHY A DECK RATHER THAN FILES. An email is a document, so a file is the natural
   unit. A push notification is a title and one line; an SMS is a sentence. Ten
   journeys across six channels is around thirty of those, and thirty files is
   thirty things to open on a call. One page that shows all of them, in the shape
   the recipient sees, is what a presales colleague actually needs, and the JSON
   beside it is what a marketer pastes from.

   EVERY LENGTH IS MEASURED, NOT EYEBALLED. channels.mjs holds the limits and
   where each one comes from. The build resolves the Dengage tags to a realistic
   worst case first, because measuring the template rejects copy that sends fine
   and measuring nothing ships a title that is cut in half for anyone with a long
   name. Anything over its limit is reported and marked on the deck rather than
   quietly written.
   ========================================================================== */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { emailPalette } from '../emails/palette.mjs';
import { CHANNELS, CHANNEL_ORDER, measure, resolved, smsCost, setAllowance } from './channels.mjs';
import { JOURNEY_COPY } from './copy.mjs';
import { sourceBox, copyScript } from '../panel/copy-console.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAGES = 'https://dengage-presales.github.io/demo-ai/demos/';

function money(locale, value) {
    if (typeof value !== 'number' || !isFinite(value)) return '';
    const symbol = (locale && locale.currencySymbol) || (locale && locale.currency) || '';
    const formatted = value.toLocaleString((locale && locale.numberLocale) || 'en-US',
        { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (symbol ? symbol + ' ' : '') + formatted;
}

function storeNameFrom(config, slug) {
    let host = '';
    try { host = new URL(config.sourceUrl).hostname; } catch (err) { host = ''; }
    const label = host.replace(/^www\./, '').split('.')[0] || String(slug).replace(/-/g, ' ');
    return label.charAt(0).toUpperCase() + label.slice(1);
}

function context(config, products, slug) {
    const base = PAGES + slug + '/';
    const locale = config.locale || {};
    const first = products[0] || {};
    return {
        storeUrl: base,
        storeName: storeNameFrom(config, slug),
        symbol: locale.currencySymbol || locale.currency || '',
        sampleFirstName: 'Alex',
        sampleProduct: first.name || 'that item',
        samplePrice: money(locale, typeof first.discountedPrice === 'number'
            ? first.discountedPrice : first.price),
        sampleCategory: first.category || 'that category',
        sampleQuery: first.name ? first.name.split(' ').slice(0, 3).join(' ') : 'that item',
        sampleImage: first.image ? base + first.image : base,
        products
    };
}

/* -------------------------------------------------------------------------- */
/* Rendering one journey for every channel it uses                             */

function render(mode, ctx) {
    const out = [];
    for (const entry of JOURNEY_COPY) {
        /* DROPPED PER JOURNEY, NOT PER PACK, and the granularity is the whole point.
           No table carries a product name, so the journeys whose copy names a product
           cannot be built (factory/phase0/SCHEMA.md). Letting that throw would take the
           twenty nine messages that are perfectly sendable down with the seven that are
           not. So the journey is dropped with its reason recorded, and the pack reports
           what is missing instead of quietly being smaller than it should be. */
        let channels;
        try {
            channels = entry.channels(mode, ctx);
        } catch (err) {
            if (!/no column for/.test(err.message)) throw err;
            out.push({ id: entry.id, journey: entry.journey, channels: {},
                       blocked: err.message });
            continue;
        }
        const rendered = {};
        for (const id of CHANNEL_ORDER) {
            if (!channels[id]) continue;
            const channel = CHANNELS[id];
            const content = channels[id];
            const checks = [];
            for (const field of Object.keys(channel.limits)) {
                const text = content[field] !== undefined ? content[field]
                    : (field === 'header' && content.headerText) ? content.headerText : null;
                if (typeof text !== 'string') continue;
                const result = measure(channel, field, text);
                if (result) checks.push(result);
            }
            /* Buttons are measured separately: the limit is per label, and on
               WhatsApp it is the one Dengage states rather than a client guess. */
            if (Array.isArray(content.buttons)) {
                const max = (channel.limits.buttonLabel || (channel.buttons && channel.buttons.label) || {}).max;
                for (const button of content.buttons) {
                    if (max === undefined) continue;
                    const cost = [...String(button.label)].length;
                    checks.push({ field: 'button "' + button.label + '"', cost, max,
                                  source: (channel.limits.buttonLabel || channel.buttons.label).source,
                                  over: cost > max, resolvedTo: button.label });
                }
            }
            rendered[id] = { ...content, checks };
        }
        out.push({ id: entry.id, journey: entry.journey, channels: rendered });
    }
    return out;
}

/* -------------------------------------------------------------------------- */
/* The deck                                                                    */

const esc = (text) => String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function counter(p, checks) {
    if (!checks.length) return '';
    const cells = checks.map((c) => `
            <span class="ct ${c.over ? 'over' : ''}" title="limit from: ${c.source}">
              ${esc(c.field)} <b>${c.cost}</b>/${c.max}</span>`).join('');
    return `<div class="counts">${cells}</div>`;
}

/* A browser notification, roughly as Chrome draws one. */
function pushCard(p, content, kind) {
    return `
        <div class="notif ${kind}">
          <div class="nicon" style="background:${p.brand}"></div>
          <div class="ntext">
            <div class="ntitle">${esc(content.title)}</div>
            <div class="nbody">${esc(content.body)}</div>
            <div class="nsrc">${kind === 'web' ? 'Chrome' : 'now'}${content.subtitle ? ' &middot; ' + esc(content.subtitle) : ''}</div>
          </div>
        </div>`;
}

function smsCard(p, content) {
    return `
        <div class="sms">
          <div class="sender">${esc(content.senderName)}</div>
          <div class="bubble">${esc(content.body)}</div>
        </div>`;
}

function whatsappCard(p, content) {
    const buttons = (content.buttons || []).map((b) => `
            <div class="wbtn">${b.type === 'Quick Reply' ? '' : '&#8599; '}${esc(b.label)}</div>`).join('');
    const carousel = content.carousel ? `
            <div class="wcarousel"><span>card 1</span><span>card 2</span><span>card 3</span></div>` : '';
    const coupon = content.coupon ? `
            <div class="wcoupon">Copy code &middot; WELCOME-4KJ9P</div>` : '';
    return `
        <div class="wa">
          <div class="wmeta"><span class="cat">${esc(content.category)}</span><span class="typ">${esc(content.messageType)}</span></div>
          <div class="wbubble">
            ${content.headerText ? `<div class="whead">${esc(content.headerText)}</div>` : ''}
            <div class="wbody">${esc(content.body)}</div>
            ${carousel}${coupon}
            ${content.footer ? `<div class="wfoot">${esc(content.footer)}</div>` : ''}
          </div>
          ${buttons}
        </div>`;
}

function inboxCard(p, content) {
    return `
        <div class="inbox">
          <div class="ithumb" style="background:${p.wash}"></div>
          <div class="itext">
            <div class="ititle">${esc(content.title)}</div>
            <div class="ibody">${esc(content.body)}</div>
            <div class="imeta">expires in ${content.expiryDays} day${content.expiryDays === 1 ? '' : 's'} &middot; priority ${content.priority}</div>
          </div>
        </div>`;
}

function onsiteCard(p, content) {
    return `
        <div class="onsite">
          <div class="otemplate">${esc(content.template)}</div>
          <div class="owidget">
            <div class="oheading">${esc(content.heading)}</div>
            <div class="obody">${esc(content.body)}</div>
            <div class="octa" style="background:${p.brand};color:${p.onBrand}">${esc(content.cta)}</div>
          </div>
          <div class="ogeneric">Stays generic: shared by every live demo</div>
        </div>`;
}

/* WHAT GOES ON THE CLIPBOARD IS THE PANEL COPY, NOT WHAT IS ON SCREEN, and the two
   are deliberately different. The card renders the preview, with a realistic name and
   product resolved in, because that is what reads properly on a call. The panel copy
   carries the live tags and is the thing that has to reach the content record. Copying
   what was on screen would paste a message that never personalises, and it would look
   completely correct.

   Fields are labelled, because a channel's content record has separate boxes for them:
   a push has a title and a body, WhatsApp has a header, a body and a footer. */
export function panelFields(id, content) {
    const channel = CHANNELS[id];
    const lines = [];
    for (const field of channel.fields) {
        const value = content[field];
        if (typeof value !== 'string' || !value) continue;
        lines.push(field + ': ' + value);
    }
    for (const button of (content.buttons || [])) {
        if (button && button.label) lines.push('button: ' + button.label);
    }
    return lines.join('\n');
}

function channelBlock(p, id, content, panelContent, key) {
    const channel = CHANNELS[id];
    const fields = panelContent ? panelFields(id, panelContent) : '';
    const body = id === 'webPush' ? pushCard(p, content, 'web')
        : id === 'mobilePush' ? pushCard(p, content, 'mob')
        : id === 'sms' ? smsCard(p, content)
        : id === 'whatsapp' ? whatsappCard(p, content)
        : id === 'inbox' ? inboxCard(p, content)
        : onsiteCard(p, content);
    return `
      <div class="ch">
        <div class="chhead">
          <span class="chname">${channel.name}</span>
          <span class="chpanel">${esc(channel.panel)}</span>
        </div>${fields ? `
        <button class="copy" data-src="${key}">Copy ${esc(channel.name)} copy</button>
        ${sourceBox(key, key, fields)}` : ''}
        ${body}
        ${counter(p, content.checks)}
      </div>`;
}

function deck(palette, journeys, panelJourneys, slug, config, problems) {
    const p = palette;
    /* A BLOCKED JOURNEY IS SHOWN, NOT OMITTED. A deck that silently carries seven
       journeys where the playbook promises ten reads as though the other three were
       never planned. Saying what is missing and why is the difference between a gap
       and a mystery. */
    const cards = journeys.map((entry, index) => entry.blocked ? `
    <section class="j blocked">
      <header><h2>${esc(entry.journey)}</h2>
        <span class="count">needs the product feed</span></header>
      <p class="why">This journey's copy names a product, and no Dengage table carries a
        product name: every one identifies a product by id and stops there. Registering the
        product feed against this application is what resolves an id into a name, a price
        and an image. See <b>factory/panel/PRODUCT-FEED.md</b>, and
        <b>factory/phase0/SCHEMA.md</b> for the column lists this was read from.</p>
    </section>` : `
    <section class="j">
      <header><h2>${esc(entry.journey)}</h2>
        <span class="count">${Object.keys(entry.channels).length} channels</span></header>
      <div class="chs">${CHANNEL_ORDER.filter((id) => entry.channels[id])
        .map((id) => channelBlock(p, id, entry.channels[id],
            ((panelJourneys[index] || {}).channels || {})[id],
            'm' + index + '-' + id)).join('')}
      </div>
    </section>`).join('');

    const warn = problems.length ? `
  <div class="warn">
    <strong>${problems.length} field${problems.length === 1 ? '' : 's'} over the limit.</strong>
    ${problems.map((x) => esc(x.journey + ' / ' + CHANNELS[x.channel].name + ' / ' + x.field +
      ': ' + x.cost + ' of ' + x.max)).join('<br>')}
  </div>` : '';

    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Message pack: ${esc(slug)}</title>
<style>
  :root{color-scheme:light dark}
  *{box-sizing:border-box}
  body{margin:0;background:${p.canvas};color:${p.canvasText};font-family:${p.body};
       padding:34px 18px 80px;line-height:1.55}
  .head{max-width:1240px;margin:0 auto 28px}
  h1{font-family:${p.display};font-size:27px;margin:0 0 8px}
  .sub{margin:0;font-size:15px;color:${p.canvasQuiet};max-width:74ch}
  .warn{max-width:1240px;margin:0 auto 26px;background:${p.wash};border:1px solid ${p.edge};
        border-left:3px solid ${p.brandText};border-radius:8px;padding:14px 16px;font-size:13.5px;color:${p.text}}
  .grid{max-width:1240px;margin:0 auto;display:flex;flex-direction:column;gap:22px}
  .j{background:${p.card};border:1px solid ${p.edge};border-radius:12px;overflow:hidden}
  .j header{display:flex;justify-content:space-between;align-items:baseline;
            padding:15px 20px;border-bottom:1px solid ${p.edge}}
  h2{font-family:${p.display};font-size:17px;margin:0;color:${p.text}}
  .count{font-size:12px;color:${p.quiet}}
  .chs{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:0}
  .ch{padding:17px 20px;border-right:1px solid ${p.edge};border-bottom:1px solid ${p.edge}}
  .chhead{display:flex;flex-direction:column;gap:2px;margin-bottom:12px}
  .chname{font-size:12px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;color:${p.brandText}}
  .chpanel{font-size:11px;color:${p.quiet};line-height:1.4}

  .notif{display:flex;gap:11px;background:${p.wash};border:1px solid ${p.edge};
         border-radius:10px;padding:11px 12px}
  .nicon{width:34px;height:34px;border-radius:8px;flex:0 0 auto}
  .ntitle{font-size:13.5px;font-weight:bold;color:${p.text};line-height:1.3}
  .nbody{font-size:13px;color:${p.text};padding-top:2px}
  .nsrc{font-size:11px;color:${p.quiet};padding-top:5px}

  .sms .sender{font-size:11px;color:${p.quiet};padding-bottom:5px}
  .sms .bubble{background:${p.wash};border:1px solid ${p.edge};border-radius:14px 14px 14px 4px;
               padding:11px 13px;font-size:13px;color:${p.text}}

  .wa .wmeta{display:flex;gap:6px;padding-bottom:7px}
  .wa .cat,.wa .typ{font-size:10.5px;padding:2px 7px;border-radius:999px;border:1px solid ${p.edge};color:${p.quiet}}
  .wa .cat{color:${p.brandText}}
  .wbubble{background:${p.wash};border:1px solid ${p.edge};border-radius:10px 10px 10px 3px;padding:11px 13px}
  .whead{font-size:13px;font-weight:bold;color:${p.text};padding-bottom:5px}
  .wbody{font-size:12.8px;color:${p.text}}
  .wfoot{font-size:11px;color:${p.quiet};padding-top:7px}
  .wcarousel{display:flex;gap:5px;padding-top:9px}
  .wcarousel span{flex:1;font-size:10px;color:${p.quiet};text-align:center;
                  border:1px dashed ${p.edge};border-radius:6px;padding:14px 0}
  .wcoupon{margin-top:9px;font-size:11.5px;text-align:center;border:1px dashed ${p.edge};
           border-radius:6px;padding:7px;color:${p.brandText}}
  .wbtn{margin-top:5px;text-align:center;font-size:12.5px;color:${p.brandText};
        border:1px solid ${p.edge};border-radius:8px;padding:8px;background:${p.card}}

  .inbox{display:flex;gap:11px;background:${p.wash};border:1px solid ${p.edge};border-radius:10px;padding:11px 12px}
  .ithumb{width:40px;height:40px;border-radius:7px;flex:0 0 auto;border:1px solid ${p.edge}}
  .ititle{font-size:13.5px;font-weight:bold;color:${p.text}}
  .ibody{font-size:12.8px;color:${p.text};padding-top:2px}
  .imeta{font-size:11px;color:${p.quiet};padding-top:6px}

  .otemplate{font-size:11px;color:${p.quiet};padding-bottom:7px}
  .owidget{background:${p.wash};border:1px solid ${p.edge};border-radius:10px;padding:15px 14px;text-align:center}
  .oheading{font-family:${p.display};font-size:15px;font-weight:bold;color:${p.text}}
  .obody{font-size:12.8px;color:${p.text};padding:5px 0 11px}
  .octa{display:inline-block;font-size:12.5px;font-weight:bold;padding:8px 16px;border-radius:${p.radius}px}
  .ogeneric{font-size:10.5px;color:${p.quiet};padding-top:7px}

  .j.blocked{opacity:0.92}
  .j.blocked .count{color:${p.brandText}}
  .why{margin:0;padding:14px 17px 17px;font-size:12.5px;line-height:1.6;color:${p.quiet}}
  .counts{display:flex;flex-wrap:wrap;gap:5px;padding-top:10px}
  .ct{font-size:10.5px;color:${p.quiet};border:1px solid ${p.edge};border-radius:999px;padding:2px 8px}
  .ct b{color:${p.text};font-variant-numeric:tabular-nums}
  .ct.over{color:${p.brandText};border-color:${p.brandText}}
  .ct.over b{color:${p.brandText}}
</style></head>
<body>
  <div class="head">
    <h1>Message pack for ${esc(slug)}</h1>
    <p class="sub">Every short form message for the ten programmes, themed from this demo and shown in
      the shape the recipient sees. The number on each field is its measured length against the limit
      that applies, with the tags resolved to a realistic worst case first. SMS is counted the way
      Dengage charges it, where a non-ANSI character costs two. messages.json beside this page carries
      the same content as data.</p>
    <p class="sub">Each block has a <b>Copy</b> button. What it copies is the panel copy, carrying the
      live Dengage tags, with one labelled line per field of the content record. What is drawn on the
      card is the preview, resolved to sample values, which is what to show on a call.</p>
  </div>${warn}
  <div class="grid">${cards}
  </div>${copyScript()}
</body></html>
`;
}

/* -------------------------------------------------------------------------- */

export function buildMessages(slug) {
    const dest = join(ROOT, 'demos', slug);
    const configPath = join(dest, 'demo.config.json');
    if (!existsSync(configPath)) throw new Error('no demo.config.json for ' + slug);
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const productsPath = join(dest, 'products.json');
    const products = existsSync(productsPath)
        ? (JSON.parse(readFileSync(productsPath, 'utf8')).products || []) : [];
    if (!products.length) throw new Error('no products for ' + slug);

    const palette = emailPalette(config.theme);
    const ctx = context(config, products, slug);

    /* MEASURE AGAINST THIS DEMO'S OWN LONGEST VALUES. A generic allowance said every
       field fitted; this store's product names run to 120 characters and three did
       not. The longest real name is the honest worst case, so it is what the limits
       are checked against. */
    const longest = (values) => values.reduce((a, b) =>
        (String(b || '').length > String(a || '').length ? b : a), '');
    setAllowance({
        product: longest(products.map((item) => item.name)) || undefined,
        category: longest(products.map((item) => item.category)) || undefined,
        query: longest(products.map((item) => item.name)) || undefined,
        store: ctx.storeName
    });

    const panel = render('panel', ctx);
    const preview = render('preview', ctx);

    /* Limits are measured on the PANEL copy, because that is what sends. The
       preview is only for the deck. */
    const problems = [];
    for (const entry of panel) {
        for (const [channel, content] of Object.entries(entry.channels)) {
            for (const check of content.checks) {
                if (check.over) {
                    problems.push({ journey: entry.journey, channel, field: check.field,
                                    cost: check.cost, max: check.max });
                }
            }
        }
    }

    /* Written to the factory rather than into the demo, because pages.yml serves demos/
       publicly and a deck naming panel locations and listing character limits is setup
       material rather than something a prospect should be able to load. */
    const out = join(ROOT, 'factory', 'panel', 'content', slug, 'messages');
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'index.html'), deck(palette, preview, panel, slug, config, problems));
    writeFileSync(join(out, 'messages.json'), JSON.stringify({
        slug,
        note: 'Panel copy carries live Dengage tags. Paste into the channel content named in each entry.',
        journeys: panel
    }, null, 2) + '\n');

    const count = panel.reduce((n, entry) => n + Object.keys(entry.channels).length, 0);
    return { slug, journeys: panel.length, messages: count, problems, palette,
             blocked: panel.filter((entry) => entry.blocked).length };
}

const args = process.argv.slice(2);
const flag = (name) => {
    const at = args.indexOf('--' + name);
    return at === -1 ? null : (args[at + 1] || true);
};

if (import.meta.url === 'file://' + process.argv[1]) {
    const slugs = args.includes('--all')
        ? readdirSync(join(ROOT, 'demos'), { withFileTypes: true })
            .filter((entry) => entry.isDirectory()).map((entry) => entry.name)
        : [flag('slug')].filter((value) => typeof value === 'string');
    if (!slugs.length) {
        console.error('usage: node factory/messages/build-messages.mjs --slug <slug> | --all');
        process.exit(2);
    }
    let failed = 0;
    for (const slug of slugs) {
        try {
            const result = buildMessages(slug);
            console.error('Messages: ' + result.messages + ' across ' + result.journeys +
                ' journeys for ' + slug +
                (result.blocked ? ', ' + result.blocked + ' JOURNEY(S) NEED THE PRODUCT FEED' : '') +
                (result.problems.length ? ', ' + result.problems.length + ' OVER LIMIT' : ', all within limits'));
            for (const problem of result.problems) {
                console.error('   over: ' + problem.journey + ' / ' + CHANNELS[problem.channel].name +
                    ' / ' + problem.field + ' ' + problem.cost + ' of ' + problem.max);
            }
        } catch (err) {
            failed++;
            console.error('Messages: skipped ' + slug + ' (' + err.message + ')');
        }
    }
    process.exit(failed === slugs.length ? 1 : 0);
}
