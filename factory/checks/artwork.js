/* ============================================================================
   GENERATED PRODUCT ARTWORK, DRIVEN IN A BROWSER.

   Handoff 7.4, 9.1. Run from the repository root:  bash factory/checks/run.sh

   THE ASSERTION THAT MATTERS is not that a tile fills. It is that the motif
   matches the product's own vertical, because the entire reason this module
   exists is that "Quilted Field Jacket" rendering as a grey QF tile is a weak
   thing to put in front of a prospect. So a jacket must draw the jacket motif and
   a camera must draw the camera motif, asserted per product, by name.

   THE OTHER THREE ARE RULES THAT WOULD FAIL SILENTLY.

   No requests. A motif that reached for an external asset would work perfectly on
   this machine and show a broken image icon on a prospect's network, which is the
   whole reason product images are committed rather than hotlinked. Asserted as
   zero src and href attributes in the generated markup, and by watching the
   network for image requests while the grid renders.

   No colour literals. Every fill and stroke is currentColor, so a motif inherits
   the prospect's palette. A hex value here would survive every visual review and
   then clash on the one demo whose theme is not blue.

   Stable per product. Seeded from the product id, so the same product draws the
   same picture in every rail and on both pages. Math.random would look like a
   rendering fault to anyone watching two rails at once.
   ========================================================================== */
const { chromium } = require('playwright');

const BASE = process.env.TEMPLATE_URL || 'http://localhost:8101/template/';

let pass = 0, fail = 0;
const ok = (label, cond, detail) => {
  if (cond) { pass++; console.log('   ok    ' + label); }
  else { fail++; console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : '')); }
};

/* Name fragment to the motif it must produce. Written out here on purpose: this is
   the check, so deriving it from the module would assert the module against
   itself and pass no matter how wrong the classifier became. */
