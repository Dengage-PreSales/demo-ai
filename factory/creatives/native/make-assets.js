/* ============================================================================
   Generates the images the panel built templates need, and writes them to
   assets/.

     node factory/creatives/native/make-assets.js

   WHY THESE IMAGES ARE GENERATED RATHER THAN SOURCED.

   Story, Video Popup and Vertical Popup are Visual Editor templates, so their
   artwork is a panel field holding a URL rather than markup this repository
   serves. Two rules meet at that field and between them they decide everything
   about what the artwork can be.

   First, one campaign per template serves every demo, so the artwork is SHARED.
   It cannot show a garment, a phone, a tyre or a bottle, because the same story
   circle appears on a fashion demo and an industrial supplier's demo in the same
   week. Everything here is therefore abstract: geometry and a theme colour, with
   the meaning carried by the label rather than the picture.

   Second, no runtime dependency on a third party (CLAUDE.md 4). A panel field
   needs an absolute URL, and a relative one would resolve against Dengage, so
   the files are committed here and referenced on the published origin:

     https://dengage-presales.github.io/demo-ai/assets/<path>

   WHY PNG AND NOT SVG. The panel accepts a URL and hands it to an img element
   in a creative it renders itself, and whether that path allows SVG is not
   documented. PNG is accepted everywhere, so the sources live in this file as
   markup and only PNG is committed. That also keeps the guard's image-locations
   rule satisfied with no exception: nothing image shaped exists outside
   assets/.

   The theme colour is the Dengage blue from assets/dengage-logo.svg, hard coded
   here on purpose. These files are not part of template/, are not themed per
   prospect, and are the one place a literal colour is the correct answer: they
   are Dengage's own artwork, the same on every demo.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT = path.join(ROOT, 'assets');

const BLUE = '#125CFA';
const DEEP = '#0A2A6E';
const MIST = '#E8EEFF';
const PAPER = '#FFFFFF';
const INK = '#0B1220';

/* -------------------------------------------------------------------------- */
/* Shared pieces                                                              */

/* The Dengage mark, the same two paths as assets/dengage-logo.svg. Inlined so a
   generated image never depends on fetching another file mid render. */
function mark(fill, size, x, y) {
    return `<g transform="translate(${x} ${y}) scale(${size / 38})" fill="${fill}">
      <path d="M11.3821 34.8307H6.61521V28.0187H11.3821C16.4408 27.824 20.4293 23.6395 20.2348 18.5791C20.1375 13.7133 16.1489 9.82066 11.3821 9.72334H6.61521V15.5623H12.3549V22.3744H0V2.91125H11.3821C20.2348 3.2032 27.1418 10.5019 26.85 19.3576C26.6554 27.824 19.8456 34.6361 11.3821 34.8307Z"/>
      <path d="M36.9964 15.9687C38.288 17.303 38.3802 19.5905 36.9964 20.9248C35.6126 22.2591 33.3986 22.2591 32.0148 20.9248C31.369 20.2576 31 19.3045 31 18.4468C31 16.5406 32.476 14.9203 34.4134 14.9203C34.4134 14.9203 34.4134 14.9203 34.5056 14.9203C35.4281 14.9203 36.3507 15.3015 36.9964 15.9687Z"/>
    </g>`;
}

/* Five motifs, one per story. Each is drawn inside a 0 0 100 100 box so the same
   markup composes into a square thumbnail and a portrait panel without being
   redrawn. Abstract by requirement: the label says what it means. */
