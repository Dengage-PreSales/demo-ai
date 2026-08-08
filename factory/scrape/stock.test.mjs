/* ============================================================================
   The stock photograph fallback, proven against a fixture API.

     node factory/scrape/stock.test.mjs

   Nothing here touches the live Unsplash API: the module takes an apiBase for
   exactly this reason, and the download step is injected so no browser and no
   file fetch is involved. What is being proven is the DISCIPLINE, not the
   vendor: no key means no request at all, real photographs are never displaced,
   a rate limit degrades to artwork instead of failing a build, and no two tiles
   share a photograph while the pool has distinct ones to give.

   Ports 9500 to 9549 are this file's range.
   ========================================================================== */

import { createServer } from 'node:http';
import { stockImages } from './stock.mjs';

let pass = 0;
let fail = 0;

function ok(label, condition, detail) {
    if (condition) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('   FAIL  ' + label +
        (detail === undefined ? '' : '  <' + JSON.stringify(detail) + '>')); }
}
function is(label, actual, expected) {
    ok(label, JSON.stringify(actual) === JSON.stringify(expected),
       { actual, expected });
}

let nextPort = 9500;

/* A fixture shaped like the two Unsplash endpoints this module speaks to:
   /search/photos answering a pool per query, and a download counter per photo.
   Every request is logged, because half the assertions below are about which
   requests were NOT made. */
function apiServer(poolsByQuery, options = {}) {
    const port = nextPort++;
    const hits = [];
    const server = createServer((request, response) => {
        const url = new URL(request.url, 'http://127.0.0.1:' + port);
        hits.push(url.pathname + (url.searchParams.get('query')
            ? '?query=' + url.searchParams.get('query') : ''));
        if (options.status) {
            response.writeHead(options.status, { 'content-type': 'application/json' });
            response.end('{}');
            return;
        }
        if (url.pathname === '/search/photos') {
            const pool = poolsByQuery[url.searchParams.get('query')] || [];
            response.writeHead(200, { 'content-type': 'application/json' });
            response.end(JSON.stringify({
                results: pool.map((entry) => ({
                    id: entry.id,
                    urls: { raw: entry.file },
                    links: { download_location:
                        'http://127.0.0.1:' + port + '/count/' + entry.id }
                }))
            }));
            return;
        }
        if (url.pathname.startsWith('/count/')) {
            response.writeHead(200, { 'content-type': 'application/json' });
            response.end('{"url":"counted"}');
            return;
        }
        response.writeHead(404, { 'content-type': 'text/plain' });
        response.end('not here');
    });
    return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({
        base: 'http://127.0.0.1:' + port,
        hits,
        close: () => new Promise((done) => server.close(done))
    })));
}

/* The injected delivery step: marks every product it is handed as committed,
   the way images.mjs does on success, without a browser or a byte of network. */
function deliverAll(products) {
    for (const product of products) {
        product.image = 'images/' + product.id.toLowerCase() + '.jpg';
        delete product.imageUrl;
    }
    return { downloaded: products.length, failed: 0, skipped: 0, bytes: 1000 };
}

function catalogue() {
    return [
        { id: 'P1', name: 'Oud Royale', category: 'Perfumes', image: null },
        { id: 'P2', name: 'Rose Mist', category: 'Perfumes', image: null },
        { id: 'P3', name: 'Amber Oil', category: 'Perfumes', image: null },
        { id: 'G1', name: 'Gift Box', category: 'Gift Sets', image: null },
        { id: 'R1', name: 'Real Photo Product', category: 'Perfumes',
          image: 'images/real.jpg' }
    ];
}

console.log('1. No key means no request, not a quiet degradation');
{
    const api = await apiServer({});
    const products = catalogue();
    const result = await stockImages(products, '/tmp/unused', {
        key: '', apiBase: api.base, download: deliverAll
    });
    await api.close();
    is('everything empty is reported skipped', result.skipped, 4);
    is('and the reason says why', result.reason, 'no-key');
    is('THE API WAS NEVER SPOKEN TO', api.hits.length, 0);
    ok('no tile was touched', products.every((p) => p.id === 'R1'
        ? p.image === 'images/real.jpg' : p.image === null));
}

console.log('\n2. The pool is dealt round the category, one photo each');
{
    const api = await apiServer({
        perfumes: [
            { id: 'ph-a', file: 'https://images.example/a' },
            { id: 'ph-b', file: 'https://images.example/b' },
            { id: 'ph-c', file: 'https://images.example/c' }
        ],
        'gift sets': [{ id: 'ph-g', file: 'https://images.example/g' }]
    });
    const products = catalogue();
    const result = await stockImages(products, '/tmp/unused', {
        key: 'k', apiBase: api.base, download: deliverAll
    });
    await api.close();
    is('four empty tiles filled', result.filled, 4);
    ok('a product with a real photograph was never considered',
       products.find((p) => p.id === 'R1').image === 'images/real.jpg');
    const searches = api.hits.filter((hit) => hit.startsWith('/search'));
    is('one search per category, not per product',
       searches.sort(), ['/search/photos?query=gift sets', '/search/photos?query=perfumes']);
    is('every used photo was counted, and only used ones',
       api.hits.filter((hit) => hit.startsWith('/count/')).length, 4);
    const files = products.filter((p) => p.id !== 'R1').map((p) => p.image);
    is('no two tiles share a photograph', new Set(files).size, files.length);
}

console.log('\n3. A rate limit degrades to artwork, never to a failed build');
{
    const api = await apiServer({}, { status: 403 });
    const products = catalogue();
    const result = await stockImages(products, '/tmp/unused', {
        key: 'k', apiBase: api.base, download: deliverAll
    });
    await api.close();
    is('nothing filled', result.filled, 0);
    is('the reason is the limit', result.reason, 'rate-limited');
    is('one request went out, then the module stopped asking',
       api.hits.filter((hit) => hit.startsWith('/search')).length, 1);
}

console.log('\n4. The pool running dry leaves tiles for the artwork');
{
    const api = await apiServer({
        perfumes: [{ id: 'only', file: 'https://images.example/only' }]
    });
    const products = catalogue().filter((p) => p.category === 'Perfumes');
    const result = await stockImages(products, '/tmp/unused', {
        key: 'k', apiBase: api.base, download: deliverAll
    });
    await api.close();
    is('one filled from a pool of one', result.filled, 1);
    is('the rest stay empty for the artwork', products.filter((p) => !p.image).length, 2);
}

console.log('\n5. The cap bounds what one build may spend');
{
    const api = await apiServer({
        perfumes: [
            { id: 'a', file: 'https://images.example/a' },
            { id: 'b', file: 'https://images.example/b' },
            { id: 'c', file: 'https://images.example/c' }
        ]
    });
    const products = catalogue().filter((p) => p.category === 'Perfumes');
    const result = await stockImages(products, '/tmp/unused', {
        key: 'k', apiBase: api.base, download: deliverAll, cap: 2
    });
    await api.close();
    is('two filled at cap two', result.filled, 2);
}

console.log('\n6. A pool entry that is not https never becomes a tile');
{
    const api = await apiServer({
        perfumes: [{ id: 'plain', file: 'http://images.example/insecure' }]
    });
    const products = catalogue().filter((p) => p.category === 'Perfumes');
    const result = await stockImages(products, '/tmp/unused', {
        key: 'k', apiBase: api.base, download: deliverAll
    });
    await api.close();
    is('nothing filled from an insecure pool', result.filled, 0);
    is('and the reason is honest', result.reason, 'no-results');
}

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
