/* ============================================================================
   One HTML email per scenario, for the Dengage Code Editor, plus a rendered preview.

     node factory/emails/build-scenarios.mjs
     node factory/emails/build-scenarios.mjs --only wishlist

   WHY THE CODE EDITOR RATHER THAN THE EMAIL BUILDER. The abandoned cart email is a
   BeeFree template, because BeeFree gives a salesperson blocks to point at. It pays for
   that with a constraint: a BeeFree block cannot hold a `{% %}` query, so every dynamic
   part has to be a saved Dynamic Content asset, created by hand in the panel, with its id
   carried back here. Four assets took three days of round trips and one id was filed
   under the wrong name for a day.

   A CODE EDITOR EMAIL IS RAW HTML AND CARRIES ITS OWN QUERY. So each of these is ONE
   PASTE and nothing else: no asset to create, no id to send back, nothing in
   factory/sandbox.json. That is the whole reason they are built this way.

   WHAT IS EMITTED, per scenario, into factory/panel/content/_shared/:

     scenario-<id>.html          paste this into the Code Editor. Contains the query
     scenario-<id>.preview.html  the same email rendered against a demo's real catalogue

   THE PREVIEW IS RENDERED, NOT MOCKED UP. dengage-template.mjs executes the same file
   that goes into the panel, against a $from backed by a demo's committed products.json
   and a synthetic event log. So the preview is the email's own output rather than a
   drawing of it, and if the query is broken the preview is broken in the same way.

   IT IS STILL NOT A SEND. Dengage owns the real engine and the real data. What this
   proves is that the template compiles, the query runs, the fold resolves, the markup
   closes and the links point at a real page. What it cannot prove is that Dengage agrees.
   ========================================================================== */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoWithProducts, asProductRows, ORIGIN } from '../catalogue.mjs';
import { emailPalette } from './palette.mjs';
import { dengageTheme } from './dengage-theme.mjs';
import { resolveBlock } from './resolve.mjs';
import { render, arrayFrom } from './dengage-template.mjs';
import { SCENARIOS, masthead, footer, band, note } from './scenarios.mjs';
import { document } from './scenario-html.mjs';
import { ampScenario } from './amp-scenario.mjs';

/* THE ONE SCENARIO THAT ALSO GETS AN AMP VARIANT. See amp-scenario.mjs for why it is one
   and why it is this one. */
export const AMP_SCENARIO = 'browse';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'factory', 'panel', 'content', '_shared');

export function scenarioHtml(scenario, palette) {
    const block = resolveBlock({
        table: scenario.table,
        fold: scenario.fold,
        extra: scenario.extra,
        cap: scenario.cap,
        show: scenario.show
    });
    const rows = [masthead(palette)].concat(scenario.body(palette), [footer(palette)]);
    return '{%\n' + block + '\n%}' + document(palette, {
        title: scenario.journey + ', Dengage eComm Demo',
        rows
    });
}

/* -------------------------------------------------------------------------- */
/* The preview's data: a real catalogue, and an event log that reaches it       */

/* THE DEMO AND ITS CATALOGUE COME FROM factory/catalogue.mjs, because the short form
   asset builder needs exactly the same two things: a committed demo with photographs, and
   its products as the dps_product rows the ETL loads. Two copies of that translation would
   be two answers to what the ETL puts in a column, which is the question a preview exists
   to answer. The event log below does NOT move, because a scenario email's history is per
   scenario and an asset's is per table. */

/* An event log per scenario, reaching the fold the way a real visitor would. Synthetic,
   and it says so: these are not rows from Dengage, they are the smallest history that
   makes each scenario resolve, so the preview shows a full email rather than an empty
   one. Every timestamp is fixed so two builds produce the same bytes. */
