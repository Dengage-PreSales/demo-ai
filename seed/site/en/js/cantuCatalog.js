/* ============================================================================
   Catálogo de Cenários On-Site da Dengage  |  CantuPneus demo
   ----------------------------------------------------------------------------
   DOIS CONTRATOS DE EVENTO, exatamente como no jewelry-example:

   1) Default Scenarios  -> o nome do evento É o slug do cenário
      { event: '<slug>', actionType: '<slug>', category: 'Default Scenarios' }
      Esses 8 cenários NÃO possuem código local. São montados no painel da
      Dengage (conta BFSI). No painel, cada cenário usa
      triggerBy = DATA_LAYER_EVENT com eventName igual ao slug: o SDK observa
      o window.dataLayer sozinho, sem precisar de GTM.

   2) Demais grupos      -> evento genérico 'dengage'
      { event: 'dengage', actionType: '<slug>', widgetName: '<nome>', category: '<grupo>' }
      Esses possuem função local nos módulos JS desta pasta. O botão dispara o
      evento E chama a função local, para que a demo funcione mesmo sem cenário
      configurado na conta.

   Slugs e categorias mantidos em inglês, idênticos ao jewelry-example.
   ========================================================================== */

/* ----------------------------------------------------------------------------
   Tabela Big Data que recebe os eventos do catálogo.

   Crie no painel da Dengage uma tabela do tipo Big Data com este nome e as
   colunas abaixo, depois acione cada cenário On-Site pelo valor de event_name
   (o slug do cenário). As colunas key e event_date são preenchidas pelo SDK.

     event_name      texto   slug do cenário, ex.: survey, nps-popup
     scenario_group  texto   grupo do catálogo, ex.: Default Scenarios
     widget_name     texto   nome do widget, ex.: Nps Popup
     page_type       texto   home | product
     page_url        texto   URL da página no momento do clique

   Trocou o nome da tabela no painel? Altere apenas esta constante.
---------------------------------------------------------------------------- */
var DENGAGE_EVENT_TABLE = 'onsite_events';

/* ----------------------------------------------------------------------------
   Prefix for the panel-driven scenario events, i.e. the dataLayer event name a
   Default Scenario campaign triggers on.

   This site is the EN CantuPneus site, so its eight Default Scenarios and its A/B
   test fire as en_survey, en_nps-popup, en_ab-testing and so on.

   WHY: the two CantuPneus sites need DIFFERENT content in the panel, Portuguese
   here and English there, and a campaign is bound to one piece of content. One
   shared event name could only ever serve one language. Splitting the event name
   splits the campaign, which is what allows a Portuguese survey on the BR site
   and an English one on the EN site.

   THE COST, worth knowing before you touch it: every scenario now needs TWO
   campaigns in the panel instead of one. The unprefixed names are still used by
   the fintech and banking sites, so do not delete those campaigns.

   Local widgets are unaffected. They push { event: 'dengage', actionType: slug }
   and run their own code, so they never depended on the scenario name.
-------------------------------------------------------------------------- */
/* ---------------------------------------------------------------- THE SWITCH

   ON. This site fires en_ prefixed scenario events, and the en_ campaigns in
   the panel serve them from cantu-pneus/panel-content/en/.

   Every panel-driven scenario on this site now depends on a campaign whose
   trigger event carries the prefix. If one of the nine is missing in the panel,
   that widget is silently dark here: nothing errors, it simply never shows.
   Check the panel before assuming the code is wrong.

   TO TURN IT OFF: set this back to '' and set scenarioPrefix to '' for this
   site in tools/verify/sites.js. The bare slugs and the original unprefixed
   campaigns take over again. Nothing else changes.

   Do not delete the unprefixed campaigns. The fintech and banking sites still
   trigger on those bare slugs.
-------------------------------------------------------------------------- */
var SCENARIO_EVENT_PREFIX = 'en_';

/* Dispara o evento customizado que aciona o cenário On-Site no painel.
   Silencioso e sem quebrar a página se o SDK ainda não tiver carregado. */
