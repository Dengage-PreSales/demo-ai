/* ============================================================================
   Stock photographs from Unsplash, as the middle fallback and nothing more.

   THE ORDER IS THE CONTRACT, Salil's instruction, 8 August 2026. A product tile
   shows, in this order and never another:

     1. the store's own photograph, downloaded by images.mjs
     2. a stock photograph found by the product's category, from here
     3. the drawn artwork, template/js/artwork.js

   Real photography always wins because a stock photo of A perfume bottle is not
   THE prospect's perfume, and a demo sells them their own store. This module
   only ever fills tiles that step 1 left empty, and only when the build carries
   an UNSPLASH_ACCESS_KEY. Without the key it does nothing, reports that it did
   nothing, and the artwork keeps the floor exactly as before.

   WHAT IS FETCHED AND WHAT IS COMMITTED. The Unsplash photo file is downloaded
   at build time and committed through the SAME pipeline as a real product
   photograph: images.mjs enforces https, content types, size caps, robots and
   the canvas compression, so a stock image cannot take a path a real one could
   not. Nothing in a published demo hotlinks Unsplash, which non-negotiable 4
   forbids anyway; the API's download endpoint is called once per photo used,
   which is how Unsplash asks usage to be counted, and the Unsplash License
   permits commercial use of the photographs without attribution.

   ONE SEARCH PER CATEGORY, NOT PER PRODUCT. Product names make terrible queries
   ("Rose Velvet Eau de Parfum 75ml") and thirty searches would exhaust a demo
   API key's hourly allowance on one build. A category name makes a decent query
   ("Perfumes"), one page of thirty results gives a pool per category, and the
   pool is dealt round the category's products in order so no two tiles share a
   photograph until the pool genuinely runs out. Requests per build stay at
   categories + photos used, inside the 50 per hour of an unapproved key.

   WHY THE PHOTOS ARE STILL HONEST. The tile shows a category-true photograph
   under the product's real scraped name and real scraped price. Nothing about
   the product record is invented here, and a generated fallback catalogue
   (fallback.mjs) already announces itself as invented in three places before
   any photograph is chosen.
   ========================================================================== */

import { downloadImages } from './images.mjs';

const API = 'https://api.unsplash.com';
const PAGE_SIZE = 30;

/* The file URL is requested at a sensible size rather than raw, so the download
   is a few hundred kilobytes instead of a twelve megapixel original that the
   compressor would immediately shrink to 900px anyway. */
const FILE_PARAMS = 'w=1080&q=80&fm=jpg&fit=max';

function query(category) {
    /* "Gift Sets" -> "gift sets". The category came off the prospect's own store
       or feed, so it is already the vocabulary a photo search understands. */
    return String(category || '').trim().toLowerCase() || 'shopping';
}

async function searchOnce(base, key, text, fetcher) {
    const url = base + '/search/photos?query=' + encodeURIComponent(text) +
        '&per_page=' + PAGE_SIZE + '&orientation=squarish&content_filter=high';
    const response = await fetcher(url, {
        headers: { authorization: 'Client-ID ' + key, 'accept-version': 'v1' }
    });
    if (response.status === 403 || response.status === 429) {
        return { ok: false, reason: 'rate-limited' };
    }
    if (!response.ok) return { ok: false, reason: 'http-' + response.status };
    const data = await response.json();
    const photos = (data.results || []).map((photo) => ({
        id: photo.id,
        file: (photo.urls && (photo.urls.raw ? photo.urls.raw + '&' + FILE_PARAMS
                                             : photo.urls.regular)) || null,
        download: photo.links && photo.links.download_location
    })).filter((photo) => photo.file && /^https:\/\//.test(photo.file));
    return { ok: true, photos };
}

/* The download endpoint is how Unsplash counts a use. It is called once per
   photo this build actually commits, never for pool entries that go unused, and
   a failure here does not fail the photo: the count is a courtesy to the
   photographer, not a gate on the build. */
async function countUse(photo, key, fetcher) {
    if (!photo.download) return;
    try {
        await fetcher(photo.download, {
            headers: { authorization: 'Client-ID ' + key, 'accept-version': 'v1' }
        });
    } catch (err) { /* the use still happened; the counter is best effort */ }
}

/* ----------------------------------------------------------------------------
   The one entry point.

     stockImages(products, destDir, options)
       -> { filled, failed, skipped, reason }

   Only products whose image is still null are considered. options.key is the
   access key (absent means skip everything with reason 'no-key'), options.cap
   bounds how many tiles one build will fill (default 24, so a fully blocked
   store cannot spend the whole hourly allowance), options.apiBase and
   options.fetcher and options.download exist for the tests, which must never
   touch the live API. */
export async function stockImages(products, destDir, options = {}) {
    const key = options.key === undefined ? process.env.UNSPLASH_ACCESS_KEY : options.key;
    const fetcher = options.fetcher || fetch;
    const base = options.apiBase || API;
    const cap = options.cap === undefined ? 24 : options.cap;
    const deliver = options.download || downloadImages;

    const empty = products.filter((product) => !product.image);
    if (!empty.length) return { filled: 0, failed: 0, skipped: 0, reason: 'nothing-empty' };
    if (!key) return { filled: 0, failed: 0, skipped: empty.length, reason: 'no-key' };

    /* One pool per category, fetched lazily so a category whose products all
       carry real photographs costs no request at all. */
    const pools = new Map();
    let rateLimited = false;

    const chosen = [];
    for (const product of empty) {
        if (chosen.length >= cap) break;
        const name = query(product.category);
        if (!pools.has(name)) {
            if (rateLimited) continue;
            const result = await searchOnce(base, key, name, fetcher);
            if (!result.ok) {
                if (result.reason === 'rate-limited') rateLimited = true;
                pools.set(name, []);
            } else {
                pools.set(name, result.photos);
            }
        }
        const pool = pools.get(name);
        if (!pool.length) continue;
        const photo = pool.shift();
        /* The photo travels the exact road a real product photograph does:
           images.mjs owns https, content types, caps and compression. */
        product.imageUrl = photo.file;
        chosen.push({ product, photo });
    }

    if (!chosen.length) {
        return { filled: 0, failed: 0, skipped: empty.length,
                 reason: rateLimited ? 'rate-limited' : 'no-results' };
    }

    const delivered = await deliver(chosen.map((entry) => entry.product), destDir, options.downloadOptions);

    let filled = 0;
    for (const entry of chosen) {
        if (entry.product.image) {
            filled++;
            await countUse(entry.photo, key, fetcher);
        }
    }

    return {
        filled,
        failed: chosen.length - filled,
        skipped: empty.length - chosen.length,
        reason: rateLimited ? 'rate-limited' : null,
        bytes: delivered.bytes || 0
    };
}
