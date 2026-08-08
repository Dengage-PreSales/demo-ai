/* ============================================================================
   Generates the Video Popup's video, and writes it to assets/.

     node factory/creatives/native/make-video.js

   The Video Popup template plays a video inside the popup rather than sending
   anyone to a video site, which is the whole reason to reach for it over an image
   popup. It needs a source, and that source has the same two constraints every
   other shared creative has.

   IT HAS TO BE GENERIC. One campaign serves every demo, so this cannot show a
   product, name a vertical, quote a price or feature a prospect. What it can do
   is say what the demo itself is, in Dengage's own colours, which is what it
   does: a short titled sequence naming the capabilities the launcher fires.

   IT HAS TO BE OURS. No third party host, so the file is committed here and
   played from https://dengage-presales.github.io/demo-ai/assets/.

   HOW IT IS MADE. There is no video editor in this toolchain. The animation is an
   HTML document and the recording is the browser filming itself: Playwright
   records the page for the life of the context and writes WebM. So the sequence
   runs start to finish in real time, and every part of it is a CSS animation for
   the reason given above the document below.

   WEBM, AND WHAT THAT COSTS. The recorder writes VP8 in WebM and there is no
   H.264 encoder in this toolchain, so MP4 is not available here. WebM plays in
   Chrome, Edge and Firefox, and in Safari from 14.1. A call driven from Chrome is
   the normal case and is fine. If a prospect ever needs to be shown this in an
   older Safari, the file has to be converted with a tool that has an H.264
   encoder, and the panel field pointed at the MP4 instead.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT = path.join(ROOT, 'assets', 'video');
const WIDTH = 1280;
const HEIGHT = 720;

/* Every card is one held title. The list is what the demo can actually do, so it
   stays truthful: each line corresponds to cards in the launcher. */
const CARDS = [
    { kicker: 'Dengage',        title: 'eComm Demo',
      line: 'A working storefront for a personalization conversation' },
    { kicker: 'On-site',        title: 'Eleven messages',
      line: 'Popups, bars, slide-ins, exit intent and scroll depth' },
    { kicker: 'Inline',         title: 'Five content slots',
      line: 'Content placed into the page, not over it' },
    { kicker: 'Gamification',   title: 'Spin, scratch, count down',
      line: 'Reward mechanics with a coupon behind them' },
    { kicker: 'Messaging',      title: 'Push and an inbox',
      line: 'Reach the device, or leave it waiting to be read' },
    { kicker: 'Every event',    title: 'Straight into Dengage',
      line: 'Views, carts, orders, wishlists and searches' }
];

const HOLD = 2200;      /* ms a card is fully readable */
const FADE = 520;       /* ms of crossfade between cards */
const STEP = HOLD + FADE;
const TOTAL = CARDS.length * STEP + FADE;

/* THE WHOLE SEQUENCE IS DECLARATIVE CSS, AND IT HAS TO BE.

   The obvious way to build this is to hold each card from Node: add a class,
   wait, add the next. That produced a recording with the background animating
   and every title missing, because what the recorder captures is the compositor
   output and DOM mutations driven from outside the page did not reach it. The
   background survived only because it was a CSS animation declared before
   recording started.

   So nothing here is driven from Node. Every card carries its own keyframe
   animation and its own delay, the page starts the whole sequence the moment it
   loads, and recording is reduced to opening the page and waiting for it to
   finish. Anything added later that needs to appear in the video has to be a CSS
   animation for the same reason. */