const MOTIFS = {
    /* Concentric arcs opening upward. Arrival. */
    welcome: (c) => `
      <g fill="none" stroke="${c}" stroke-width="3.2" stroke-linecap="round">
        <path d="M22 66a28 28 0 0 1 56 0"/>
        <path d="M34 66a16 16 0 0 1 32 0"/>
      </g>
      <circle cx="50" cy="66" r="4.6" fill="${c}"/>`,

    /* A grid of dots with one picked out and ringed. Selection. */
    picked: (c) => {
        let dots = '';
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const x = 26 + col * 16;
                const y = 26 + row * 16;
                const chosen = row === 1 && col === 2;
                dots += chosen
                    ? `<circle cx="${x}" cy="${y}" r="5.4" fill="${c}"/>
                       <circle cx="${x}" cy="${y}" r="11" fill="none" stroke="${c}" stroke-width="2.4"/>`
                    : `<circle cx="${x}" cy="${y}" r="3" fill="${c}" opacity=".28"/>`;
            }
        }
        return dots;
    },

    /* Three columns rising, the tallest refilled. Replenishment. */
    restock: (c) => `
      <g fill="${c}">
        <rect x="24" y="60" width="14" height="20" rx="2.5" opacity=".3"/>
        <rect x="43" y="48" width="14" height="32" rx="2.5" opacity=".55"/>
        <rect x="62" y="30" width="14" height="50" rx="2.5"/>
      </g>
      <path d="M69 22v-8M69 14l-5 5M69 14l5 5" fill="none" stroke="${c}"
            stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,

    /* A route from one point to another. Movement. */
    delivery: (c) => `
      <path d="M20 70c14 0 12-18 26-18s14 18 30 4" fill="none" stroke="${c}"
            stroke-width="3.2" stroke-linecap="round" stroke-dasharray="1 7"/>
      <circle cx="20" cy="70" r="5" fill="${c}" opacity=".35"/>
      <circle cx="76" cy="56" r="7" fill="${c}"/>
      <path d="M73 56l2.4 2.4L79.5 54" fill="none" stroke="${PAPER}"
            stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,

    /* Two speech bubbles, one answering. Conversation. */
    help: (c) => `
      <path d="M24 32h38a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H40l-10 8V60h-6a6 6 0 0 1-6-6V38a6 6 0 0 1 6-6z"
            fill="${c}" opacity=".22"/>
      <path d="M48 46h28a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6h-4v7l-9-7H48a6 6 0 0 1-6-6V52a6 6 0 0 1 6-6z"
            fill="${c}"/>
      <g fill="${PAPER}">
        <circle cx="56" cy="59" r="2.6"/><circle cx="64" cy="59" r="2.6"/><circle cx="72" cy="59" r="2.6"/>
      </g>`
};

/* The five stories. Order is display order in the panel. Labels are the only
   thing carrying meaning, so they have to work for every vertical: nothing here
   names a product, a category, a price or a season. */
const STORIES = [
    { id: 'welcome',  motif: 'welcome',  name: 'Welcome',        title: 'Welcome in',
      line: 'A storefront that reacts to what you do' },
    { id: 'picked',   motif: 'picked',   name: 'Picked for you', title: 'Picked for you',
      line: 'Chosen from what this catalogue holds' },
    { id: 'restock',  motif: 'restock',  name: 'Back in stock',  title: 'Back in stock',
      line: 'Saved items, watched and reported' },
    { id: 'delivery', motif: 'delivery', name: 'Delivery',       title: 'On its way',
      line: 'Every step, messaged as it happens' },
    { id: 'help',     motif: 'help',     name: 'Need help?',     title: 'Ask any time',
      line: 'A reply on the channel you prefer' }
];

/* -------------------------------------------------------------------------- */
/* Framing                                                                    */

/* Each motif is drawn where it reads best rather than to a shared bounding box,
   so the five occupy very different parts of the 100 unit square: the delivery
   route is wide and flat, the restock columns are tall, the arcs sit low. One
   hand written viewBox cannot frame all five, and the first attempt at one
   clipped the restock arrow off the top while leaving the route swimming in
   space.

   So the frame is measured rather than guessed. getBBox reports what a motif
   actually drew, including stroke geometry, and the viewBox is that box plus a
   margin. Every motif then fills its frame the same amount, whatever it is.

   The margin is generous on purpose. A story circle is masked to a circle by the
   template, and a circle inscribed in a square crosses the edge at four points,
   so artwork that reaches the edge of the frame loses its extremes to the mask. */
