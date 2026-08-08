/* Known-bad fixture. The scenario launcher, copied across without retargeting.

   No ec: call and no standard ecommerce table name appears in this file, so a
   denylist of the five standard tables passes it. It writes to a core account
   table on every launcher click regardless. Handoff 5.3. */

var DENGAGE_EVENT_TABLE = 'onsite_events';

function sendScenarioEvent(item, menu) {
  var payload = {
    event_name: item.slug,
    scenario_group: menu.category,
    widget_name: item.widgetName,
    page_type: 'home',
    page_url: window.location.href
  };
  window.dengage('sendDeviceEvent', DENGAGE_EVENT_TABLE, payload);
}
