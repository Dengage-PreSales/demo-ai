/* Start the site, in the one order that works.

   js/edu-site.js fires the page view immediately and then fetches the config and
   the content. Everything below waits for that, because the launcher's event
   names come from the scenario prefix in the config and the pages are drawn from
   the content.

   The page view is deliberately NOT in this file. It has to happen whether or not
   the fetch succeeds, and putting it behind a promise is how a page ends up
   writing application rows that no page view can be joined to. */
(function (window) {
    'use strict';

    function start() {
        window.EduSite.init();
        window.EduSite.ready(function (state) {
            window.EduPages.render(state.content);
            window.EduJourney.init(state.content);
            window.EduUseCases.init(state.content);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})(window);