function history(scenario, slug, cat) {
    const base = 'https://dengage-presales.github.io/demo-ai/demos/' + slug + '/';
    const withImage = cat.filter((p) => p.image_link);
    const pick = (withImage.length >= 4 ? withImage : cat).slice(0, 5);
    const view = (i, product, at) => ({
        key: 'preview-device', session_id: 'preview-session', event_date: at,
        page_url: product ? product.link : base + 'index.html',
        page_title: product ? product.title : 'Home',
        product_id: product ? product.product_id : null,
        category_path: product ? product.category_path : '', price: product ? product.price : null
    });

    const tables = {
        master_device: [{ device_id: 'preview-device', contact_key: 'DPS-1' }],
        dps_product: cat,
        page_view_events: [view(0, null, '2026-08-10T09:00:00Z')]
            .concat(pick.map((p, i) => view(i, p, '2026-08-10T09:0' + (i + 1) + ':00Z'))),
        shopping_cart_events: [],
        wishlist_events: [],
        search_events: [],
        order_events_detail: []
    };

    if (scenario.table === 'shopping_cart_events') {
        tables.shopping_cart_events = pick.slice(0, 4).map((p, i) => ({
            id: 100 + i, key: 'preview-device', session_id: 'preview-session',
            event_date: '2026-08-10T10:0' + i + ':00Z', event_type: 'add_to_cart',
            product_id: p.product_id, quantity: i === 1 ? 2 : 1,
            unit_price: p.price, discounted_price: p.discounted_price
        }));
        if (scenario.id === 'checkout') {
            tables.shopping_cart_events.push({
                id: 200, key: 'preview-device', session_id: 'preview-session',
                event_date: '2026-08-10T10:10:00Z', event_type: 'begin_checkout',
                product_id: null, quantity: null
            });
        }
    }
    if (scenario.table === 'wishlist_events') {
        tables.wishlist_events = pick.slice(0, 4).map((p, i) => ({
            event_id: 'e' + i, key: 'preview-device', session_id: 'preview-session',
            event_date: '2026-08-10T10:0' + i + ':00Z', event_type: 'add',
            product_id: p.product_id, list_name: 'favorites',
            /* SAVED WELL ABOVE TODAY'S PRICE ON THE NEWEST ROW, and the row matters.
               The first version inflated the oldest, which is fine for triggering the
               price drop branch and useless for reading it: the fold sorts newest first,
               so the hero was a different item whose saved price happened to equal its
               full price. The two numbers coincided, the preview looked right, and it
               proved nothing about which comparison the email is making. Inflating the
               newest puts the obviously-different number where it can be seen. */
            price: i === 3 && p.price ? String(Number(p.price) * 1.6) : p.price,
            stock_count: p.stock_count
        }));
    }
    if (scenario.table === 'search_events') {
        /* A TERM THE CATALOGUE DOES NOT HAVE, so the preview shows the branch the scenario
           is named after. The first fixture took the first word of a product name, which on
           this catalogue is the store's own brand prefix and therefore matches all thirty
           products: the preview then showed the "found" branch and said nothing about how
           a failed search actually looks. */
        tables.search_events = [{
            key: 'preview-device', session_id: 'preview-session',
            event_date: '2026-08-10T10:00:00Z',
            keywords: 'waterproof jacket', result_count: 0, filters: null
        }];
    }
    if (scenario.table === 'order_events_detail') {
        tables.order_events_detail = pick.slice(0, 3).map((p, i) => ({
            key: 'preview-device', session_id: 'preview-session',
            event_date: '2026-08-10T10:00:00Z', order_id: 'DPS-ORDER-4471',
            product_id: p.product_id, quantity: i === 0 ? 2 : 1,
            unit_price: p.price, discounted_price: p.discounted_price, event_type: 'order'
        }));
    }
    return tables;
}

/* THE PUBLISHED ORIGIN BECOMES A RELATIVE PATH, IN THE PREVIEW ONLY, and this is the one
   place the preview deliberately differs from the file that goes into the panel.

   The email's addresses are absolute and have to be: dps_product carries them that way,
   which is what lets one email serve every demo. A preview opened from disk cannot fetch
   them, so every product came out as a broken image icon over its alt text and the card
   layout was impossible to judge. Rewriting the origin to a path relative to the preview's
   own folder makes the photographs and the links resolve against the working tree instead.

   The rewrite runs on the rendered output, never on the emitted email. So the preview shows
   real photographs and its links open the real storefront pages, and nothing that reaches
   Dengage has been touched. */
const TO_ROOT = '../../../../';

