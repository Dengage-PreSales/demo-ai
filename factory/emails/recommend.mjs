/* ============================================================================
   The storefront's recommendation strategy, run at build time for the emails.

   Salil's instruction, 9 August 2026: the recommendation strips in the emails work
   the same way the storefront's rails work, not through the Dengage engine.

   WHY THE STOREFRONT IS LOCAL IS ALREADY WRITTEN UP in template/js/recommend.js and
   is worth reading before changing anything here: the engine is fed per application,
   every demo shares one application, so an engine backed rail would show a fashion
   prospect somebody else's phones. Computing from the demo's own catalogue cannot
   return the wrong vertical, because the catalogue has nothing else in it.

   WHICH OF THE FIVE STRATEGIES AN EMAIL CAN RUN, and why it is only one of them.
   The storefront has five. Four need something an email does not have at the moment
   it is generated:

     More like this          needs the product being viewed
     Others also viewed      needs the product being viewed
     Completes your basket   needs the live basket
     Recently viewed         needs this visit's sessionStorage

   Trending now needs nothing. It is a deterministic ordering of the whole catalogue
   seeded on the slug, so running it here produces the SAME products in the SAME
   order as the rail on the demo's own pages. An email and the storefront it links to
   never disagree, which is the point: a prospect who clicks through sees the rail
   they were just shown.

   THE ALGORITHM IS DUPLICATED, DELIBERATELY, AND PINNED BY A TEST. template/js/
   recommend.js is browser JavaScript in an IIFE, loaded by a page rather than
   imported, and the guard's demo-js-current check compares every demo's copy of it
   against the template byte for byte. Restructuring it into a shared module to save
   these fifteen lines would touch all of that. So the ordering is reimplemented here
   and emails.test.mjs extracts seeded() out of the storefront file and asserts both
   produce the same order for the same catalogue. Change one and the test fails,
   which is the only property that actually matters.
   ========================================================================== */

/* Byte for byte the storefront's seeded(), in module syntax. A deterministic
   pseudo-shuffle rather than a random one, for the reason given there: a rail that
   reorders while a prospect is looking at it reads as broken rather than as fresh. */
export function seeded(list, seed) {
    const out = list.slice();
    let s = 0;
    for (let i = 0; i < String(seed).length; i++) {
        s = (s * 31 + String(seed).charCodeAt(i)) % 100003;
    }
    out.sort((a, b) => {
        const ha = (s + a.id.length * 7 + a.id.charCodeAt(0)) % 1000;
        const hb = (s + b.id.length * 7 + b.id.charCodeAt(0)) % 1000;
        return ha - hb;
    });
    return out;
}

/* THE POOL HAS TO MATCH Catalog.all(), or the ordering diverges even though the
   comparator is identical. catalog.js drops any product with no id in normalise()
   and keeps products.json's order otherwise, so that is the whole rule. */
export function pool(products) {
    return (products || []).filter((product) => product && product.id)
        .map((product) => ({ ...product, id: String(product.id) }));
}

/* The label the storefront prints above this rail. Same words in the email, because
   they describe the same computation over the same catalogue. */
export const TRENDING_LABEL = 'Trending now';

export function trending(products, slug, limit) {
    return seeded(pool(products), slug).slice(0, limit);
}