function sendScenarioEvent(item, menu) {
  var payload = {
    event_name: item.slug,
    scenario_group: menu.category,
    widget_name: item.widgetName,
    page_type: (document.body && document.body.dataset && document.body.dataset.pageType) || 'other',
    page_url: window.location.href
  };

  try {
    if (typeof window.dengage === 'function') {
      window.dengage('sendDeviceEvent', DENGAGE_EVENT_TABLE, payload);
    } else {
      console.log('Dengage ' + DENGAGE_EVENT_TABLE + ' (mock):', payload);
    }
  } catch (err) {
    console.error('Failed to send the scenario event ' + item.slug + ':', err);
  }
}

function cantuCatalog() {

  var ACCENT = '#125cfa';

  var menuData = [
    {
      title: 'Default Scenarios',
      category: 'Default Scenarios',
      icon: '📱',
      note: 'Built in the Dengage panel (BFSI account)',
      mode: 'panel',
      items: [
        { label: 'Survey',            widgetName: 'Survey',              slug: 'survey' },
        { label: 'NPS Popup',           widgetName: 'Nps Popup',           slug: 'nps-popup' },
        { label: 'Subscription Popup',  widgetName: 'Subscripton Popup',   slug: 'subscripton-popup' },
        { label: 'Sticky Bar',          widgetName: 'Stickey Bar',         slug: 'stickey-bar' },
        { label: 'Image Popup',     widgetName: 'Image Popup',         slug: 'image-popup' },
        { label: 'Image Bar',     widgetName: 'Image Bar',           slug: 'image-bar' },
        { label: 'Horizontal Popup',    widgetName: 'Horizonal Popup',     slug: 'horizonal-popup' },
        { label: 'CTA Image Popup', widgetName: 'CTA Image Popup',     slug: 'cta-image-popup' }
      ]
    },
    {
      title: 'A/B Testing',
      category: 'A/B Testing',
      icon: '🔀',
      note: 'One campaign, three designs, 10/30/30/30 split',
      mode: 'panel',
      items: [
        /* One campaign holds all three variants, so one button covers the
           whole test. The engine pins the chosen variant per visitor, so
           re-triggering shows the same design until Reset displays clears
           it. Control group visitors see nothing at all. */
        { label: 'A/B Test: free freight offer', widgetName: 'A/B Testing', slug: 'ab-testing' }
      ]
    },
    {
      title: 'Inline Scenarios',
      category: 'Inline Scenarios',
      icon: '📐',
      note: 'Injected inside the page content',
      items: [
        { label: 'Mega Banner',          widgetName: 'Mega Banner',       slug: 'mega-banner',       reveal: '#cantupneus-highlights-slider', fn: function () { window.showSliderBanner(); } },
        { label: 'Expand Banner',    widgetName: 'Expand Banner',     slug: 'expand-banner',     fn: function () { ExpandBanner(); } },
        { label: 'Head Banner',          widgetName: 'Head Banner',       slug: 'head-banner',       fn: function () { window.showHeadBanner(); } },
        { label: 'Notification Icon', widgetName: 'Notification Icon', slug: 'notification-icon', fn: function () { addIcon(); } },
        /* Built in the panel, not here: the Story template injects into
           #dn_inline_target_below_header. panel:true makes this button push
           { event: 'story' }, which is what the campaign triggers on. There is
           no local fn, so nothing renders unless the campaign is live. */
        { label: 'Story (panel)', widgetName: 'Story', slug: 'story', panel: true }
      ]
    },
    {
      title: 'On-Site Scenarios',
      category: 'On Site Scenarios',
      icon: '🎯',
      note: 'Overlaid on the content, layout untouched',
      items: [
        /* earing.js and asistant.js publish their public API from inside
           earingWidget() / BottomAssistant(). Neither builder runs on page
           load, so the demo has to build the widget before opening it. Both
           builders guard against being run twice. */
        { label: 'Side Bar',      widgetName: 'Side Bar',         slug: 'side-bar',
          fn: function () {
            if (!window.EaringWidget) earingWidget();
            window.EaringWidget.open();
          } },
        { label: 'Bottom Assistant',widgetName: 'Bottom Assistant', slug: 'bottom-assistant',
          fn: function () {
            if (!window.openBottomAssistant) BottomAssistant();
            window.openBottomAssistant();
          } },
        { label: 'Carousel Banner',   widgetName: 'Carousel Banner',  slug: 'carousel-banner',  fn: function () { carouselBanner(); } }
      ]
    },
    {
      title: 'Gamification Scenarios',
      category: 'Gamification Scenarios',
      icon: '🎮',
      note: 'Engagement mechanics with prizes',
      items: [
        { label: 'Spin to Win', widgetName: 'Spin to Win',    slug: 'spin-to-win',    fn: function () { WheelGame(); } },
        { label: 'Scratch to Win',      widgetName: 'Scratch to Win', slug: 'scratch-to-win', fn: function () { ScratchGame(); } },
        { label: 'Santa Deer',      widgetName: 'Santa Deer',     slug: 'santa-deer',     fn: function () { SantaGame(); } },
        { label: 'Like Card',       widgetName: 'Like Card',      slug: 'like-card',      fn: function () { LikeCardGame(); } },
        { label: 'Snow',            widgetName: 'Snow',           slug: 'snow',           fn: function () { SnowStorm(); } }
      ]
    },
    {
      title: 'Product Recommendations',
      category: 'Recommendation Example',
      icon: '◆',
      note: 'Powered by the tire catalog',
      items: [
        { label: 'Classic Widget', widgetName: 'Classic Widget', slug: 'classic-widget', reveal: '#classicWidget', fn: function () { ClassicWidget(); } },
        { label: 'Banner Widget',   widgetName: 'Banner Widget',  slug: 'banner-widget',  reveal: '#bannerWidget', fn: function () { BannerWidget(); } },
        { label: 'Tab Widget',  widgetName: 'Tab Widget',     slug: 'tab-widget',     reveal: '#tabWidget', fn: function () { TabWidget(); } },
        { label: 'Sidebar Widget',  widgetName: 'SideBar Widget', slug: 'sidebar-widget', fn: function () { SideBarWidget(); } },
        { label: 'Popup Widget',    widgetName: 'Popup Widget',   slug: 'popup-widget',   fn: function () { PopupWidget(); } }
      ]
    }
  ];

  /* ------------------------------------------------------------ sticky icon */
  var stickyIcon = document.createElement('div');
  stickyIcon.id = 'sticky-icon';
  stickyIcon.setAttribute('role', 'button');
  stickyIcon.setAttribute('tabindex', '0');
  stickyIcon.setAttribute('aria-label', 'Open the Dengage scenario catalog');
  stickyIcon.innerHTML = '<img src="vendor/assets/dengage-icon.png" alt="" style="width:32px;height:32px;object-fit:contain;filter:brightness(0) invert(1);" />';
  stickyIcon.style.cssText =
    'position:fixed;bottom:30px;right:30px;width:70px;height:70px;' +
    'background:linear-gradient(135deg,#125cfa 0%,#0d4bc4 50%,#0a3a9e 100%);' +
    'border-radius:20px;display:flex;align-items:center;justify-content:center;color:#fff;' +
    'cursor:pointer;z-index:1200;transition:all .4s cubic-bezier(.175,.885,.32,1.275);' +
    'user-select:none;border:1px solid rgba(255,255,255,.2);' +
    'box-shadow:0 8px 32px rgba(18,92,250,.3),inset 0 1px 0 rgba(255,255,255,.2);';
  stickyIcon.addEventListener('mouseenter', function () { this.style.transform = 'scale(1.15) translateY(-5px)'; });
  stickyIcon.addEventListener('mouseleave', function () { this.style.transform = 'scale(1) translateY(0)'; });

  /* ---------------------------------------------------------------- drawer */
  var modal = document.createElement('div');
  modal.id = 'sticky-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-label', 'Dengage Catalog');
  modal.style.cssText =
    'position:fixed;top:0;right:-450px;width:450px;height:100vh;background:#fff;' +
    'z-index:1201;transition:right .5s cubic-bezier(.25,.46,.45,.94);overflow-y:auto;' +
    'box-sizing:border-box;box-shadow:-20px 0 60px rgba(0,0,0,.18);' +
    "font-family:Inter,-apple-system,'Segoe UI',Roboto,sans-serif;";

  var header = document.createElement('div');
  header.style.cssText =
    'display:flex;justify-content:space-between;align-items:center;padding:26px 30px 18px;' +
    'background:linear-gradient(135deg,rgba(18,92,250,.1) 0%,rgba(10,58,158,.1) 100%);' +
    'border-bottom:1px solid rgba(18,92,250,.12);position:sticky;top:0;z-index:2;backdrop-filter:blur(10px);';

  var title = document.createElement('h2');
  title.textContent = 'Dengage Catalog';
  title.style.cssText =
    'margin:0;font-weight:700;font-size:23px;letter-spacing:-.5px;' +
    'background:linear-gradient(135deg,#125cfa 0%,#0a3a9e 100%);' +
    '-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;';

  var closeBtn = document.createElement('button');
  closeBtn.setAttribute('aria-label', 'Close catalog');
  closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  closeBtn.style.cssText =
    'background:linear-gradient(135deg,#ff6b6b 0%,#ee5a52 100%);color:#fff;border:none;' +
    'width:40px;height:40px;border-radius:12px;cursor:pointer;display:flex;align-items:center;' +
    'justify-content:center;box-shadow:0 4px 15px rgba(255,107,107,.3);transition:transform .3s;';
  closeBtn.addEventListener('mouseenter', function () { this.style.transform = 'scale(1.1)'; });
  closeBtn.addEventListener('mouseleave', function () { this.style.transform = 'scale(1)'; });

  header.appendChild(title);
  header.appendChild(closeBtn);

  var counter = document.createElement('p');
  counter.style.cssText = 'margin:0;padding:12px 30px;font-size:12px;line-height:1.5;color:#64748b;background:rgba(18,92,250,.04);border-bottom:1px solid rgba(18,92,250,.08);';
  var total = menuData.reduce(function (n, m) { return n + m.items.length; }, 0);
  counter.textContent = total + ' On-Site scenarios. Each button pushes the event to the dataLayer with the slug shown.';

  /* ---------------------------------------------------------- push opt-in
     O SDK só registra o service worker e cria a inscrição quando alguém pede
     a permissão. Se "Show Permission Prompt on page load" estiver desligado
     no painel, nada acontece sozinho: Notification.permission fica em
     "default" e navigator.serviceWorker.getRegistrations() volta vazio.

     Este botão pede a permissão sob demanda, que numa demonstração é melhor
     do que o prompt automático: dá para mostrar o opt-in na hora.
  --------------------------------------------------------------------- */
  var pushRow = document.createElement('div');
  pushRow.style.cssText =
    'margin:0 30px 4px;padding:14px 16px;border:1px solid rgba(18,92,250,.25);' +
    'border-radius:12px;background:rgba(18,92,250,.06);display:flex;' +
    'align-items:center;justify-content:space-between;gap:12px;';

  var pushLabel = document.createElement('span');
  pushLabel.style.cssText = 'font-size:13px;font-weight:600;color:#2d3748;';

  var pushBtn = document.createElement('button');
  pushBtn.style.cssText =
    'background:' + ACCENT + ';color:#fff;border:none;padding:9px 16px;border-radius:8px;' +
    'cursor:pointer;font-size:12px;font-weight:600;flex-shrink:0;';

  function permissionState() {
    try { return (window.Notification && Notification.permission) || 'unsupported'; }
    catch (e) { return 'unsupported'; }
  }

  function paintPush() {
    var state = permissionState();
    if (state === 'granted') {
      pushLabel.textContent = 'Push notifications enabled';
      pushBtn.textContent = 'Test';
      pushBtn.disabled = false;
    } else if (state === 'denied') {
      pushLabel.textContent = 'Notifications blocked in the browser';
      pushBtn.textContent = 'Blocked';
      pushBtn.disabled = true;
      pushBtn.style.opacity = '.5';
      pushBtn.style.cursor = 'not-allowed';
    } else {
      pushLabel.textContent = 'Push notifications';
      pushBtn.textContent = 'Enable';
      pushBtn.disabled = false;
    }
  }

  pushBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (typeof window.dengage !== 'function') {
      console.warn('Dengage SDK has not loaded yet.');
      return;
    }
    if (permissionState() === 'granted') {
      /* já concedida: mostra o estado atual da inscrição no console */
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        console.log('Service workers registrados:', regs.length,
                    regs.map(function (r) { return r.scope; }));
      });
      window.dengage('getDeviceId', function (id) { console.log('deviceId:', id); });
      return;
    }
    /* A aplicação já tem o prompt customizado da Dengage configurado
       (conteúdo, botões Allow / No Thanks, cores e logo). Ele só não aparece
       sozinho porque "Show Permission Prompt on page load" está desligado no
       painel. showCustomPrompt() abre exatamente esse prompt, e ao aceitar o
       SDK pede a permissão nativa, registra o worker e assina.

       O prompt nativo do navegador entra em seguida caso a permissão
       continue pendente, para o botão sempre concluir o fluxo. */
    var handled = false;
    function report(state) {
      if (handled) return;
      handled = true;
      console.log('Notification.permission ->', state);
      if (state !== 'granted') { paintPush(); return; }
      setTimeout(function () {
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          console.log('service workers:', regs.length,
                      regs.map(function (r) { return r.scope; }));
          regs.forEach(function (r) {
            r.pushManager.getSubscription().then(function (sub) {
              console.log('subscription:', sub ? sub.endpoint : 'NENHUMA');
            });
          });
        });
        paintPush();
      }, 2500);
    }

    try {
      window.dengage('showCustomPrompt');
    } catch (err) {
      console.warn('showCustomPrompt unavailable:', err);
    }

    /* o prompt da Dengage é assíncrono; depois de alguns segundos o fluxo
       segue para o prompt nativo se a permissão continuar pendente */
    setTimeout(function () {
      if (handled) return;
      if (permissionState() !== 'default') { report(permissionState()); return; }
      console.log('Opening the browser permission prompt.');
      try {
        var res = Notification.requestPermission(report);
        if (res && typeof res.then === 'function') res.then(report);
      } catch (e) {
        console.error('requestPermission falhou:', e);
      }
    }, 6000);
  });

  paintPush();
  pushRow.appendChild(pushLabel);
  pushRow.appendChild(pushBtn);

  /* ----------------------------------------------------- reset de exibições
     Este botão limpa o histórico de exibição das campanhas On-Site deste
     visitante e recarrega, para repetir cenários sem limpar cache e
     cookies. deviceId, contactKey e inscrição push ficam intactos.
  --------------------------------------------------------------------- */
  var resetRow = document.createElement('div');
  resetRow.style.cssText = pushRow.style.cssText;
  resetRow.style.marginTop = '10px';

  var resetLabel = document.createElement('span');
  resetLabel.style.cssText = pushLabel.style.cssText;
  resetLabel.textContent = 'Repeat scenarios without clearing the browser';

  var resetBtn = document.createElement('button');
  resetBtn.style.cssText = pushBtn.style.cssText;
  resetBtn.textContent = 'Reset displays';

  function scrubVisitor(v) {
    if (!v || typeof v !== 'object') return v;
    delete v.lastOnsitePopupDisplayTime;
    v.onsiteMessageHistories = {};
    v.onsiteABContentIds = {};
    return v;
  }

  resetBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    resetBtn.disabled = true;
    resetBtn.textContent = 'Clearing...';

    try {
      var mirror = JSON.parse(localStorage.getItem('_dn_visitors'));
      if (mirror) localStorage.setItem('_dn_visitors', JSON.stringify(scrubVisitor(mirror)));
    } catch (err) { /* segue */ }
    try { localStorage.removeItem('_dn_show'); } catch (err) { /* segue */ }

    var reloaded = false;
    function done() {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    }
    /* rede de segurança: recarrega mesmo se o IndexedDB travar */
    setTimeout(done, 2500);

    try {
      if (!window.indexedDB || !indexedDB.databases) return done();
      indexedDB.databases().then(function (dbs) {
        var name = (dbs || []).map(function (d) { return d && d.name; })
          .filter(Boolean)
          .find(function (n) { return n.indexOf('Dengage ') === 0; });
        if (!name) return done();
        var rq = indexedDB.open(name);
        rq.onerror = done;
        rq.onsuccess = function () {
          var db = rq.result;
          try {
            var tx = db.transaction('visitors', 'readwrite');
            var cur = tx.objectStore('visitors').openCursor();
            cur.onsuccess = function (ev) {
              var c = ev.target.result;
              if (!c) return;
              c.update(scrubVisitor(c.value));
              c['continue']();
            };
            tx.oncomplete = function () { db.close(); done(); };
            tx.onabort = tx.onerror = function () { db.close(); done(); };
          } catch (err) { db.close(); done(); }
        };
      })['catch'](done);
    } catch (err) {
      done();
    }
  });

  resetRow.appendChild(resetLabel);
  resetRow.appendChild(resetBtn);

  var menuContainer = document.createElement('div');
  menuContainer.style.cssText = 'display:flex;flex-direction:column;gap:18px;padding:22px 30px 40px;';

  menuData.forEach(function (menu) {
    var wrapper = document.createElement('div');
    wrapper.style.cssText =
      'border:1px solid rgba(0,0,0,.1);border-radius:16px;overflow:hidden;background:#f8f9fa;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.08);transition:box-shadow .2s ease;';

    var mHeader = document.createElement('div');
    mHeader.setAttribute('role', 'button');
    mHeader.setAttribute('tabindex', '0');
    mHeader.style.cssText =
      'background:linear-gradient(135deg,#125cfa 0%,#0d4bc4 50%,#0a3a9e 100%);color:#fff;' +
      'padding:18px 20px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-weight:600;';
    mHeader.innerHTML =
      '<span style="display:flex;align-items:center;gap:12px">' +
        '<span style="font-size:20px">' + menu.icon + '</span>' +
        '<span><span style="font-size:16px;letter-spacing:-.3px">' + menu.title +
        ' <span style="opacity:.7;font-weight:500">(' + menu.items.length + ')</span></span>' +
        '<small style="display:block;font-size:11px;font-weight:400;opacity:.85;margin-top:1px">' + menu.note + '</small></span>' +
      '</span>' +
      '<span class="tg" style="transition:transform .2s;width:24px;height:24px;background:rgba(255,255,255,.3);border-radius:6px;display:flex;align-items:center;justify-content:center">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
      '</span>';

    var content = document.createElement('div');
    content.style.cssText = 'max-height:0;overflow:hidden;transition:max-height .3s ease;background:#fff;';

    var list = document.createElement('div');
    list.style.cssText = 'padding:18px;display:flex;flex-direction:column;gap:10px;';

    menu.items.forEach(function (item) {
      var row = document.createElement('div');
      row.style.cssText =
        'display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;' +
        'background:#fff;border:1px solid #e0e0e0;border-radius:12px;transition:transform .15s ease,box-shadow .15s ease;';

      var label = document.createElement('span');
      label.innerHTML =
        '<span style="display:block;color:#2d3748;font-weight:600;font-size:14px;letter-spacing:-.2px">' + item.label + '</span>' +
        '<small style="display:block;font-size:10.5px;font-weight:500;color:#8b95a5;font-family:ui-monospace,Menlo,monospace;margin-top:2px">' +
        (menu.mode === 'panel' || item.panel
           ? 'event: ' + SCENARIO_EVENT_PREFIX + item.slug
           : item.slug) + '</small>';

      var btn = document.createElement('button');
      btn.textContent = 'Show';
      btn.style.cssText =
        'background:linear-gradient(135deg,' + ACCENT + ' 0%,' + ACCENT + 'dd 100%);color:#fff;border:none;' +
        'padding:9px 18px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;flex-shrink:0;' +
        'box-shadow:0 4px 15px ' + ACCENT + '40;transition:transform .3s;';

      row.addEventListener('mouseenter', function () { this.style.transform = 'translateY(-2px)'; this.style.boxShadow = '0 8px 25px rgba(0,0,0,.12)'; });
      row.addEventListener('mouseleave', function () { this.style.transform = 'translateY(0)'; this.style.boxShadow = 'none'; });
      btn.addEventListener('mouseenter', function () { this.style.transform = 'scale(1.05)'; });
      btn.addEventListener('mouseleave', function () { this.style.transform = 'scale(1)'; });

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        window.dataLayer = window.dataLayer || [];

        /* Evento customizado para o SDK da Dengage. É isto que dispara os
           cenários On-Site montados no painel: cada cenário é acionado pelo
           valor de event_name. Vale para os 25 botões, então qualquer um
           deles pode receber um cenário do painel, não só os 8 padrão. */
        sendScenarioEvent(item, menu);

        if (menu.mode === 'panel' || item.panel) {
          /* Panel-driven scenario: the event name IS the slug. Whole groups opt
             in with mode:'panel'; a single item in an otherwise local group opts
             in with panel:true, which is how Story sits under Inline Scenarios
             where it belongs conceptually. */
          window.dataLayer.push({
            event: SCENARIO_EVENT_PREFIX + item.slug,
            actionType: SCENARIO_EVENT_PREFIX + item.slug,
            category: menu.category
          });
        } else {
          window.dataLayer.push({
            event: 'dengage',
            actionType: item.slug,
            widgetName: item.widgetName,
            category: menu.category
          });
          /* execução local para a demo funcionar sem cenário configurado */
          if (typeof item.fn === 'function') {
            setTimeout(function () {
              try { item.fn(); }
              catch (err) { console.error('Widget ' + item.slug + ' falhou:', err); return; }
              /* Widgets injetados no corpo da página podem nascer fora da
                 área visível. Sem isso o apresentador clica e nada parece
                 acontecer. */
              if (item.reveal) {
                setTimeout(function () {
                  var el = document.querySelector(item.reveal);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 500);
              }
            }, 380);
          }
        }

        setTimeout(closeModal, 300);
      });

      row.appendChild(label);
      row.appendChild(btn);
      list.appendChild(row);
    });

    content.appendChild(list);

    var open = false;
    function toggle() {
      open = !open;
      content.style.maxHeight = open ? content.scrollHeight + 'px' : '0';
      mHeader.querySelector('.tg').style.transform = open ? 'rotate(180deg)' : 'rotate(0)';
      wrapper.style.boxShadow = open ? '0 4px 12px rgba(0,0,0,.12)' : '0 2px 8px rgba(0,0,0,.08)';
    }
    mHeader.addEventListener('click', toggle);
    mHeader.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });

    wrapper.appendChild(mHeader);
    wrapper.appendChild(content);
    menuContainer.appendChild(wrapper);
  });

  modal.appendChild(header);
  modal.appendChild(counter);
  modal.appendChild(pushRow);
  modal.appendChild(resetRow);
  modal.appendChild(menuContainer);

  var overlay = document.createElement('div');
  overlay.id = 'modal-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(8px);z-index:1200;' +
    'opacity:0;visibility:hidden;transition:all .4s cubic-bezier(.25,.46,.45,.94);';

  function openModal() {
    modal.style.right = '0';
    overlay.style.opacity = '1';
    overlay.style.visibility = 'visible';
    stickyIcon.style.opacity = '0';
    stickyIcon.style.pointerEvents = 'none';
    closeBtn.focus();
  }
  function closeModal() {
    modal.style.right = window.innerWidth < 768 ? '-100%' : '-450px';
    overlay.style.opacity = '0';
    overlay.style.visibility = 'hidden';
    stickyIcon.style.opacity = '1';
    stickyIcon.style.pointerEvents = 'auto';
  }

  stickyIcon.addEventListener('click', openModal);
  stickyIcon.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(); }
  });
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', closeModal);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.style.right === '0px') closeModal();
  });

  document.body.appendChild(stickyIcon);
  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  function handleResize() {
    if (window.innerWidth < 768) {
      modal.style.width = '100%';
      if (modal.style.right !== '0px') modal.style.right = '-100%';
    } else {
      modal.style.width = '450px';
      if (modal.style.right !== '0px') modal.style.right = '-450px';
    }
  }
  window.addEventListener('resize', handleResize);
  handleResize();
}

cantuCatalog();
