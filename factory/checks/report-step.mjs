/* ============================================================================
   Runs the build workflow's reporting step against a real generator report,
   without GitHub.

     node factory/checks/report-step.mjs /tmp/report.json

   WHY THIS EXISTS. "Post the live address and close the issue" is the step that
   tells a colleague their demo is ready, and it rarely runs: it is skipped when
   generation fails, and skipped on workflow_dispatch by its own condition. A step
   that rarely runs is one whose first real execution can be the first time anybody
   learns whether it works.

   Its failure mode is bad enough to be worth a check of its own. By the time it
   runs, the demo is built, verified, committed and published. If the script
   throws, the job goes red AFTER all of that, the issue stays open with no
   address in it, and the documented response to an open issue is to comment
   retry, which builds a SECOND demo. So one undefined property here costs a
   duplicate storefront and an operator left without an address.

   HOW IT TESTS THE REAL THING. The script is not copied into this file. It is
   read out of .github/workflows/build-demo.yml at the moment of the run, so a
   change to the workflow is a change to what this exercises, and a copy cannot
   drift from the original. github, context and core are stubbed, so nothing is
   posted and no issue is closed: the comment body is printed instead, which is
   also the fastest way to read what an operator will actually be sent.
   ========================================================================== */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKFLOW = join(ROOT, '.github', 'workflows', 'build-demo.yml');
const STEP = 'Post the live address and close the issue';

/* The step's script is a YAML block scalar. Rather than depend on a YAML parser
   this repository does not otherwise need, the block is taken by indentation,
   which is what a block scalar is: everything more indented than the key that
   introduced it. */
function scriptFor(name) {
    const lines = readFileSync(WORKFLOW, 'utf8').split('\n');
    const start = lines.findIndex((line) => line.includes('- name: ' + name));
    if (start === -1) throw new Error('step not found in the workflow: ' + name);

    const scriptAt = lines.findIndex((line, index) =>
        index > start && /^\s*script:\s*\|/.test(line));
    if (scriptAt === -1) throw new Error('the step has no script block: ' + name);

    const indent = lines[scriptAt].match(/^\s*/)[0].length;
    const body = [];
    for (let index = scriptAt + 1; index < lines.length; index++) {
        const line = lines[index];
        if (line.trim() === '') { body.push(''); continue; }
        if (line.match(/^\s*/)[0].length <= indent) break;
        body.push(line);
    }
    if (!body.length) throw new Error('the script block is empty: ' + name);
    return body.join('\n');
}

let reportPath = process.argv.slice(2).find((arg) => !arg.startsWith('--'));

/* A CHECK THAT CANNOT FAIL PROVES NOTHING, and this one runs a script through a
   stub, so it is exactly the shape that can quietly pass on anything.

   --selftest hands it a report with productCount and liveUrl removed. Both are
   read without a guard and neither throws when absent: they render the word
   "undefined" straight into the comment an operator receives, which is the
   failure this check is really for. A planted exception would only prove the try
   block works; a planted undefined proves the assertions do.

   Keep the plant on something genuinely unguarded. Once a field is guarded in the
   workflow, removing it stops breaking anything and this check will report,
   correctly, that it can no longer fail. When that happens, move the plant to a
   field that is still unguarded rather than deleting it. */
const SELFTEST = process.argv.includes('--selftest');
if (SELFTEST) {
    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const real = JSON.parse(readFileSync(reportPath, 'utf8'));
    delete real.productCount;
    delete real.liveUrl;
    reportPath = join(mkdtempSync(join(tmpdir(), 'dps-report-')), 'report.json');
    writeFileSync(reportPath, JSON.stringify(real));
}

if (!reportPath) {
    console.error('usage: node factory/checks/report-step.mjs <report.json> [--show] [--selftest]');
    process.exit(2);
}

