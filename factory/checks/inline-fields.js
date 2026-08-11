/* ============================================================================
   THE INLINE CREATIVES, ASSEMBLED THE WAY THE PANEL ACTUALLY ASSEMBLES THEM.

   Handoff 5.2, 9.1. Run from the repository root:  bash factory/checks/run.sh

   WHY THIS EXISTS. The panel's Custom Inline template does not take one document.
   It takes THREE separate fields, Html, Style and Script, and supplies the
   .dn-inline-html, .dn-inline-style and .dn-inline-script wrappers itself.

   The creatives were authored as a single document carrying all three wrappers
   plus a comment header, which is what a one-field editor would need. Pasted into
   the Html field that nests the style and the script inside the markup, so the
   engine finds a .dn-inline-html whose content is a comment and two inert
   elements, and nothing renders. No error anywhere: the campaign fires, the
   engine reports it displayed, and the slot stays empty.

   So this file reads the three split fields from factory/creatives/inline/<name>/
   and reassembles them exactly as the panel does, then asserts the slot actually
   gained height. Anything that only ever checks the single-document form would
   keep passing while every live inline campaign renders nothing.
   ========================================================================== */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const T = {
  'below-header':    ['#dn_inline_target_below_header', ''],
  'below-hero':      ['#dn_inline_target_below_hero', ''],
  'in-grid':         ['#dn_inline_target_in_grid', ''],
  'above-footer':    ['#dn_inline_target_above_footer', ''],
  'pdp-below-price': ['#dn_inline_target_pdp_below_price', 'product.html?id=']
};
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    /* The SDK hosts resolve to nowhere INSIDE THIS BROWSER, so what these
       checks record is always the page's own stub, on every machine. The
       comment used to claim the CDN was unreachable from the sandbox, which
       was true here and false on any machine with internet, where the real
       SDK loaded mid-check and raced the recorder. Enforced, not assumed. */
    args: ['--host-resolver-rules=MAP pcdn.dengage.com ~NOTFOUND, MAP push.dengage.com ~NOTFOUND'] });
  let bad = 0;
  for (const [n, [sel, suffix]] of Object.entries(T)) {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
    await p.addInitScript(() => { window.dengage = function(){}; });
    let url = 'http://localhost:8101/template/';
    if (suffix) {
      await p.goto(url, {waitUntil:'domcontentloaded'});
      await p.waitForFunction(() => window.Catalog && window.Catalog.all().length, null, {timeout:20000});
      url += suffix + encodeURIComponent(await p.evaluate(() => window.Catalog.all()[0].id));
    }
    await p.goto(url, {waitUntil:'domcontentloaded'});
    await p.waitForFunction(() => window.Catalog && window.Catalog.all().length, null, {timeout:20000});
    const d = path.join('factory/creatives/inline', n);
    const html  = fs.readFileSync(path.join(d,'html.html'),'utf8');
    const style = fs.readFileSync(path.join(d,'style.css'),'utf8');
    const script= fs.readFileSync(path.join(d,'script.js'),'utf8');
    /* Exactly how the panel assembles a Custom Inline: it supplies the three
       wrapper elements and drops each field inside its own. */
    const res = await p.evaluate(({html,style,script,sel}) => {
      const holder = document.createElement('div');
      holder.innerHTML =
        '<div class="dn-inline-html">' + html + '</div>' +
        '<style class="dn-inline-style">' + style + '</style>' +
        '<script class="dn-inline-script">' + script + '<\/script>';
      const H = holder.querySelector('.dn-inline-html');
      const S = holder.querySelector('.dn-inline-style');
      const J = holder.querySelector('.dn-inline-script');
      if (!H || !S || !J) return {err:'wrapper missing'};
      if (!H.innerHTML) return {err:'html field empty, SDK would skip'};
      document.head.appendChild(S.cloneNode(true));
      const t = document.querySelector(sel); t.innerHTML='';
      t.appendChild(H.cloneNode(true));
      try { (new Function(J.innerHTML))(); } catch(e){ return {err:'script threw: '+e.message}; }
      return {ok:1};
    }, {html,style,script,sel});
    await p.waitForTimeout(900);
    const h = await p.locator(sel).first().evaluate(n => Math.round(n.getBoundingClientRect().height));
    const ok = !res.err && h > 20;
    if (!ok) bad++;
    console.log('  ' + n.padEnd(18) + (res.err ? 'FAIL ' + res.err : 'renders, height ' + h));
    await p.close();
  }
  /* THE PANEL PREVIEW, which is where this last failed. The preview renders the
     three fields with no window.Catalog, because that object only exists on a
     demo page. A creative whose Html field is an empty hidden placeholder is
     therefore BLANK in the preview and blank on screen the moment the script
     cannot run, and neither state reports an error.

     So the Html field must be a standing skeleton that renders on its own, and
     the skeleton must use the SAME class names the script emits, or the CSS
     styles nothing and it renders as a stack of unformatted text. That is exactly
     how in-grid failed: invented class names, correct content, no card. */
  console.log('\n  preview, no window.Catalog:');
  const fsx = require('fs'), px = require('path');
  for (const n of Object.keys(T)) {
    const d = px.join('factory/creatives/inline', n);
    const html = fsx.readFileSync(px.join(d,'html.html'),'utf8');
    const style = fsx.readFileSync(px.join(d,'style.css'),'utf8');
    const p2 = await (await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    /* The SDK hosts resolve to nowhere INSIDE THIS BROWSER, so what these
       checks record is always the page's own stub, on every machine. The
       comment used to claim the CDN was unreachable from the sandbox, which
       was true here and false on any machine with internet, where the real
       SDK loaded mid-check and raced the recorder. Enforced, not assumed. */
    args: ['--host-resolver-rules=MAP pcdn.dengage.com ~NOTFOUND, MAP push.dengage.com ~NOTFOUND'] })).newPage();
    await p2.setContent('<style>:root{--ink:#14181b;--muted:#667085;--surface:#fff;--page:#f4f5f7;'
      + '--line:#e5e7eb;--primary:#125cfa;--radius:10px;--tint:#eef3ff;--display-font:system-ui}'
      + 'body{margin:0;padding:16px;font:14px system-ui}</style><style>' + style + '</style>'
      + '<div class="dn-inline-html">' + html + '</div>');
    const root = await p2.evaluate(() => {
      const el = document.querySelector('[id^="dnil-"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { h: Math.round(r.height), text: (el.innerText||'').trim().length };
    });
    /* EVERY CLASS THE SKELETON USES MUST BE STYLED BY THIS CREATIVE'S OWN CSS.
       Stated this way round on purpose. The reverse, every script class must be
       in the skeleton, produces false failures on conditional branches: in-grid
       emits .none for price-on-request and .was for a struck-through original,
       and a skeleton showing neither is correct.

       This direction is what catches the real defect. in-grid's first skeleton
       invented .tag, .crumb, .name and .cta while the CSS styles .flag, .cat, h3
       and a.go, so every rule missed and the preview was a stack of unformatted
       text with a plain blue link where the button should be. */
    const cls = s => new Set([...s.matchAll(/class="([a-z0-9 _-]+)"/g)]
      .flatMap(m => m[1].split(/\s+/)).filter(Boolean));
    const missing = [...cls(html)].filter(c => style.indexOf('.' + c) === -1);
    const ok = root && root.h > 20 && root.text > 10 && missing.length === 0;
    if (!ok) bad++;
    console.log('    ' + n.padEnd(18) + (root ? 'height ' + String(root.h).padStart(4) : 'NO ROOT')
      + (missing.length ? '  UNSTYLED CLASSES: ' + missing.join(',') : '  styled'));
    await p2.context().browser().close();
  }

  /* THE SINGLE DOCUMENT FORM, which is what a one field editor takes and what the
     reference banking creative uses. Both forms have to work: the split fields
     for the Custom Inline template, this for a plain HTML one. They are generated
     from the same three sources, so the only way they drift is if someone edits
     one and not the other, which is exactly what this catches. */
  console.log('\n  single document, no window.Catalog:');
  for (const n of Object.keys(T)) {
    const doc = fsx.readFileSync(px.join('factory/creatives/inline', n + '.html'), 'utf8');
    const p3 = await b.newPage({ viewport: { width: 1100, height: 420 } });
    await p3.setContent('<style>:root{--ink:#14181b;--muted:#667085;--surface:#fff;--page:#f4f5f7;'
      + '--line:#e5e7eb;--primary:#125cfa;--radius:10px;--tint:#eef3ff;--display-font:system-ui}'
      + 'body{margin:0;padding:16px;font:14px system-ui}</style>' + doc);
    await p3.waitForTimeout(350);
    const r = await p3.evaluate(() => {
      const el = document.querySelector('[id^="dnil-"]');
      if (!el) return null;
      return { h: Math.round(el.getBoundingClientRect().height), text: (el.innerText || '').trim().length };
    });
    const ok = r && r.h > 20 && r.text > 10;
    if (!ok) bad++;
    console.log('    ' + n.padEnd(18) + (r ? 'height ' + String(r.h).padStart(4) + (ok ? '  renders' : '  BLANK') : '  NO ROOT'));
    await p3.close();
  }

  await b.close();
  process.exit(bad ? 1 : 0);
})();