const EXPECTED = [
  ['jacket',      'jacket'],
  ['knit',        'knit'],
  ['boot',        'boot'],
  ['shirt',       'shirt'],
  ['weekender',   'bag'],
  ['laptop',      'laptop'],
  ['headphones',  'headphones'],
  ['fitness watch', 'smartwatch'],
  ['camera',      'camera'],
  ['speaker',     'speaker'],
  ['chair',       'chair'],
  ['lamp',        'lamp'],
  ['rug',         'rug'],
  ['casserole',   'cookware'],
  ['throw',       'scarf']
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
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

  /* Watch for any image request while the grid renders. A motif must make none. */
  const imageRequests = [];
  page.on('request', r => {
    if (r.resourceType() === 'image') imageRequests.push(r.url());
  });

  await page.addInitScript(() => { window.dengage = function () {}; });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.Catalog && window.Catalog.all().length && window.Artwork,
    null, { timeout: 20000 });

  console.log('\n1. The module is present and has a motif library');
  const motifs = await page.evaluate(() => window.Artwork.motifs());
  ok('motifs defined', motifs.length >= 20, motifs.length);
  ok('motif ids are unique', new Set(motifs).size === motifs.length, motifs.length - new Set(motifs).size);

  console.log('\n2. Every product in the catalogue gets an svg');
  const drawn = await page.evaluate(() => window.Catalog.all().map(p => {
    const s = window.Artwork.svg(p);
    return { id: p.id, name: p.name, len: s.length,
             motif: (s.match(/data-motif="([^"]+)"/) || [])[1] || null,
             isSvg: s.indexOf('<svg') === 0 };
  }));
  ok(drawn.length + ' products, all produce an svg', drawn.every(d => d.isSvg && d.len > 400),
    drawn.filter(d => !d.isSvg || d.len <= 400).map(d => d.name));
  ok('every svg carries a data-motif', drawn.every(d => d.motif), drawn.filter(d => !d.motif));

  console.log('\n3. The motif matches the product\'s vertical');
  for (const [fragment, expected] of EXPECTED) {
    const hit = drawn.filter(d => d.name.toLowerCase().indexOf(fragment) !== -1);
    if (!hit.length) { ok('a product matching "' + fragment + '" exists', false, drawn.map(d => d.name)); continue; }
    ok('"' + hit[0].name + '" draws the ' + expected + ' motif',
      hit[0].motif === expected, { got: hit[0].motif, want: expected });
  }
  /* Not one product may fall through to the initials tile in a catalogue this
     ordinary. The fallback is for unexpected verticals, and if it fires here the
     classifier has regressed. */
  ok('nothing fell back to the initials tile',
    drawn.every(d => d.motif !== 'initials'), drawn.filter(d => d.motif === 'initials').map(d => d.name));

  console.log('\n4. No requests, no colour literals');
  const all = await page.evaluate(() => window.Catalog.all().map(p => window.Artwork.svg(p)).join(''));
  ok('no src or href anywhere in the markup', !/\b(src|href)=/.test(all),
    (all.match(/\b(src|href)="[^"]*"/g) || []).slice(0, 3));
  ok('no url() references', all.indexOf('url(') === -1 || !/url\((?!#)/.test(all),
    (all.match(/url\([^)]*\)/g) || []).filter(u => u.indexOf('#') === -1).slice(0, 3));
  /* Anything that is not currentColor: hex, rgb, hsl or a bare colour word on a
     fill or stroke. url(#gradient) is the one allowed non-literal. */
  const literals = await page.evaluate(() => {
    const s = window.Catalog.all().map(p => window.Artwork.svg(p)).join('');
    return (s.match(/(?:fill|stroke|stop-color)\s*[:=]\s*"?(?!currentColor|none|url\(#)[^";}\s]+/g) || []);
  });
  ok('every fill and stroke is currentColor, none or a local gradient',
    literals.length === 0, literals.slice(0, 5));

  console.log('\n5. The grid renders them, and asks the network for nothing');
  await page.waitForFunction(() => document.querySelectorAll('[data-id]').length > 0, null, { timeout: 20000 });
  const inDom = await page.evaluate(() =>
    [...document.querySelectorAll('[data-id] svg[data-motif]')].map(n => n.getAttribute('data-motif')));
  ok('motifs are in the rendered grid', inDom.length > 0, inDom.length);
  ok('the grid asked for no images', imageRequests.length === 0, imageRequests.slice(0, 3));
  ok('no <img> tags in the grid',
    await page.locator('.grid img').count() === 0);

  console.log('\n6. Stable: same product, same picture, twice and across pages');
  const twice = await page.evaluate(() => {
    const p = window.Catalog.all()[0];
    return [window.Artwork.svg(p), window.Artwork.svg(p)];
  });
  ok('two calls give identical markup', twice[0] === twice[1]);

  const first = await page.evaluate(() => window.Catalog.all()[0].id);
  const onHome = await page.evaluate(() => window.Artwork.svg(window.Catalog.all()[0]));
  await page.goto(BASE + 'product.html?id=' + encodeURIComponent(first), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.Catalog && window.Catalog.all().length && window.Artwork,
    null, { timeout: 20000 });
  const onPdp = await page.evaluate(id => window.Artwork.svg(window.Catalog.get(id)), first);
  ok('the same product draws identically on the product page', onHome === onPdp);
  ok('the product page shows the motif',
    await page.locator('.pdp-media svg[data-motif]').count() === 1);

  console.log('\n7. An unclassifiable product falls back rather than breaking');
  const oddball = await page.evaluate(() => {
    const s = window.Artwork.svg({ id: 'zz-unknown-1', name: 'Zephyr Quiddity', category: 'Misc',
                                   categoryPath: 'Misc', attributes: {} });
    return { motif: (s.match(/data-motif="([^"]+)"/) || [])[1], hasText: s.indexOf('<text') !== -1,
             initials: (s.match(/>([A-Z]{1,2})<\/text>/) || [])[1] };
  });
  ok('falls back to the initials tile', oddball.motif === 'initials', oddball);
  ok('and still draws the initials', oddball.hasText && oddball.initials === 'ZQ', oddball);

  /* THIS SECTION EXISTS BECAUSE SECTION 3 PASSED WHILE PLURALS WERE BROKEN.
     Every product in the showcase catalogue happens to be named in the singular,
     so a classifier that could not see 'trouser' inside "Trousers" scored fifteen
     out of fifteen and fell to the initials tile on any catalogue that writes its
     names the ordinary way. Found by rendering the motifs and looking at them,
     which is the check this file could not be. */
  console.log('\n8. Plural product names, the way a real catalogue writes them');
  const PLURALS = [
    ['Slim Fit Trousers',     'trousers'],
    ['Chelsea Boots',         'boot'],
    ['Wireless Headphones',   'headphones'],
    ['Dive Watches',          'watch'],
    ['Linen Shirts',          'shirt'],
    ['Running Shoes',         'shoe'],
    ['Ceramic Table Lamps',   'lamp'],
    ['Reading Glasses',       'glasses'],
    ['Cotton Dresses',        'dress'],
    ['Leather Bags',          'bag']
  ];
  for (const [name, expected] of PLURALS) {
    const got = await page.evaluate(n => window.Artwork.classify({
      id: 'zz-' + n, name: n, category: '', categoryPath: '', attributes: {}
    }), name);
    ok('"' + name + '" draws the ' + expected + ' motif', got === expected, { got, want: expected });
  }

  /* Every motif must be reachable by its own id used as a product name. A motif
     nobody can select is dead weight, and this is how 'cookware' was found: it
     was drawn, listed, and had no keyword that could ever choose it. */
  console.log('\n8a. Every motif is reachable');
  const unreachable = await page.evaluate(() => window.Artwork.motifs().filter(id => {
    const got = window.Artwork.classify({ id: 'zz-' + id, name: id.replace(/-/g, ' '),
                                          category: '', categoryPath: '', attributes: {} });
    return got === null;
  }));
  ok('no motif is unselectable by its own name', unreachable.length === 0, unreachable);

  /* ---------------------------------------------------------------------- */
  /* THE AUTOMOTIVE VERTICAL, added 5 August 2026. A tyre and parts retailer drew
     its entire catalogue as initials tiles, because the vertical had no motifs.
     These are the names such a catalogue actually uses. */
  console.log('\n8d. The automotive vertical');
  const AUTOMOTIVE = [
    ['Winter Tyres 225/45 R17',      'tyre'],
    ['All Season Tires',             'tyre'],
    ['Alloy Rim 17 inch',            'wheel'],
    ['Hub Cap, 15 inch',             'wheel'],
    ['Brake Disc, front',            'brake'],
    ['Rear Rotor',                   'brake'],
    ['Brake Caliper',                'brake'],
    ['AGM Battery 70Ah',             'battery'],
    ['Engine Oil 5W-30',             'fluid'],
    ['Brake Fluid DOT 4',            'fluid'],
    ['Coolant, ready mixed',         'fluid'],
    ['Oil Filter',                   'filter'],
    ['Cabin Filter',                 'filter'],
    ['Spark Plug, iridium',          'sparkplug'],
    ['Ignition Coil',                'sparkplug'],
    ['Wiper Blade, 24 inch',         'wiper'],
    ['Headlight, LED',               'headlight'],
    ['Halogen Bulb H7',              'headlight'],
    ['Compact SUV',                  'car'],
    ['Panel Van',                    'car']
  ];
  for (const [name, expected] of AUTOMOTIVE) {
    const got = await page.evaluate((n) =>
      window.Artwork.classify({ id: n, name: n, category: '', attributes: {} }), name);
    ok('"' + name + '" draws ' + expected, got === expected, { got, want: expected });
  }

  /* A TYRE IS OFTEN NAMED ONLY BY ITS MODEL, with no word for what it is:
     "Sport Contact 6, 205/55 R16" contains nothing to match. The category is what
     saves it, and this is the case a tyre retailer's whole catalogue depends on. */
  console.log('\n8e. A product named only by its model is placed by its category');
  for (const [name, category, expected] of [
    ['Sport Contact 6, 205/55 R16', 'Summer Tyres', 'tyre'],
    ['WinterContact TS 870',        'Winter Tyres', 'tyre'],
    ['Pilot Sport 5',               'Tyres',        'tyre'],
    ['Alloy rim, 16 inch, 5x112',   'Rims',         'wheel'],
    /* A whole product line named after the season, with nothing in the name or
       the category that says tyre. This was a fifth of one real catalogue. */
    ['AllSeasonContact 2',          'All Season',   'tyre'],
    ['CrossClimate 2',              'All-Season',   'tyre']
  ]) {
    const got = await page.evaluate((args) => window.Artwork.classify(
      { id: args.name, name: args.name, category: args.category,
        categoryPath: args.category, attributes: {} }), { name, category });
    ok('"' + name + '" in ' + category + ' draws ' + expected, got === expected,
      { got, want: expected });
  }

  /* THE THREE COLLISIONS THE AUTOMOTIVE MOTIFS INTRODUCED, asserted from the
     other side. Adding automotive keywords must not take a keyword away from a
     more common vertical, and whole word matching must still hold. */
  console.log('\n8f. The automotive motifs did not steal another vertical\'s words');
  for (const [name, expected] of [
    ['Rose Face Oil',        'bottle'],   /* oil stays with the bottle */
    ['Argan Oil Serum',      'bottle'],
    ['Baseball Cap',         'hat'],      /* cap stays with the hat */
    ['Wool Beanie',          'hat'],
    ['Wool Carpet',          'rug'],      /* car is not inside carpet */
    ['Merino Cardigan',      'knit'],     /* car is not inside cardigan */
    ['Car Mat, rubber',      'rug'],      /* the head noun still wins */
    ['Tennis Ball',          'ball'],
    ['Torque Wrench',        'tool'],
    /* 'all season' must not take clothing off the shelf. The head noun is last in
       an English compound, and the match furthest through the name wins, so these
       stay what they are. */
    ['All Season Jacket',    'jacket'],
    ['All-Season Coat',      'jacket'],
    ['All Season Trousers',  'trousers']
  ]) {
    const got = await page.evaluate((n) =>
      window.Artwork.classify({ id: n, name: n, category: '', attributes: {} }), name);
    ok('"' + name + '" still draws ' + expected, got === expected, { got, want: expected });
  }
  /* And the words that must match nothing, because whole word matching is the only
     thing stopping them. */
  for (const name of ['Entire Collection Gift Card', 'Trim Kit', 'Primer, matte']) {
    const got = await page.evaluate((n) =>
      window.Artwork.classify({ id: n, name: n, category: '', attributes: {} }), name);
    ok('"' + name + '" matches no motif', got === null, got);
  }

  /* ---------------------------------------------------------------------- */
  /* A SHAPE THE STYLE DOES NOT NAME RENDERS SOLID BLACK, which is the SVG
     default and the one thing on the page that cannot be themed. A motif drawn
     with an <ellipse> shipped exactly that, and section 4's colour literal scan
     cannot see it: there is no literal, the shape simply has no rule. */
  console.log('\n8g. Every shape a motif draws is themed by the style block');
  const shapes = await page.evaluate(() => {
    const used = new Set();
    for (const motif of window.Artwork.art()) {
      const re = /<([a-z]+)[\s>/]/g;
      let match;
      while ((match = re.exec(motif.art)) !== null) used.add(match[1]);
    }
    return { used: [...used].sort(), fillable: window.Artwork.fillable() };
  });
  const unstyled = shapes.used.filter((tag) => !shapes.fillable.includes(tag));
  ok('no motif draws with a shape the style leaves unthemed', unstyled.length === 0,
    { unstyled, styled: shapes.fillable });
  ok('the style block names every shape in use',
    shapes.used.every((tag) => shapes.fillable.includes(tag)), shapes);

  /* Proves the assertion above is worth having, by confirming the rendered result
     really does differ. An unstyled shape keeps the default black fill. */
  const blackness = await page.evaluate(() => {
    const svg = window.Artwork.svg({ id: 'oil-filter-x', name: 'Oil Filter',
                                     category: '', attributes: {} });
    const holder = document.createElement('div');
    holder.style.color = 'rgb(20, 24, 27)';
    holder.innerHTML = svg;
    document.body.appendChild(holder);
    const shapes = [...holder.querySelectorAll('.mf > *')];
    const out = shapes.map((el) => {
      const style = getComputedStyle(el);
      return { tag: el.tagName.toLowerCase(), fill: style.fill, opacity: style.fillOpacity };
    });
    holder.remove();
    return out;
  });
  ok('the filter motif has an ellipse in it',
    blackness.some((shape) => shape.tag === 'ellipse'), blackness);
  ok('and every one of its shapes is themed rather than default black',
    blackness.every((shape) => shape.fill === 'rgb(20, 24, 27)' || shape.fill === 'none'),
    blackness.filter((shape) => shape.fill !== 'rgb(20, 24, 27)' && shape.fill !== 'none'));

  console.log('\n8b. Attribute values are read, not just the name');
  const fromAttrs = await page.evaluate(() => window.Artwork.classify({
    id: 'zz-2', name: 'Aurelia', category: 'Accessories', categoryPath: 'Accessories',
    attributes: { Type: 'ankle boot', Material: 'suede' }
  }));
  ok('a motif is found from an attribute value', fromAttrs === 'boot', fromAttrs);

  /* The motifs are pure currentColor, so if this inherits something untethered
     from the theme the whole catalogue stops following the prospect's palette and
     nothing above would notice: every assertion in section 4 would still pass. */
  console.log('\n8c. The artwork colour comes from a theme token');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.art'), null, { timeout: 20000 });
  const colour = await page.evaluate(() => {
    const el = document.querySelector('.art');
    const hex = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
    /* Resolve the token through the browser so the comparison is rgb to rgb
       rather than rgb to hex. */
    const probe = document.createElement('span');
    probe.style.color = hex;
    document.body.appendChild(probe);
    const want = getComputedStyle(probe).color;
    probe.remove();
    return { got: getComputedStyle(el).color, want: want, token: hex };
  });
  ok('.art resolves to the themed --ink token', colour.got === colour.want, colour);

  console.log('\n9. No page errors');
  console.log(errors.length ? JSON.stringify(errors, null, 2) : '   none');
  ok('clean console', errors.length === 0, errors.slice(0, 3));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
