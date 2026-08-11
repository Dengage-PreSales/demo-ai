/* ============================================================================
   THE LAUNCHER OFFERS EVERY CAMPAIGN THE FACTORY BUILDS, AND NOTHING ELSE.

   Handoff 2.2, 9.1. Run from the repository root:  bash factory/checks/run.sh

   WHY THIS FILE EXISTS. The creatives folder and js/panels.js are two lists of the
   same campaigns, maintained by hand, and they drifted: fourteen
   creatives were written, committed and documented while the launcher still offered
   eight. Nothing failed. Every other check passed, the site was live, and the only
   symptom was a group of scenarios that no button could reach, which is invisible
   unless someone counts.

   So this check counts, in both directions, against the FILE NAMES ON DISK rather
   than a list written out here. A list written out here would be a third copy to
   drift.

     creative on disk with no button   cannot be demonstrated at all
     button with no creative on disk   fires an event nothing answers, which on
                                       screen is identical to a broken widget

   THE TWO GESTURE CARDS ARE ASSERTED NOT TO FIRE. Exit intent listens for the
   pointer leaving the window and scroll depth for a scroll position, so neither has
   a data layer event to push. A button that pushes one anyway would put a line in
   the log saying it fired, which is worse than no button.

   THE INLINE SLOT CHECK IS THE SUBTLE ONE. Three of the five slots exist on one
   page only. Firing one from the wrong page is answered correctly by the campaign
   and renders nowhere, so the operator sees the product fail when they are simply
   on the wrong page. The launcher must refuse instead, and refusing means NOT
   pushing the event, which is what is asserted here by watching the calls.
   ========================================================================== */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.TEMPLATE_URL || 'http://localhost:8101/template/';
const CREATIVES = path.join(__dirname, '..', 'creatives');

let pass = 0, fail = 0;
const ok = (label, cond, detail) => {
  if (cond) { pass++; console.log('   ok    ' + label); }
  else { fail++; console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : '')); }
};

/* Every campaign the factory ships, derived from the folder. The inline five carry
   the inline- prefix in their trigger name but not in their file name, which is the
   one place the two lists are not a literal match, so it is spelled out once here
   rather than in each entry. */
function creativesOnDisk() {
  const slugs = [];
  const drop = f => f.endsWith('.html');

  for (const f of fs.readdirSync(CREATIVES).filter(drop)) {
    slugs.push(path.basename(f, '.html'));
  }
  /* The three variants are arms of ONE campaign with one trigger name, so the
     folder contributes a single slug rather than three. */
  if (fs.existsSync(path.join(CREATIVES, 'ab-testing'))) slugs.push('ab-test');

  for (const f of fs.readdirSync(path.join(CREATIVES, 'gamification')).filter(drop)) {
    slugs.push(path.basename(f, '.html'));
  }
  for (const f of fs.readdirSync(path.join(CREATIVES, 'inline')).filter(drop)) {
    slugs.push('inline-' + path.basename(f, '.html'));
  }
  return slugs.sort();
}

