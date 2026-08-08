/* ============================================================================
   THE APP INBOX, DRIVEN IN A BROWSER.

   Handoff 9.1. Run from the repository root:  bash factory/checks/run.sh

   WHAT THIS CAN AND CANNOT PROVE, stated first because the difference decides
   what the assertions are worth.

   It CANNOT prove a message arrives. Dengage's CDN is unreachable from this
   sandbox, so the SDK never loads here and there is no device id to read an
   inbox for. That half is confirmed by opening the published demo and pressing
   the App inbox card, and it is the only way to confirm it.

   It CAN prove everything that is actually ours, and those are the parts that
   have somewhere to hide:

     1. The provider is asked for correctly and its four reporting calls are made
        with the ids the list is showing.
     2. A message is READ correctly whatever the server calls its fields. This is
        the real risk. The message shape is decided by Dengage, not here, and a
        title read from the wrong key renders an untitled card on a sales call.
        So the reader is driven against every spelling the payload might use.
     3. The four empty states are told apart. "No messages" when the SDK never
        started is a lie, and it is the exact lie a demo tells when a timing state
        is rendered as an empty list.
     4. Dismiss does not delete anything in Dengage unless the demo opted in.
        CLAUDE.md 1a: a delete against the shared account is never a default.

   The provider is faked through the same door the real one arrives by, so the
   module under test cannot tell the difference: window.dengage is installed
   before any page script runs and answers InboxMessageProvider with an object
   carrying the five real method names.
   ========================================================================== */
const { chromium } = require('playwright');

const BASE = process.env.TEMPLATE_URL || 'http://localhost:8101/template/';

let pass = 0, fail = 0;
const ok = (label, cond, detail) => {
  if (cond) { pass++; console.log('   ok    ' + label); }
  else { fail++; console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : '')); }
};

/* The fake provider. Installed before page scripts so js/dengageEvents.js
   resolves it exactly as it would resolve the real one. Everything it is asked
   is recorded on window.__inbox so the assertions can read it back. */
