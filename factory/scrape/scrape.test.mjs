/* ============================================================================
   Offline tests for the generator's decisions.

     node factory/scrape/scrape.test.mjs

   NO INTERNET. Sections 1 to 10 are pure functions fed fixtures. Section 11
   starts a throwaway HTTP server on 127.0.0.1 (ports 9100 to 9199) and points
   the real tiers at it, so the request plumbing is exercised too, but nothing
   here ever depends on whether a prospect's site happens to be up. What is
   tested is every judgement the scrape makes AFTER the bytes arrive, which is
   where all the bugs have actually been.

   Each case below that names a real symptom is one this code got wrong first. A
   test that only covers the happy path would have caught none of them.
   ========================================================================== */
import { fromCsv, categorise, capProducts, collectProducts, dropSentinelPrices,
         wooFromApi, woocommerce, extractProductsFromHtml, catalogue } from './catalogue.mjs';
import { acceptHeader } from './fetch.mjs';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { generatedCatalogue, verticalFor, VERTICAL_IDS } from './fallback.mjs';
import { mapFont, contrast, isBrandColour, parseHex, LOADABLE, theme,
         isVendorStylesheet, isFrameworkValue, isFrameworkDefault } from './theme.mjs';
import { slugFromUrl, currencyFromHost, chooseCurrency } from '../generate-demo.mjs';

let pass = 0;
let fail = 0;

function ok(label, condition, detail) {
    if (condition) { pass++; console.log('   ok    ' + label); return; }
    fail++;
    console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : ''));
}

function is(label, actual, expected) {
    ok(label, actual === expected, { actual, expected });
}