function document_() {
    const cards = CARDS.map((card, i) => `
      <section class="card" data-index="${i}"
               style="animation-delay:${i * STEP}ms">
        <div class="kicker">${card.kicker}</div>
        <div class="title">${card.title}</div>
        <div class="line">${card.line}</div>
      </section>`).join('');

    return `<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;padding:0;width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden}
      body{background:#0A2A6E;
           font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
      .stage{position:absolute;inset:0;
             background:linear-gradient(150deg,#0A2A6E 0%,#125CFA 60%,#3D7BFF 100%)}
      /* A slow drift under everything, so a held title is never a still frame.
         A video that stops moving for two seconds looks to a viewer like the
         stream stalled. */
      .wash{position:absolute;inset:-20%;opacity:.20;
            background:radial-gradient(circle at 30% 30%, #fff 0%, transparent 45%);
            animation:drift 9s ease-in-out infinite alternate}
      @keyframes drift{from{transform:translate(-6%, -4%) scale(1)}
                       to{transform:translate(8%, 6%) scale(1.15)}}
      .brand{position:absolute;top:52px;left:64px;display:flex;align-items:center;gap:16px;
             color:#fff;opacity:.88}
      .brand span{font-size:19px;font-weight:600;letter-spacing:.16em;text-transform:uppercase}
      .card{position:absolute;left:64px;right:64px;bottom:132px;color:#fff;
            opacity:0;transform:translateY(18px);
            animation:card ${STEP + FADE}ms ease both}
      /* In and out inside one animation, so consecutive cards overlap by exactly
         one fade and no card is ever left on screen under the next. */
      @keyframes card{
        0%{opacity:0;transform:translateY(18px)}
        ${((FADE / (STEP + FADE)) * 100).toFixed(2)}%{opacity:1;transform:none}
        ${((STEP / (STEP + FADE)) * 100).toFixed(2)}%{opacity:1;transform:none}
        100%{opacity:0;transform:translateY(-14px)}
      }
      .kicker{font-size:22px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;
              opacity:.72;margin-bottom:20px}
      .title{font-size:82px;font-weight:700;letter-spacing:-.02em;line-height:1.04}
      .line{font-size:29px;opacity:.82;margin-top:22px;max-width:26em;line-height:1.4}
      .bar{position:absolute;bottom:0;left:0;height:5px;background:#fff;opacity:.7;
           width:0;animation:grow ${TOTAL}ms linear both}
      @keyframes grow{from{width:0}to{width:100%}}
    </style></head><body>
      <div class="stage"><div class="wash"></div></div>
      <div class="brand">
        <svg viewBox="0 0 38 38" width="42" height="42" fill="#fff">
          <path d="M11.3821 34.8307H6.61521V28.0187H11.3821C16.4408 27.824 20.4293 23.6395 20.2348 18.5791C20.1375 13.7133 16.1489 9.82066 11.3821 9.72334H6.61521V15.5623H12.3549V22.3744H0V2.91125H11.3821C20.2348 3.2032 27.1418 10.5019 26.85 19.3576C26.6554 27.824 19.8456 34.6361 11.3821 34.8307Z"/>
          <path d="M36.9964 15.9687C38.288 17.303 38.3802 19.5905 36.9964 20.9248C35.6126 22.2591 33.3986 22.2591 32.0148 20.9248C31.369 20.2576 31 19.3045 31 18.4468C31 16.5406 32.476 14.9203 34.4134 14.9203C34.4134 14.9203 34.4134 14.9203 34.5056 14.9203C35.4281 14.9203 36.3507 15.3015 36.9964 15.9687Z"/>
        </svg>
        <span>eComm Demo</span>
      </div>
      ${cards}
      <div class="bar" id="bar"></div>
    </body></html>`;
}

/* ==========================================================================
   THE SAME SEQUENCE AS AN ANIMATED SVG, and it exists because of a real limit in
   the panel rather than as a nicety.

   A Video Popup renders a <video> element, and whether it AUTOPLAYS is decided by
   the autoplay attribute, which only the panel can set. A URL cannot ask for it:
   ?autoplay=1 and #t=3 were both tested against a bare <video src> and both were
   ignored, because those parameters belong to embed players like YouTube, which
   parse them in JavaScript. A direct file URL has no such parameters.

   An IMAGE has no such problem. Every <img> plays an animated image the moment it
   loads, with no attribute and no panel setting, and CSS animations inside an SVG
   run when that SVG is the src of an img. So the same six cards as an animated SVG
   can go into any image field in any template, and they play by themselves.

   Which makes this the answer when a template has no autoplay toggle: use the
   Image Popup with this file rather than the Video Popup with the WebM.

   No external font is referenced. A font-family that has to be fetched would not
   resolve inside an img, and the text would silently fall back mid animation.
   ========================================================================== */