export function previewOf(scenario, source, slug, cat, options) {
    const o = options || {};
    const out = render(source, {
        $from: arrayFrom(history(scenario, slug, cat)),
        $Contact: { contact_key: 'DPS-1' }
    });
    /* ABSOLUTE ON REQUEST, and AMP is why the option exists. AMP4EMAIL requires every src
       and href to be an absolute https URL, so the rewrite that makes a preview's images
       load from disk is exactly what makes the AMP validator reject it. The validator has
       to see what a send would carry, so it gets this. */
    return o.absolute ? out : out.split(ORIGIN).join(TO_ROOT);
}

export { ORIGIN, TO_ROOT };

/* -------------------------------------------------------------------------- */

const INVOKED = process.argv[1] &&
    join(process.argv[1]) === join(fileURLToPath(import.meta.url));

if (INVOKED) {
    const only = (process.argv.find((a) => a.startsWith('--only=')) || '').replace('--only=', '') ||
                 (process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : '');

    const palette = emailPalette(dengageTheme());
    const demo = demoWithProducts();
    if (!demo) {
        console.error('No demo with products to preview against. Build a demo first.');
        process.exit(1);
    }
    const cat = asProductRows(demo.slug, demo.list);
    mkdirSync(OUT, { recursive: true });

    const report = [];
    let amped = null;
    for (const scenario of SCENARIOS) {
        if (only && scenario.id !== only) continue;
        const source = scenarioHtml(scenario, palette);
        writeFileSync(join(OUT, 'scenario-' + scenario.id + '.html'), source);

        let preview;
        try {
            preview = previewOf(scenario, source, demo.slug, cat);
        } catch (err) {
            console.error('FAILED to render ' + scenario.id + ': ' + err.message);
            process.exit(1);
        }
        writeFileSync(join(OUT, 'scenario-' + scenario.id + '.preview.html'), preview);

        /* NO PREVIEW FILE FOR THE AMP VARIANT, and that is deliberate rather than missing.
           The AMP boilerplate is `body{visibility:hidden}`, undone only when the runtime
           loads from cdn.ampproject.org, so an AMP document opened from disk without a
           network is a blank page. Checked, not assumed: Chromium reports body visibility
           hidden and zero visible characters. A file called .preview.html that renders
           blank is worse than no file, so what gets emitted instead is the send output,
           validated. Somebody who wants to see it uses the AMP playground, which
           factory/panel/SCENARIO-EMAILS.md links. */
        if (scenario.id === AMP_SCENARIO) {
            const amp = ampScenario(scenario, palette);
            writeFileSync(join(OUT, 'scenario-' + scenario.id + '.amp.html'), amp);
            let sent;
            try {
                sent = previewOf(scenario, amp, demo.slug, cat, { absolute: true });
            } catch (err) {
                console.error('FAILED to render the AMP variant: ' + err.message);
                process.exit(1);
            }
            amped = { bytes: amp.length, rendered: sent.length,
                      slides: (sent.match(/<amp-img /g) || []).length };
        }

        const cards = (preview.match(/<img /g) || []).length;
        const links = (source.match(/href="\{%=/g) || []).length;
        report.push({ id: scenario.id, journey: scenario.journey, table: scenario.table,
                      bytes: source.length, rendered: preview.length, cards, links });
    }

    const pad = (s, n) => String(s).padEnd(n);
    console.log('Scenario emails, into factory/panel/content/_shared/\n');
    console.log('  ' + pad('id', 11) + pad('journey', 24) + pad('reads', 22) +
                pad('source', 9) + pad('rendered', 10) + pad('images', 8) + 'links');
    for (const r of report) {
        console.log('  ' + pad(r.id, 11) + pad(r.journey, 24) + pad(r.table, 22) +
                    pad(r.bytes, 9) + pad(r.rendered, 10) + pad(r.cards, 8) + r.links);
    }
    if (amped) {
        console.log('\n  AMP variant of ' + AMP_SCENARIO + ': ' + amped.bytes +
                    ' bytes, ' + amped.slides + ' slides in the carousel.');
    }
    console.log('\n  Previewed against ' + demo.slug + ', ' + cat.length + ' products.');
    console.log('\n  Subject and Pre-header for each, to paste into those two fields:\n');
    for (const scenario of SCENARIOS) {
        if (only && scenario.id !== only) continue;
        console.log('  ' + pad(scenario.id, 11) + scenario.subject);
        console.log('  ' + pad('', 11) + scenario.preheader);
    }
}
