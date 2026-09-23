/* ============================================================================
   THE FRONT DOOR, EVALUATED RATHER THAN READ.

     node .github/scripts/gate.test.mjs

   Who may start a build, and who is told why they may not, is decided by two
   `if:` expressions in .github/workflows/build-demo.yml. They are the most
   consequential lines in this repository: this workflow reads a website, commits
   to main and starts a deployment, and the repository is public. They were also
   the only lines nothing could test, because a GitHub Actions expression only
   runs inside GitHub Actions.

   So it has failed twice, both times the same way: a request correctly declined
   and nothing said about it.

     16 September 2026. A colleague the repository did not know opened a request.
     Both runs skipped in a second, the issue sat without a word on it, and the
     factory was reported broken. The refuse job was written for that.

     23 September 2026. The refuse job's own message ends "comment retry here".
     A colleague did, sixty six seconds later, before anybody could have added
     them. That is an issue_comment, the refuse job only looked at issues, and
     the retry was declined in silence under a comment promising it would work.

   Neither was a wrong decision. Both were right decisions delivered as silence,
   which a person reads as a broken factory, and no amount of care reading YAML
   catches the third one.

   This reads the two expressions out of the workflow itself and evaluates them
   against a table of situations, including both of the above exactly as they
   happened. It evaluates the real strings: an expression edited in the workflow
   is the expression tested here, and there is no second copy to drift.
   ========================================================================== */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKFLOW = join(HERE, '..', 'workflows', 'build-demo.yml');

/* ---------------------------------------------------------------- the subset

   A GitHub Actions expression evaluator covering exactly what these two
   conditions use and nothing else. An unknown name or call throws rather than
   guessing, so this suite fails loudly the day the gate starts using something
   it cannot evaluate, instead of quietly reporting on an expression it only
   half understood.                                                            */

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

