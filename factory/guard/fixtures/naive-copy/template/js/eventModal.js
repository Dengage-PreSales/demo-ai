/* Known-bad fixture. The event panel, copied across without retargeting.

   This is the module that no static check can make safe. It renders a
   free-text input for the table name and sends to whatever is typed into it,
   so a table name is chosen at demo time, by a pre-sales person, in front of a
   prospect. Handoff 5.3.

   The guard refuses the call below because the target is a variable rather
   than an allowlisted literal, and that is the correct static outcome. It is
   not the fix. The fix is a fixed dropdown offering the two sandbox tables,
   validation at the call site against the same two names, and the smoke test
   assertion that the panel cannot be driven to emit anything else. */

var eventTemplates = [
    { title: 'Page view',   tableName: 'page_view_events' },
    { title: 'Add to cart', tableName: 'shopping_cart_events', action: 'ec:addToCart' },
    { title: 'Wishlist',    tableName: 'wishlist_events' },
    { title: 'Order',       tableName: 'order_events', action: 'ec:order' },
    { title: 'Advisor contact', tableName: 'events' }
];

function renderTableField(eventTemplate) {
    var tableInput = document.createElement('input');
    tableInput.type = 'text';
    tableInput.value = eventTemplate.tableName;
    return tableInput;
}

function sendEvent(tableInput, payload) {
    var tableName = tableInput.value.trim();
    window.dengage('sendDeviceEvent', tableName, payload);
}
