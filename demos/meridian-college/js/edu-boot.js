/* Dengage eComm Demo. Generated file. Sources and notes live in the factory. */
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