(async () => {
  const disk = creativesOnDisk();
  console.log('\n0. What is on disk');
  console.log('   ' + disk.length + ' campaign(s): ' + disk.join(' '));

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    /* The SDK hosts resolve to nowhere INSIDE THIS BROWSER, so what these
       checks record is always the page's own stub, on every machine. The
       comment used to claim the CDN was unreachable from the sandbox, which
       was true here and false on any machine with internet, where the real
       SDK loaded mid-check and raced the recorder. Enforced, not assumed. */
    args: ['--host-resolver-rules=MAP pcdn.dengage.com ~NOTFOUND, MAP push.dengage.com ~NOTFOUND'] });
  const page = await browser.newPage();
  const errors = [];
  /* The SDK hosts are refused by the launch flags above, so the loader request
     always fails, by construction rather than by circumstance. */
  const IGNORE = /fonts\.googleapis|fonts\.gstatic|favicon|404|pcdn\.dengage\.com/;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const s = m.text(), from = (m.location() && m.location().url) || '';
    if (IGNORE.test(s) || IGNORE.test(from)) return;
    errors.push(s);
  });

  /* WHAT IS WATCHED IS THE DATA LAYER, not window.dengage, and getting that wrong
     is worth a note. Every campaign here is triggered by a Data Layer Event, so
     DengageEvents.scenario pushes onto window.dataLayer and never calls the SDK
     function. A stub on window.dengage records nothing when a scenario fires, and
     then reads as "the launcher pushed nothing" for the fires and the refusals
     alike, which is the same wrong answer twice.

     The array is created up front so it exists before the first press. That is
     what the page does anyway: scenario() opens with dataLayer = dataLayer || []. */
  await page.addInitScript(() => {
    window.dataLayer = window.dataLayer || [];
    window.dengage = function () {};
  });

  /* Firing a scenario closes the launcher, on purpose: its scrim would cover the
     widget it just fired. So every press needs the panel reopened first, and this
     asks whether it is already open rather than blind-clicking a toggle. Without
     it the click lands on the hero behind the closed modal and Playwright waits
     thirty seconds for a button it can see but cannot reach. */
  const openPanel = async () => {
    if (await page.locator('#dengage-panel.open').count() === 0) {
      await page.click('.panel-toggle button');
      await page.waitForSelector('#dengage-panel.open');
      await page.waitForTimeout(250);   // the open transition
    }
  };

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.Panels && window.Catalog && window.Catalog.all().length,
    null, { timeout: 20000 });

  console.log('\n1. The list in js/panels.js matches the folder, both directions');
  const listed = await page.evaluate(() => window.Panels.SCENARIOS.map(s => s.slug));
  /* panel:true marks a campaign authored in the panel's own builder, so it has a
     card and no file on purpose. Exempting it by name would rot the moment another
     one appears, so the exemption is read off the list itself. Everything not
     flagged still has to have a file. */
  const panelAuthored = await page.evaluate(() =>
    window.Panels.SCENARIOS.filter(s => s.panel).map(s => s.slug));
  /* An action card is not a campaign at all: it calls the SDK directly, so it has
     no creative, no trigger name and nothing in the panel to point at. Web push is
     the only one today. Excluded from the file count for the same reason panel
     authored cards are, and asserted separately below. */
  const actions = await page.evaluate(() =>
    window.Panels.SCENARIOS.filter(s => s.action).map(s => s.slug));
  const fromFiles = listed.filter(s =>
    panelAuthored.indexOf(s) === -1 && actions.indexOf(s) === -1);

  const missing = disk.filter(s => fromFiles.indexOf(s) === -1);
  const extra = fromFiles.filter(s => disk.indexOf(s) === -1);
  ok('every creative on disk is in the launcher list', missing.length === 0, missing);
  ok('nothing claims a creative it does not have', extra.length === 0, extra);
  ok(disk.length + ' creatives on disk, and the same number of file backed cards',
    fromFiles.length === disk.length, { disk: disk.length, fileBacked: fromFiles.length });
  /* A panel authored card must be deliberate, not a typo that happens to have no
     file. Assert the flag exists rather than inferring it from the absence of one. */
  ok(panelAuthored.length + ' panel authored campaign(s), each flagged deliberately',
    panelAuthored.every(s => disk.indexOf(s) === -1), panelAuthored);
  ok(actions.length + ' action card(s), none of them claiming a creative',
    actions.every(s => disk.indexOf(s) === -1), actions);
  /* An action card must render as one. Getting this wrong would draw it like a
     campaign trigger, and pressing it would look like a widget that never fired. */
  const actionCards = await page.evaluate(() =>
    [...document.querySelectorAll('#launcher-grid [data-action]')].map(n => ({
      action: n.getAttribute('data-action'),
      styled: n.className.indexOf('action') !== -1,
      label: (n.querySelector('.slug') || {}).textContent || ''
    })));
  ok('every action card renders as an action, not as a trigger',
    actionCards.length === actions.length &&
    actionCards.every(c => c.styled && c.label && c.label.indexOf('dengage_demo_') === -1),
    actionCards);

  console.log('\n2. Every one of them renders a card');
  const rendered = await page.evaluate(() =>
    [...document.querySelectorAll('#launcher-grid [data-scenario], #launcher-grid [data-gesture], #launcher-grid [data-action]')]
      .map(n => n.getAttribute('data-scenario') || n.getAttribute('data-gesture') ||
                (window.Panels.SCENARIOS.filter(s => s.action === n.getAttribute('data-action'))[0] || {}).slug));
  const notRendered = listed.filter(s => rendered.indexOf(s) === -1);
  ok('no campaign is left without a card', notRendered.length === 0, notRendered);
  ok('cards and list are the same length',
    rendered.length === listed.length, { rendered: rendered.length, listed: listed.length });

  console.log('\n3. Groups, so a wall of buttons stays legible');
  const groups = await page.evaluate(() =>
    [...document.querySelectorAll('#launcher-grid .launcher-group')].map(n => n.textContent.trim()));
  /* Derived, not hardcoded. This read "four group headings" and broke the moment a
     fifth group was added, which is the same third-copy-that-drifts problem this
     whole file exists to prevent. The number of headings is a fact about the page,
     so ask the page: every group that has at least one member gets exactly one. */
  const groupsWithMembers = await page.evaluate(() =>
    window.Panels.GROUPS.filter(g =>
      window.Panels.SCENARIOS.some(s => s.group === g.id)).length);
  ok(groupsWithMembers + ' group headings, one per populated group',
    groups.length === groupsWithMembers, { rendered: groups.length, expected: groupsWithMembers, groups });
  ok('none of them renders as its own copy key',
    groups.every(g => !/^group[A-Z]/.test(g)), groups);
  ok('each heading carries its count',
    groups.every(g => /\d+$/.test(g)), groups);

  console.log('\n4. The five recommendation strategies are offered');
  /* Restored 6 August 2026, Salil's call. These five compute from the demo's own
     catalogue rather than from a product feed inside Dengage, so they were never
     blocked by what Product Box, Smart Search and Dengage's own engine are waiting
     on; they had been parked alongside those three on presentation grounds only.
     Dengage's engine stays parked, and js/panels.js keeps the two decisions apart.

     Asserted as five rather than "some", because a page that restored the heading
     and not the grid, or the grid on one page and not the other, is exactly the
     half-done state this check exists to catch. */
  ok('all five strategy cards render',
    await page.locator('#rec-grid [data-reco]').count() === 5);
  ok('under their own heading',
    await page.locator('h2:has-text("Recommendations")').count() === 1);
  const offered =
    await page.locator('#launcher-grid [data-scenario], #launcher-grid [data-gesture], #launcher-grid [data-action]').count();
  ok('every campaign is offered and nothing else, ' + listed.length + ' in total',
    offered === listed.length, { offered, expected: listed.length });

  console.log('\n5. A normal scenario fires, exactly once, with the prefix');
  await openPanel();
  await page.evaluate(() => { window.dataLayer.length = 0; });
  await page.click('#launcher-grid [data-scenario="spin-to-win"]');
  await page.waitForTimeout(200);
  const spin = await page.evaluate(() => window.dataLayer.slice());
  ok('one data layer push went out', spin.length === 1, spin);
  ok('it is the prefixed trigger name',
    spin.length === 1 && JSON.stringify(spin[0]).indexOf('dengage_demo_spin-to-win') !== -1, spin);

  console.log('\n6. The two gesture cards do NOT fire, and say what to do instead');
  for (const slug of ['exit-intent', 'scroll-depth']) {
    await page.evaluate(() => { window.dataLayer.length = 0; });
    await openPanel();
    const card = page.locator('#launcher-grid [data-gesture="' + slug + '"]');
    ok(slug + ': rendered as a gesture card, not a fire button',
      await card.count() === 1 && (await card.getAttribute('class')).indexOf('gesture') !== -1);
    const hint = (await card.locator('.slug').textContent()).trim();
    ok(slug + ': the card names the gesture rather than a trigger',
      hint.length > 12 && hint.indexOf('dengage_demo_') === -1, hint);
    await card.click();
    await page.waitForTimeout(200);
    const calls = await page.evaluate(() => window.dataLayer.slice());
    ok(slug + ': nothing was pushed to the data layer', calls.length === 0, calls);
    const logText = await page.locator('#panel-log').textContent();
    ok(slug + ': the log explains it instead of claiming it fired',
      logText.indexOf('is not fired from here') !== -1, logText.slice(0, 120));
  }

  console.log('\n7. Inline: the home page slots fire, the product page slot refuses');
  await openPanel();
  for (const slug of ['inline-below-header', 'inline-below-hero', 'inline-in-grid', 'inline-above-footer']) {
    const cls = await page.locator('#launcher-grid [data-scenario="' + slug + '"]').getAttribute('class');
    ok(slug + ': offered normally on the home page', cls.indexOf('elsewhere') === -1, cls);
  }
  const pdpClass = await page.locator('#launcher-grid [data-scenario="inline-pdp-below-price"]')
    .getAttribute('class');
  ok('inline-pdp-below-price: marked as living on another page',
    pdpClass.indexOf('elsewhere') !== -1, pdpClass);

  await openPanel();
  await page.evaluate(() => { window.dataLayer.length = 0; });
  await page.click('#launcher-grid [data-scenario="inline-pdp-below-price"]');
  await page.waitForTimeout(200);
  const refused = await page.evaluate(() => window.dataLayer.slice());
  ok('it refuses rather than firing into a slot that is not here',
    refused.length === 0, refused);
  ok('and the log names the missing target',
    (await page.locator('#panel-log').textContent()).indexOf('dn_inline_target_pdp_below_price') !== -1);

  await openPanel();
  await page.evaluate(() => { window.dataLayer.length = 0; });
  await page.click('#launcher-grid [data-scenario="inline-below-hero"]');
  await page.waitForTimeout(200);
  const hero = await page.evaluate(() => window.dataLayer.slice());
  ok('a slot that IS here fires normally', hero.length === 1, hero);
  ok('and the log says inline renders in the page, not over it',
    (await page.locator('#panel-log').textContent()).indexOf('into its slot in the page') !== -1);

  console.log('\n8. On a product page the availability flips');
  const first = await page.evaluate(() => window.Catalog.all()[0].id);
  await page.goto(BASE + 'product.html?id=' + encodeURIComponent(first), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.Panels && window.Catalog && window.Catalog.all().length,
    null, { timeout: 20000 });
  await openPanel();
  const pdpHere = await page.locator('#launcher-grid [data-scenario="inline-pdp-below-price"]')
    .getAttribute('class');
  ok('inline-pdp-below-price: offered normally on a product page',
    pdpHere.indexOf('elsewhere') === -1, pdpHere);
  for (const slug of ['inline-below-hero', 'inline-in-grid']) {
    const cls = await page.locator('#launcher-grid [data-scenario="' + slug + '"]').getAttribute('class');
    ok(slug + ': marked as living on another page here', cls.indexOf('elsewhere') !== -1, cls);
  }
  await openPanel();
  await page.evaluate(() => { window.dataLayer.length = 0; });
  await page.click('#launcher-grid [data-scenario="inline-pdp-below-price"]');
  await page.waitForTimeout(200);
  ok('and it fires from the page that has the slot',
    (await page.evaluate(() => window.dataLayer.length)) === 1);

  console.log('\n9. No page errors');
  console.log(errors.length ? JSON.stringify(errors, null, 2) : '   none');
  ok('clean console', errors.length === 0, errors.slice(0, 3));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
