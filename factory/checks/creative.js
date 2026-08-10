/* ============================================================================
   CHECK A CREATIVE'S FORM CONTRACT WITHOUT THE PANEL.

   Handoff 2.2a, 9.1, 12.4. Run it from the repository root:

       bash factory/checks/run.sh

   Pasting a creative into the panel and clicking submit tells you almost nothing
   when it fails: the card just sits there. Wrong field vocabulary, wrong nesting,
   a missing data-dn-is-enabled and a broken handler all look identical. This runs
   the creative against Dengage's OWN shipped form handler, offline, and reports
   which of those it is.

   Nothing reaches Dengage and no contact is created. Dn.postMessageToParent is
   the boundary: inside the iframe the creative only posts a message, and the
   parent SDK is what makes the HTTP call. Replacing that one function proves the
   payload while writing nothing.

   It assembles the iframe document the way the SDK does, from the SDK's own
   source:

     html.replace('</head>', '<style>'  + sharedCss     + '</style></head>')
         .replace('</body>', '<script>' + sharedJs      + '<\/script></body>')
         .replace('</body>', '<script>' + formHandler   + '<\/script></body>')

   and the form handler is included only when the creative contains the exact
   substring  data-dn-form-id="subscription_form"  or  ..."question_form".

   THE ASSEMBLY USES A FUNCTION REPLACEMENT, so the injected source reaches the
   document byte identical to what is served. A string replacement would apply
   substitution semantics to the replacement text, which is not what is wanted when
   the replacement text is somebody else's source file. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

/* Where run.sh put the four fetched resources. */
const SCRATCH = process.env.DN_RESOURCE_DIR || __dirname;
const PREFIX = 'https://pcdn.dengage.com/onsite-message/';
const SERVE = process.env.SERVE_URL || 'http://localhost:8104/';
/* WHERE THE ASSEMBLED DOCUMENT IS WRITTEN, AND WHERE IT IS FETCHED FROM.
   SERVE_URL must be the http face of ASSEMBLED_DIR: the check writes the
   assembly into the directory and navigates to the URL, and when the two name
   different places the server answers with its 404 page instead. That page
   loads cleanly, carries no engine, and its console line matches the harness
   noise filter below, so before the engine gate in the main flow existed it
   was silently judged as if it were the creative. run.sh exports both. */
const ASSEMBLED_DIR = process.env.ASSEMBLED_DIR || SCRATCH;

/* SLICE the text out of the wrapper, which is what the SDK does: it fetches the
   file and takes the source between the backticks. Do NOT evaluate the wrapper as
   a template literal, because that collapses the source's own \" escapes and the
   result is not valid JavaScript. */
function unwrap(file) {
  const raw = fs.readFileSync(path.join(SCRATCH, file), 'utf8').replace(/^\uFEFF/, '');
  const i = raw.indexOf('(`');
  const j = raw.lastIndexOf('`)');
  if (i === -1 || j === -1) throw new Error('no template literal in ' + file);
  return raw.slice(i + 2, j);
}

/* Exactly what the SDK does, from the minified source:
     t.replace('</head>', '<style>'+sharedCss+'</style></head>')
      .replace('</body>', '<script>'+sharedJs+'<\/script></body>')
      .replace('</body>', form ? '<script>'+formHandler+'<\/script></body>' : '</body>')
   where the form handler is included ONLY IF the creative HTML contains the exact
   substring  data-dn-form-id="subscription_form"  (or question_form). */
function assemble(creativeHtml) {
  const sharedCss = unwrap('dn-shared.css.js');
  const sharedJs = unwrap('dn-shared.js');
  const containerCss = unwrap('dn-container.css.js');
  const wantsForm = creativeHtml.includes('data-dn-form-id="subscription_form"')
                 || creativeHtml.includes('data-dn-form-id="question_form"');
  const formHandler = wantsForm
    ? unwrap('dn-form-handler.js').split('{{ONSITE_COMMON_RESOURCE_URL_PREFIX}}').join(PREFIX)
    : null;

  /* A function replacement, so no substitution is applied to the replacement text.
     The injected source therefore reaches the document exactly as served. */
  const put = (hay, needle, value) => hay.replace(needle, () => value);

  let out = put(creativeHtml, '</head>', '<style>' + sharedCss + '</style></head>');
  out = put(out, '</body>', '<script>' + sharedJs + '<\/script></body>');
  out = put(out, '</body>', formHandler
    ? '<script>' + formHandler + '<\/script></body>' : '</body>');

  /* The sizes ride along so the engine gate below can name exactly what was
     injected when the engine turns out not to have run: a zero or tiny size
     points at the fetch, a healthy one points at the serving arrangement. */
  return { html: out, wantsForm, containerCss, sizes: {
    sharedCss: sharedCss.length,
    sharedJs: sharedJs.length,
    formHandler: formHandler ? formHandler.length : 0
  } };
}