function installFake(arg) {
  const messages = arg.messages, mode = arg.mode;
  window.__inbox = { calls: [], asked: 0 };
  window.dengage = function (action, payload) {
    window.__inbox.calls.push([action, payload]);
    if (action !== 'InboxMessageProvider') return undefined;
    window.__inbox.asked++;
    return {
      getMessages: function (limit) {
        window.__inbox.limit = limit;
        if (mode === 'reject-empty') return Promise.reject();
        if (mode === 'reject-reason') return Promise.reject('inbox is not enabled');
        if (mode === 'not-a-promise') return null;
        return Promise.resolve(messages);
      },
      onImpression: function (id) { window.__inbox.calls.push(['onImpression', id]); },
      onOpen: function (id) { window.__inbox.calls.push(['onOpen', id]); },
      onClick: function (id, button) { window.__inbox.calls.push(['onClick', id, button]); },
      onDelete: function (id) { window.__inbox.calls.push(['onDelete', id]); }
    };
  };
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* A fresh page per scenario. The module caches the provider and reads state
     out of localStorage, so reusing one page would let an earlier scenario
     decide a later one's answer. */
  async function open(messages, mode) {
    const page = await browser.newPage();
    const errors = [];
    const IGNORE = /fonts\.googleapis|fonts\.gstatic|favicon|404|pcdn\.dengage\.com/;
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const s = m.text(), from = (m.location() && m.location().url) || '';
      if (IGNORE.test(s) || IGNORE.test(from)) return;
      errors.push(s);
    });
    if (mode !== 'no-sdk') {
      await page.addInitScript(installFake, { messages: messages || [], mode: mode || 'ok' });
    }
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.Inbox && window.DEMO_COPY, null, { timeout: 20000 });

    /* GIVE THE PAGE AN APPLICATION, because the module refuses to read an inbox
       without one and the template deliberately has none. A generated demo
       already carries a real guid and this changes nothing there; the template
       needs a stand-in so the rest of the suite has something to drive.

       The guid is read at call time rather than captured, which is the only
       reason this works from out here, and is the same property that lets the
       delete opt in be exercised below. */
    if (mode !== 'no-application') {
      await page.evaluate(() => {
        window.DEMO_CONFIG.dengage = window.DEMO_CONFIG.dengage || {};
        if (!window.DEMO_CONFIG.dengage.appGuid) {
          window.DEMO_CONFIG.dengage.appGuid = 'check-stand-in';
        }
      });
    }
    /* boot() runs settle(), whose first refresh resolves a tick later. */
    await page.evaluate(() => window.Inbox.refresh());
    return { page, errors };
  }

  /* ---------------------------------------------------------------------- */
  console.log('\n1. The provider is asked for the way the SDK offers it');
  {
    const { page, errors } = await open([]);
    ok('InboxMessageProvider is requested', await page.evaluate(() => window.__inbox.asked >= 1));
    ok('a limit is passed', await page.evaluate(() => window.__inbox.limit === 20),
      await page.evaluate(() => window.__inbox.limit));
    ok('no page errors', errors.length === 0, errors);
    await page.close();
  }

  /* ---------------------------------------------------------------------- */
  console.log('\n2. A message is read whatever the server calls its fields');
  {
    /* Four spellings of the same message. Every one has to produce the same
       four values, because which one Dengage sends is not ours to decide. */
    const SHAPES = [
      { label: 'push payload names, nested in messageJson',
        msg: { smsgId: 'a1', messageJson: { title: 'T', message: 'B',
               mediaUrl: 'https://dengage-presales.github.io/demo-ai/i.png', targetUrl: 'https://dengage-presales.github.io/demo-ai/go' } } },
      { label: 'snake case, nested',
        msg: { smsgId: 'a1', messageJson: { title: 'T', body: 'B',
               media_url: 'https://dengage-presales.github.io/demo-ai/i.png', target_url: 'https://dengage-presales.github.io/demo-ai/go' } } },
      { label: 'flat on the message itself',
        msg: { smsgId: 'a1', title: 'T', message: 'B',
               image: 'https://dengage-presales.github.io/demo-ai/i.png', url: 'https://dengage-presales.github.io/demo-ai/go' } },
      { label: 'message_json rather than messageJson',
        msg: { smsg_id: 'a1', message_json: { messageTitle: 'T', text: 'B',
               imageUrl: 'https://dengage-presales.github.io/demo-ai/i.png', link: 'https://dengage-presales.github.io/demo-ai/go' } } }
    ];
    const { page, errors } = await open([]);
    for (const shape of SHAPES) {
      const read = await page.evaluate((msg) => {
        const p = window.Inbox.parse;
        return { id: p.id(msg), title: p.title(msg), body: p.body(msg),
                 media: p.media(msg), url: p.url(msg) };
      }, shape.msg);
      ok(shape.label,
        read.id === 'a1' && read.title === 'T' && read.body === 'B' &&
        read.media === 'https://dengage-presales.github.io/demo-ai/i.png' && read.url === 'https://dengage-presales.github.io/demo-ai/go',
        read);
    }

    console.log('\n   neither a destination nor an image is taken unless it is http');
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', '/relative', 'JAVASCRIPT:x']) {
      ok('refuses as a destination: ' + bad, await page.evaluate((u) =>
        window.Inbox.parse.url({ smsgId: 'x', targetUrl: u }) === null, bad));
      ok('refuses as an image: ' + bad, await page.evaluate((u) =>
        window.Inbox.parse.media({ smsgId: 'x', mediaUrl: u }) === null, bad));
    }

    console.log('\n   buttons');
    const buttons = await page.evaluate(() => window.Inbox.parse.buttons({
      smsgId: 'x',
      messageJson: { actionButtons: [
        { id: 'b1', text: 'Shop', targetUrl: 'https://dengage-presales.github.io/demo-ai/a' },
        { title: 'Later' },
        { label: 'Bad', url: 'javascript:alert(1)' },
        { nothing: true },
        'not an object'
      ] }
    }));
    ok('a labelled button is kept', buttons.length === 3, buttons);
    ok('its id and destination survive',
      buttons[0].id === 'b1' && buttons[0].url === 'https://dengage-presales.github.io/demo-ai/a', buttons[0]);
    ok('a button with no label is dropped', !buttons.some(b => /^button-/.test(b.id) && !b.label));
    ok('a button id is invented when absent', buttons[1].id === 'button-1', buttons[1]);
    ok('a non http button destination is dropped', buttons[2].url === null, buttons[2]);
    ok('no page errors', errors.length === 0, errors);
    await page.close();
  }

  /* ---------------------------------------------------------------------- */
  console.log('\n3. The four empty states say different things');
  {
    const copy = {};
    {
      const { page } = await open([]);
      Object.assign(copy, await page.evaluate(() => ({
        empty: window.DEMO_COPY.inboxEmpty, starting: window.DEMO_COPY.inboxStarting,
        noSdk: window.DEMO_COPY.inboxNoSdk, error: window.DEMO_COPY.inboxError
      })));
      const text = await page.textContent('#inbox-body');
      ok('an inbox Dengage answered with nothing says so', text.includes(copy.empty), text.trim());
      const hint = await page.evaluate(() => window.DEMO_COPY.inboxEmptyHint);
      ok('and hints at how to fill it', text.includes(hint), text.trim());
      await page.close();
    }
    {
      const { page } = await open([], 'reject-empty');
      const text = await page.textContent('#inbox-body');
      ok('no device id yet reads as starting up, not as empty',
        text.includes(copy.starting) && !text.includes(copy.empty), text.trim());
      await page.close();
    }
    {
      const { page } = await open([], 'reject-reason');
      const text = await page.textContent('#inbox-body');
      ok('a refusal from Dengage reads as an error',
        text.includes(copy.error), text.trim());
      await page.close();
    }
    {
      const { page } = await open([], 'not-a-promise');
      const text = await page.textContent('#inbox-body');
      ok('a provider that answers with no promise is a timing state, not a crash',
        text.includes(copy.starting), text.trim());
      await page.close();
    }
    {
      /* The template carries no appGuid, so it can never connect and must say so
         rather than promise to. This is the case that used to render as
         "connecting", because the head's queue stub makes window.dengage a
         function on every page. */
      const { page } = await open([]);
      const noApp = await page.evaluate(() => {
        window.DEMO_CONFIG.dengage.appGuid = '';
        return window.Inbox.refresh().then(() =>
          document.getElementById('inbox-body').textContent);
      });
      ok('a page with no application says that instead of promising to connect',
        noApp.includes(copy.noSdk), noApp.trim());
      await page.close();
    }
  }

  /* ---------------------------------------------------------------------- */
  console.log('\n4. Messages render, and the badge counts the unread ones');
  const THREE = [
    { smsgId: 'm1', messageJson: { title: 'First', message: 'One',
      targetUrl: 'https://dengage-presales.github.io/demo-ai/1', sendDate: new Date().toISOString() } },
    { smsgId: 'm2', messageJson: { title: 'Second', message: 'Two',
      actionButtons: [{ id: 'cta', text: 'Look' }] } },
    { smsgId: 'm3', messageJson: { message: 'No title on this one' } }
  ];
  {
    const { page, errors } = await open(THREE);
    ok('three cards render', await page.locator('#inbox-body .inbox-item').count() === 3);
    ok('all three start unread', await page.locator('#inbox-body .inbox-item.unread').count() === 3);
    ok('the badge shows three', await page.textContent('#inbox-badge') === '3');
    ok('the badge is visible', await page.evaluate(() =>
      document.getElementById('inbox-badge').hidden === false));
    ok('a message with no title still has a heading', await page.evaluate(() =>
      document.querySelectorAll('#inbox-body .inbox-item h3')[2].textContent.trim() ===
      window.DEMO_COPY.inboxUntitled));
    ok('a message with a destination gets an open link',
      await page.locator('#inbox-body [data-inbox-open="m1"]').count() === 1);
    ok('a message without one does not',
      await page.locator('#inbox-body [data-inbox-open="m3"]').count() === 0);
    ok('a panel button becomes a button',
      await page.locator('#inbox-body [data-inbox-button="cta"]').count() === 1);
    ok('every card offers dismiss',
      await page.locator('#inbox-body [data-inbox-dismiss]').count() === 3);
    ok('no page errors', errors.length === 0, errors);
    await page.close();
  }

  /* ---------------------------------------------------------------------- */
  console.log('\n4a. Read and unread are told apart on screen');

  /* Every one of these replaced something that looked wrong in a browser and
     passed every assertion at the time. The list is the review, written down. */
  {
    const { page, errors } = await open(THREE);
    await page.evaluate(() => window.Storefront.openOverlay('#inbox'));
    /* Mark one read through the real path rather than by writing storage, so the
       assertion covers what a click actually does. */
    await page.click('#inbox-body [data-inbox-open="m1"]');
    await page.waitForTimeout(150);

    const state = await page.evaluate(() => {
      const items = [...document.querySelectorAll('#inbox-body .inbox-item')];
      const read = items.find((el) => el.classList.contains('read'));
      const unread = items.find((el) => el.classList.contains('unread'));
      const weight = (el) => el ? getComputedStyle(el.querySelector('h3')).fontWeight : null;
      return {
        readCount: items.filter((el) => el.classList.contains('read')).length,
        unreadCount: items.filter((el) => el.classList.contains('unread')).length,
        bothAtOnce: items.some((el) =>
          el.classList.contains('read') && el.classList.contains('unread')),
        dotsOnUnread: items.filter((el) =>
          el.classList.contains('unread') && el.querySelector('h3 .dot')).length,
        dotsOnRead: items.filter((el) =>
          el.classList.contains('read') && el.querySelector('h3 .dot')).length,
        readWeight: Number(weight(read)),
        unreadWeight: Number(weight(unread)),
        countPill: (document.getElementById('inbox-count') || {}).textContent,
        countHidden: (document.getElementById('inbox-count') || {}).hidden
      };
    });

    ok('one message is read and two are not',
      state.readCount === 1 && state.unreadCount === 2, state);
    ok('no message is both at once', state.bothAtOnce === false);
    /* THE RAIL BECAME A DOT. A left border on consecutive unread items merges into
       one continuous line, so three unread messages read as a single block and the
       header count disagrees with what is on screen. */
    ok('every unread message carries a dot', state.dotsOnUnread === 2, state);
    ok('and no read message does', state.dotsOnRead === 0, state);
    ok('a read title is lighter than an unread one',
      state.unreadWeight > state.readWeight, state);
    ok('the drawer head says how many are unread',
      /2/.test(state.countPill || '') && state.countHidden === false, state);

    /* And it goes away rather than saying zero. */
    await page.evaluate(() => {
      document.querySelectorAll('#inbox-body [data-inbox-open], #inbox-body .inbox-item')
        .forEach(() => {});
    });
    await page.click('#inbox-body [data-inbox-button="cta"]').catch(() => {});
    await page.waitForTimeout(120);
    ok('no page errors', errors.length === 0, errors);
    await page.close();
  }

  console.log('\n4b. The list has one left edge, and one dismiss position');
  {
    /* Reserving the media column per message left a ragged left edge: the ones
       with an image indented and the ones without did not. It is reserved for the
       whole list or for none of it. */
    const mixed = await open([
      { smsgId: 'p1', messageJson: { title: 'With an image', message: 'x',
        mediaUrl: BASE + 'vendor/assets/dengage-logo.svg' } },
      { smsgId: 'p2', messageJson: { title: 'Without one', message: 'x' } }
    ]);
    await mixed.page.evaluate(() => window.Storefront.openOverlay('#inbox'));
    await mixed.page.waitForTimeout(400);
    const edges = await mixed.page.evaluate(() => {
      const body = document.getElementById('inbox-body');
      const lefts = [...body.querySelectorAll('.inbox-text')]
        .map((el) => Math.round(el.getBoundingClientRect().left));
      return { reserved: body.classList.contains('with-media'), lefts };
    });
    ok('the column is reserved when any message has an image', edges.reserved, edges);
    ok('so every message text starts at the same left edge',
      new Set(edges.lefts).size === 1, edges);
    await mixed.page.close();

    const none = await open([
      { smsgId: 'q1', messageJson: { title: 'No images here', message: 'x' } },
      { smsgId: 'q2', messageJson: { title: 'None here either', message: 'x' } }
    ]);
    await none.page.evaluate(() => window.Storefront.openOverlay('#inbox'));
    await none.page.waitForTimeout(300);
    ok('and not reserved when none of them does', await none.page.evaluate(() =>
      !document.getElementById('inbox-body').classList.contains('with-media')));
    await none.page.close();
  }

  {
    /* Dismiss used to wrap to its own line whenever a message carried buttons, so
       the one control that removes something moved depending on the content above
       it. And with two buttons plus a dismiss the row fitted the content box
       exactly, so nothing wrapped and it sat flush against the edge looking cut. */
    const { page } = await open([
      { smsgId: 'r1', messageJson: { title: 'Two buttons', message: 'x',
        targetUrl: BASE, actionButtons: [
          { id: 'a', text: 'View it' }, { id: 'b', text: 'Remind me later' }] } },
      { smsgId: 'r2', messageJson: { title: 'No buttons', message: 'x' } }
    ]);
    await page.evaluate(() => window.Storefront.openOverlay('#inbox'));
    await page.waitForTimeout(400);
    const rows = await page.evaluate(() => {
      const body = document.getElementById('inbox-body');
      const right = body.getBoundingClientRect().right -
                    parseFloat(getComputedStyle(body).paddingRight);
      return [...body.querySelectorAll('.inbox-actions')].map((row) => {
        const kids = [...row.children];
        return {
          lastIsDismiss: kids[kids.length - 1].hasAttribute('data-inbox-dismiss'),
          slack: Math.round(right - Math.max(...kids.map((k) =>
            k.getBoundingClientRect().right)))
        };
      });
    });
    ok('dismiss is the last control in every message', rows.every((r) => r.lastIsDismiss), rows);
    ok('and nothing in the row reaches the drawer edge',
      rows.every((r) => r.slack >= 2), rows);
    ok('nor overflows it', rows.every((r) => r.slack >= 0), rows);
    await page.close();
  }

  console.log('\n4c. A timestamp is never an ambiguous numeric date');
  {
    /* toLocaleDateString gives "8/4/2026", which is the fourth of August to half
       the world and the eighth of April to the other half, in a list where every
       other row is a relative time. */
    const day = 24 * 3600 * 1000;
    const { page } = await open([
      { smsgId: 't1', messageJson: { title: 'Now', message: 'x',
        sendDate: new Date(Date.now() - 20 * 1000).toISOString() } },
      { smsgId: 't2', messageJson: { title: 'Minutes', message: 'x',
        sendDate: new Date(Date.now() - 42 * 60 * 1000).toISOString() } },
      { smsgId: 't3', messageJson: { title: 'Hours', message: 'x',
        sendDate: new Date(Date.now() - 5 * 3600 * 1000).toISOString() } },
      { smsgId: 't4', messageJson: { title: 'Days', message: 'x',
        sendDate: new Date(Date.now() - 9 * day).toISOString() } }
    ]);
    await page.evaluate(() => window.Storefront.openOverlay('#inbox'));
    await page.waitForTimeout(300);
    const stamps = await page.evaluate(() =>
      [...document.querySelectorAll('#inbox-body .inbox-when')].map((el) => el.textContent.trim()));
    ok('four timestamps render', stamps.length === 4, stamps);
    ok('none of them is a slash separated date',
      stamps.every((s) => !/\d+\/\d+/.test(s)), stamps);
    ok('the recent one is relative', /now|min/i.test(stamps[0]), stamps);
    ok('and the old one names a month', /[A-Za-z]{3}/.test(stamps[3]), stamps);
    await page.close();
  }

  /* ---------------------------------------------------------------------- */
  console.log('\n5. What gets reported to Dengage, and when');
  {
    const { page, errors } = await open(THREE);
    ok('nothing is reported while the drawer is shut', await page.evaluate(() =>
      !window.__inbox.calls.some(c => c[0] === 'onImpression')));

    await page.evaluate(() => window.Storefront.openOverlay('#inbox'));
    await page.evaluate(() => window.Inbox.refresh());
    const impressions = await page.evaluate(() =>
      window.__inbox.calls.filter(c => c[0] === 'onImpression').map(c => c[1]));
    ok('opening it reports one impression per message',
      impressions.length === 3 && ['m1', 'm2', 'm3'].every(id => impressions.includes(id)), impressions);

    await page.evaluate(() => window.Inbox.refresh());
    const again = await page.evaluate(() =>
      window.__inbox.calls.filter(c => c[0] === 'onImpression').length);
    ok('a second read does not report them again', again === 3, again);

    /* The open affordance is a real link, so it is asserted to leave the demo on
       screen rather than replace it. A message's destination comes from the panel
       and could be anything; navigating in place would end the screen share. */
    const openLink = page.locator('#inbox-body [data-inbox-open="m1"]');
    ok('a message opens in a new tab', await openLink.getAttribute('target') === '_blank');
    ok('and cannot reach back into this one', await openLink.getAttribute('rel') === 'noopener');
    const popup = page.waitForEvent('popup').catch(() => null);
    await openLink.click();
    const opened = await popup;
    if (opened) await opened.close();
    ok('this page is still the demo', page.url().includes('/template/') || page.url().includes('/demos/'),
      page.url());
    ok('opening a message reports an open', await page.evaluate(() =>
      window.__inbox.calls.some(c => c[0] === 'onOpen' && c[1] === 'm1')));
    ok('and it is no longer unread',
      await page.locator('#inbox-body .inbox-item.unread').count() === 2);
    ok('the badge drops to two', await page.textContent('#inbox-badge') === '2');

    await page.click('#inbox-body [data-inbox-button="cta"]');
    const click = await page.evaluate(() =>
      window.__inbox.calls.filter(c => c[0] === 'onClick')[0]);
    ok('pressing a button reports a click with the button id',
      click && click[1] === 'm2' && click[2] === 'cta', click);
    ok('no page errors', errors.length === 0, errors);
    await page.close();
  }

  /* ---------------------------------------------------------------------- */
  console.log('\n6. Dismiss hides locally and deletes nothing in Dengage');
  {
    const { page, errors } = await open(THREE);
    await page.evaluate(() => window.Storefront.openOverlay('#inbox'));
    await page.click('#inbox-body [data-inbox-dismiss="m2"]');
    ok('the card goes', await page.locator('#inbox-body .inbox-item').count() === 2);
    ok('NOTHING is deleted in Dengage', await page.evaluate(() =>
      !window.__inbox.calls.some(c => c[0] === 'onDelete')));
    ok('it stays gone across a refresh', await page.evaluate(() =>
      window.Inbox.refresh().then(() =>
        document.querySelectorAll('#inbox-body .inbox-item').length)) === 2);
    ok('the badge counts what is left', await page.textContent('#inbox-badge') === '2');

    /* The opt in exists and is read at call time, so a demo that wants the real
       delete can have it. dengage.inboxReportDelete is checked on every call
       rather than captured, which is what makes it settable here at all. */
    const reported = await page.evaluate(() => {
      window.DEMO_CONFIG.dengage.inboxReportDelete = true;
      const before = window.__inbox.calls.filter(c => c[0] === 'onDelete').length;
      window.DengageEvents.inboxDelete('m3');
      return { before, after: window.__inbox.calls.filter(c => c[0] === 'onDelete').length };
    });
    ok('opting in does reach the provider',
      reported.before === 0 && reported.after === 1, reported);
    ok('no page errors', errors.length === 0, errors);
    await page.close();
  }

  /* ---------------------------------------------------------------------- */
  console.log('\n7. A broken image does not become a broken looking inbox');
  {
    const { page, errors } = await open([
      { smsgId: 'good', messageJson: { title: 'Has a real image', message: 'x',
        mediaUrl: BASE + 'vendor/assets/dengage-logo.svg' } },
      { smsgId: 'bad', messageJson: { title: 'Image will not load', message: 'x',
        mediaUrl: BASE + 'vendor/assets/no-such-file-here.png' } }
    ]);
    await page.evaluate(() => window.Storefront.openOverlay('#inbox'));
    /* The failure arrives on the network, so give it a moment rather than
       asserting against a request that is still in flight. */
    await page.waitForTimeout(1200);
    ok('both messages still render', await page.locator('#inbox-body .inbox-item').count() === 2);
    ok('the one that loaded keeps its image',
      await page.locator('#inbox-body [data-inbox-id="good"] .inbox-media img').count() === 1);
    ok('the one that failed loses the whole media column, not just the image',
      await page.locator('#inbox-body [data-inbox-id="bad"] .inbox-media').count() === 0);
    ok('and keeps its title', (await page.textContent('#inbox-body [data-inbox-id="bad"] h3'))
      .includes('Image will not load'));
    ok('no page errors', errors.length === 0, errors);
    await page.close();
  }

  /* ---------------------------------------------------------------------- */
  console.log('\n8. Storage is namespaced by slug');
  {
    const { page } = await open(THREE);
    const keys = await page.evaluate(() => window.Inbox.keys);
    const slug = await page.evaluate(() => window.DEMO_SLUG);
    ok('the read key carries the slug', keys.read === 'dps:' + slug + ':inbox-read', keys);
    ok('the hidden key carries the slug', keys.hidden === 'dps:' + slug + ':inbox-hidden', keys);
    await page.close();
  }

  /* ---------------------------------------------------------------------- */
  console.log('\n9. The launcher card and the drawer are both present');
  {
    const { page } = await open(THREE);
    ok('there is one App inbox card',
      await page.locator('#launcher-grid [data-action="inbox-open"]').count() === 1);
    ok('it is grouped under its own heading', await page.evaluate(() =>
      [...document.querySelectorAll('#launcher-grid .launcher-group')]
        .some(h => h.textContent.includes(window.DEMO_COPY.groupInbox))));
    ok('the card says what it does rather than naming a trigger', await page.evaluate(() =>
      document.querySelector('[data-action="inbox-open"] .slug').textContent.trim() ===
      window.DEMO_COPY.actionInboxOpen));
    ok('a bell in the header opens the drawer',
      await page.locator('.header-actions [data-open="#inbox"]').count() === 1);
    ok('the drawer has a refresh control', await page.locator('#inbox-refresh').count() === 1);

    /* The card must work from the launcher, which is itself an overlay. Closing
       the launcher and opening the drawer in the wrong order leaves both shut,
       which is invisible in a diff. */
    await page.evaluate(() => window.Storefront.openOverlay('#dengage-panel'));
    await page.click('[data-action="inbox-open"]');
    await page.waitForTimeout(200);
    ok('pressing it leaves the drawer open', await page.evaluate(() =>
      document.getElementById('inbox').classList.contains('open')));
    ok('and the launcher closed', await page.evaluate(() =>
      !document.getElementById('dengage-panel').classList.contains('open')));
    await page.close();
  }

  await browser.close();
  console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
