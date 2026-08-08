/* Known-bad fixture. The search panel, copied across without retargeting.

   Writes search_events. Handoff 5.3.

   It also fires on every keystroke, which is the second thing this fixture exists
   to be caught doing: the table ends up describing typing rather than intent. The
   rewrite fires once per settled query, meaning a 700ms pause, Enter, or a filter
   change. */

function onSearchInput(term, results) {
    window.dengage('ec:search', {
        search_term: term,
        result_count: results.length
    });
}
