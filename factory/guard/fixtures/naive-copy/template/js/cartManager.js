/* Known-bad fixture. The cart, copied across without retargeting.

   Every write here lands in shopping_cart_events, order_events and
   order_events_detail, which are shared with the core demo sites.
   Handoff 5.3. */

function addToCart(product, quantity) {
    window.dengage('ec:addToCart', {
        product_id: product.id,
        quantity: quantity,
        unit_price: Number(product.price)
    });
}

function removeFromCart(product) {
    window.dengage('ec:removeFromCart', { product_id: product.id });
}

function beginCheckout(cart) {
    window.dengage('ec:beginCheckout', { total_value: cart.total });
}

function completeOrder(cart) {
    window.dengage('ec:order', { order_id: cart.orderId, total_value: cart.total });
    window.dengage('ec:deleteCart', {});
}
