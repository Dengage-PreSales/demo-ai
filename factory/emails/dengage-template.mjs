/* ============================================================================
   The Dengage template subset, executed. Enough of it to render one of this
   repository's own emails against real or synthetic data.

     import { render } from './dengage-template.mjs';
     const html = render(source, { $from, $Contact });

   WHY THIS EXISTS AND WHAT IT IS NOT. A Code Editor email carries its own `{% %}`
   block, so unlike a BeeFree template it is a whole program and its output cannot be
   guessed from reading it. Everything this repository has learned the hard way about
   these assets came from executing them: cart.test.mjs lifts the resolution block out
   of a saved asset and runs it against a synthetic event log, and three defects that
   had already shipped were found in an afternoon that way. That technique only reaches
   the block. This reaches the rendering too, which is where the last four defects were.

   IT IS NOT DENGAGE'S ENGINE AND MUST NOT BE MISTAKEN FOR IT. Dengage owns the real
   one, and the only proof an email works is a send. What this covers is exactly the
   syntax this repository emits, which is a deliberately small subset:

     {% ... %}      JavaScript, executed, output nothing
     {%= expr %}    JavaScript, evaluated, appended to the output
     everything else literal

   That is the whole grammar. No filters, no includes, no partials, no loops of its own:
   a `for` in a `{% %}` block is a JavaScript `for`, which is why the assets are written
   with one. So a template this renders correctly can still fail in a send, but a
   template it cannot render is certainly broken, and that is worth catching here rather
   than on a call.

   THE TRANSPILE IS THE OBVIOUS ONE, and its one subtlety is that a code block can open
   a brace and a later block can close it. `{% if (x) { %}` ... `{% } %}` is the
   documented shape and every asset here uses it, so the pieces are concatenated into
   one function body rather than evaluated one at a time. That also means a syntax error
   anywhere fails the whole template, which is what Dengage does too.

   $from IS THE CALLER'S. This module never touches a database and has no opinion about
   one. The test passes a stub with only where, take and get, because that is all the
   real $from has; the preview passes one backed by a demo's committed products.json.
   ========================================================================== */

const OPEN = '{%';
const CLOSE = '%}';

/* A template into a function body. Exported because the tests assert on the
   transpiled source for the two mistakes that are silent at runtime: a literal that
   was not escaped, and an output tag whose expression was swallowed. */
export function transpile(source) {
    const text = String(source == null ? '' : source);
    const parts = [];
    let at = 0;

    const literal = (chunk) => {
        if (chunk === '') return;
        /* JSON.stringify is the escape, rather than a hand written one. A product name
           with a quote, a backslash or a newline in it is ordinary, and a hand written
           escape that misses one produces a syntax error in the generated function
           whose line number means nothing. */
        parts.push('__out.push(' + JSON.stringify(chunk) + ');');
    };

    while (at < text.length) {
        const open = text.indexOf(OPEN, at);
        if (open === -1) { literal(text.slice(at)); break; }
        literal(text.slice(at, open));

        const close = text.indexOf(CLOSE, open + OPEN.length);
        if (close === -1) {
            throw new Error('unclosed ' + OPEN + ' at character ' + open);
        }
        const inner = text.slice(open + OPEN.length, close);
        at = close + CLOSE.length;

        if (inner.startsWith('=')) {
            const expression = inner.slice(1).trim();
            if (expression === '') throw new Error('empty output tag at character ' + open);
            /* NULL AND UNDEFINED RENDER AS NOTHING, not as the words "null" and
               "undefined". Every asset here already guards its own values, so this is a
               floor rather than a licence: an email that prints "undefined" to a
               prospect is worse than one that prints nothing, and both are defects. */
            parts.push('__out.push(__str(' + expression + '));');
        } else {
            parts.push(inner);
        }
    }

    return parts.join('\n');
}

export function render(source, context) {
    const ctx = context || {};
    const body =
        'const __out = [];\n' +
        'const __str = (v) => (v === null || v === undefined) ? "" : String(v);\n' +
        transpile(source) +
        '\nreturn __out.join("");';
    /* eslint-disable-next-line no-new-func */
    const fn = new Function('$from', '$Contact', body);
    return fn(ctx.$from, ctx.$Contact);
}

/* A $from over plain arrays, with the same three methods the real one has and no
   others. Shared by the preview and the tests so neither can rely on a method that
   does not exist: $from offers where, take and get, and an asset that reached for
   orderByDescending failed at send time with a TypeError.

   ROWS COME BACK IN REVERSE INSERTION ORDER, deliberately, and that is not a quirk to
   work around. take(n) without an ordering returns SOME n rows rather than the newest
   n, so any asset that depends on the order it receives rows in is already broken. */
export function arrayFrom(tables, options) {
    const o = options || {};
    const all = Object.assign({}, tables);
    return function (name) {
        const table = String(name).replace('$db.', '');
        if (!Object.prototype.hasOwnProperty.call(all, table)) {
            throw new Error('queried a table that was not provided: ' + table);
        }
        let rows = all[table].slice();
        if (o.reverse !== false) rows.reverse();
        const api = {
            where(column, operator, value) {
                if (operator === '=') {
                    rows = rows.filter((r) => String(r[column]) === String(value));
                } else if (operator === 'in') {
                    const wanted = (value || []).map(String);
                    rows = rows.filter((r) => wanted.indexOf(String(r[column])) !== -1);
                } else {
                    throw new Error('operator not available on $from: ' + operator);
                }
                return api;
            },
            take(n) { rows = rows.slice(0, n); return api; },
            get() { return rows; }
        };
        return api;
    };
}