function evaluate(node, context) {
    switch (node.kind) {
        case 'literal': return node.value;
        case 'path': return resolve(node.path, context);
        case 'not': return !truthy(evaluate(node.of, context));
        case 'and': {
            const left = evaluate(node.left, context);
            return truthy(left) ? evaluate(node.right, context) : left;
        }
        case 'or': {
            const left = evaluate(node.left, context);
            return truthy(left) ? left : evaluate(node.right, context);
        }
        case 'compare': {
            const a = evaluate(node.left, context);
            const b = evaluate(node.right, context);
            const same = typeof a === 'string' || typeof b === 'string' ? lower(a) === lower(b) : a === b;
            return node.op === '==' ? same : !same;
        }
        case 'call': {
            const args = node.args.map((arg) => evaluate(arg, context));
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

/* ------------------------------------------------------- the two expressions

   Pulled straight out of the workflow. A hand written copy here would be a
   second list of exactly the kind this repository keeps paying for. */
function conditionOf(job) {
    const text = readFileSync(WORKFLOW, 'utf8');
    const start = text.indexOf('\n  ' + job + ':\n');
    if (start === -1) throw new Error('no job called ' + job + ' in the workflow');
    const marker = text.indexOf('\n    if: >-\n', start);
    if (marker === -1) throw new Error('job ' + job + ' has no if: >- block');
    const lines = text.slice(marker + '\n    if: >-\n'.length).split('\n');
    const kept = [];
    for (const line of lines) {
        if (line.trim() === '') break;
        if (!line.startsWith('      ')) break;
        kept.push(line.trim());
    }
    if (!kept.length) throw new Error('job ' + job + ' has an empty if: block');
    return kept.join(' ');
}

const REFUSE = parse(tokenize(conditionOf('refuse')));
const BUILD = parse(tokenize(conditionOf('build')));

/* ------------------------------------------------------------- the situations */

function situation(over) {
    const base = {
        github: {
            event_name: 'issues',
            event: {
                action: 'opened',
                issue: {
                    number: 21,
                    title: 'Demo: Queima Diaria',
                    labels: [{ name: 'new-demo' }],
                    user: { login: 'jpacanaro' },
                    author_association: 'NONE'
                },
                comment: undefined,
                inputs: {}
            }
        },
        vars: { DEMO_REQUESTERS: '' }
    };
    const merged = JSON.parse(JSON.stringify(base));
    if (over.event_name) merged.github.event_name = over.event_name;
    if (over.action !== undefined) merged.github.event.action = over.action;
    if (over.title !== undefined) merged.github.event.issue.title = over.title;
    if (over.labels !== undefined) merged.github.event.issue.labels = over.labels.map((name) => ({ name }));
    if (over.issueLogin) merged.github.event.issue.user.login = over.issueLogin;
    if (over.issueAssociation) merged.github.event.issue.author_association = over.issueAssociation;
    if (over.comment) {
        merged.github.event.comment = {
            body: over.comment.body,
            user: { login: over.comment.login },
            author_association: over.comment.association || 'NONE'
        };
    }
    if (over.requesters !== undefined) merged.vars.DEMO_REQUESTERS = over.requesters;
    return merged;
}

let pass = 0;
let fail = 0;
function check(label, context, wantRefuse, wantBuild) {
    const gotRefuse = truthy(evaluate(REFUSE, context));
    const gotBuild = truthy(evaluate(BUILD, context));
    if (gotRefuse === wantRefuse && gotBuild === wantBuild) {
        pass++; console.log('   ok    ' + label);
        return;
    }
    fail++;
    console.log('   FAIL  ' + label +
        '  <refuse ' + gotRefuse + ' wanted ' + wantRefuse +
        ', build ' + gotBuild + ' wanted ' + wantBuild + '>');
}

console.log('\n1. Nobody is ever met with silence');

/* THE RULE THE WHOLE FILE IS FOR. Every request shaped event either starts a
   build or gets an answer. Exactly one of the two, never neither. */

console.log('\n   16 September: an unknown account opens a request');
check('the build does not run, and the refusal does',
      situation({ issueLogin: 'jpacanaro', requesters: '' }), true, false);

console.log('\n   23 September: that account comments retry before being added');
check('the retry is declined, and it is answered',
      situation({ event_name: 'issue_comment', action: 'created',
                  comment: { body: 'Retry', login: 'jpacanaro' },
                  requesters: '' }), true, false);

console.log('\n2. A listed requester builds, and is not also refused');
check('an account on the list may open a request',
      situation({ issueLogin: 'jpacanaro', requesters: 'alice jpacanaro carol' }), false, true);
check('and may ask for a retry',
      situation({ event_name: 'issue_comment', action: 'created',
                  comment: { body: 'retry please', login: 'jpacanaro' },
                  requesters: 'alice jpacanaro carol' }), false, true);
check('a capitalised Retry is the same word',
      situation({ event_name: 'issue_comment', action: 'created',
                  comment: { body: 'Retry', login: 'jpacanaro' },
                  requesters: 'jpacanaro' }), false, true);
check('the owner never needs the list',
      situation({ issueAssociation: 'OWNER', requesters: '' }), false, true);
check('nor does a collaborator asking for a retry',
      situation({ event_name: 'issue_comment', action: 'created',
                  comment: { body: 'retry', login: 'someone', association: 'COLLABORATOR' },
                  requesters: '' }), false, true);

console.log('\n3. One login can never match inside another');
check('bob is not admitted by bobby being listed',
      situation({ issueLogin: 'bob', requesters: 'alice bobby carol' }), true, false);
check('and bobby still is',
      situation({ issueLogin: 'bobby', requesters: 'alice bobby carol' }), false, true);
check('a name at the start of the list is found',
      situation({ issueLogin: 'alice', requesters: 'alice bobby carol' }), false, true);
check('and a name at the end of it',
      situation({ issueLogin: 'carol', requesters: 'alice bobby carol' }), false, true);

console.log('\n4. The separator the message now names, and the ones that fail');

/* THIS IS THE TRAP THE REFUSAL MESSAGE EXISTS TO PREVENT rather than a rule
   worth having. A list written with commas matches nothing, and from outside it
   looks exactly like not having been added, so the owner adds the name again and
   again and the factory looks broken. The gate cannot repair the text: a GitHub
   Actions expression has no way to replace one character with another. So the
   message says the format, and these two assertions are here to keep the
   message honest about what really happens. */
check('spaces work, which is what the refusal tells the owner to use',
      situation({ issueLogin: 'jpacanaro', requesters: 'alice jpacanaro' }), false, true);
check('commas do not, and the refusal says so in as many words',
      situation({ issueLogin: 'jpacanaro', requesters: 'alice,jpacanaro' }), true, false);

console.log('\n5. A stranger cannot start a build by wearing somebody else\'s issue');
check('a retry from an unlisted account on a listed account\'s request is declined',
      situation({ event_name: 'issue_comment', action: 'created',
                  issueLogin: 'jpacanaro',
                  comment: { body: 'retry', login: 'passer-by' },
                  requesters: 'jpacanaro' }), true, false);

console.log('\n6. Ordinary traffic is left alone');
check('a comment that does not ask for a retry starts nothing and says nothing',
      situation({ event_name: 'issue_comment', action: 'created',
                  comment: { body: 'Looks great, thanks', login: 'jpacanaro' },
                  requesters: 'jpacanaro' }), false, false);
check('an issue that is not a request is not a request',
      situation({ title: 'The wishlist button is the wrong colour', labels: [],
                  issueLogin: 'jpacanaro', requesters: 'jpacanaro' }), false, false);
check('and an unknown account opening an ordinary issue is not refused at it',
      situation({ title: 'A question about the demos', labels: [],
                  issueLogin: 'stranger', requesters: '' }), false, false);

console.log('\n7. One request is one build');

/* The issue form creates the issue and applies the label in one action, so
   GitHub delivers opened and labeled a second apart. Both matching means one
   request builds twice, takes a numbered slug the second time, and publishes a
   duplicate. */
check('opened builds it',
      situation({ action: 'opened', requesters: 'jpacanaro' }), false, true);
check('and the labeled event that follows it does not build it again',
      situation({ action: 'labeled', requesters: 'jpacanaro' }), false, false);
check('while a hand made issue labelled afterwards still builds',
      situation({ action: 'labeled', title: 'Please build acme-tools',
                  requesters: 'jpacanaro' }), false, true);

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