function animatedSvg() {
    const step = STEP;
    const total = TOTAL;

    /* IT LOOPS, AND THAT IS NOT A FLOURISH. The first version gave each card its
       own short animation with a delay, which plays the sequence once and then
       leaves the image BLANK forever. A video ends on a paused last frame; an
       animation that has run out ends on nothing. In an Image Popup that stays
       open on screen, a prospect who looks up thirty seconds late sees an empty
       blue rectangle.

       So every card runs the same animation over the WHOLE timeline, infinitely,
       and its slot is expressed as keyframe percentages rather than as a delay.
       One keyframes rule per card is the cost of that, which at six cards is
       nothing. */
    const pct = (ms) => Math.max(0, Math.min(100, (ms / total) * 100)).toFixed(3);

    const keyframes = CARDS.map((card, i) => {
        const start = i * step;
        return `@keyframes dncard${i}{` +
            `0%,${pct(start)}%{opacity:0;transform:translateY(18px)}` +
            `${pct(start + FADE)}%,${pct(start + step)}%{opacity:1;transform:translateY(0)}` +
            `${pct(start + step + FADE)}%,100%{opacity:0;transform:translateY(-14px)}` +
        `}`;
    }).join('\n      ');

    const cardRules = CARDS.map((card, i) =>
        `.c${i}{animation:dncard${i} ${total}ms linear infinite both}`).join('');

    const cards = CARDS.map((card, i) => `
    <g class="card c${i}">
      <text class="kicker" x="64" y="${HEIGHT - 210}">${card.kicker.toUpperCase()}</text>
      <text class="title"  x="64" y="${HEIGHT - 140}">${card.title}</text>
      <text class="line"   x="64" y="${HEIGHT - 96}">${card.line}</text>
    </g>`).join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}"
     width="${WIDTH}" height="${HEIGHT}" role="img"
     aria-label="Dengage eComm Demo: what this storefront can do">
  <defs>
    <linearGradient id="dnbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0A2A6E"/>
      <stop offset=".6" stop-color="#125CFA"/>
      <stop offset="1" stop-color="#3D7BFF"/>
    </linearGradient>
    <radialGradient id="dnwash" cx=".3" cy=".3" r=".5">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity=".22"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <style>
      .card{opacity:0}
      ${cardRules}
      ${keyframes}
      .wash{animation:dndrift 9s ease-in-out infinite alternate}
      @keyframes dndrift{from{transform:translate(-6%,-4%) scale(1)}
                         to{transform:translate(8%,6%) scale(1.15)}}
      /* Restarts with the cards, so the bar always describes the current pass
         rather than sitting full for the rest of the loop. */
      .bar{animation:dngrow ${total}ms linear infinite}
      @keyframes dngrow{from{width:0}to{width:${WIDTH}px}}
      text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
           fill:#FFFFFF}
      .kicker{font-size:22px;font-weight:600;letter-spacing:3.5px;opacity:.72}
      .title{font-size:74px;font-weight:700;letter-spacing:-1.2px}
      .line{font-size:27px;opacity:.82}
      .brandword{font-size:19px;font-weight:600;letter-spacing:3px;opacity:.88}
    </style>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#dnbg)"/>
  <rect class="wash" x="-20%" y="-20%" width="140%" height="140%" fill="url(#dnwash)"/>

  <g transform="translate(64 40) scale(1.1)" fill="#FFFFFF">
    <path d="M11.3821 34.8307H6.61521V28.0187H11.3821C16.4408 27.824 20.4293 23.6395 20.2348 18.5791C20.1375 13.7133 16.1489 9.82066 11.3821 9.72334H6.61521V15.5623H12.3549V22.3744H0V2.91125H11.3821C20.2348 3.2032 27.1418 10.5019 26.85 19.3576C26.6554 27.824 19.8456 34.6361 11.3821 34.8307Z"/>
    <path d="M36.9964 15.9687C38.288 17.303 38.3802 19.5905 36.9964 20.9248C35.6126 22.2591 33.3986 22.2591 32.0148 20.9248C31.369 20.2576 31 19.3045 31 18.4468C31 16.5406 32.476 14.9203 34.4134 14.9203C34.4134 14.9203 34.4134 14.9203 34.5056 14.9203C35.4281 14.9203 36.3507 15.3015 36.9964 15.9687Z"/>
  </g>
  <text class="brandword" x="128" y="72">ECOMM DEMO</text>
${cards}
  <rect class="bar" x="0" y="${HEIGHT - 5}" width="0" height="5" fill="#FFFFFF" opacity=".7"/>
</svg>
`;
}

function launchOptions() {
    const named = process.env.PW_CHROMIUM;
    if (named && fs.existsSync(named)) return { executablePath: named };
    if (fs.existsSync('/opt/pw-browsers/chromium')) {
        return { executablePath: '/opt/pw-browsers/chromium' };
    }
    return {};
}

(async () => {
    fs.mkdirSync(OUT, { recursive: true });

    const browser = await chromium.launch(launchOptions());
    /* The video is the size of the viewport, so the two are set to the same thing
       rather than left to be scaled: recording at one size and displaying at
       another is where soft text comes from. */
    const context = await browser.newContext({
        viewport: { width: WIDTH, height: HEIGHT },
        recordVideo: { dir: OUT, size: { width: WIDTH, height: HEIGHT } }
    });
    const page = await context.newPage();
    await page.setContent(document_(), { waitUntil: 'load' });

    /* Wait out the sequence, plus a moment so the last fade is not cut off by the
       recorder closing on the final frame. */
    await page.waitForTimeout(TOTAL + 400);

    /* The file is only written and named when the context closes, so the path has
       to be read after that rather than before. */
    const video = page.video();
    await context.close();
    const produced = await video.path();
    await browser.close();

    const target = path.join(OUT, 'dn-ecomm-demo.webm');
    fs.renameSync(produced, target);

    /* Playwright leaves the recording directory behind it, so anything else in
       there is a previous run rather than output. */
    fs.readdirSync(OUT).forEach((name) => {
        if (name !== 'dn-ecomm-demo.webm') fs.unlinkSync(path.join(OUT, name));
    });

    const kb = (fs.statSync(target).size / 1024).toFixed(1);
    console.log(`${kb} kB  ${path.relative(ROOT, target)}`);
    console.log(`${(TOTAL / 1000).toFixed(1)}s, ${WIDTH}x${HEIGHT}, VP8 in WebM`);

    /* The animated SVG, written from the same CARDS list so the two cannot drift.
       See the comment above animatedSvg for why it exists. */
    const svgTarget = path.join(OUT, 'dn-ecomm-demo.svg');
    fs.writeFileSync(svgTarget, animatedSvg());
    const svgKb = (fs.statSync(svgTarget).size / 1024).toFixed(1);
    console.log(`${svgKb} kB  ${path.relative(ROOT, svgTarget)}`);
    console.log('the same sequence, plays by itself in any img field');
})().catch((err) => { console.error(err); process.exit(1); });
