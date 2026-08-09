/* ============================================================================
   Where a message's button actually goes.

     import { demoLink } from '../demo-links.mjs';
     demoLink(storeUrl, 'cart')   ->  <storeUrl>index.html?open=cart

   WHY THIS EXISTS, AND IT IS A DEFECT THAT SHIPPED IN EVERY CHANNEL AT ONCE. Every
   generator in this repository linked to cart.html, checkout.html, wishlist.html and
   account.html. None of those files has ever existed. A demo is two pages, index.html
   and product.html, and the basket, the checkout, the search and the saved items are
   all overlays on the first one. So the primary button in ten emails, the AMP variant
   and all five short form channels pointed at a GitHub Pages 404.

   Nothing could see it. The links are absolute, they are built from strings, and the
   preview pages render them as anchors nobody clicks while checking a layout. It is
   also the single worst thing a demo can do on a call: the story is that the basket
   survived, and pressing the button proved it had not.

   THE STOREFRONT NOW OPENS AN OVERLAY FROM THE URL, so there is something correct to
   link to. template/js/storefront.js reads ?open= against a named list. This module is
   the other half, and it is one function on purpose: a second place that spells these
   URLs is a second place to get them wrong.
   ========================================================================== */

/* The surfaces a link can ask for, and the overlay each one opens. Keys match the
   allowlist in template/js/storefront.js. Anything not here has no destination, which
   is the point: an unknown surface throws at build time rather than resolving to a
   plausible looking 404. */
const SURFACES = {
    home: null,
    cart: 'cart',
    checkout: 'checkout',
    wishlist: 'wishlist',
    account: 'account',
    search: 'search'
};

export function demoLink(storeUrl, surface) {
    if (!Object.prototype.hasOwnProperty.call(SURFACES, surface)) {
        throw new Error('no such demo surface: "' + surface + '". ' +
            'A demo is index.html and product.html; everything else is an overlay. ' +
            'Available: ' + Object.keys(SURFACES).join(', '));
    }
    const base = String(storeUrl || '');
    const open = SURFACES[surface];
    return open ? base + 'index.html?open=' + open : base;
}

/* A product page, which is one of the two real pages. Here so that nothing else has to
   remember the parameter name or the encoding. */
export function productLink(storeUrl, id) {
    return String(storeUrl || '') + 'product.html?id=' + encodeURIComponent(String(id));
}

/* A category, which is index.html filtered rather than a page of its own. */
export function categoryLink(storeUrl, category) {
    return String(storeUrl || '') + 'index.html?category=' +
        encodeURIComponent(String(category));
}

export { SURFACES };