/* The browser lives at module scope so the failure handler at the bottom of
   this file can close it: an unhandled rejection used to kill the process with
   a stack trace mid section, which reads as a harness crash rather than a
   verdict, and left a chromium behind. */
let browser = null;

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.log('usage: node factory/checks/creative.js <creative.html>   (or --selftest)');
    process.exit(2);
  }
  const creative = fs.readFileSync(target, 'utf8');
  console.log('Creative: ' + target + '  (' + creative.length + ' bytes)\n');

  /* ---- the gates, checked before a browser is involved ---- */
  console.log('1. The engine\'s injection gates, which are plain string matching');
  const hasHead = creative.includes('</head>');
  const hasBody = creative.includes('</body>');
  const gate = creative.includes('data-dn-form-id="subscription_form"');
  console.log('   </head> present ................. ' + hasHead);
  console.log('   </body> present ................. ' + hasBody + '   (both scripts inject here)');
  console.log('   exact  data-dn-form-id="subscription_form"  present ... ' + gate);
  if (!hasBody) console.log('   ^^ without </body> NEITHER shared.js NOR the form handler is injected');
  if (!gate) console.log('   ^^ without this EXACT substring the form handler is never fetched');

  const { html, wantsForm, sizes } = assemble(creative);
  /* THREE FORM KINDS, not one. subscription_form creates a contact with
     permissions; question_form writes contact TAGS and has a completely different
     structure, with the attributes on .form-block rather than on the form. Treating
     them alike reported formFound false on a perfectly good survey. */
  const isSubscription = creative.includes('data-dn-form-id="subscription_form"');
  const isQuestion = creative.includes('data-dn-form-id="question_form"');
  const hasForm = isSubscription;
  console.log('   form handler would be injected .. ' + wantsForm + '\n');

  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const s = m.text();
    if (/favicon|404 \(File not found\)/.test(s)) return;   /* harness noise */
    errors.push('console: ' + s);
  });

  /* Capture instead of post. The real Dn.postMessageToParent talks to the parent
     SDK, which is what makes the HTTP call that creates the contact. Replacing it
     proves the payload without writing anything. */
  /* SERVED OVER HTTP, not setContent. setContent goes through document.write,
     which cannot take a document carrying injected <script> blocks, and the
     resulting parse error looks exactly like a handler failure. The engine gives
     the iframe a real document, so this is also the more faithful arrangement. */
  const stem = 'assembled-' + path.basename(target).replace(/\W+/g, '-') + '.html';
  fs.writeFileSync(path.join(ASSEMBLED_DIR, stem), html, 'utf8');
  const response = await page.goto(SERVE + stem, { waitUntil: 'load' });
  const httpStatus = response ? response.status() : 0;
  await page.waitForTimeout(500);

  /* The handler reads Dn.postMessageToParent at CALL time, so replacing the
     property after load still intercepts. */
  await page.evaluate(() => {
    window.__posted = [];
    window.__installCapture = function () {
      if (!window.Dn) return false;
      window.Dn.postMessageToParent = function (action, payload) {
        window.__posted.push({ action: action, payload: payload });
      };
      return true;
    };
  });

  if (errors.length) {
    console.log('   ERRORS DURING LOAD, which is why the handler did not finish:');
    errors.forEach(e => console.log('     ' + e));
    console.log('');
  }

  /* THE GATE THAT KEEPS THIS CHECK HONEST. Every assertion below interrogates
     the document the browser is actually showing. If the engine script did not
     run in it, that document is not this creative's assembly: most likely it is
     a page the server substituted, such as its 404 page when SERVE_URL and
     ASSEMBLED_DIR name different directories, and every verdict read off it
     would be confidently wrong about a creative that is fine. One loud failure
     that names what was injected is worth more than fourteen precise lies, so
     the check stops here. Exit 2 still fails the suite: a broken harness is a
     red build, never a silent skip. The fail open proof for this gate is
     --selftest, at the bottom of this file. */
  const engineRan = await page.evaluate(() => typeof window.Dn !== 'undefined');
  if (!engineRan) {
    console.log('FAIL  THE ENGINE SCRIPT DID NOT RUN IN THE ASSEMBLED PAGE');
    console.log('   window.Dn is undefined after load, so dn-shared.js never executed in');
    console.log('   the document the browser fetched. The markup assertions are skipped:');
    console.log('   they would describe that document, not this creative.');
    console.log('   served url .................... ' + SERVE + stem + '   (HTTP ' + httpStatus + ')');
    console.log('   assembled file ................ ' + path.join(ASSEMBLED_DIR, stem) +
                '   (' + html.length + ' bytes)');
    console.log('   injected dn-shared.css.js ..... ' + sizes.sharedCss + ' bytes');
    console.log('   injected dn-shared.js ......... ' + sizes.sharedJs + ' bytes');
    console.log('   injected dn-form-handler.js ... ' +
                (wantsForm ? sizes.formHandler + ' bytes' : 'not injected, no form gate'));
    if (httpStatus !== 200) {
      console.log('   THE HTTP STATUS IS THE TELL: the server did not return the assembled');
      console.log('   file, so SERVE_URL and ASSEMBLED_DIR do not name the same directory.');
    }
    await browser.close();
    process.exit(2);
  }

  console.log('2. What the injected scripts actually produced');
  const state = await page.evaluate(() => ({
    hasDn: typeof window.Dn,
    postSubscription: typeof (window.Dn || {}).postSubscription,
    postQuestion: typeof (window.Dn || {}).postQuestion,
    sendClick: typeof (window.Dn || {}).sendClick,
    close: typeof (window.Dn || {}).close,
    formFound: !!document.querySelector('form.form[data-dn-form-id="subscription_form"]'),
    fieldCount: document.querySelectorAll('[data-dn-id]').length,
    messageCount: document.querySelectorAll('[data-dn-invalid-message-type]').length,
    containerFound: !!document.querySelector('.container'),
    containerInsideForm: !!document.querySelector('form.form .container'),
    submittedContent: !!document.querySelector('.submitted-content'),
    submittedEnabled: (document.querySelector('.submitted-content') || {}).dataset
      ? document.querySelector('.submitted-content').dataset.dnIsEnabled : null
  }));
  Object.keys(state).forEach(k => console.log('   ' + k.padEnd(22, '.') + ' ' + state[k]));

  console.log('\n   THE SELECTOR IS  form.form[data-dn-form-id="subscription_form"]');
  console.log('   so the form needs BOTH class="form" AND the attribute.');

  /* ---- field/message pairing, which the handler does BY INDEX ---- */
  /* SECTIONS 3 TO 6 ARE THE FORM CONTRACT ONLY. Five of the eight creatives
     carry no form, and running these against them reports failures that are
     not defects. Those five are judged on section 8 onward. */
  let posted = [], badPosted = 0;
  if (hasForm) {
    console.log('\n3. Fields and messages, paired BY INDEX by the handler');
    const pairs = await page.evaluate(() => {
      const form = document.querySelector('form.form[data-dn-form-id="subscription_form"]');
      if (!form) return null;
      const f = [...form.querySelectorAll('[data-dn-id]')];
      const m = [...form.querySelectorAll('[data-dn-invalid-message-type]')];
      const rows = [];
      for (let i = 0; i < Math.max(f.length, m.length); i++) {
        rows.push({
          i,
          field: f[i] ? (f[i].dataset.dnId + ' [' + (f[i].dataset.dnType || 'TEXT') + ']') : '(none)',
          message: m[i] ? (m[i].getAttribute('data-dn-invalid-message-type') || '(empty)') : '(none)',
          aligned: !!(f[i] && m[i] &&
            (f[i].dataset.dnType || 'TEXT') === m[i].getAttribute('data-dn-invalid-message-type'))
        });
      }
      return rows;
    });
    (pairs || []).forEach(r => console.log('   ' + String(r.i) + '  ' + r.field.padEnd(34) +
      r.message.padEnd(22) + (r.aligned ? 'aligned' : 'MISALIGNED')));

    console.log('\n4. Submit with valid values, and capture the payload');
    const installed = await page.evaluate(() => window.__installCapture());
    console.log('   capture installed on Dn ......... ' + installed);
    if (!installed) {
      console.log('   Dn does not exist, so there is nothing to submit. Stopping.');
      console.log('\n   ERRORS: ' + JSON.stringify(errors, null, 2));
      await browser.close();
      process.exit(1);
    }

    await page.evaluate(() => {
      const set = (id, v) => {
        const el = document.querySelector('[data-dn-id="' + id + '"]');
        if (el) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }
      };
      set('name', 'Probe');
      set('surname', 'Contract');
      set('email', 'probe.contract@dengage.com');
      set('gsm', '7700900123');
      const perm = document.querySelector('[data-dn-id="mergedPermission"]');
      if (perm) perm.checked = true;
    });

    await page.click('button.send');
    await page.waitForTimeout(500);

    posted = await page.evaluate(() => window.__posted);
    console.log('   messages posted to parent ....... ' + posted.length);
    console.log(JSON.stringify(posted, null, 2).split('\n').map(l => '   ' + l).join('\n'));

    const marks = await page.evaluate(() => {
      const form = document.querySelector('form.form[data-dn-form-id="subscription_form"]');
      return [...form.querySelectorAll('[data-dn-id]')].map(el => ({
        id: el.dataset.dnId, invalid: el.dataset.dnInvalid,
        message: (el.parentElement.querySelector('[data-dn-invalid-message-type]') || {}).innerHTML || ''
      }));
    });
    console.log('\n5. Per field validity the handler stamped');
    marks.forEach(m => console.log('   ' + m.id.padEnd(18) + 'invalid=' + String(m.invalid).padEnd(7) +
      (m.message ? '"' + m.message.slice(0, 46) + '"' : '')));

    console.log('\n6. Invalid input must be refused, not posted');
    await page.evaluate(() => {
      window.__posted = [];
      const el = document.querySelector('[data-dn-id="email"]');
      el.value = 'not-an-email';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.click('button.send');
    await page.waitForTimeout(400);
    badPosted = await page.evaluate(() => window.__posted.length);
    const emailMark = await page.evaluate(() => {
      const el = document.querySelector('[data-dn-id="email"]');
      return { invalid: el.dataset.dnInvalid,
               shown: getComputedStyle(el.parentElement
                 .querySelector('[data-dn-invalid-message-type]')).display };
    });
    console.log('   posted with a bad email ......... ' + badPosted + '  (must be 0)');
    console.log('   email marked invalid ............ ' + emailMark.invalid);
    console.log('   its message is visible .......... ' + (emailMark.shown !== 'none') +
      '  (display: ' + emailMark.shown + ')');

  } else {
    console.log('\n3 to 6. Form contract: not a form creative, skipped.');
  }

  console.log('\n7. Page errors');
  console.log(errors.length ? JSON.stringify(errors, null, 2) : '   none');

  /* --------------------------------------------------------------------- */
  /* Rules that bind EVERY creative, form or not. These are the ones the five
     form free creatives live or die by, and every one of them has a reason
     recorded in factory/creatives/README.md. */

  let ok2 = true;
  const fail = (label, detail) => {
    ok2 = false;
    console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : ''));
  };
  const pass = label => console.log('   ok    ' + label);

  /* --------------------------------------------------------------------- */
  if (isQuestion) {
    console.log('\n7b. The question_form contract, which writes contact tags');
    const q = await page.evaluate(() => {
      const form = document.querySelector('form.form[data-dn-form-id="question_form"]');
      if (!form) return { formFound: false };
      const block = form.querySelector('.form-block');
      const msg = block && block.querySelector('div.form-message');
      const inputs = block ? [...block.querySelectorAll('input[type="radio"],input[type="checkbox"]')] : [];
      const first = inputs[0];
      const cs = first ? getComputedStyle(first) : null;
      const label = first ? form.querySelector('label[for="' + first.id + '"]') : null;
      return {
        formFound: true,
        blockFound: !!block,
        tagName: block ? block.getAttribute('data-dn-name') : null,
        isRadio: block ? block.getAttribute('data-dn-is-radio') : null,
        messageIsDiv: !!msg,
        inputCount: inputs.length,
        /* THE LOAD BEARING CHECK. The styled labels are driven by the hidden
           input's :checked state, so the input must be invisible but still IN the
           layout. display:none takes it out of the layout and out of the focus
           order, and the whole option row unstyles. Handoff 12.7. */
        inputDisplay: cs ? cs.display : null,
        inputHasLabel: !!label
      };
    });
    ok2 = true;
    const qok = (l, c, d) => { if (c) console.log('   ok    ' + l); else { ok2 = false; console.log('   FAIL  ' + l + (d !== undefined ? '  <' + JSON.stringify(d) + '>' : '')); } };
    qok('the engine\'s selector matches: form.form[data-dn-form-id="question_form"]', q.formFound);
    qok('has a .form-block', q.blockFound);
    qok('the tag name is on .form-block, not the form', !!q.tagName, q.tagName);
    qok('the message element is a DIV (selector is div.form-message)', q.messageIsDiv);
    qok('has radio or checkbox inputs', q.inputCount > 0, q.inputCount);
    qok('each input has a label driving it', q.inputHasLabel);
    qok('hidden inputs are NOT display:none, so the labels still style',
        q.inputDisplay && q.inputDisplay !== 'none', q.inputDisplay);

    /* Nothing selected must be refused. */
    const refused = await page.evaluate(() => {
      window.__tags = [];
      window.Dn.setTags = t => { window.__tags.push(t); };
      document.querySelector('button.send').click();
      const b = document.querySelector('.form-block');
      return { tags: window.__tags.length, invalid: b.getAttribute('data-dn-invalid') };
    });
    qok('an empty answer sends nothing', refused.tags === 0, refused);
    qok('and is marked invalid', refused.invalid === 'true', refused);

    /* A real answer must produce the same payload postQuestion would send. */
    const sent = await page.evaluate(() => {
      window.__tags = [];
      window.Dn.setTags = t => { window.__tags.push(t); };
      const b = document.querySelector('.form-block');
      const input = b.querySelector('input[type="radio"],input[type="checkbox"]');
      input.checked = true;
      const btn = document.querySelector('button.send');
      btn.disabled = false;
      btn.click();
      return {
        tags: window.__tags,
        submitted: (document.querySelector('.container') || {}).getAttribute
          ? document.querySelector('.container').getAttribute('data-dn-is-submitted') : null,
        invalid: b.getAttribute('data-dn-invalid')
      };
    });
    const payload = sent.tags[0];
    qok('an answer calls setTags', Array.isArray(payload), sent.tags);
    qok('the payload is [{tag, value}], the shape postQuestion sends',
        Array.isArray(payload) && payload.length > 0 && payload[0].tag && payload[0].value !== undefined,
        payload);
    qok('the tag matches data-dn-name',
        Array.isArray(payload) && payload[0] && payload[0].tag === q.tagName, { sent: payload, expected: q.tagName });
    /* THE CONFIRMATION PANEL IS NOT SWITCHED ON YET, AND MUST NOT BE. Corrected 10
       August 2026. The engine stamps data-dn-is-submitted only when the parent SDK posts
       { action: 'closeForm', status: 'tagsSuccess' } back into the frame, which happens
       after /api/setTags succeeds. A creative that stamps it itself shows the thank you
       whether or not the answer was stored, which is how a broken capture came to look
       like a working one. */
    qok('the confirmation panel is NOT switched on before the write is confirmed',
        sent.submitted !== 'true', sent);

    /* AND THE SUCCESS ROUND TRIP IS EXERCISED, so the assertion above cannot pass just
       because nothing ever confirms. This is the message the parent really sends. */
    const confirmed = await page.evaluate(() => new Promise((resolve) => {
        window.postMessage({ action: 'closeForm', status: 'tagsSuccess' }, '*');
        setTimeout(() => {
            const c = document.querySelector('.container');
            resolve({ submitted: c ? c.getAttribute('data-dn-is-submitted') : null });
        }, 250);
    }));
    qok('and the engine switches it on when the parent confirms the write',
        confirmed.submitted === 'true', confirmed);
    /* CLEARED MEANS "NOT true", NOT "ABSENT". Both creatives used to remove the
       attribute themselves and this asserted null. They now submit through
       Dn.postQuestion(), and the engine SETS data-dn-invalid="false" rather than
       removing it, so a null test fails on a creative that is working correctly.
       Every invalid style in both files keys on [data-dn-invalid="true"], so "false"
       styles identically to absent, which is what makes this the right assertion
       rather than a loosened one. Checked against the published handler, 10 August
       2026. */
    qok('the invalid stamp is cleared', sent.invalid !== 'true', sent);
  }

  console.log('\n8. Rules every creative must satisfy');

  const body = creative.slice(creative.indexOf('<body'));

  /* Exactly one sendClick. Two double counts one engagement; none makes the
     campaign report read 0 clicks, which is a bad moment in front of a prospect
     caused entirely by a missing line. Handoff 6.3. */
  const clicks = (creative.match(/Dn\.sendClick\s*\(/g) || []).length;
  clicks === 1 ? pass('exactly one Dn.sendClick') : fail('exactly one Dn.sendClick', clicks);

  /* A GAME IS A THIRD CONTRACT, and applying the popup rule to it asserts the
     opposite of what is wanted. A popup's CTA reports then dismisses. A game's CTA
     reports then REVEALS, and dismissing there would hide the prize the visitor
     just won. The panel supplies the close control outside the card, so a game
     needs no close of its own.

     What matters for a game instead is that it CANNOT HANG. Dn.getGameWinner
     rejects after three seconds, and with no coupon configured that is the normal
     path, so a missing catch leaves a wheel spinning in front of a prospect. That
     is the rule worth enforcing here. */
  const isGame = /Dn\.getGameWinner\s*\(/.test(body);
  const closes = (body.match(/Dn\.close\s*\(/g) || []).length;
  if (isGame) {
    pass('game creative: close is the panel\'s job, not this file\'s');
    /Dn\.getGameWinner\([^)]*\)[\s\S]{0,900}?\.catch\s*\(/.test(body)
      ? pass('the draw has a catch, so an unconfigured game cannot hang')
      : fail('the draw has a catch, so an unconfigured game cannot hang');
    /data-state=["'](sorry|lost|empty)["']|'(sorry|lost|empty)'/.test(body)
      ? pass('has a visible fallback state')
      : fail('has a visible fallback state');
  } else if (isQuestion) {
    pass('question creative: close is the panel\'s job, not this file\'s');
  } else {
    closes >= 1 ? pass('at least one Dn.close') : fail('at least one Dn.close', closes);
  }

  /* The panel strips <script> on save, so a creative needing one silently loses
     its behaviour. */
  !/<script[\s>]/i.test(body) ? pass('no script tag') : fail('no script tag');

  /* No navigation. No URL is correct for every demo, and a relative one resolves
     against the iframe rather than the page. */
  const hrefs = (body.match(/href\s*=\s*"[^"]*"/gi) || []).filter(h => !/"#/.test(h));
  hrefs.length === 0 ? pass('no navigating links') : fail('no navigating links', hrefs);

  /* A creative may not depend on a host we do not control. Non-negotiable 4. */
  const urls = (creative.match(/https?:\/\/[^"'\s)]+/g) || [])
    .filter(u => !/w3\.org/.test(u));
  urls.length === 0 ? pass('no off-origin URLs') : fail('no off-origin URLs', urls);

  /* Shared across every demo forever, so no price, currency or percentage.
     Comments and CSS are stripped first so only visible copy is scanned. */
  const text = body.replace(/<style[\s\S]*?<\/style>/gi, '')
                   .replace(/<!--[\s\S]*?-->/g, '')
                   .replace(/<[^>]+>/g, ' ');
  const money = text.match(/[$£€₺]\s?\d|\b\d+\s?%|\b\d+\s?(off|percent)\b/gi) || [];
  money.length === 0 ? pass('no price, currency or percentage in the copy')
                     : fail('no price, currency or percentage in the copy', money);

  /* CSS scoped under one root id. An INLINE creative is not sandboxed: its style
     is lifted into document.head, so one unscoped selector restyles the whole
     storefront. Handoff 12.3. */
  const rootId = (body.match(/<(?:div|form)[^>]*\sid="([^"]+)"/) || [])[1];
  const styles = (body.match(/<style>([\s\S]*?)<\/style>/i) || [])[1] || '';
  const selectors = styles
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('}').map(s => s.split('{')[0].trim())
    .filter(s => s && !s.startsWith('@') && !/^(from|to|\d)/.test(s));
  /* CONTAINS the root id, not STARTS WITH it. "body > #dnf-x" is properly scoped:
     it cannot match anything outside the root, and it is how each creative sizes
     itself when the file is opened on its own for review. Requiring the selector
     to start with the id rejected that and would have pushed the next person to
     delete a harmless rule to satisfy the check. What matters is that no selector
     can escape the root, which is what containment tests. */
  const unscoped = selectors.filter(s =>
    !s.split(',').every(one => one.includes('#' + rootId)));
  rootId ? pass('has a root id: #' + rootId) : fail('has a root id');
  unscoped.length === 0 ? pass('every CSS selector scoped under #' + rootId)
                        : fail('scoped CSS', unscoped.slice(0, 4));

  console.log('\n9. It renders, and the CTA reports before it dismisses');
  const rendered = await page.evaluate(() => {
    const root = document.body.firstElementChild;
    const r = root ? root.getBoundingClientRect() : { width: 0, height: 0 };
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  rendered.h > 20 && rendered.w > 100
    ? pass('renders at ' + rendered.w + 'x' + rendered.h)
    : fail('renders with real size', rendered);

  /* Drive the real control and record the ORDER of calls, because order is the
     thing that matters: closing before reporting loses the click.

     The control is found by its HANDLER, not by class. A game's playable control is
     often not the first .cta on the page, and one that reported from a container
     while carrying a separate Done button made selection by class pick the wrong
     element and read as a creative that never reported. */
  const order = await page.evaluate(() => {
    window.__seq = [];
    ['sendClick', 'close', 'getGameWinner', 'copyText'].forEach(fn => {
      const orig = window.Dn[fn];
      window.Dn[fn] = function () {
        window.__seq.push(fn);
        /* The two promise returning methods must still return a promise, or the
           handler's .then throws and the sequence stops early. */
        if (fn === 'getGameWinner') return Promise.reject(new Error('probe'));
        if (fn === 'copyText') return Promise.resolve(1);
        return orig && orig.apply(this, arguments);
      };
    });
    const el = [...document.querySelectorAll('[onclick]')]
      .find(n => /Dn\.sendClick/.test(n.getAttribute('onclick')));
    if (!el) return null;
    /* If the handler DELEGATES, clicking the handler element itself is not the
       gesture. A delegating handler reads event.target.closest(...) and bails when
       the target is the container rather than one of its children, so clicking the
       container proves nothing. Click a real child control and let it bubble, which
       is what a person does. */
    const child = el.querySelector('button, a[href], [role="button"]');
    (child || el).click();
    return window.__seq;
  });
  if (!order) fail('a control that reports a click exists');
  else if (hasForm) pass('form creative, submit path checked in section 4');
  else if (isGame) {
    order[0] === 'sendClick' && order.includes('getGameWinner')
      ? pass('game reports the click and then draws')
      : fail('game reports the click and then draws', order);
    /* The draw was forced to reject, so the fallback must be on screen. */
    await page.waitForTimeout(250);
    const state = await page.evaluate(() =>
      (document.querySelector('[data-state]') || {}).getAttribute
        ? document.querySelector('[data-state]').getAttribute('data-state') : null);
    /sorry|lost|empty/.test(state || '')
      ? pass('a rejected draw lands in the fallback state, not a hang')
      : fail('a rejected draw lands in the fallback state, not a hang', state);
  }
  else if (isQuestion) pass('question creative, submit path checked in section 7b');
  else if (order.join(',') === 'sendClick,close') pass('CTA reports the click, then dismisses');
  else fail('CTA reports the click, then dismisses', order);

  console.log('\n10. Page errors');
  console.log(errors.length ? JSON.stringify(errors, null, 2) : '   none');

  await browser.close();

  /* A form creative must satisfy both contracts. The others are judged on the
     rules above alone. */
  const formOk = !hasForm || (state.postSubscription === 'function' && state.formFound &&
                              posted.length === 1 && badPosted === 0);
  const good = ok2 && formOk && errors.length === 0;
  const kind = isSubscription ? '(subscription form)'
             : isQuestion ? '(question form, writes contact tags)'
             : isGame ? '(game)'
             : '(no form: click contract only)';
  console.log('\n' + (good ? 'CONTRACT SATISFIED' : 'CONTRACT NOT SATISFIED') + '  ' + kind);
  process.exit(good ? 0 : 1);
}

/* ===========================================================================
   THE FAIL OPEN PROOF.  node factory/checks/creative.js --selftest

   A guard that has only ever seen good input proves nothing, and this
   repository has already shipped two checks that failed open. So the engine
   gate above carries a known bad input: a resource set whose engine script
   runs but deliberately defines nothing, which is exactly what a substituted
   page looks like from inside the browser. The selftest assembles a creative
   against it, runs this same file as a child process the way run.sh does, and
   passes, exit 0, only when the gate catches the bad input with exit 2 and
   stops before the markup assertions. Nothing in CI invokes it; it exists to
   be run by hand whenever this file changes. */
async function selftest() {
  const os = require('os');
  const http = require('http');
  const { spawn } = require('child_process');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'creative-selftest-'));
  const wrap = (name, source) => fs.writeFileSync(path.join(dir, name),
    '__dn_selftest__(`' + source + '`)', 'utf8');
  wrap('dn-shared.css.js', '.dn-selftest { color: inherit; }');
  /* The engine under test: it parses, it runs, and it defines nothing.
     window.Dn must stay undefined so the gate has something real to catch. */
  wrap('dn-shared.js', '(function () { var definesNothing = true; })();');
  wrap('dn-container.css.js', '.dn-selftest-container { display: block; }');
  wrap('dn-form-handler.js', '(function () {})();');

  const creativePath = path.join(dir, 'selftest-creative.html');
  fs.writeFileSync(creativePath,
    '<!doctype html><html><head><title>selftest</title></head><body>' +
    '<div id="dnf-selftest" onclick="Dn.sendClick(&quot;selftest&quot;); Dn.close();">probe</div>' +
    '</body></html>', 'utf8');

  /* An ephemeral port, so the selftest can never collide with the suite's two
     fixture servers or with another checkout running in parallel. */
  const server = http.createServer((req, res) => {
    const name = path.basename(req.url.split('?')[0]);
    try {
      const bytes = fs.readFileSync(path.join(dir, name));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(bytes);
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  /* spawn, not spawnSync: the child fetches its page from THIS process's
     server, and a synchronous wait would block the event loop that serves it,
     so the child would hang on a request the parent can never answer. */
  let output = '';
  const status = await new Promise(resolve => {
    const child = spawn(process.execPath, [__filename, creativePath], {
      env: Object.assign({}, process.env, {
        DN_RESOURCE_DIR: dir,
        ASSEMBLED_DIR: dir,
        SERVE_URL: 'http://127.0.0.1:' + port + '/'
      })
    });
    child.stdout.on('data', d => { output += d; });
    child.stderr.on('data', d => { output += d; });
    child.on('close', resolve);
  });
  server.close();

  const caughtIt = status === 2 &&
    output.includes('THE ENGINE SCRIPT DID NOT RUN IN THE ASSEMBLED PAGE');
  const stoppedEarly = !output.includes('8. Rules every creative must satisfy');

  console.log('selftest: an engine that defines nothing must trip the gate');
  console.log('   child exit code ................. ' + status + '   (must be 2)');
  console.log('   loud failure printed ............ ' + caughtIt);
  console.log('   markup assertions not reached ... ' + stoppedEarly);
  if (caughtIt && stoppedEarly) {
    console.log('\nSELFTEST PASSED: the gate catches a page whose engine never ran.');
    process.exit(0);
  }
  console.log('\nSELFTEST FAILED: the gate did not catch the bad input. Child output:');
  console.log(output.split('\n').map(l => '   ' + l).join('\n'));
  process.exit(1);
}

if (process.argv[2] === '--selftest') {
  selftest().catch(e => {
    console.log('SELFTEST FAILED to run at all: ' + (e && e.message ? e.message : e));
    process.exit(1);
  });
} else {
  /* A rejection out of main is a harness fault, not a verdict on the creative.
     It must still fail the suite, so exit 2, but as one readable line rather
     than an uncaught stack trace, and without leaving a browser behind. */
  main().catch(async e => {
    console.log('\nHARNESS ERROR, not a verdict on this creative: ' +
      (e && e.message ? e.message : e));
    if (browser) { try { await browser.close(); } catch (e2) { /* already gone */ } }
    process.exit(2);
  });
}
