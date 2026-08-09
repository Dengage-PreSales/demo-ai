/* ============================================================================
   Renders one email hero image per demo, from that demo's own theme.

     node factory/emails/make-hero.mjs --slug <slug>
     node factory/emails/make-hero.mjs --all

   Output: demos/<slug>/images/email-hero.jpg, 1200x480, which is 600x240 at 2x.

   WHY AN IMAGE AT ALL, AND WHY A GENERATED ONE. An email of nothing but text reads as a
   receipt, and the one thing this factory cannot do is put a stock photograph in it: a
   demo carries the prospect's product names and never their imagery, non-negotiable 3,
   and it may not depend on a third party CDN at runtime, non-negotiable 4. A stock
   library is both of those problems at once.

   So the hero is drawn rather than sourced. It is geometry in the demo's own brand
   colour, which means it themes itself for every prospect with nothing to license, no
   file to source, and nothing that can be taken down between the build and the call.

   IT CARRIES NO TEXT, deliberately. Text baked into an image cannot be read by a screen
   reader, does not reflow on a phone, and is invisible to the third of recipients whose
   client blocks images. Every word in the email is real text in a real module. This is
   the decoration behind them.

   RENDERED IN A BROWSER, the same way factory/make-motif-images.mjs renders the feed
   tiles. Same reason: the geometry is described once, in markup, and a browser is the
   thing that already knows how to draw it.
   ========================================================================== */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import { emailPalette } from './palette.mjs';
import { launchOptions } from '../browser.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/* 600 wide is the email body, and 240 tall is deep enough to be a hero without pushing
   the products below the fold. Rendered at 2x for a retina screen, which is where these
   are read. */
const WIDTH = 600;
const HEIGHT = 240;
const SCALE = 2;

/* A BAG, A TAG AND TWO CARDS. The bag says shopping, the cards suggest the items in it,
   and the count badge says something is waiting. All of it is a flat geometric drawing
   in two tones of the demo's brand, so a bright orange and a deep navy both work: the
   ink is the readable version of the brand that emailPalette already resolved, and the
   fills are tints of it against the wash.

   No gradient meshes and no shadows with blur. Every shape here is a rectangle, a
   circle or a straight line, which is what survives being scaled and compressed to a
   40KB JPEG. */
function heroMarkup(palette) {
    const ink = palette.brandText;
    const brand = palette.brand;

    return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;}
  body{width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:${palette.wash};}
  svg{display:block;}
</style></head><body>
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"
     xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${palette.wash}"/>

  <!-- One large disc behind the group, cropped by the frame, so the composition has
       depth without a gradient. Kept faint so it reads on a light wash and a dark one
       alike, and centred behind the subject rather than cut by the right edge, which
       made it look like a shape instead of a ground. -->
  <circle cx="330" cy="${HEIGHT / 2}" r="150" fill="${brand}" opacity="0.07"/>
  <circle cx="86" cy="34" r="9" fill="${brand}" opacity="0.35"/>
  <circle cx="${WIDTH - 74}" cy="${HEIGHT - 44}" r="13" fill="${brand}" opacity="0.22"/>

  <!-- Three product cards, fanned, overlapping the bag so the group reads as one
       object rather than two. Nothing in them depicts a real product: a colour block
       where the photograph goes and two bars where the name and price go, which is the
       same anatomy as the rows further down the email. -->
  <g transform="translate(268 58) rotate(-9)">
    <rect width="96" height="118" rx="9" fill="${palette.card}" opacity="0.8"/>
    <rect x="13" y="14" width="70" height="52" rx="5" fill="${brand}" opacity="0.16"/>
    <rect x="13" y="78" width="54" height="6" rx="3" fill="${ink}" opacity="0.20"/>
    <rect x="13" y="91" width="32" height="6" rx="3" fill="${ink}" opacity="0.13"/>
  </g>
  <g transform="translate(342 44)">
    <rect width="104" height="130" rx="9" fill="${palette.card}"/>
    <rect x="14" y="16" width="76" height="58" rx="5" fill="${brand}" opacity="0.30"/>
    <rect x="14" y="88" width="62" height="7" rx="3.5" fill="${ink}" opacity="0.34"/>
    <rect x="14" y="103" width="38" height="7" rx="3.5" fill="${ink}" opacity="0.21"/>
  </g>
  <g transform="translate(432 58) rotate(9)">
    <rect width="96" height="118" rx="9" fill="${palette.card}" opacity="0.8"/>
    <rect x="13" y="14" width="70" height="52" rx="5" fill="${brand}" opacity="0.16"/>
    <rect x="13" y="78" width="54" height="6" rx="3" fill="${ink}" opacity="0.20"/>
    <rect x="13" y="91" width="32" height="6" rx="3" fill="${ink}" opacity="0.13"/>
  </g>

  <!-- The bag, in front. Body, a darker band where the fold is, the handle as an open
       arc, and a price tag on a string.

       THE TAG REPLACED A COUNT BADGE. The badge was a disc with two vertical bars in
       it, meaning "two items", and it read unmistakably as a pause button. A tag says
       retail with no symbol to misread. -->
  <g transform="translate(96 60)">
    <path d="M6 34 h140 l10 108 a11 11 0 0 1 -11 12 H7 a11 11 0 0 1 -11 -12 Z"
          fill="${brand}"/>
    <path d="M6 34 h140 l3 30 H3 Z" fill="${ink}" opacity="0.16"/>
    <path d="M46 38 V25 a30 30 0 0 1 60 0 V38"
          fill="none" stroke="${ink}" stroke-width="9" stroke-linecap="round"/>
    <line x1="106" y1="30" x2="128" y2="52" stroke="${ink}" stroke-width="3"
          opacity="0.55" stroke-linecap="round"/>
    <g transform="translate(122 46) rotate(-20)">
      <path d="M4 0 h40 a8 8 0 0 1 8 8 v22 a8 8 0 0 1 -8 8 H4 L-12 19 Z"
            fill="${palette.card}"/>
      <circle cx="2" cy="19" r="4.5" fill="${brand}" opacity="0.55"/>
      <rect x="16" y="12" width="28" height="5" rx="2.5" fill="${ink}" opacity="0.30"/>
      <rect x="16" y="22" width="18" height="5" rx="2.5" fill="${ink}" opacity="0.20"/>
    </g>
  </g>

  <!-- A hairline floor, so the group sits on something. -->
  <rect x="0" y="${HEIGHT - 1}" width="${WIDTH}" height="1" fill="${palette.edge}"/>