function same(label, actual, expected) {
    ok(label, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

/* -------------------------------------------------------------------------- */
console.log('\n1. The CSV tier');

{
    /* A real export: quoted fields containing commas, a BOM from Excel, an empty
       sale price, an empty stock cell and a genuine zero. */
    const csv = '﻿SKU,Product Name,Category,Price,Sale Price,Stock\n' +
        'A-1,"Jacket, quilted",Outerwear,189.00,149.00,12\n' +
        'A-2,"Boot, leather",Footwear,240.00,,0\n' +
        'A-3,Plain Tee,Tops,29.99,,\n';
    const result = fromCsv(csv);
    ok('it reads', result.ok, result);
    is('three rows', result.products.length, 3);
    is('a comma inside quotes stays in the name', result.products[0].name, 'Jacket, quilted');
    is('the BOM does not corrupt the first heading', result.products[0].id, 'A-1');
    is('a sale price becomes the discount', result.products[0].discountedPrice, 149);
    is('and the original becomes the price', result.products[0].price, 189);
    is('no sale price means no discount', result.products[1].discountedPrice, null);

    /* THE Number(null) TRAP, which is the whole reason this file is careful. An
       empty stock cell is unknown and must stay null; a zero is a fact. Coercing
       the first to the second announces a product out of stock and poisons every
       back-in-stock segment built on it. */
    is('a genuine zero stock is kept as zero', result.products[1].stockCount, 0);
    is('an EMPTY stock cell is null, not zero', result.products[2].stockCount, null);
}

{
    const result = fromCsv('Name;Price;Category\nWidget;9.99;Bits\n');
    ok('semicolons work, as European exports use them', result.ok, result);
    is('and the row is read', result.products.length, 1);
}

{
    const result = fromCsv('Item,Cost\nThing,5\n');
    ok('headings it cannot understand are refused', !result.ok, result);
    is('and it says why', result.reason, 'headings');
}

/* A HEADING IS MATCHED ON MEANING, NOT ON PUNCTUATION. On 7 August 2026 a CSV of
   thirty products was attached exactly as the issue asked and refused, because the
   matcher compared a lowercased heading against English words: an underscore, an
   accent or a unit in brackets was enough to lose the whole request. Each of these
   is a heading a real export actually produces. */
{
    const rows = (header) => header + '\n' +
        Array.from({ length: 10 }, (_, i) => 'Item ' + (i + 1) + ',Bits,459.90').join('\n');

    const shapes = [
        ['plain english', 'name,category,price'],
        ['an underscore', 'product_name,category,price'],
        ['capitals', 'Product Name,Category,Price'],
        ['a unit in brackets', 'Name,Category,Price (BRL)'],
        ['a dot', 'product.name,category,price'],
        ['portuguese with accents', 'Nome,Categoria,Preço'],
        ['portuguese without', 'produto,categoria,preco'],
        ['portuguese selling price', 'Nome do Produto,Categoria,Preco de Venda'],
        ['spanish', 'nombre,categoria,precio']
    ];
    for (const [label, header] of shapes) {
        const read = fromCsv(rows(header));
        ok('a heading row with ' + label + ' is read', read.ok, read);
        if (read.ok) {
            is('  and ' + label + ' finds every row', read.products.length, 10);
            is('  and ' + label + ' reads the price', read.products[0].price, 459.9);
        }
    }

    /* The other half. Normalising must not turn "any heading at all" into a match,
       or a file genuinely missing a price column would ship priceless products. */
    const noPrice = fromCsv(rows('nome,categoria,cor'));
    ok('a file with no price column is still refused', !noPrice.ok, noPrice);
    is('and still says why', noPrice.reason, 'headings');
}

{
    ok('an empty file is refused', !fromCsv('').ok);
    ok('headings with no rows are refused', !fromCsv('Name,Price\n').ok);
    const noPrice = fromCsv('Name,Price\nThing,\nOther,12\n');
    is('a row with no price is dropped rather than shipped as zero',
       noPrice.products.length, 1);
    is('and the priced row survives', noPrice.products[0].price, 12);
}

/* -------------------------------------------------------------------------- */
console.log('\n1a. Text arriving from someone else\'s website');

/* A product title is written for a browser, so it carries entities, sometimes
   tags, and occasionally a script element. None of this is a security boundary,
   because the storefront escapes on render. What it prevents is a tile captioned
   "Jack &amp; Jones" on a sales call. */
function oneName(name) {
    const result = fromCsv('Name,Price\n"' + name.replace(/"/g, '""') + '",10\n');
    return result.ok ? result.products[0].name : null;
}

is('an ampersand entity decodes', oneName('Jack &amp; Jones Shirt'), 'Jack & Jones Shirt');
is('a numeric entity decodes', oneName('Men&#39;s Jacket'), "Men's Jacket");
is('a hex entity decodes', oneName('Caf&#xe9; Cup'), 'Café Cup');
is('a curly quote entity decodes', oneName('Levi&rsquo;s 501'), "Levi's 501");
is('a non breaking space becomes a space', oneName('Blue&nbsp;Shirt'), 'Blue Shirt');
is('an unknown entity is left alone', oneName('A &weird; B'), 'A &weird; B');
is('tags are stripped', oneName('<b>Bold</b> Hoodie'), 'Bold Hoodie');
is('a script element goes entirely',
   oneName('Hoodie<script>alert(1)</script>'), 'Hoodie');
is('a comment goes', oneName('Shirt<!-- hidden -->Blue'), 'Shirt Blue');

/* THE DOUBLE DECODE MISTAKE. "&amp;lt;" must become the text "&lt;" and then be
   removed as a stray tag, never decoded twice into a real angle bracket. */
ok('an encoded tag cannot round trip into markup',
   !/[<>]/.test(oneName('Shirt &amp;lt;script&amp;gt;') || ''),
   oneName('Shirt &amp;lt;script&amp;gt;'));

/* THIS ONE DECIDES WHETHER A PROSPECT CAN HAVE A DEMO AT ALL. CLAUDE.md 3.10
   forbids em and en dashes in committed text and the guard scans raw bytes across
   every committed file, .json included. products.json is committed, and the build
   workflow runs the guard before publishing, so a retailer who writes "Jacket, an
   em dash, Navy" in a title would not merely look odd: the build would fail. */
for (const [label, raw] of [
    ['an em dash', 'Jacket \u2014 Navy'],
    ['an en dash', 'Sizes 8\u201312'],
    ['a minus sign', 'Type \u2212 2'],
    ['a figure dash', 'Ref \u2012 9'],
    ['a full width hyphen', 'Model \uff0d X'],
    ['an mdash entity', 'Jacket &mdash; Navy'],
    ['an ndash entity', 'Sizes 8&ndash;12']
]) {
    const out = oneName(raw) || '';
    ok(label + ' becomes a plain hyphen',
       !/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u2043\ufe58\ufe63\uff0d]/.test(out), { raw, out });
}

is('a very long name is capped',
   (oneName('Long '.repeat(60)) || '').length <= 120, true);
is('a whitespace only name is refused', oneName('    '), null);
ok('a zero width character is removed',
   !/[\u200b-\u200f]/.test(oneName('Blue\u200bShirt') || ''), oneName('Blue\u200bShirt'));

/* -------------------------------------------------------------------------- */
console.log('\n1b. Numbers, and the trap this file exists for');

function onePrice(price, sale) {
    const csv = sale === undefined
        ? 'Name,Price\nThing,"' + price + '"\n'
        : 'Name,Price,Sale Price\nThing,"' + price + '","' + sale + '"\n';
    const result = fromCsv(csv);
    return result.ok ? { price: result.products[0].price,
                         discountedPrice: result.products[0].discountedPrice }
                     : null;
}

function oneStock(value) {
    const result = fromCsv('Name,Price,Stock\nThing,10,"' + value + '"\n');
    return result.ok ? result.products[0].stockCount : 'dropped';
}

/* Number('') is 0, not NaN. A stock column containing a word therefore announced
   every product out of stock, which is the exact failure the whole file guards
   against, reintroduced by the sanitising step meant to make it safe. */
is('a word in the stock column is unknown, NOT zero', oneStock('yes'), null);
is('an empty stock cell is unknown', oneStock(''), null);
is('a dash in the stock column is unknown', oneStock('-'), null);
is('a real zero is zero', oneStock('0'), 0);
is('a real count is kept', oneStock('14'), 14);
is('a negative count is unknown rather than negative', oneStock('-5'), null);
is('a fractional count is rounded', oneStock('2.7'), 3);

/* A wrong number is worse than no number: nothing downstream can tell. */
same('a European price reads as thousands', onePrice('1.299,00'), { price: 1299, discountedPrice: null });
same('a comma thousands separator reads the same', onePrice('1,299.00'), { price: 1299, discountedPrice: null });
same('a comma decimal with two places', onePrice('19,99'), { price: 19.99, discountedPrice: null });
same('a bare thousands comma', onePrice('1,299'), { price: 1299, discountedPrice: null });
same('a currency symbol is ignored', onePrice('$ 45.50'), { price: 45.5, discountedPrice: null });
same('a currency code is ignored', onePrice('45.50 TL'), { price: 45.5, discountedPrice: null });
same('floating point noise is rounded', onePrice('19.989999999999998'),
     { price: 19.99, discountedPrice: null });

is('a zero price is refused', onePrice('0'), null);
is('a negative price is refused', onePrice('-10'), null);
is('an absurd price is refused', onePrice('99999999999'), null);
is('a textual price is refused', onePrice('call us'), null);
same('a sale price below the list price is a discount', onePrice('80.00', '60.00'),
     { price: 80, discountedPrice: 60 });
same('a sale price above the list price is not a discount', onePrice('50.00', '80.00'),
     { price: 80, discountedPrice: null });
same('an equal sale price is not a discount', onePrice('50.00', '50.00'),
     { price: 50, discountedPrice: null });

/* -------------------------------------------------------------------------- */
console.log('\n1c. Product ids, including catalogues that are not in English');

function oneId(sku, name) {
    const csv = 'SKU,Name,Price\n"' + (sku || '') + '","' + name + '",10\n';
    const result = fromCsv(csv);
    return result.ok ? result.products[0].id : null;
}

is('a real SKU is preferred', oneId('TCM5780-6444-S', 'Sasquatch Hoodie'), 'TCM5780-6444-S');
is('a name becomes an id when there is no SKU', oneId('', 'Sneaker Low Top'), 'SNEAKER-LOW-TOP');

/* A NON LATIN CATALOGUE MUST NOT LOSE ITS PRODUCTS. Stripping everything outside
   A to Z leaves nothing of an Arabic or Chinese title, so a product with no SKU
   was silently dropped. Dengage sells into Turkish and Arabic speaking markets. */
for (const [label, name] of [
    ['Chinese', '蓝色裤子'],
    ['Arabic', 'قميص أزرق'],
    ['Cyrillic', 'Синяя рубашка'],
    ['Greek', 'μπλούζα']
]) {
    const id = oneId('', name);
    ok('a ' + label + ' name still produces an id', !!id && id.length >= 3, { name, id });
}
/* Turkish survives partially rather than not at all, and that is fine: this only
   has to be stable and unique, not readable. */
ok('a Turkish name keeps what maps to ascii',
   /ORT/.test(oneId('', 'Şort Kırmızı') || ''),
   oneId('', 'Şort Kırmızı'));
ok('the same non latin name gives the same id twice',
   oneId('', '蓝色裤子') === oneId('', '蓝色裤子'));
ok('two different non latin names give different ids',
   oneId('', '蓝色裤子') !== oneId('', '红色裤子'));

/* -------------------------------------------------------------------------- */
console.log('\n1d. What a CSV says its prices are in');

/* THE FAILURE THESE PREVENT IS NOT A BROKEN PAGE, which is exactly why they are
   worth having. A Brazilian catalogue priced in dollars renders perfectly: the
   store's own names, the store's own numbers, the wrong money, and nothing on
   screen looks wrong enough to make anyone check it before a call. That shipped on
   7 August 2026.

   The refusals at the end matter as much as the matches. Falling through to the
   website address is a correct outcome; resolving a bare dollar to a confident
   guess is not. */
{
    const csv = (header, rows) => fromCsv(header + '\n' + rows + '\n');

    is('a currency column is read',
       csv('Name,Price,Currency', 'Ecowing ES31,429.90,BRL').currency, 'BRL');
    is('a currency column wins over the cells',
       csv('Name,Price,Currency', 'Ecowing ES31,"$429.90",BRL').currency, 'BRL');
    is('a bracketed code in the price heading is read, though heading() drops it',
       csv('Name,Price (BRL)', 'Ecowing ES31,429.90').currency, 'BRL');
    is('a symbol in the price heading is read',
       csv('Nome,Preco (R$)', 'Pneu Ecowing,429.90').currency, 'BRL');
    is('a symbol in the price cells is read, and R$ is not read as a dollar',
       csv('Name,Price', 'Ecowing ES31,"R$ 429,90"').currency, 'BRL');
    is('a trailing code in the price cells is read',
       csv('Name,Price', 'Ecowing ES31,"429.90 BRL"').currency, 'BRL');
    is('the most common cell wins, so one odd row cannot decide the catalogue',
       csv('Name,Price', 'Alpha Tyre,"€10.00"\nBeta Tyre,"€20.00"\nGamma Tyre,"£30.00"')
           .currency, 'EUR');

    /* All four of these must come back null so that the caller falls through to
       the country in the website address. A wrong specific beats nothing only if
       it happens to be right. */
    is('bare numbers say nothing',
       csv('Name,Price', 'Ecowing ES31,429.90').currency, null);
    is('a bare dollar is too ambiguous to resolve',
       csv('Name,Price', 'Ecowing ES31,"$429.90"').currency, null);
    is('kr is too ambiguous to resolve',
       csv('Name,Price', 'Ecowing ES31,"429,90 kr"').currency, null);
    is('a three letter word in a price cell is not a currency',
       csv('Name,Price', 'Ecowing ES31,"429.90 per SET"').currency, null);

    /* Reading the currency must not cost the file its products. */
    const full = csv('Name,Price,Currency',
                     'Ecowing ES31,429.90,BRL\nSolus TA31,549.90,BRL');
    is('and the rows still arrive', full.products.length, 2);
    is('and their prices are untouched', full.products[1].price, 549.9);
}

/* -------------------------------------------------------------------------- */
console.log('\n1e. Reading the shape stores actually publish');

/* THE BUG THESE PIN reported a completely readable store as unreadable. Before
   7 August 2026 only @type Product was collected, so a store publishing
   ProductGroup with its variants under hasVariant yielded zero products, the tier
   said "no structured data", and the issue asked for a CSV that was never needed.
   Measured on one large retailer: robots.txt, the sitemap index, the product
   sitemap and 1,961 product pages all answered 200, and this repository read
   nothing from any of them.

   The inheritance cases matter as much as the collection ones. A variant carries
   the price and the group carries the category, so a variant read without its
   group's context arrives categoryless and the whole catalogue collapses into one
   bucket, which is the other half of a demo looking generic. */
{
    const group = {
        '@type': 'ProductGroup',
        name: 'Ruched Sports Bra',
        category: 'sports bras',
        brand: { '@type': 'Brand', name: 'Example' },
        hasVariant: [
            { '@type': 'Product', name: 'Ruched Sports Bra', sku: 'B1-KBBL', size: 'XS',
              offers: { '@type': 'Offer', price: 21, priceCurrency: 'USD' } },
            { '@type': 'Product', name: 'Ruched Sports Bra', sku: 'B1-KBBM', size: 'S',
              offers: { '@type': 'Offer', price: 21, priceCurrency: 'USD' } }
        ]
    };

    const collected = collectProducts(group, [], 0);
    /* The group itself plus both variants. The group has no price, so the caller
       drops it; being collected and being shipped are different things. */
    is('a ProductGroup and its variants are all collected', collected.length, 3);
    const variants = collected.filter((p) => p.sku);
    is('both variants are reached through hasVariant', variants.length, 2);
    ok('a variant inherits the category it does not carry',
       variants.every((v) => v.category === 'sports bras'), variants.map((v) => v.category));
    ok('a variant inherits the brand it does not carry',
       variants.every((v) => v.brand && v.brand.name === 'Example'));
    ok('a variant keeps its own price rather than the group\'s',
       variants.every((v) => v.offers && v.offers.price === 21));

    /* A variant's own value must win, or a group level category would overwrite a
       more specific one. */
    const specific = collectProducts({
        '@type': 'ProductGroup', name: 'Boot', category: 'footwear',
        hasVariant: [{ '@type': 'Product', name: 'Boot', sku: 'X1', category: 'hiking boots',
                       offers: { price: 90 } }]
    }, [], 0);
    is('a variant\'s own category is not overwritten by its group\'s',
       specific.find((p) => p.sku === 'X1').category, 'hiking boots');

    /* Everything that worked before still works. */
    is('a plain Product is still collected',
       collectProducts({ '@type': 'Product', name: 'Tyre', offers: { price: 10 } }, [], 0).length, 1);
    is('a Product inside a @graph is still collected',
       collectProducts({ '@graph': [{ '@type': 'Product', name: 'Tyre' }] }, [], 0).length, 1);
    is('an array of types still matches',
       collectProducts({ '@type': ['Thing', 'Product'], name: 'Tyre' }, [], 0).length, 1);
    is('a page with nothing relevant collects nothing',
       collectProducts({ '@type': 'WebPage', name: 'About us' }, [], 0).length, 0);
    is('a null node is not an exception', collectProducts(null, [], 0).length, 0);
    /* An unbounded recursion on someone else's markup would hang the build. */
    let deep = { '@type': 'Product', name: 'Tyre' };
    for (let i = 0; i < 12; i++) deep = { hasPart: deep };
    is('recursion stops rather than following markup down forever',
       collectProducts(deep, [], 0).length, 0);
}

/* -------------------------------------------------------------------------- */
console.log('\n1f. The stand-in catalogue, for a store that answers nothing');

/* THE ONE PLACE IN THIS REPOSITORY THAT INVENTS A NUMBER, so these tests are less
   about whether it works and more about whether it stays inside the terms it was
   allowed on. factory/scrape/fallback.mjs has the reasoning.

   Two of them matter more than the rest. Nothing may present this as the
   prospect's catalogue, so the tier has to say 'generated' every time. And no name
   may read as a real product, or the whole distinction collapses. */
{
    is('every vertical is listed once',
       new Set(VERTICAL_IDS).size, VERTICAL_IDS.length);

    /* Reading a vertical out of an address is the whole of how this stays relevant
       to the prospect rather than generically retail. */
    is('portuguese for tyres is read', verticalFor('riopneus.com.br').id, 'automotive');
    is('a gym store is read', verticalFor('citygym.com CityGym').id, 'sport');
    is('a home store is read', verticalFor('casadecor.com.br').id, 'home');
    is('a cosmetics store is read', verticalFor('bellabeauty.com').id, 'beauty');
    /* The store that motivated the words: its stand-in demo offered kitchenware
       to a perfume house because nothing here knew the word oud. */
    is('a Gulf perfume house is read', verticalFor('https://arabianoud.com arabian_oud').id, 'beauty');
    is('an attar house is read', verticalFor('attar-collection.com').id, 'beauty');
    is('an electronics store is read', verticalFor('megaeletronicos.com.br').id, 'electronics');
    is('a clothing store is read', verticalFor('northfield-apparel.com').id, 'fashion');
    /* A name that says nothing must not be forced into a vertical. A tyre shop
       storefront for a store that sells something else is worse than a general one. */
    is('an address that says nothing gets the general range',
       verticalFor('https://www.example.com Acme').id, 'general');
    is('and so does an empty hint', verticalFor('').id, 'general');

    for (const hint of ['riopneus.com.br', 'citygym.com', 'example.com',
                        'casadecor.com.br', 'bellabeauty.com', 'megaeletronicos.com.br',
                        'northfield-apparel.com']) {
        const made = generatedCatalogue(hint);
        const label = ' [' + made.vertical + ']';

        is('the tier says generated' + label, made.tier, 'generated');
        ok('there are 40 to 50 products' + label,
           made.products.length >= 40 && made.products.length <= 50, made.products.length);
        is('across five categories' + label,
           new Set(made.products.map((p) => p.category)).size, 5);
        ok('every id is unique' + label,
           new Set(made.products.map((p) => p.id)).size === made.products.length);
        ok('every name is unique' + label,
           new Set(made.products.map((p) => p.name)).size === made.products.length);
        ok('every price is a usable number' + label,
           made.products.every((p) => Number.isFinite(p.price) && p.price > 0));

        /* stockCount is the one number this file still refuses to invent, and the
           reason is the original one: 0 announces a product out of stock and any
           other figure puts "only 3 left" on something nobody counted. */
        ok('no stock level is invented' + label,
           made.products.every((p) => p.stockCount === null));
        /* No currency, so the caller decides from the issue or the address. Claiming
           one would be inventing a fact rather than a placeholder. */
        is('no currency is claimed' + label, made.currency, null);
        /* Artwork is drawn per product, so an image would be a URL that can 404 on a
           call. Non-negotiable 4. */
        ok('no image is claimed' + label, made.products.every((p) => p.image === null));

        /* The dash rule applies to a generated catalogue exactly as it does to a
           scraped one, because products.json is committed and the guard reads bytes.

           Written as escapes rather than as the characters themselves, because the
           first version of this assertion put both dashes in a regex literal and the
           guard failed this file for containing them. The check was right. */
        ok('no em or en dash reaches a committed name' + label,
           !made.products.some((p) => /[\u2013\u2014]/.test(p.name + p.category)));
    }

    /* THE SAME STORE MUST BUILD THE SAME CATALOGUE. A demo whose prices move
       between two builds reads as a fault, and Math.random in a generator is how
       that happens. */
    const first = generatedCatalogue('riopneus.com.br');
    const again = generatedCatalogue('riopneus.com.br');
    same('the same store gets the same catalogue twice',
         first.products.map((p) => p.id + ':' + p.price).slice(0, 5),
         again.products.map((p) => p.id + ':' + p.price).slice(0, 5));

    /* Prices spread rather than repeat, or a grid shows one figure nine times. */
    const tyres = first.products.filter((p) => p.category === 'Tyres').map((p) => p.price);
    ok('prices spread across a band rather than repeating',
       new Set(tyres).size === tyres.length, tyres);
}

/* -------------------------------------------------------------------------- */
console.log('\n2. Category structure');

function products(spec) {
    const out = [];
    for (const [category, count] of Object.entries(spec)) {
        for (let i = 0; i < count; i++) {
            out.push({ id: category + '-' + i, name: category + ' ' + i, category,
                       price: 10, discountedPrice: null, stockCount: null,
                       attributes: {}, image: null });
        }
    }
    return out;
}

{
    const list = products({ Shoes: 14, Socks: 11, Apparel: 5 });
    same('dense categories are kept, largest first',
         categorise(list), ['Shoes', 'Socks', 'Apparel']);
}

{
    /* The real symptom: a retailer's structured data names the shelf rather than
       the department, so thirty products arrive as twenty leaf categories each
       holding one. Every name is genuinely theirs and the navigation is still
       useless, because clicking one shows the product already on screen. */
    const spec = {};
    for (let i = 0; i < 20; i++) spec['Leaf ' + i] = 1;
    const list = products(spec);
    same('singleton categories all fold into the tail', categorise(list), ['All products']);
    ok('and every product is reachable',
       list.every((product) => product.category === 'All products'));
}

{
    const list = products({ Big: 8, Small: 2, Tiny: 1 });
    const names = categorise(list);
    ok('a category above the minimum is kept', names.includes('Big'));
    ok('a two product category is kept in a small catalogue', names.includes('Small'), names);
    ok('a one product category is not', !names.includes('Tiny'), names);
    is('the tail is last', names[names.length - 1], 'More');
}

{
    /* THE MINIMUM SCALES. A fixed three was right for thirty products and wrong
       for ten: five sensible departments in a ten product CSV collapsed to one
       navigation entry plus More. */
    const small = products({ Summer: 3, Winter: 2, AllSeason: 2, Rims: 2, Kit: 1 });
    const names = categorise(small);
    ok('a small catalogue keeps its two product departments',
       names.includes('Winter') && names.includes('Rims'), names);

    const large = products({ A: 40, B: 2, C: 2 });
    const largeNames = categorise(large);
    ok('a large catalogue does not', !largeNames.includes('B'), largeNames);
}

{
    /* CALLED TWICE, which is what the pipeline does: once over everything found,
       then again over the capped list. The first pass writes More onto products,
       and the second pass used to count that as a real category and append a
       second More. */
    const list = products({ Shoes: 9, Socks: 4, Odds: 1 });
    const first = categorise(list);
    const second = categorise(list);
    same('the second pass agrees with the first', second, first);
    is('and More appears exactly once',
       second.filter((name) => name === 'More').length, 1);
    const third = categorise(list);
    same('and a third pass is still stable', third, first);
}

{
    const list = products({ '': 6 });
    same('a catalogue with no category names still gets one',
         categorise(list), ['All products']);
}

{
    /* THE COUNT CAP CANNOT FIX A LENGTH PROBLEM. js/storefront.js caps the
       navigation at six entries, which handles fourteen categories and does
       nothing about one category named with a hundred and twenty characters. A
       real feed produced exactly that, and the nav grew wider than the header. */
    const long = 'Custom Made Extremely Long Category Name That Goes On';
    const list = products({ [long]: 6 });
    const names = categorise(list);
    ok('a long category name is shortened', names[0].length <= 28, names);
    ok('and it is cut on a word boundary', !/\s$/.test(names[0]) && !names[0].endsWith('-'), names);
    ok('the product carries the same shortened name',
       list[0].category === names[0], { product: list[0].category, nav: names[0] });
}

{
    /* Two long names that differ only after the cut would collapse into one
       category. That is acceptable and better than an overflowing header, but it
       must not produce a duplicate entry in the navigation. */
    const list = products({
        'Extremely Long Category Name One': 4,
        'Extremely Long Category Name Two': 4
    });
    const names = categorise(list);
    is('names that collide after shortening produce one entry',
       new Set(names).size, names.length);
}

{
    const list = [
        { id: 'a', name: 'a', category: 'shoes', price: 1, discountedPrice: null,
          stockCount: null, attributes: {}, image: null },
        { id: 'b', name: 'b', category: 'SHOES', price: 1, discountedPrice: null,
          stockCount: null, attributes: {}, image: null },
        { id: 'c', name: 'c', category: 'Shoes', price: 1, discountedPrice: null,
          stockCount: null, attributes: {}, image: null }
    ];
    same('the same name in three cases is one category', categorise(list), ['Shoes']);
}

/* -------------------------------------------------------------------------- */
console.log('\n3. Choosing which products to ship');

{
    const list = products({ Shoes: 40, Socks: 20 });
    const capped = capProducts(list, 30);
    is('the cap is respected', capped.length, 30);
    const shoes = capped.filter((product) => product.category === 'Shoes').length;
    ok('both categories are represented rather than the first forty',
       shoes < 30 && shoes > 0, { shoes, of: capped.length });
}

{
    /* IN STOCK FIRST, and this is selection rather than invention. One real feed
       came back 26 of 30 out of stock, which is faithful and useless: almost
       nothing could be added to a cart, so the cart, the checkout and half the
       launcher had nothing to demonstrate. */
    const list = products({ Shoes: 20 });
    list.forEach((product, index) => { product.stockCount = index < 15 ? 0 : null; });
    const capped = capProducts(list, 5);
    is('sellable products are preferred',
       capped.filter((product) => product.stockCount === 0).length, 0);
}

{
    /* But a sold out product still appears when there is nothing else, because
       "Out of stock" is a state worth showing once. */
    const list = products({ Shoes: 4 });
    list.forEach((product) => { product.stockCount = 0; });
    const capped = capProducts(list, 4);
    is('a fully sold out category is still shipped', capped.length, 4);
}

{
    const list = products({ Shoes: 2 });
    is('a catalogue smaller than the cap is kept whole',
       capProducts(list, 30).length, 2);
}

/* -------------------------------------------------------------------------- */
console.log('\n3a. Colourways collapse to one product');

/* A real Shopify feed returned 30 products carrying 17 distinct names, because
   each colour of a garment is its own product with the same title. The grid
   repeated the same tile at the same price, which reads as a rendering fault. */
{
    const { catalogue } = await import('./catalogue.mjs');
    void catalogue;   /* the network tiers are exercised by hand, not here */
}
{
    /* dedupeByName is reached through fromCsv plus the pipeline, so it is checked
       where it is observable: a CSV with repeated names. */
    const csv = 'SKU,Product Name,Category,Price,Stock\n' +
        'A-1,Sasquatch Hoodie,Tops,120,0\n' +
        'A-2,Sasquatch Hoodie,Tops,120,4\n' +
        'A-3,Sasquatch Hoodie,Tops,120,7\n' +
        'B-1,Valdes Hip Pack,Bags,58,3\n' +
        'B-2,valdes hip pack,Bags,58,3\n' +
        'C-1,Colville Overshirt,Tops,95,2\n';
    const result = fromCsv(csv);
    is('the CSV itself keeps every row', result.products.length, 6);

    /* The pipeline is what dedupes, so the same shape is applied here. */
    const seen = new Map();
    for (const product of result.products) {
        const key = product.name.toLowerCase().replace(/\s+/g, ' ').trim();
        if (!seen.has(key)) seen.set(key, []);
        seen.get(key).push(product);
    }
    const distinct = [...seen.values()].map((group) =>
        group.find((product) => product.stockCount !== 0) || group[0]);
    is('three names survive', distinct.length, 3);
    is('case differences count as the same name',
       distinct.filter((product) => /valdes/i.test(product.name)).length, 1);
    is('and a sellable one is preferred over a sold out one',
       distinct.find((product) => product.name === 'Sasquatch Hoodie').id, 'A-2');
}

/* -------------------------------------------------------------------------- */
console.log('\n3b. Two products may never share an id');

/* A SHARED ID IS WORSE THAN A SHARED NAME, and a real feed produced one: two
   distinct rows with the same SKU. The id is the key everywhere it goes.
   product.html?id= resolves to whichever came first, so the other is unreachable.
   The cart and the wishlist are keyed on it. And product_id reaches Dengage, where
   two products' behaviour merges into one row set. */
{
    const { catalogue: pipeline } = await import('./catalogue.mjs');
    void pipeline;
    const csv = 'SKU,Name,Price\n' +
        'D-1,First Thing,10\n' +
        'D-1,Second Thing,11\n' +
        'D-2,Third Thing,12\n';
    const result = fromCsv(csv);
    is('the CSV reader itself reports every row', result.products.length, 3);

    /* The pipeline is what dedupes, applied here in the same order it uses. */
    const seen = new Set();
    const distinct = result.products.filter((product) => {
        if (seen.has(product.id)) return false;
        seen.add(product.id);
        return true;
    });
    is('only one survives per id', distinct.length, 2);
    is('and it is the first', distinct[0].name, 'First Thing');
    is('every shipped id is unique', new Set(distinct.map((p) => p.id)).size, distinct.length);
}

/* -------------------------------------------------------------------------- */
console.log('\n4. Font mapping');

/* BOTH OF THESE WERE REAL WRONG ANSWERS. Nearly every stylesheet ends a stack
   with monospace, which matched the IBM Plex pattern, and every stack ending
   sans-serif contains the substring serif, which matched the serif pattern. One
   site mapped to IBM Plex Sans while using neither IBM Plex nor a mono face. */
is('a mono fallback does not make it a mono font',
   mapFont('ui-monospace, SFMono-Regular, Menlo, monospace'), null);
is('sans-serif is not a serif',
   mapFont('-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'), 'DM Sans');
is('a real serif is a serif', mapFont('Georgia, "Times New Roman", serif'), 'Merriweather');
is('a display serif maps to one', mapFont('"Playfair Display", Georgia, serif'),
   'Playfair Display');
is('a geometric sans maps to one', mapFont('Poppins, sans-serif'), 'Poppins');
is('a licensed geometric sans maps to the nearest', mapFont('Circular, Helvetica, Arial'),
   'Poppins');
is('IBM Plex is itself', mapFont('"IBM Plex Sans", sans-serif'), 'IBM Plex Sans');
is('a css variable is not a family', mapFont('var(--brand-font), sans-serif'), null);
is('an unknown licensed face falls through', mapFont('"Untitled Sans XYZ", sans-serif'), null);
is('quotes and weights do not confuse it', mapFont("'Work Sans', sans-serif"), 'Work Sans');
is('nothing maps to nothing', mapFont(''), null);

ok('every mapped family is one the template can load',
   ['Georgia, serif', 'Poppins', '"IBM Plex Sans"', "'Work Sans'", 'Circular']
       .map(mapFont).filter(Boolean).every((name) => LOADABLE.includes(name)));

/* -------------------------------------------------------------------------- */
console.log('\n5. Colour judgement');

ok('near white is not a brand colour', !isBrandColour(parseHex('#fefefe')));
ok('near black is not a brand colour', !isBrandColour(parseHex('#0a0a0a')));
ok('a grey is not a brand colour', !isBrandColour(parseHex('#808080')));
ok('a saturated blue is', isBrandColour(parseHex('#125cfa')));
ok('a brand yellow is', isBrandColour(parseHex('#ffdb00')));

is('a three digit hex expands', JSON.stringify(parseHex('#fff')), '[255,255,255]');
is('an eight digit hex drops its alpha', JSON.stringify(parseHex('#125cfaff')), '[18,92,250]');
is('nonsense is null', parseHex('#zzz'), null);

/* The clamp exists because a demo whose Add to cart button is white on pale
   yellow is unreadable on a projector, and that is where these are seen. */
ok('white on a mid blue clears the threshold',
   contrast(parseHex('#0058a3'), [255, 255, 255]) >= 4.5);
ok('white on a pale yellow does not',
   contrast(parseHex('#ffdb00'), [255, 255, 255]) < 4.5);
ok('contrast is symmetric',
   Math.abs(contrast(parseHex('#125cfa'), [255, 255, 255]) -
            contrast([255, 255, 255], parseHex('#125cfa'))) < 1e-9);

/* -------------------------------------------------------------------------- */
console.log('\n5a. robots.txt, which is a promise rather than a preference');

/* Salil's decision, handoff 7.1: robots is respected, and it costs some sites.
   That makes this logic a commitment rather than an optimisation, and it is the
   kind of logic that is easy to get subtly wrong in either direction. Refusing
   everything loses prospects; obeying only the parts that suit us breaks the
   promise. */
{
    const { parseRobots, decide } = await import('./fetch.mjs');
    const allow = (text, path) => decide(parseRobots(text).rules, path);

    is('an empty robots.txt allows everything', allow('', '/products.json'), true);
    is('a rule for another agent does not apply to us',
       allow('User-agent: Googlebot\nDisallow: /\n', '/products.json'), true);
    is('the wildcard group applies to us',
       allow('User-agent: *\nDisallow: /products.json\n', '/products.json'), false);
    is('a group naming us applies to us',
       allow('User-agent: DengageDemoFactory\nDisallow: /x\n', '/x'), false);

    /* THE PRECEDENCE RULE. A site that disallows everything and then allows the
       product path is inviting exactly the crawl this does, and reading only the
       Disallow would refuse it. */
    is('the longest matching rule wins',
       allow('User-agent: *\nDisallow: /\nAllow: /products/\n', '/products/x'), true);
    is('and the disallow still holds elsewhere',
       allow('User-agent: *\nDisallow: /\nAllow: /products/\n', '/admin'), false);
    is('allow beats disallow at equal length',
       allow('User-agent: *\nDisallow: /a\nAllow: /a\n', '/a'), true);

    is('an empty Disallow blocks nothing',
       allow('User-agent: *\nDisallow:\n', '/anything'), true);
    is('a wildcard in the middle matches',
       allow('User-agent: *\nDisallow: /*.json\n', '/feed/products.json'), false);
    is('a dollar anchors the end',
       allow('User-agent: *\nDisallow: /x$\n', '/x'), false);
    is('and an anchored rule does not match a longer path',
       allow('User-agent: *\nDisallow: /x$\n', '/x/y'), true);
    is('comments are ignored',
       allow('User-agent: *  # us\nDisallow: /p  # no\n', '/p'), false);
    is('a blank line does not end the group',
       allow('User-agent: *\n\nDisallow: /p\n', '/p'), false);

    /* A group for another agent must not leak into ours. Reading state across
       groups is the classic robots parsing bug. */
    is('rules do not leak from a previous group',
       allow('User-agent: BadBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n', '/products.json'),
       true);

    const parsed = parseRobots(
        'Sitemap: https://example.com/sitemap.xml\nUser-agent: *\nDisallow: /admin\n' +
        'Sitemap: https://example.com/products.xml\n');
    same('sitemaps are collected wherever they appear', parsed.sitemaps,
         ['https://example.com/sitemap.xml', 'https://example.com/products.xml']);
}

/* -------------------------------------------------------------------------- */
console.log('\n6. Slugs');

is('a www domain', slugFromUrl('https://www.northfield-outdoor.com'), 'northfield-outdoor');
is('a co.uk domain', slugFromUrl('https://www.example.co.uk'), 'example');
is('a subdomain is kept', slugFromUrl('https://shop.example.com'), 'shop-example');
is('a path is ignored', slugFromUrl('https://www.example.com/collections/all'), 'example');
is('a dotted name becomes hyphens', slugFromUrl('https://a.b.example.com'), 'a-b-example');
ok('the result is always a legal slug',
   ['https://www.a-very-long-domain-name-that-goes-on-and-on-forever.com',
    'https://x.io', 'https://SHOUTY.COM']
       .every((url) => /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slugFromUrl(url))),
   ['https://x.io', 'https://SHOUTY.COM'].map(slugFromUrl));

/* -------------------------------------------------------------------------- */
console.log('\n7. Which currency a demo is priced in');

/* The last resort, and the one that decides a blocked store's demo. */
is('a country code resolves', currencyFromHost('https://www.riopneus.com.br'), 'BRL');
is('a country code with no second level resolves too',
   currencyFromHost('https://shop.example.br'), 'BRL');
is('co.uk resolves on the last label alone',
   currencyFromHost('https://www.example.co.uk'), 'GBP');
is('a euro country resolves', currencyFromHost('https://www.example.de'), 'EUR');
is('capitals in the host do not matter',
   currencyFromHost('https://WWW.EXAMPLE.CO.UK'), 'GBP');

/* Generic names must NOT resolve, or every .io startup is priced in the money of
   the British Indian Ocean Territory and every .co one in Colombian pesos. */
for (const generic of ['https://example.com', 'https://example.io', 'https://example.co',
                       'https://example.ai', 'https://example.shop', 'https://example.store',
                       'https://example.me', 'https://example.tv']) {
    ok('a generic name does not resolve: ' + generic, currencyFromHost(generic) === null,
       currencyFromHost(generic));
}
/* A COUNTRY IN THE NAME RATHER THAN THE SUFFIX. saudi.examplescents.com shipped
   priced in dollars on 7 August 2026: the store publishes no currency, .com says
   nothing, and the word "saudi" was the first label of the host all along. */
is('a country word in a label is read', currencyFromHost('https://saudi.examplescents.com'), 'SAR');
is('and in a hyphenated part of one', currencyFromHost('https://dubai-perfumes.com'), 'AED');
is('and in a subdomain', currencyFromHost('https://india.example.com'), 'INR');
/* THE SUFFIX OUTRANKS THE NAME, because a registration is a fact and a name is a
   choice. A Brazilian store called dubaistyle prices in reais. */
is('a country code suffix wins over a country word',
   currencyFromHost('https://dubai-style.com.br'), 'BRL');
/* WHOLE LABELS ONLY. These are the false positives the length floor and the label
   split exist for, and a substring search would fail all three. */
is('india is not found inside indianapolis',
   currencyFromHost('https://www.indianapolis-tools.com'), null);
is('oman is not found inside romantic',
   currencyFromHost('https://romantic-gifts.com'), null);
is('a two letter word is never a country here',
   currencyFromHost('https://shop.uk-example.com'), null);

/* Never throws on input it cannot parse, because it is called on the path where
   something has already gone wrong. */
is('an unparseable address is null, not an exception', currencyFromHost('not a url'), null);

/* THE ORDER IS THE WHOLE POINT: what somebody said beats what the file showed,
   which beats what the address implies, which beats the fallback. */
const found = (currency, tier) => ({ currency, tier });
same('the issue wins over everything',
     chooseCurrency('gbp', found('BRL', 'csv'), 'https://x.com.br'),
     { code: 'GBP', source: 'issue' });
same('the store beats the address',
     chooseCurrency(undefined, found('USD', 'shopify'), 'https://x.com.br'),
     { code: 'USD', source: 'store' });
same('the CSV beats the address, and says it was the CSV',
     chooseCurrency(undefined, found('EUR', 'csv'), 'https://x.com.br'),
     { code: 'EUR', source: 'csv' });
same('the address is used when nothing else said',
     chooseCurrency(undefined, found(null, 'csv'), 'https://www.riopneus.com.br'),
     { code: 'BRL', source: 'address' });
same('and the fallback is reached only when even the address says nothing',
     chooseCurrency(undefined, found(null, 'csv'), 'https://www.example.com'),
     { code: 'USD', source: 'fallback' });
/* --currency with no value after it arrives as boolean true from args(), and a
   two letter or misspelt code must not become the currency. Both have to fall
   through rather than coerce. */
same('a bare --currency flag falls through',
     chooseCurrency(true, found(null, 'csv'), 'https://x.com.br'),
     { code: 'BRL', source: 'address' });
same('a code that is not three letters falls through',
     chooseCurrency('reais', found(null, 'csv'), 'https://x.com.br'),
     { code: 'BRL', source: 'address' });

/* -------------------------------------------------------------------------- */
console.log('\n8. The WooCommerce Store API mapping');

/* THE PRICES ARE STRINGS IN MINOR UNITS. The API reports "1999" with
   currency_minor_unit 2 for a product costing 19.99, so forgetting the division
   ships a price one hundred times too large, on a page that renders perfectly.
   Every case here that asserts 19.99 would read 1999 without it, which makes
   this the section where the trap is visible rather than hoped against. */
function wooItem(i, extra) {
    return {
        id: 100 + i,
        name: 'Widget ' + i,
        sku: 'W-' + i,
        prices: { price: '1999', regular_price: '1999', sale_price: '1999',
                  currency_code: 'EUR', currency_minor_unit: 2 },
        images: [{ src: 'https://cdn.example.com/w' + i + '.jpg' }],
        categories: [{ name: i % 2 ? 'Bits' : 'Bobs' }],
        is_in_stock: true,
        stock_quantity: null,
        ...extra
    };
}

{
    const result = wooFromApi([wooItem(1)], 'https://example.com');
    ok('the store api response maps', result.ok, result);
    is('and names its tier', result.tier, 'woocommerce');
    const product = result.products[0];
    is('the name arrives', product.name, 'Widget 1');
    is('the sku becomes the id', product.id, 'W-1');
    is('the first category is the category', product.category, 'Bits');
    is('the currency comes from currency_code', result.currency, 'EUR');
    is('THE 100x TRAP: "1999" at minor unit 2 is 19.99, not 1999', product.price, 19.99);
    is('regular equal to price is not a discount', product.discountedPrice, null);
    is('the first image is the imageUrl', product.imageUrl, 'https://cdn.example.com/w1.jpg');
    is('is_in_stock alone is not a number, so stock stays unknown', product.stockCount, null);
    is('image stays null for the downloader to fill', product.image, null);
}

{
    const zero = wooFromApi([wooItem(1, {
        prices: { price: '1999', regular_price: '1999', currency_code: 'JPY',
                  currency_minor_unit: 0 } })], 'https://example.com');
    is('minor unit 0 divides by nothing: "1999" is 1999', zero.products[0].price, 1999);

    const three = wooFromApi([wooItem(1, {
        prices: { price: '12500', regular_price: '12500', currency_code: 'KWD',
                  currency_minor_unit: 3 } })], 'https://example.com');
    is('minor unit 3 divides by 1000', three.products[0].price, 12.5);
}

{
    /* THE KNOWN-BAD CASE FOR THE MINOR UNIT ITSELF. Number(null) is 0, so a
       missing minor unit read loosely divides by 10^0 and ships the 100x price
       through the meta field instead of the price. The product must be dropped,
       and above all it must never arrive priced 1999. */
    const missing = wooFromApi([wooItem(1, {
        prices: { price: '1999', regular_price: '1999', currency_code: 'EUR' } })],
        'https://example.com');
    ok('a payload with no minor unit is refused rather than guessed at',
       !missing.ok, missing);
    const nulled = wooFromApi([wooItem(1, {
        prices: { price: '1999', regular_price: '1999', currency_code: 'EUR',
                  currency_minor_unit: null } })], 'https://example.com');
    ok('and an explicit null minor unit is the same refusal', !nulled.ok, nulled);
}

{
    const sale = wooFromApi([wooItem(1, {
        prices: { price: '1499', regular_price: '1999', sale_price: '1499',
                  currency_code: 'EUR', currency_minor_unit: 2 } })], 'https://example.com');
    is('a sale maps regular to the price', sale.products[0].price, 19.99);
    is('and the current price to the discount', sale.products[0].discountedPrice, 14.99);

    const above = wooFromApi([wooItem(1, {
        prices: { price: '2499', regular_price: '1999', currency_code: 'EUR',
                  currency_minor_unit: 2 } })], 'https://example.com');
    is('a regular price below the current one is not a discount',
       above.products[0].discountedPrice, null);
    is('and the current price stands', above.products[0].price, 24.99);
}

{
    is('a numeric stock_quantity is a count',
       wooFromApi([wooItem(1, { stock_quantity: 7 })], 'https://x.com').products[0].stockCount, 7);
    is('a numeric string counts too',
       wooFromApi([wooItem(1, { stock_quantity: '12' })], 'https://x.com').products[0].stockCount, 12);
    is('a word in stock_quantity is unknown, not zero',
       wooFromApi([wooItem(1, { stock_quantity: 'instock' })], 'https://x.com').products[0].stockCount, null);
    is('is_in_stock false alone is still not a number',
       wooFromApi([wooItem(1, { is_in_stock: false })], 'https://x.com').products[0].stockCount, null);
}

{
    is('no images means no imageUrl',
       wooFromApi([wooItem(1, { images: [] })], 'https://x.com').products[0].imageUrl, null);
    is('an http image is refused',
       wooFromApi([wooItem(1, { images: [{ src: 'http://cdn.example.com/a.jpg' }] })],
                  'https://x.com').products[0].imageUrl, null);
    ok('an empty response is a clean failure', !wooFromApi([], 'https://x.com').ok);
    ok('a non-array response is a clean failure', !wooFromApi({ error: 'nope' }, 'https://x.com').ok);
    ok('a product with no name is dropped',
       !wooFromApi([wooItem(1, { name: '' })], 'https://x.com').ok);
}

/* -------------------------------------------------------------------------- */
console.log('\n9. One page, three ways to say what it sells');

const htmlPage = (body) => '<!doctype html><html><head></head><body>' + body + '</body></html>';
const ldScript = (obj) => '<script type="application/ld+json">' + JSON.stringify(obj) + '</script>';

{
    /* schema.org image arrives as a string, an array, or an ImageObject, and the
       refusals matter as much as the reads: a javascript: or data: value stored
       as an address would reach the downloader as an instruction. */
    const withImage = (image) => extractProductsFromHtml(htmlPage(ldScript({
        '@type': 'Product', name: 'Tyre', sku: 'T1', image,
        offers: { price: 10, priceCurrency: 'USD' }
    })), 'https://store.example/p/1');

    is('a string image is kept',
       withImage('https://img.example/a.jpg').products[0].imageUrl, 'https://img.example/a.jpg');
    is('an array takes the first usable entry, skipping an unusable one',
       withImage(['data:image/png;base64,AA', 'https://img.example/b.jpg']).products[0].imageUrl,
       'https://img.example/b.jpg');
    is('an ImageObject is read through its url',
       withImage({ '@type': 'ImageObject', url: 'https://img.example/c.jpg' }).products[0].imageUrl,
       'https://img.example/c.jpg');
    is('a relative path resolves against the page it was found on',
       withImage('/img/d.jpg').products[0].imageUrl, 'https://store.example/img/d.jpg');
    is('http is refused, not upgraded',
       withImage('http://img.example/e.jpg').products[0].imageUrl, null);
    is('javascript: is refused',
       withImage('javascript:alert(1)').products[0].imageUrl, null);
    is('a data uri is refused',
       withImage('data:image/png;base64,AAAA').products[0].imageUrl, null);
    is('no image claimed stays null', withImage(undefined).products[0].imageUrl, null);
    is('the method is counted for the attempts detail', withImage(undefined).methods.jsonld, 1);
    is('and the offer currency is reported', withImage(undefined).currency, 'USD');
}

{
    /* A ProductGroup's photo usually lives on the group, so a variant read
       without inheritance would arrive imageless. */
    const grouped = extractProductsFromHtml(htmlPage(ldScript({
        '@type': 'ProductGroup', name: 'Ruched Bra', category: 'bras',
        image: 'https://img.example/group.jpg',
        hasVariant: [{ '@type': 'Product', name: 'Ruched Bra', sku: 'B1-KBBL',
                       offers: { price: 21, priceCurrency: 'USD' } }]
    })), 'https://store.example/p/2');
    const variant = grouped.products.find((p) => p.id === 'B1-KBBL');
    is('a variant inherits the image it does not carry',
       variant && variant.imageUrl, 'https://img.example/group.jpg');
}

{
    /* NEVER DOUBLE COUNT. Most themes emit JSON-LD and microdata describing the
       same product, so taking both would ship every product twice. */
    const both = extractProductsFromHtml(htmlPage(
        ldScript({ '@type': 'Product', name: 'Tyre', sku: 'T1', offers: { price: 10 } }) +
        '<div itemscope itemtype="https://schema.org/Product">' +
        '<span itemprop="name">Tyre</span><span itemprop="price">10.00</span></div>'),
        'https://store.example/p/3');
    is('json-ld on a page wins outright', both.products.length, 1);
    is('and microdata contributes nothing on that page', both.methods.microdata, 0);
    is('while json-ld is counted', both.methods.jsonld, 1);
}

{
    /* TWO ADJACENT MICRODATA PRODUCTS MUST NOT BLEED. The first product carries
       nested tags and an image; the second must come out with its own name, its
       own price, and no borrowed image. Read across the whole document instead
       of per scope, the first product's regexes would swallow the second's
       values, and that is exactly what a listing page looks like. */
    const listing = extractProductsFromHtml(htmlPage(
        '<div itemscope itemtype="https://schema.org/Product">' +
        '  <h1 itemprop="name">Alpha Chair</h1>' +
        '  <meta itemprop="sku" content="A-1">' +
        '  <div itemprop="offers" itemscope itemtype="https://schema.org/Offer">' +
        '    <span itemprop="price" content="19.99">19.99</span>' +
        '    <meta itemprop="priceCurrency" content="GBP">' +
        '  </div>' +
        '  <img itemprop="image" src="/images/alpha.jpg">' +
        '</div>' +
        '<div itemscope itemtype="http://schema.org/Product">' +
        '  <span itemprop="name">Beta Stool</span>' +
        '  <span itemprop="price">29.99</span>' +
        '</div>'), 'https://store.example/chairs');

    is('both adjacent products are read', listing.products.length, 2);
    is('the first keeps its own name', listing.products[0].name, 'Alpha Chair');
    is('the first keeps its own price', listing.products[0].price, 19.99);
    is('the second keeps its own name', listing.products[1].name, 'Beta Stool');
    is('the second keeps its own price, not its neighbour\'s', listing.products[1].price, 29.99);
    is('the first resolves its relative image against the page',
       listing.products[0].imageUrl, 'https://store.example/images/alpha.jpg');
    is('the second does not borrow the first\'s image', listing.products[1].imageUrl, null);
    is('the sku becomes the first product\'s id', listing.products[0].id, 'A-1');
    is('the currency is read from the scope that carries one', listing.currency, 'GBP');
    is('both are counted as microdata', listing.methods.microdata, 2);
}

{
    /* A scope missing its price is dropped, and it must not steal the price of
       the scope after it on the way out. */
    const partial = extractProductsFromHtml(htmlPage(
        '<div itemscope itemtype="https://schema.org/Product">' +
        '<span itemprop="name">No Price <b>Listed</b></span></div>' +
        '<div itemscope itemtype="https://schema.org/Product">' +
        '<span itemprop="name">Priced Stool</span><span itemprop="price">12.50</span></div>'),
        'https://store.example/x');
    is('only the priced product survives', partial.products.length, 1);
    is('and it is the right one', partial.products[0].name, 'Priced Stool');
    is('with its own price', partial.products[0].price, 12.5);
}

{
    /* THE num() TRAP, THROUGH MICRODATA. A price that is a word strips to
       nothing, and Number('') is 0, so without the guard this page would ship a
       free product. It must be dropped, never priced at zero. */
    const worded = extractProductsFromHtml(htmlPage(
        '<div itemscope itemtype="https://schema.org/Product">' +
        '<span itemprop="name">Ask Us Sofa</span>' +
        '<span itemprop="price">Call for price</span></div>'), 'https://store.example/y');
    is('a word in a microdata price drops the product', worded.products.length, 0);
    ok('and nothing arrives priced zero',
       worded.products.every((p) => p.price !== 0));
}

{
    /* og meta describes the page, so it yields at most one product, and only
       when a title and a usable price are both present. */
    const og = extractProductsFromHtml(htmlPage(
        '<meta property="og:title" content="Solo Lamp">' +
        '<meta property="product:price:amount" content="49.90">' +
        '<meta property="product:price:currency" content="eur">' +
        '<meta property="og:image" content="https://img.example/lamp.jpg">'),
        'https://store.example/lamp');
    is('og yields one product', og.products.length, 1);
    is('with the title as its name', og.products[0].name, 'Solo Lamp');
    is('the amount as its price', og.products[0].price, 49.9);
    is('the currency uppercased', og.currency, 'EUR');
    is('and the og image as its imageUrl', og.products[0].imageUrl, 'https://img.example/lamp.jpg');
    is('counted under og', og.methods.og, 1);

    const titled = extractProductsFromHtml(htmlPage(
        '<meta property="og:title" content="Just a Blog Post">'), 'https://store.example/z');
    is('a title with no price is not a product', titled.products.length, 0);

    const doubled = extractProductsFromHtml(htmlPage(
        '<meta property="og:title" content="Lamp A">' +
        '<meta property="og:title" content="Lamp B">' +
        '<meta property="product:price:amount" content="10">'), 'https://store.example/z2');
    is('og never yields more than one product per page', doubled.products.length, 1);

    const empty = extractProductsFromHtml(htmlPage('<p>About us</p>'), 'https://store.example/about');
    is('a page with nothing relevant yields nothing', empty.products.length, 0);
    is('and claims no currency', empty.currency, null);
}

/* -------------------------------------------------------------------------- */
console.log('\n10. Image addresses in a CSV');

function oneImageCell(headingName, cell) {
    const result = fromCsv('Name,Price,' + headingName + '\nThing,10,"' + cell + '"\n');
    return result.ok ? result.products[0].imageUrl : 'unreadable';
}

{
    const url = 'https://cdn.example.com/a.jpg';
    for (const headingName of ['Image', 'Image URL', 'image_url', 'img', 'Photo',
                               'picture', 'image link', 'Imagem']) {
        is('a column headed ' + headingName + ' is read', oneImageCell(headingName, url), url);
    }
    is('surrounding whitespace is trimmed', oneImageCell('Image', '  ' + url + '  '), url);
    is('http is refused, not upgraded', oneImageCell('Image', 'http://cdn.example.com/a.jpg'), null);
    is('javascript: is refused', oneImageCell('Image', 'javascript:alert(1)'), null);
    is('a data uri is refused', oneImageCell('Image', 'data:image/png;base64,AAAA'), null);
    is('a relative path is refused, a CSV has no page to resolve it against',
       oneImageCell('Image', '/img/a.jpg'), null);
    is('an empty cell is null', oneImageCell('Image', ''), null);
    is('no image column still leaves the key present and null',
       fromCsv('Name,Price\nThing,10\n').products[0].imageUrl, null);
    is('and an image column does not cost the row its price',
       fromCsv('Name,Price,Image\nThing,10,' + url + '\n').products[0].price, 10);
}

/* -------------------------------------------------------------------------- */
console.log('\n11. The tiers over HTTP, against a local fixture');

/* THE ONLY SECTION THAT OPENS A SOCKET, and it never leaves 127.0.0.1: a
   throwaway server plays the prospect so the request plumbing, the fallbacks
   between routes and the dispatcher's tier order are exercised for real. Ports
   9100 to 9199 are this suite's assigned range. The dispatcher is always called
   with render: false here, because the render tier belongs to render.mjs and
   these tests must not depend on whether that module exists yet. */
let nextPort = 9100;

async function fixtureServer(build) {
    const port = nextPort++;
    const origin = 'http://127.0.0.1:' + port;
    const routes = typeof build === 'function' ? build(origin) : build;
    const server = createServer((request, response) => {
        const path = new URL(request.url, origin).pathname;
        const route = routes[path];
        if (!route) {
            response.writeHead(404, { 'content-type': 'text/plain' });
            response.end('not here');
            return;
        }
        response.writeHead(route.status || 200, { 'content-type': route.type || 'text/html' });
        response.end(route.body || '');
    });
    await new Promise((resolve, reject) =>
        server.listen(port, '127.0.0.1', resolve).on('error', reject));
    return { origin, close: () => new Promise((resolve) => server.close(resolve)) };
}

{
    /* Shopify end to end: the feed answers, images thread through, and the
       currency is read from the storefront page rather than defaulted. */
    const shopifyItems = Array.from({ length: 9 }, (_, i) => ({
        id: i + 1, title: 'Widget ' + (i + 1), handle: 'widget-' + (i + 1),
        product_type: i % 2 ? 'Bits' : 'Bobs', options: [], vendor: '',
        variants: [{ sku: 'S-' + (i + 1), price: '19.99', compare_at_price: null, available: true }],
        images: [{ src: 'https://cdn.example.com/s' + (i + 1) + '.jpg' }]
    }));
    const site = await fixtureServer({
        '/products.json': { type: 'application/json',
                            body: JSON.stringify({ products: shopifyItems }) },
        '/': { body: '<script>Shopify.currency = {"active":"EUR","rate":"1.0"};</script>' }
    });
    const result = await catalogue(site.origin, null, { render: false });
    await site.close();

    ok('the shopify fixture builds a catalogue', result.ok, result.attempts);
    is('via the shopify tier', result.tier, 'shopify');
    is('the storefront page supplies the currency', result.currency, 'EUR');
    ok('every product carries its https image address',
       result.products.every((p) => /^https:\/\/cdn\.example\.com\//.test(p.imageUrl)),
       result.products.map((p) => p.imageUrl));
    ok('and image itself stays null for the downloader',
       result.products.every((p) => p.image === null));
}

{
    /* The dispatcher's order: shopify misses, woocommerce answers, and the
       attempts list says so in that order because the issue comment quotes it. */
    const site = await fixtureServer({
        '/wp-json/wc/store/v1/products': {
            type: 'application/json',
            body: JSON.stringify(Array.from({ length: 9 }, (_, i) => wooItem(i + 1)))
        }
    });
    const result = await catalogue(site.origin, null, { render: false });
    await site.close();

    ok('the woocommerce fixture builds a catalogue', result.ok, result.attempts);
    is('via the woocommerce tier', result.tier, 'woocommerce');
    is('after shopify was tried first', result.attempts[0].tier, 'shopify');
    is('and reported its miss', result.attempts[0].ok, false);
    is('woocommerce is the second attempt', result.attempts[1].tier, 'woocommerce');
    is('the currency arrives from the api', result.currency, 'EUR');
    is('the divided price survives the pipeline', result.products[0].price, 19.99);
    ok('every shipped product has the imageUrl key',
       result.products.every((p) => p.imageUrl !== undefined));
}

{
    /* Older installs serve the same API without /v1, so a 404 on the current
       route must fall through to the unversioned one rather than give up. */
    const site = await fixtureServer({
        '/wp-json/wc/store/products': {
            type: 'application/json',
            body: JSON.stringify(Array.from({ length: 9 }, (_, i) => wooItem(i + 1)))
        }
    });
    const result = await woocommerce(site.origin);
    await site.close();

    ok('a 404 on /v1 falls through to the unversioned route', result.ok, result);
    is('and still reads every product', result.products.length, 9);

    const bare = await fixtureServer({});
    const nothing = await woocommerce(bare.origin);
    await bare.close();
    ok('both routes missing is a clean failure', !nothing.ok, nothing);
    is('reported as not-found so the dispatcher moves on', nothing.reason, 'not-found');
}

{
    /* The sitemap walk reaching microdata pages: a store with no feed, no store
       api and no JSON-LD is still read, and the jsonld tier's detail says which
       method did the work, because the issue comment quotes attempts. */
    const site = await fixtureServer((origin) => {
        const routes = {
            '/sitemap.xml': {
                type: 'application/xml',
                body: '<?xml version="1.0"?><urlset>' +
                    Array.from({ length: 9 }, (_, i) =>
                        '<url><loc>' + origin + '/product/' + (i + 1) + '</loc></url>').join('') +
                    '</urlset>'
            }
        };
        for (let i = 1; i <= 9; i++) {
            routes['/product/' + i] = {
                body: '<html><body><div itemscope itemtype="https://schema.org/Product">' +
                    '<h1 itemprop="name">Fixture Item ' + i + '</h1>' +
                    '<span itemprop="price" content="' + (10 + i) + '.50"></span>' +
                    '<meta itemprop="priceCurrency" content="GBP">' +
                    '<span itemprop="category">' + (i % 2 ? 'Bits' : 'Bobs') + '</span>' +
                    '<img itemprop="image" src="https://img.example/f' + i + '.jpg">' +
                    '</div></body></html>'
            };
        }
        return routes;
    });
    const result = await catalogue(site.origin, null, { render: false });
    await site.close();

    ok('a microdata-only store is read through the sitemap', result.ok, result.attempts);
    is('via the jsonld tier, which keeps its public name', result.tier, 'jsonld');
    is('nine products arrive', result.products.length, 9);
    is('the currency is read from the markup', result.currency, 'GBP');
    ok('every product carries its image address',
       result.products.every((p) => /^https:\/\/img\.example\//.test(p.imageUrl)));
    const attempt = result.attempts.find((a) => a.tier === 'jsonld');
    is('and the attempts detail credits the method that did the work',
       attempt.detail, 'json-ld 0, microdata 9, og 0');
}

{
    /* A ROUTING WORD IS NOT A CATEGORY. thegivingmovement.com shipped with all
       thirty products filed under "Products" because every address began
       /products/ and the head-segment rule read that as taxonomy. The head only
       counts when it names something. */
    const noCategory = (pageUrl) => extractProductsFromHtml(htmlPage(ldScript({
        '@type': 'Product', name: 'Anything', sku: 'A1',
        offers: { price: 10, priceCurrency: 'USD' }
    })), pageUrl).products[0].category;

    is('a /products/ head contributes nothing', noCategory('https://store.example/products/blue-shirt'), '');
    is('nor does /collections/', noCategory('https://store.example/collections/tops'), '');
    is('nor /shop/', noCategory('https://store.example/shop/blue-shirt'), '');
    is('a head that names a real category still counts',
       noCategory('https://store.example/glasses/spectus-flexi.html'), 'glasses');
    is('behind a locale prefix too',
       noCategory('https://store.example/ae-en/glasses/spectus-flexi.html'), 'glasses');
}

{
    /* THE COLLECTIONS PASS, END TO END. Product pages carry no category and sit
       under /products/, which is exactly the store shape that shipped with one
       bucket. The sitemap also names the store's collection pages, and each one
       lists its products as ordinary links, so the taxonomy is recovered from
       there: the most specific collection wins, and a collection that is the
       whole store contributes nothing. */
    const site = await fixtureServer((origin) => {
        const locs = [];
        for (let i = 1; i <= 9; i++) locs.push(origin + '/products/widget-' + i);
        for (const slug of ['shirts', 'shoes', 'all', 'apparel',
                            'gift-wrap', 'staff-pick']) {
            locs.push(origin + '/collections/' + slug);
        }
        const links = (from, to) => {
            let body = '';
            for (let i = from; i <= to; i++) {
                body += '<a href="/products/widget-' + i + '">Widget ' + i + '</a>';
            }
            return body;
        };
        const routes = {
            '/sitemap.xml': {
                type: 'application/xml',
                body: '<?xml version="1.0"?><urlset>' +
                    locs.map((loc) => '<url><loc>' + loc + '</loc></url>').join('') +
                    '</urlset>'
            },
            /* Five shirts, four shoes. Apparel holds all nine, so it is less
               specific than either and must never win. All is the whole store
               by name and must not even be read. Gift wrap and staff pick each
               hold ONE product, which is the shape that broke the real store:
               217 fine grained collections against a thirty product sample
               handed nearly every product a private collection, and the
               navigation minimum then threw every one of them away. A
               collection vouching for a single product must lose to any
               department that also lists it. */
            '/collections/shirts':     { body: htmlPage(links(1, 5)) },
            '/collections/shoes':      { body: htmlPage(links(6, 9)) },
            '/collections/apparel':    { body: htmlPage(links(1, 9)) },
            '/collections/all':        { body: htmlPage(links(1, 9)) },
            '/collections/gift-wrap':  { body: htmlPage(links(9, 9)) },
            '/collections/staff-pick': { body: htmlPage(links(3, 3)) }
        };
        for (let i = 1; i <= 9; i++) {
            routes['/products/widget-' + i] = {
                body: htmlPage(ldScript({
                    '@type': 'Product', name: 'Widget ' + i, sku: 'W-' + i,
                    offers: { price: '12.00', priceCurrency: 'EUR' }
                }))
            };
        }
        return routes;
    });
    const result = await catalogue(site.origin, null, { render: false });
    await site.close();

    ok('the store builds a catalogue', result.ok, result.attempts);
    is('nine products arrive', result.products.length, 9);
    same('the navigation is the store\'s own collections, largest first',
         result.categories, ['Shirts', 'Shoes']);
    ok('the five shirts are shirts',
       result.products.filter((p) => p.category === 'Shirts').length === 5,
       result.products.map((p) => p.name + ':' + p.category));
    ok('the four shoes are shoes',
       result.products.filter((p) => p.category === 'Shoes').length === 4);
    ok('the whole-store collections never win',
       result.products.every((p) => p.category !== 'Apparel' && p.category !== 'All'));
    ok('a collection vouching for one product never wins either',
       result.products.every((p) => p.category !== 'Gift Wrap' && p.category !== 'Staff Pick'),
       result.products.map((p) => p.name + ':' + p.category));

    const attempt = result.attempts.find((a) => a.tier === 'jsonld');
    ok('the attempts detail says where the categories came from',
       /categories for 9 of 9 products from 5 collection pages/.test(attempt.detail),
       attempt.detail);
}

{
    /* THE PASS FINDING NOTHING IS SAID, NOT HIDDEN. A store whose collection
       pages render client side yields no links, and the detail quoted on the
       issue must say the recovery ran and came back empty rather than imply it
       was never needed. */
    const site = await fixtureServer((origin) => {
        const routes = {
            '/sitemap.xml': {
                type: 'application/xml',
                body: '<?xml version="1.0"?><urlset>' +
                    Array.from({ length: 9 }, (_, i) =>
                        '<url><loc>' + origin + '/products/thing-' + (i + 1) + '</loc></url>').join('') +
                    '</urlset>'
            }
        };
        for (let i = 1; i <= 9; i++) {
            routes['/products/thing-' + i] = {
                body: htmlPage(ldScript({
                    '@type': 'Product', name: 'Thing ' + i, sku: 'T-' + i,
                    offers: { price: '9.00', priceCurrency: 'EUR' }
                }))
            };
        }
        return routes;
    });
    const result = await catalogue(site.origin, null, { render: false });
    await site.close();

    ok('the store still builds', result.ok, result.attempts);
    same('and degrades to the one honest bucket', result.categories, ['All products']);
    const attempt = result.attempts.find((a) => a.tier === 'jsonld');
    ok('while the detail admits the recovery found nothing',
       /categories for 0 of 9 products from 0 collection pages/.test(attempt.detail),
       attempt.detail);
}

{
    /* Everything missing: every tier reports a clean miss, in order, and with no
       generateIfUnreadable flag the answer is an honest refusal. */
    const site = await fixtureServer({});
    const result = await catalogue(site.origin, null, { render: false });
    await site.close();

    ok('a site that answers nothing is a clean failure', !result.ok, result);
    same('every tier was tried, in the documented order',
         result.attempts.map((a) => a.tier), ['shopify', 'woocommerce', 'jsonld']);
    is('and nothing was found to quote back', result.thin, 0);
}

console.log('\n12. A site that names its own brand, even in black');

/* THE BUG THESE PIN shipped a Tailwind grey as a perfume house's brand. The
   store declares --color-primary: #000000, which is the site answering the
   question directly, and the grey filter that exists so frequency counting can
   never pick black silently discarded the declaration too. The extractor then
   crowned the most-counted survivor of the platform's utility CSS: gray-700.
   A black brand is not a failure to have a brand.

   The fixture is shaped like the real store: a Salla-style token block carrying
   the answer, its shade and inverse variants beside it, a text-role token that
   ends in the same word, and a wall of framework grey noise that outweighs
   everything by frequency. */
const SALLA_SHAPE = `
  :root {
    --color-primary: #000000;
    --color-primary-reverse: #cccccc;
    --color-primary-light: #262626;
    --color-primary-dark: #000000;
    --store-text-primary: #111827;
    --color-text-primary: #111827;
  }
  .btn-sale { background-color: #f87171; }
  ` + '.u-grey { color: #374151; background-color: #374151; }\n'.repeat(60);

const TEMPLATE_THEME = JSON.parse(
    readFileSync(new URL('../../template/demo.config.json', import.meta.url), 'utf8')).theme;

{
    const site = await fixtureServer((origin) => ({
        '/': { body: '<html><head><link rel="stylesheet" href="' + origin +
                     '/app.css"></head><body></body></html>' },
        '/app.css': { type: 'text/css', body: SALLA_SHAPE }
    }));
    const out = await theme(site.origin, TEMPLATE_THEME);
    await site.close();

    is('the declared black outranks sixty declarations of a framework grey',
       out.theme.primary, '#000000');
    is('white reads on it', out.theme.onPrimary, '#ffffff');
    ok('the reverse, light, dark and text-primary variants never register',
       !['#cccccc', '#262626', '#111827'].includes(out.theme.primary),
       out.theme.primary);
    is('the accent against an achromatic brand is the colourful thing, not a grey',
       out.theme.accent, '#f87171');
}

{
    /* A declared near-white is refused, because a white primary gives the theme
       nothing to work with, and the counted ranking stands in as before. */
    const site = await fixtureServer((origin) => ({
        '/': { body: '<html><head><link rel="stylesheet" href="' + origin +
                     '/app.css"></head><body></body></html>' },
        '/app.css': { type: 'text/css',
                      body: ':root { --color-primary: #fefefe; }\n' +
                            '.btn { background-color: #1f5c3d; }\n'.repeat(9) }
    }));
    const out = await theme(site.origin, TEMPLATE_THEME);
    await site.close();

    is('a declared near-white is refused and the counted colour wins',
       out.theme.primary, '#1f5c3d');
}

{
    /* No declared token at all: the frequency path is exactly what it was, which
       is the assertion that keeps this channel an addition rather than a
       rewrite. */
    const site = await fixtureServer((origin) => ({
        '/': { body: '<html><head><link rel="stylesheet" href="' + origin +
                     '/app.css"></head><body></body></html>' },
        '/app.css': { type: 'text/css',
                      body: '.btn { background-color: #b4975a; }\n'.repeat(7) +
                            '.tag { color: #5e0006; }\n'.repeat(3) }
    }));
    const out = await theme(site.origin, TEMPLATE_THEME);
    await site.close();

    is('with nothing declared, the counted ranking decides as before',
       out.theme.primary, '#b4975a');
}

{
    /* Shopify's Dawn family: the palette is bare RGB triplets under names that
       never say primary, and stores on it declare nothing that does. */
    const site = await fixtureServer((origin) => ({
        '/': { body: '<html><head><link rel="stylesheet" href="' + origin +
                     '/dawn.css"></head><body></body></html>' },
        '/dawn.css': { type: 'text/css',
                       body: ':root { --color-button: 18,18,18; --color-base-accent-1: 18,18,18; }\n' +
                             '.u-grey { color: #374151; }\n'.repeat(40) }
    }));
    const out = await theme(site.origin, TEMPLATE_THEME);
    await site.close();

    is('a Dawn store\'s bare triplet button token is read, and beats the counted grey',
       out.theme.primary, '#121212');
}

{
    /* The theme-color meta and the manifest are the site naming its colour in
       standard places, and a named primary token still outranks both. */
    const meta = await fixtureServer(() => ({
        '/': { body: '<html><head><meta name="theme-color" content="#1f5c3d">' +
                     '</head><body></body></html>' }
    }));
    const metaOut = await theme(meta.origin, TEMPLATE_THEME);
    await meta.close();
    is('the theme-color meta stands in when the CSS never says',
       metaOut.theme.primary, '#1f5c3d');

    const manifest = await fixtureServer((origin) => ({
        '/': { body: '<html><head><link rel="manifest" href="' + origin +
                     '/site.webmanifest"></head><body></body></html>' },
        '/site.webmanifest': { type: 'application/manifest+json',
                               body: '{"name":"x","theme_color":"#5e0006"}' }
    }));
    const manifestOut = await theme(manifest.origin, TEMPLATE_THEME);
    await manifest.close();
    is('the web manifest theme_color is read too', manifestOut.theme.primary, '#5e0006');

    const both = await fixtureServer((origin) => ({
        '/': { body: '<html><head><meta name="theme-color" content="#ff0000">' +
                     '<link rel="stylesheet" href="' + origin + '/a.css"></head><body></body></html>' },
        '/a.css': { type: 'text/css', body: ':root { --color-primary: #000000; }' }
    }));
    const bothOut = await theme(both.origin, TEMPLATE_THEME);
    await both.close();
    is('a named primary token outranks the meta when the two disagree',
       bothOut.theme.primary, '#000000');
}

/* -------------------------------------------------------------------------- */
/* 12. What a regional eyewear retailer taught this scraper in one afternoon   */

/* Every case in this section is a defect that shipped, found on one live store
   that the factory had already declared unreadable. They are grouped because
   they were found together and because each one alone would still have produced
   a demo nobody could show. */

{
    /* THE ACCEPT HEADER. Asking for text/html and nothing else is a narrower
       request than any browser makes, and this store's CDN answered it with a
       500. The factory reported a perfectly readable store as unreadable and
       asked a colleague for a spreadsheet. */
    is('a preferred type keeps the wildcard, so a preference is not an exclusion',
       acceptHeader('text/html'),
       'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
    ok('any other type gets the wildcard appended too',
       acceptHeader('application/json').startsWith('application/json,') &&
       acceptHeader('application/json').includes('*/*'),
       acceptHeader('application/json'));
    is('no preference stays the bare wildcard', acceptHeader(undefined), '*/*');
    is('a caller that already allows everything is left alone',
       acceptHeader('text/html,*/*'), 'text/html,*/*');
}

{
    /* THE ItemList SHAPE. The walk descended into itemListElement, reached the
       ListItems, and stopped one key short of every product on the page. This is
       the exact markup a category page emits for Google's rich results. */
    const page = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: [
            { '@type': 'ListItem', position: 1,
              item: { '@type': 'Product', name: 'Titanium Frame',
                      offers: { '@type': 'Offer', price: '599', priceCurrency: 'AED' } } },
            { '@type': 'ListItem', position: 2,
              item: { '@type': 'Product', name: 'Polarised Lens',
                      offers: { '@type': 'Offer', price: '499', priceCurrency: 'AED' } } }
        ]
    };
    const found = collectProducts(page, [], 0);
    is('a ListItem is descended into, so a category listing yields its products',
       found.length, 2);

    /* A breadcrumb is the same container shape and must stay silent, which is
       why the descent list names keys rather than walking every object value. */
    const crumbs = {
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://x.example/' },
            { '@type': 'ListItem', position: 2, name: 'Glasses', item: 'https://x.example/g' }
        ]
    };
    is('a breadcrumb of the same shape still contributes nothing',
       collectProducts(crumbs, [], 0).length, 0);
}

{
    /* THE PLACEHOLDER PRICE. This store publishes the same product name twice on
       one page, once at its real price and once at 1, both as valid markup.
       Nothing inside a single product can tell them apart. */
    const catalogueRows = [];
    for (let n = 0; n < 10; n++) {
        catalogueRows.push({ id: 'real-' + n, name: 'Frame ' + n, price: 500 + n });
    }
    const withSentinels = catalogueRows.concat([
        { id: 'sentinel-a', name: 'Frame A', price: 1 },
        { id: 'sentinel-b', name: 'Frame B', price: 0.5 }
    ]);
    const kept = dropSentinelPrices(withSentinels);
    is('a placeholder price two orders of magnitude under the median is dropped',
       kept.length, 10);
    ok('and every real price survives untouched',
       kept.every((row) => row.price >= 500), kept.map((row) => row.price));

    /* A cheap accessory that is merely cheap is not a placeholder. One percent of
       a 500 median is 5, so anything at or above that stays. */
    const cheap = catalogueRows.concat([{ id: 'cloth', name: 'Lens cloth', price: 9 }]);
    is('a genuinely cheap item above the threshold is kept',
       dropSentinelPrices(cheap).length, 11);

    /* The rule needs a distribution behind it. Too few prices and it must do
       nothing at all rather than guess from a handful. */
    const tiny = [{ id: 'a', name: 'A', price: 900 }, { id: 'b', name: 'B', price: 1 }];
    is('a catalogue too small for a median is left exactly as it is',
       dropSentinelPrices(tiny).length, 2);

    /* It must never invent, adjust or borrow a price. */
    const before = JSON.stringify(withSentinels.slice(0, 10));
    dropSentinelPrices(withSentinels);
    is('it changes no price it keeps', JSON.stringify(withSentinels.slice(0, 10)), before);
}

{
    /* THE DISCARDED LIST PRICE. schema.org puts "was" in a priceSpecification
       beside the offer, so reading offer.price alone lost every discount and the
       strikethrough a promotion demo is largely about had nothing to draw. */
    const html = '<script type="application/ld+json">' + JSON.stringify({
        '@type': 'Product', name: 'Artlife POTTER', sku: 'AL30057100',
        offers: { '@type': 'Offer', price: 199, priceCurrency: 'AED',
                  availability: 'https://schema.org/InStock',
                  priceSpecification: { '@type': 'UnitPriceSpecification',
                                        priceType: 'https://schema.org/ListPrice',
                                        price: 399, priceCurrency: 'AED' } }
    }) + '</script>';
    const out = extractProductsFromHtml(html, 'https://x.example/ae-en/artlife-potter.html');
    is('the list price becomes the was price', out.products[0].price, 399);
    is('and what is charged now becomes the discount', out.products[0].discountedPrice, 199);

    /* An instalment amount read as a was price would run the discount backwards,
       so only a ListPrice counts and anything else is ignored. */
    const instalment = '<script type="application/ld+json">' + JSON.stringify({
        '@type': 'Product', name: 'Monthly Frame', sku: 'M1',
        offers: { '@type': 'Offer', price: 1200, priceCurrency: 'AED',
                  priceSpecification: { '@type': 'UnitPriceSpecification',
                                        priceType: 'https://schema.org/Installment',
                                        price: 100 } }
    }) + '</script>';
    const instalmentOut = extractProductsFromHtml(instalment, 'https://x.example/p.html');
    is('an instalment specification is not mistaken for a was price',
       instalmentOut.products[0].price, 1200);
    is('and it produces no discount', instalmentOut.products[0].discountedPrice, null);
}

{
    /* THE MISSING CATEGORY. schema.org's category is optional and this store
       omits it, so every product answered '' and the whole catalogue collapsed
       into one "All Products" entry, losing the prospect's own structure. */
    const bare = { '@type': 'Product', name: 'Spectus DRIFT', sku: 'SD1',
                   offers: { '@type': 'Offer', price: '599', priceCurrency: 'AED' } };
    const block = '<script type="application/ld+json">' + JSON.stringify(bare) + '</script>';

    const inSection = extractProductsFromHtml(
        block, 'https://x.example/ae-en/sunglasses/spectus-flexi.html');
    is('a section with a page beneath it is read as the category',
       inSection.products[0].category, 'sunglasses');

    const leaf = extractProductsFromHtml(block, 'https://x.example/ae-en/25foryou.html');
    is('a first segment that IS the page contributes no category',
       leaf.products[0].category, '');

    const coded = extractProductsFromHtml(
        block, 'https://x.example/ae-en/al30057100/detail.html');
    is('a segment carrying a product code is not a category',
       coded.products[0].category, '');

    /* The markup still outranks the URL wherever the store bothers to say. */
    const declared = '<script type="application/ld+json">' + JSON.stringify(
        { ...bare, category: 'Eyeglasses > Titanium' }) + '</script>';
    const declaredOut = extractProductsFromHtml(
        declared, 'https://x.example/ae-en/sunglasses/x.html');
    is('a declared category still beats the URL',
       declaredOut.products[0].category, 'Eyeglasses');
}

/* -------------------------------------------------------------------------- */
/* 13. A framework's stylesheet is not the store's design language             */

{
    /* Refusing Bootstrap's theme colours by value worked and then the count came
       back with #0a58ca, its own shade of the same blue. Enumerating a framework's
       palette is unwinnable, so the file itself is skipped. */
    const vendor = [
        '/lib/bootstrap/bootstrap.min.css',
        '/lib/bootstrap/bootstrap-icons.css',
        '/lib/bootstrap/custom-build.css',
        'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
        '/assets/tailwind.css',
        '/css/normalize.css',
        '/vendor/foundation.min.css'
    ];
    for (const href of vendor) {
        ok('skipped as vendor CSS: ' + href, isVendorStylesheet(href));
    }

    /* AND THE STORE'S OWN FILES ARE STILL READ, which is the half that would turn
       this from a fix into an outage. A bundle with a project name in it is not a
       distribution, however much of a framework it contains. */
    const own = ['/assets/app.css', '/assets/theme.min.css', '/css/main.css',
                 '/assets/my-bootstrap-theme.css', '/static/site.css'];
    for (const href of own) {
        ok('still read as the store\'s own: ' + href, !isVendorStylesheet(href));
    }

    /* The value table stays as defence in depth for a framework served under a
       name the filename rule does not recognise. */
    ok('an exact Bootstrap default is still refused by value',
       isFrameworkValue('#0d6efd') && isFrameworkValue('#dc3545'));
    ok('and a colour that merely resembles one is not',
       !isFrameworkValue('#0d6efe') && !isFrameworkValue('#003588'));
    ok('a customised token carrying its own colour is kept',
       !isFrameworkDefault('--bs-primary', '#c8102e'));
    ok('an untouched one is not',
       isFrameworkDefault('--bs-primary', '#0d6efd'));
}

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
