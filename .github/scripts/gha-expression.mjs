/* ============================================================================
   A GITHUB ACTIONS EXPRESSION, EVALUATED HERE.

     import { evaluate, substitute } from './gha-expression.mjs'

   The lines that decide who may start a build and what arguments the build
   passes are GitHub Actions expressions, and an expression only runs inside
   GitHub Actions. That is why they were the only part of the factory nothing
   could test, and why both times they were wrong the symptom reached a
   colleague rather than a check.

   It covers exactly what those files use and nothing else. An unknown name or
   call THROWS rather than guessing, so a suite built on this fails loudly the
   day a workflow starts using something it cannot evaluate, instead of quietly
   reporting on an expression it only half understood.
   ========================================================================== */

function tokenize(source) {
    const tokens = [];
    let i = 0;
    while (i < source.length) {
        const ch = source[i];
        if (/\s/.test(ch)) { i++; continue; }
        if (ch === "'") {
            let value = '';
            i++;
            while (i < source.length) {
                if (source[i] === "'" && source[i + 1] === "'") { value += "'"; i += 2; continue; }
                if (source[i] === "'") { i++; break; }
                value += source[i++];
            }
            tokens.push({ type: 'string', value });
            continue;
        }
        const two = source.slice(i, i + 2);
        if (two === '&&' || two === '||' || two === '==' || two === '!=') {
            tokens.push({ type: 'op', value: two }); i += 2; continue;
        }
        if ('(),!'.includes(ch)) { tokens.push({ type: 'op', value: ch }); i++; continue; }
        const path = /^[A-Za-z_][A-Za-z0-9_.*-]*/.exec(source.slice(i));
        if (path) { tokens.push({ type: 'name', value: path[0] }); i += path[0].length; continue; }
        throw new Error('cannot tokenize at: ' + source.slice(i, i + 24));
    }
    return tokens;
}

function parse(tokens) {
    let at = 0;
    const peek = () => tokens[at];
    const eat = (value) => {
        const token = tokens[at];
        if (!token || token.value !== value) {
            throw new Error('expected ' + value + ', found ' + (token ? token.value : 'end'));
        }
        at++;
        return token;
    };

    function primary() {
        const token = peek();
        if (!token) throw new Error('unexpected end of expression');
        if (token.value === '!') { at++; return { kind: 'not', of: primary() }; }
        if (token.value === '(') { at++; const inner = or(); eat(')'); return inner; }
        if (token.type === 'string') { at++; return { kind: 'literal', value: token.value }; }
        if (token.type === 'name') {
            at++;
            if (peek() && peek().value === '(') {
                at++;
                const args = [];
                if (peek() && peek().value !== ')') {
                    args.push(or());
                    while (peek() && peek().value === ',') { at++; args.push(or()); }
                }
                eat(')');
                return { kind: 'call', name: token.value, args };
            }
            if (token.value === 'true')  return { kind: 'literal', value: true };
            if (token.value === 'false') return { kind: 'literal', value: false };
            return { kind: 'path', path: token.value };
        }
        throw new Error('unexpected token ' + token.value);
    }

    function equality() {
        let left = primary();
        while (peek() && (peek().value === '==' || peek().value === '!=')) {
            const op = tokens[at++].value;
            left = { kind: 'compare', op, left, right: primary() };
        }
        return left;
    }
    function and() {
        let left = equality();
        while (peek() && peek().value === '&&') { at++; left = { kind: 'and', left, right: equality() }; }
        return left;
    }
    function or() {
        let left = and();
        while (peek() && peek().value === '||') { at++; left = { kind: 'or', left, right: and() }; }
        return left;
    }

    const tree = or();
    if (at !== tokens.length) throw new Error('trailing tokens from ' + tokens[at].value);
    return tree;
}

/* GitHub's own comparison rules, which are the reason this cannot be eyeballed:
   contains and startsWith are BOTH case insensitive on strings, and contains on
   an array tests membership. Getting either backwards here would make the suite
   agree with a gate that behaves differently. */
const lower = (value) => String(value === null || value === undefined ? '' : value).toLowerCase();

function resolve(path, context) {
    let value = context;
    for (const part of path.split('.')) {
        if (part === '*') {
            if (!Array.isArray(value)) return [];
            value = { __spread: value };
            continue;
        }
        if (value && value.__spread) {
            value = value.__spread.map((item) => (item === null || item === undefined ? undefined : item[part]));
            continue;
        }
        if (value === null || value === undefined) return undefined;
        value = value[part];
    }
    return value && value.__spread ? value.__spread : value;
}

function run(node, context) {
    switch (node.kind) {
        case 'literal': return node.value;
        case 'path': return resolve(node.path, context);
        case 'not': return !truthy(run(node.of, context));
        case 'and': {
            const left = run(node.left, context);
            return truthy(left) ? run(node.right, context) : left;
        }
        case 'or': {
            const left = run(node.left, context);
            return truthy(left) ? left : run(node.right, context);
        }
        case 'compare': {
            const a = run(node.left, context);
            const b = run(node.right, context);
            const same = typeof a === 'string' || typeof b === 'string' ? lower(a) === lower(b) : a === b;
            return node.op === '==' ? same : !same;
        }
        case 'call': {
            const args = node.args.map((arg) => run(arg, context));
            if (node.name === 'contains') {
                const [hay, needle] = args;
                if (Array.isArray(hay)) return hay.some((item) => lower(item) === lower(needle));
                return lower(hay).includes(lower(needle));
            }
            if (node.name === 'startsWith') return lower(args[0]).startsWith(lower(args[1]));
            if (node.name === 'format') {
                const [template, ...rest] = args;
                return String(template).replace(/\{(\d+)\}/g, (whole, index) => {
                    const value = rest[Number(index)];
                    return value === null || value === undefined ? '' : String(value);
                });
            }
            if (node.name === 'fromJSON') return JSON.parse(String(args[0]));
            if (node.name === 'toJSON') return JSON.stringify(args[0]);
            throw new Error('this evaluator does not implement ' + node.name + '()');
        }
        default: throw new Error('unknown node ' + node.kind);
    }
}

function truthy(value) {
    if (Array.isArray(value)) return true;
    return Boolean(value) && value !== '';
}

/* ---------------------------------------------------------------- public API */

/* Evaluate one expression, without the ${{ }} wrapper. */
export function evaluate(source, context) {
    return run(parse(tokenize(source)), context);
}

/* Replace every ${{ ... }} in a block of text with what it evaluates to, which
   is what GitHub does to a run: block before the shell ever sees it. */
export function substitute(text, context) {
    return String(text).replace(/\$\{\{([\s\S]*?)\}\}/g, (whole, inner) => {
        const value = evaluate(inner.trim(), context);
        if (value === null || value === undefined || value === false) return '';
        return String(value);
    });
}

export { truthy };