async function motifViewBoxes(browser) {
    const page_ = await browser.newPage({ viewport: { width: 400, height: 400 } });
    const svgs = Object.keys(MOTIFS)
        .map((name) => `<svg id="m-${name}" viewBox="0 0 100 100" width="200" height="200">` +
                       `<g id="g-${name}">${MOTIFS[name](BLUE)}</g></svg>`)
        .join('');
    await page_.setContent(page(400, 2000, svgs, PAPER), { waitUntil: 'load' });

    const boxes = await page_.evaluate((names) => {
        const out = {};
        names.forEach((name) => {
            const box = document.getElementById('g-' + name).getBBox();
            out[name] = { x: box.x, y: box.y, width: box.width, height: box.height };
        });
        return out;
    }, Object.keys(MOTIFS));
    await page_.close();

    const framed = {};
    Object.keys(boxes).forEach((name) => {
        const box = boxes[name];
        /* Square the box first so a wide motif is not stretched taller than it
           was drawn, then pad. Both images this feeds are square or are drawn
           into a square area. */
        const side = Math.max(box.width, box.height);
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const pad = side * 0.16;
        const span = side + pad * 2;
        framed[name] = `${(cx - span / 2).toFixed(2)} ${(cy - span / 2).toFixed(2)} ` +
                       `${span.toFixed(2)} ${span.toFixed(2)}`;
    });
    return framed;
}

/* -------------------------------------------------------------------------- */
/* Documents                                                                  */