</svg>
</body></html>`;
}

export async function makeHero(slug, browser) {
    const configPath = join(ROOT, 'demos', slug, 'demo.config.json');
    if (!existsSync(configPath)) throw new Error('no demo.config.json for ' + slug);
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const palette = emailPalette(config.theme);

    const own = !browser;
    const chrome = browser || await chromium.launch(launchOptions());
    try {
        const page = await chrome.newPage({
            viewport: { width: WIDTH, height: HEIGHT },
            deviceScaleFactor: SCALE
        });
        await page.setContent(heroMarkup(palette), { waitUntil: 'load' });
        /* JPEG rather than PNG: this is a photograph sized band of flat colour, and a
           quality 88 JPEG of it is a third the size with no visible difference at the
           size it is displayed. Email cares about weight. */
        const bytes = await page.screenshot({ type: 'jpeg', quality: 88 });
        await page.close();

        const dir = join(ROOT, 'demos', slug, 'images');
        mkdirSync(dir, { recursive: true });
        const file = join(dir, 'email-hero.jpg');
        writeFileSync(file, bytes);

        return { slug, file, bytes: bytes.length, brand: palette.brand };
    } finally {
        if (own) await chrome.close();
    }
}

/* -------------------------------------------------------------------------- */

const args = process.argv.slice(2);

if (import.meta.url === 'file://' + process.argv[1]) {
    const at = args.indexOf('--slug');
    const slugs = args.includes('--all')
        ? readdirSync(join(ROOT, 'demos'), { withFileTypes: true })
            .filter((entry) => entry.isDirectory()).map((entry) => entry.name)
        : (at === -1 ? [] : [args[at + 1]]).filter(Boolean);

    if (!slugs.length) {
        console.error('usage: node factory/emails/make-hero.mjs --slug <slug> | --all');
        process.exit(2);
    }

    /* ONE BROWSER FOR EVERY DEMO. Launching Chromium per slug is most of the runtime. */
    const browser = await chromium.launch(launchOptions());
    let failed = 0;
    try {
        for (const slug of slugs) {
            try {
                const result = await makeHero(slug, browser);
                console.error('Hero: ' + slug + ', ' + Math.round(result.bytes / 1024) +
                    'KB, brand ' + result.brand);
            } catch (err) {
                failed++;
                console.error('Hero: skipped ' + slug + ' (' + err.message + ')');
            }
        }
    } finally {
        await browser.close();
    }
    process.exit(failed === slugs.length ? 1 : 0);
}
