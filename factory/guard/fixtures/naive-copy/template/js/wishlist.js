/* Known-bad fixture. The wishlist, copied across without retargeting.

   Writes a standard account table directly by sendDeviceEvent, with no ec:
   call on the write path. Handoff 5.3. */

function addToWishlist(product) {
    window.dengage('ec:addToWishlist', {
        product_id: product.id,
        stock_count: Number(product.stock)
    });

    var TABLE = 'wishlist_events';
    var payload = {
        product_id: product.id,
        product_name: product.name,
        list_name: 'default'
    };
    window.dengage('sendDeviceEvent', TABLE, payload);
}

function removeFromWishlist(product) {
    window.dengage('ec:removeFromWishlist', { product_id: product.id });
}