function page(width, height, body, background) {
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;padding:0}
      body{width:${width}px;height:${height}px;overflow:hidden;background:${background};
           font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
      *{box-sizing:border-box}
    </style></head><body>${body}</body></html>`;
}

/* The circle a story shows before it is opened. Square, and cropped to a circle
   by the panel, so nothing meaningful goes near a corner.

   The viewBox crops to the band the motifs actually draw in rather than the full
   0 0 100 100 box. Drawn to the full box the motif fills about half the width,
   and a story circle is roughly 64 pixels across on screen: at that size half a
   circle of artwork surrounded by empty white reads as an image that failed to
   load. */
function storyThumb(story, viewBox) {
    return page(400, 400, `
      <div style="width:400px;height:400px;display:grid;place-items:center;
                  background:radial-gradient(circle at 50% 42%, ${MIST} 0%, ${PAPER} 76%)">
        <svg viewBox="${viewBox}" width="330" height="330">${MOTIFS[story.motif](BLUE)}</svg>
      </div>`, PAPER);
}

/* The panel a story shows when it is opened. Portrait, phone shaped, with the
   label burned in: the template's own caption sits elsewhere and a story with no
   words in the image reads as a loading state. */
function storyPanel(story, viewBox) {
    return page(1080, 1920, `
      <div style="width:1080px;height:1920px;position:relative;
                  background:linear-gradient(168deg, ${DEEP} 0%, ${BLUE} 58%, #3D7BFF 100%)">
        <div style="position:absolute;inset:0;opacity:.16">
          <svg viewBox="${viewBox}" width="880" height="880"
               style="position:absolute;top:340px;left:100px">${MOTIFS[story.motif](PAPER)}</svg>
        </div>
        <div style="position:absolute;top:96px;left:88px;display:flex;align-items:center;gap:22px">
          <svg viewBox="0 0 38 38" width="64" height="64">${mark(PAPER, 38, 0, 0)}</svg>
          <span style="color:${PAPER};font-size:34px;font-weight:600;letter-spacing:.14em;
                       text-transform:uppercase;opacity:.85">eComm Demo</span>
        </div>
        <div style="position:absolute;left:88px;right:88px;bottom:300px">
          <div style="color:${PAPER};font-size:108px;font-weight:700;line-height:1.06;
                      letter-spacing:-.02em">${story.title}</div>
          <div style="color:${PAPER};opacity:.82;font-size:44px;line-height:1.4;
                      margin-top:36px;max-width:14em">${story.line}</div>
        </div>
      </div>`, DEEP);
}

/* The Vertical Popup's image. Landscape, sits above the title and message the
   panel supplies, so it carries no words of its own: the template would then
   show two headings. */
function verticalPopupImage(viewBox) {
    return page(900, 560, `
      <div style="width:900px;height:560px;position:relative;overflow:hidden;
                  background:linear-gradient(140deg, ${DEEP} 0%, ${BLUE} 62%, #3D7BFF 100%)">
        <!-- Off centre and oversized, cropped by the frame. A motif floated in
             the middle of a landscape image leaves two columns of dead space and
             reads as a placeholder; running it off the edge reads as artwork. -->
        <svg viewBox="${viewBox}" width="720" height="720"
             style="position:absolute;top:-96px;right:-150px;opacity:.22">${MOTIFS.picked(PAPER)}</svg>
        <div style="position:absolute;top:44px;left:52px;display:flex;align-items:center;gap:14px">
          <svg viewBox="0 0 38 38" width="40" height="40">${mark(PAPER, 38, 0, 0)}</svg>
          <span style="color:${PAPER};font-size:19px;font-weight:600;letter-spacing:.14em;
                       text-transform:uppercase;opacity:.85">eComm Demo</span>
        </div>
        <svg viewBox="${viewBox}" width="230" height="230"
             style="position:absolute;bottom:56px;left:52px">${MOTIFS.picked(PAPER)}</svg>
      </div>`, DEEP);
}

/* -------------------------------------------------------------------------- */

/* PNG for flat artwork, JPEG for anything with a gradient across it.

   This is not a stylistic choice. PNG stores a large smooth gradient badly
   because it has no lossy path for one, and the story panels came out at 640 kB
   each, 6.4 MB across five: a shared creative that every demo loads on every
   call. The same panel as JPEG is a small fraction of that with no visible
   difference, while the circles stay PNG because they are flat colour on white
   and JPEG would ring around the edges. */
async function shoot(browser, html, width, height, file) {
    const page_ = await browser.newPage({ viewport: { width, height } });
    await page_.setContent(html, { waitUntil: 'load' });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const jpeg = /\.jpg$/.test(file);
    await page_.screenshot(jpeg
        ? { path: file, type: 'jpeg', quality: 86 }
        : { path: file, type: 'png' });
    await page_.close();
    return file;
}

/* Playwright normally downloads its own browser and finds it without help. Some
   build environments pre-install one instead and point at it, so an explicit
   path is honoured when there is one and otherwise nothing is forced: hard
   coding a path here would make this script run in one place only. */
function launchOptions() {
    const named = process.env.PW_CHROMIUM;
    if (named && fs.existsSync(named)) return { executablePath: named };
    if (fs.existsSync('/opt/pw-browsers/chromium')) {
        return { executablePath: '/opt/pw-browsers/chromium' };
    }
    return {};
}

(async () => {
    const browser = await chromium.launch(launchOptions());
    const frames = await motifViewBoxes(browser);
    const written = [];

    for (const story of STORIES) {
        const frame = frames[story.motif];
        written.push(await shoot(browser, storyThumb(story, frame), 400, 400,
            path.join(OUT, 'story', `dn-story-${story.id}-circle.png`)));
        written.push(await shoot(browser, storyPanel(story, frame), 1080, 1920,
            path.join(OUT, 'story', `dn-story-${story.id}-panel.jpg`)));
    }

    written.push(await shoot(browser, verticalPopupImage(frames.picked), 900, 560,
        path.join(OUT, 'popup', 'dn-vertical-popup.jpg')));

    await browser.close();

    written.forEach((file) => {
        const rel = path.relative(ROOT, file);
        console.log(`${(fs.statSync(file).size / 1024).toFixed(1).padStart(7)} kB  ${rel}`);
    });
    console.log(`\n${written.length} file(s) written to assets/`);
})().catch((err) => { console.error(err); process.exit(1); });