let comment = null;
let closed = false;
const github = {
    rest: {
        issues: {
            createComment: async (args) => { comment = args.body; },
            update: async (args) => { closed = args.state === 'closed'; }
        }
    }
};
const context = { repo: { owner: 'Dengage-PreSales', repo: 'demo-ai' }, issue: { number: 4 } };
const core = { info: () => {}, warning: () => {}, setOutput: () => {} };

/* The script calls require('/tmp/report.json') by that literal path, so the
   module loader is pointed at the report under test instead. */
const { createRequire } = await import('node:module');
const realRequire = createRequire(import.meta.url);
const require = (id) => (id === '/tmp/report.json'
    ? JSON.parse(readFileSync(reportPath, 'utf8'))
    : realRequire(id));

const published = process.argv.includes('--publishing') ? 'false' : 'true';
process.env.PUBLISHED = published;

const run = new Function('github', 'context', 'core', 'require', 'process',
    '"use strict";return (async () => {' + scriptFor(STEP) + '})()');

let failed = 0;
try {
    await run(github, context, core, require, process);
} catch (error) {
    console.error('   FAIL  the step threw: ' + error.message);
    failed = 1;
}

if (!failed) {
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    const checks = [
        ['a comment was composed', typeof comment === 'string' && comment.length > 80],
        ['the issue was closed', closed === true],
        ['the live address is in it', comment && comment.includes(report.liveUrl)],
        ['the product count is a number, not undefined',
            comment && comment.includes('| Products | ' + report.productCount + ' |')],
        ['every category is named',
            comment && (report.categories || []).every((name) => comment.includes(name))],
        ['the currency is stated', comment && comment.includes(report.currency)],
        ['the expiry is stated', comment && comment.includes(report.expiresAt)],
        ['nothing rendered as undefined', comment && !/undefined/.test(comment)],
        ['nothing rendered as NaN', comment && !/NaN/.test(comment)],
        ['the Dengage logo promise is made', comment && comment.includes('Dengage logo')],
        /* Written as escapes rather than as the characters themselves, because the
           repository guard scans committed text for those two code points and a
           check that hunts for them must not smuggle them in. */
        ['no em or en dash reached the operator', comment && !/[\u2013\u2014]/.test(comment)],
        /* EVERY WARNING THE GENERATOR RAISED REACHES THE OPERATOR. A warning
           computed and then dropped by the comment is the silent thin build all
           over again, one layer up. */
        ['every generator warning is in the comment',
            comment && (report.warnings || []).every((warning) => comment.includes(warning))],
        /* EVERY PATH THE COMMENT NAMES EXISTS. The comment told every operator to
           open emails/index.html for as long as the file did not exist, because the
           sentence was written from memory rather than from disk. Backticked paths
           are resolved from the repository root, and bare ones against the demo's
           own panel folder, which is how the comment spells them. */
        ['every file the comment names exists', comment && (() => {
            const named = [...comment.matchAll(/`([^`\s]+\.(?:html|json|md|csv))`/g)]
                .map((match) => match[1]);
            const roots = ['', 'factory/panel/content/' + report.slug + '/'];
            return named.every((path) =>
                roots.some((root) => existsSync(join(ROOT, root + path))));
        })()]
    ];
    for (const [label, condition] of checks) {
        console.log((condition ? '   ok    ' : '   FAIL  ') + label);
        if (!condition) failed++;
    }
    if (process.argv.includes('--show')) {
        console.log('\n----- what the operator receives -----\n');
        console.log(comment);
    }
}

/* UNDER --selftest THE SENSE IS INVERTED, because there the expected outcome is a
   failure. A selftest that exits non-zero when it correctly catches the planted
   bug would be read as a broken check by whatever runs it. */
if (SELFTEST) {
    console.log('\n   ' + (failed
        ? 'the selftest planted a broken report and this check caught it'
        : 'THE SELFTEST PASSED A BROKEN REPORT. This check cannot fail and proves nothing.'));
    process.exit(failed ? 0 : 1);
}

console.log('\n   ' + (failed ? failed + ' failed' : 'the reporting step is sound'));
process.exit(failed ? 1 : 0);
