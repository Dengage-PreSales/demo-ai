/* ============================================================================
   Every link in the panel content points at something that exists.

     node factory/panel/links.test.mjs

   WHY THIS EXISTS. Ten emails, an AMP variant and five short form channels all linked
   to cart.html, checkout.html, wishlist.html and account.html. None of those files has
   ever existed: a demo is index.html and product.html, and the basket, the checkout,
   the search and the saved items are overlays on the first one. So the primary button
   in every message this factory produced landed on a GitHub Pages 404.

   Nothing caught it, and nothing could. The links are absolute strings, so no build
   step resolves them. The preview pages render them as anchors, and a preview is read
   to check a layout rather than clicked. The only place the defect appears is on a
   call, when somebody presses the button.

   So this resolves them. Every absolute URL in the panel content that points at this
   repository's own Pages origin is turned back into a path on disk and checked. It
   needs no network: the demo folder is right here, and a 404 on Pages is exactly a
   missing file in the tree.

   IT CHECKS ITSELF AGAINST A KNOWN BAD URL at the end, because a link checker that
   silently matches nothing passes on an empty repository and proves nothing. That has
   already happened twice here with other checks.
   ========================================================================== */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ORIGIN = 'https://dengage-presales.github.io/demo-ai/demos/';

let pass = 0;
let fail = 0;
function ok(label, condition, detail) {
    if (condition) { pass++; console.log('   ok    ' + label); return; }
    fail++;
    console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : ''));
}

function walk(dir, out) {
    if (!existsSync(dir)) return out;
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) { walk(full, out); continue; }
        if (/\.(html|json|txt|csv|md)$/.test(entry)) out.push(full);
    }
    return out;
}

/* A URL on the demos origin, back into a path in the tree. Returns null for anything
   that is not one of ours, so an off origin link is somebody else's problem and the
   guard's off-origin-assets check owns it. */
function resolveToDisk(url) {
    if (url.indexOf(ORIGIN) !== 0) return null;
    const rest = url.slice(ORIGIN.length);
    const slug = rest.split(/[/?#]/)[0];
    if (!slug) return null;

    let path = rest.slice(slug.length).replace(/^\//, '');
    path = path.split('#')[0].split('?')[0];
    /* A bare demo URL and a trailing slash both serve index.html, which is what Pages
       does and what a browser asks for. */
    if (path === '') path = 'index.html';

    return {
        slug,
        path,
        onDisk: join(ROOT, 'demos', slug, decodeURIComponent(path))
    };
}

const files = walk(join(ROOT, 'factory', 'panel', 'content'), []);
ok('there is panel content to check', files.length > 0, files.length);

/* Both quoted attributes and bare occurrences, because a JSON asset carries the URL as
   a value and a CSV carries it as a field.

   THE COMMA IS EXCLUDED DELIBERATELY. dps_product.csv holds an image URL in one field,
   and without stopping at the delimiter the pattern swallowed the rest of the row and
   reported thirty one images as missing files. None of the URLs this factory writes
   contains a comma. */
const URL_PATTERN = new RegExp(ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^\\s"\',<>)\\\\]*', 'g');

const seen = new Map();
for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const url of text.match(URL_PATTERN) || []) {
        /* A Dengage tag inside a URL is resolved at send time, so the literal cannot be
           checked and must not be reported as broken. */
        if (url.indexOf('{%') !== -1) continue;
        const clean = url.replace(/[.,;:]+$/, '');
        if (!seen.has(clean)) seen.set(clean, []);
        seen.get(clean).push(file.slice(ROOT.length + 1));
    }
}

ok('and it contains links to the demos', seen.size > 0, seen.size);

const broken = [];
const unknownSlug = [];
for (const [url, where] of seen) {
    const target = resolveToDisk(url);
    if (!target) continue;
    if (!existsSync(join(ROOT, 'demos', target.slug))) {
        unknownSlug.push({ url, where: where[0] });
        continue;
    }
    if (!existsSync(target.onDisk)) broken.push({ url, path: target.path, where: where[0] });
}

ok('every link resolves to a file in the demo it names', broken.length === 0, broken);
ok('and every link names a demo that exists', unknownSlug.length === 0, unknownSlug);

/* THE FIVE PAGES THAT NEVER EXISTED, named so a future change cannot reintroduce one
   by writing the string rather than calling demoLink. */
const invented = [];
for (const url of seen.keys()) {
    if (/\/(cart|checkout|wishlist|account|search|unsubscribe)\.html/.test(url)) {
        invented.push(url);
    }
}
ok('nothing links to a page the storefront has never had', invented.length === 0, invented);

/* -------------------------------------------------------------------------- */
/* The checker, against input it must reject                                    */

{
    const slug = readdirSync(join(ROOT, 'demos'), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())[0];
    ok('there is a demo to test the resolver against', Boolean(slug), slug && slug.name);
    if (slug) {
        const base = ORIGIN + slug.name + '/';

        const home = resolveToDisk(base);
        ok('a bare demo URL resolves to its index.html',
           home && home.path === 'index.html' && existsSync(home.onDisk), home);

        const product = resolveToDisk(base + 'product.html?id=ABC');
        ok('a product URL drops the query before resolving',
           product && product.path === 'product.html' && existsSync(product.onDisk), product);

        const overlay = resolveToDisk(base + 'index.html?open=cart');
        ok('an overlay link resolves to the page that hosts it',
           overlay && overlay.path === 'index.html' && existsSync(overlay.onDisk), overlay);

        const dead = resolveToDisk(base + 'cart.html');
        ok('THE DEFECT: cart.html resolves to nothing, so the checker would catch it',
           dead && !existsSync(dead.onDisk), dead && dead.path);

        const alsoDead = resolveToDisk(base + 'unsubscribe.html?c=DPS-1042');
        ok('and so would unsubscribe.html',
           alsoDead && !existsSync(alsoDead.onDisk), alsoDead && alsoDead.path);

        ok('an off origin URL is not this checker\'s business',
           resolveToDisk('https://fonts.googleapis.com/css2?family=DM+Sans') === null);
    }
}

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
