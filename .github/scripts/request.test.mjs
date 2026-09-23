/* ============================================================================
   A REQUEST REACHES THE BUILD, WHICH IS THE HALF NOTHING TESTED.

     node .github/scripts/request.test.mjs

   The build workflow has two halves. The second one, turning a web address into
   a demo, is exercised constantly: by every real request, by the nightly drill,
   and by a person running the generator. The first one, turning what a colleague
   typed into the arguments that build runs with, was exercised only by real
   requests, which means a colleague was always the first to find a fault in it.

   Three of them found one this week, and all three were the same shape: a piece
   that worked perfectly, wired to nothing.

     The form labels a field "Product listing screenshot (optional)" and the
     parser looked it up without the suffix. readImageUrl was correct, the
     regular expression was correct, and the field read empty on every request
     ever filed.

     The form asks what the store sells and nothing read the answer, so the
     catalogue invented for a store nobody can read was chosen from a hint that
     did not include the one sentence a person had actually written.

     The generator learned to rebuild a demo for the same issue rather than
     publish a second one, and the call site was never updated to pass the issue
     number. Its own test passed, because that test drives the function directly.

   None of those is visible from either end. The parser is right, the generator
   is right, and the seam between them is a string in a YAML file that nothing
   reads. So this reads it.

   IT RUNS THE REAL STEP. The workflow's own run block is pulled out of
   build-demo.yml, its ${{ }} expressions are evaluated the way GitHub evaluates
   them, and the result is executed by bash with node replaced by a stub that
   prints its arguments. What is asserted is the actual argument list the actual
   step would produce, including the quoting, the empty-field handling and the
   array that carries values with spaces in them.
   ========================================================================== */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { substitute } from './gha-expression.mjs';
import { parse } from './parse-request.mjs';
import { args as readArgs } from '../../factory/generate-demo.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const WORKFLOW = join(ROOT, '.github', 'workflows', 'build-demo.yml');

let pass = 0;
let fail = 0;
function ok(label, condition, detail) {
    if (condition) { pass++; console.log('   ok    ' + label); return; }
    fail++;
    console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : ''));
}
const is = (label, actual, expected) => ok(label, actual === expected, { actual, expected });

/* ------------------------------------------------------------- the real step */

/* The run: of one named step, with its indentation removed.

   IT NEVER READS PAST THE STEP, and the first version did. It searched forward
   for the next "run: |" from the step's name, and a step whose run is a single
   line rather than a block has none, so it silently returned the NEXT step's
   script and ran it under the wrong name. Reading a neighbour's work and
   reporting it as this one's is the failure this whole file exists to catch, so
   the helper is bounded to the step and refuses rather than reaching. */
function stepRun(name) {
    const text = readFileSync(WORKFLOW, 'utf8');
    const at = text.indexOf('      - name: ' + name + '\n');
    if (at === -1) throw new Error('no step called ' + name);

    /* Everything up to the next step at the same indentation. */
    const rest = text.slice(at + ('      - name: ' + name + '\n').length);
    const nextStep = rest.search(/\n {6}- (name|uses):/);
    const step = nextStep === -1 ? rest : rest.slice(0, nextStep);

    const block = step.match(/^ {8}run: \|\s*\n([\s\S]*)$/m);
    if (block) {
        const kept = [];
        for (const line of block[1].split('\n')) {
            if (line.trim() === '') { kept.push(''); continue; }
            if (!line.startsWith('          ')) break;
            kept.push(line.slice(10));
        }
        return kept.join('\n');
    }

    const single = step.match(/^ {8}run: (.+)$/m);
    if (single) return single[1];

    throw new Error('step ' + name + ' has no run:');
}

/* THE FORM AS A COLLEAGUE LEAVES IT, every field answered, written the way
   GitHub writes it: an h3 per label, the suffixes the labels really carry, and a
   pasted image as an img tag rather than markdown. */
const REQUEST = [
    '### Prospect website address',
    '',
    'https://www.queimadiaria.com',
    '',
    '### Product listing screenshot (optional)',
    '',
    '<img width="1613" height="708" alt="Image" ' +
    'src="https://github.com/user-attachments/assets/a-pasted-screenshot" />',
    '',
    '### Language',
    '',
    'Portuguese',
    '',
    '### Short name for the address',
    '',
    'queimadiaria',
    '',
    '### Currency',
    '',
    'BRL',
    '',
    '### What the store sells',
    '',
    'Gym classes',
    '',
    '### Notes for the build',
    '',
    '_No response_'
].join('\n');

/* THE STEP THAT READS IT, run for real rather than called around. parse() being
   correct is not the same as the workflow invoking it correctly: the step passes
   the issue body, the comment and the title through named environment variables
   and appends what it gets to GITHUB_OUTPUT, and a wrong name there produces an
   empty field with nothing to show for it. That is the same shape as everything
   else this file exists for, one step earlier. */
function readTheRequest(body, title, comment) {
    const out = join(tmpdir(), 'request-test-read-' + process.pid);
    writeFileSync(out, '');
    execFileSync('bash', ['-c', stepRun('Read the request')], {
        cwd: ROOT,
        env: Object.assign({}, process.env, {
            BODY: body, TITLE: title || '', COMMENT: comment || '',
            IN_URL: '', IN_SLUG: '', IN_CURRENCY: '', IN_LANGUAGE: '', IN_NAME: '',
            GITHUB_OUTPUT: out
        }),
        encoding: 'utf8'
    });
    const fields = {};
    for (const line of readFileSync(out, 'utf8').split('\n')) {
        const at = line.indexOf('=');
        if (at > 0) fields[line.slice(0, at)] = line.slice(at + 1);
    }
    rmSync(out, { force: true });
    return fields;
}

const outputs = readTheRequest(REQUEST, 'Demo: Queima Diaria');

/* Run the step for real: GitHub's substitution, then bash, with node replaced by
   something that prints the argument list. */
function argvFor(request, issueNumber, csvPath) {
    const context = {
        steps: {
            request: { outputs: request },
            csv: { outputs: { path: csvPath || '' } }
        },
        github: { event: { issue: { number: issueNumber === undefined ? 21 : issueNumber } } },
        secrets: {}
    };
    const script = 'node() { printf "%s\\n" "$@"; }\n' + substitute(stepRun('Generate the demo'), context);
    const printed = execFileSync('bash', ['-c', script], {
        cwd: ROOT,
        env: Object.assign({}, process.env, {
            STORE_NAME: request.name || '',
            SELLS: request.sells || '',
            /* The step writes its outcome here, so it needs somewhere real to
               write to. Without it the redirect targets an empty path and bash
               complains, which is noise in a suite that has to be read. */
            GITHUB_OUTPUT: join(tmpdir(), 'request-test-output')
        }),
        encoding: 'utf8'
    });
    /* The first argument is the script path the stub was handed. */
    return printed.trim().split('\n').filter(Boolean);
}

console.log('\n1. Everything a colleague filled in arrives at the generator');

const argv = argvFor(outputs);
const options = readArgs(argv);

is('the web address',      options.url, 'https://www.queimadiaria.com');
is('the short name',       options.slug, 'queimadiaria');
is('the currency',         options.currency, 'BRL');
is('the language',         options.language, 'pt');
is('the store name',       options.name, 'Queima Diaria');
is('what the store sells', options.sells, 'Gym classes');
is('the screenshot',       options.screenshot,
   'https://github.com/user-attachments/assets/a-pasted-screenshot');
is('and the request it answers', options.issue, '21');

console.log('\n1a. And the step that reads the form is the one that produced them');

/* Asserted separately so a failure here is unmistakable: if this section fails
   and the one above passes, the parser is fine and the STEP is not. */
ok('the read step produced a url', Boolean(outputs.url), outputs);
ok('and every other field the parser returns',
   ['slug', 'currency', 'name', 'language', 'sells', 'csv_url', 'screenshot_url']
       .every((key) => key in outputs), Object.keys(outputs));

console.log('\n2. A value with a space in it survives the shell');

/* This is why the store name and what the store sells travel through the
   environment rather than the command line. A name legitimately contains spaces,
   an ampersand and an apostrophe, and interpolating it into the command would
   let an issue title decide where the command ends. */
const spaced = parse({
    BODY: ['### Prospect website address', '', 'https://example.com', '',
           '### What the store sells', '', "Women's shoes & bags"].join('\n'),
    TITLE: "Demo: A & B Shoes"
});
const spacedOptions = readArgs(argvFor(spaced));
is('a store name with spaces arrives whole', spacedOptions.name, 'A & B Shoes');
is('and so does an answer with an ampersand and an apostrophe',
   spacedOptions.sells, "Women's shoes & bags");
is('without the rest of it becoming arguments', spacedOptions.url, 'https://example.com');

console.log('\n3. A field left blank passes no flag at all');

/* An empty output must produce nothing, not an empty flag. --currency with no
   value would swallow the next argument. */
const bare = parse({
    BODY: ['### Prospect website address', '', 'https://example.com', '',
           '### Short name for the address', '', '_No response_', '',
           '### Currency', '', '_No response_'].join('\n'),
    TITLE: 'Demo: Example'
});
const bareArgv = argvFor(bare);
ok('no --slug is passed', !bareArgv.includes('--slug'), bareArgv);
ok('no --currency is passed', !bareArgv.includes('--currency'), bareArgv);
ok('no --screenshot is passed', !bareArgv.includes('--screenshot'), bareArgv);
ok('no --csv is passed when nothing was attached', !bareArgv.includes('--csv'), bareArgv);
is('and the address still arrives', readArgs(bareArgv).url, 'https://example.com');

console.log('\n4. Every field the parser produces is used somewhere');

/* A field read out of the form and then used by nothing is the exact shape of
   the screenshot fault and of the one about what the store sells. Both were
   parsed correctly for weeks and reached nothing. */
{
    const workflow = readFileSync(WORKFLOW, 'utf8');
    for (const field of Object.keys(outputs)) {
        ok('"' + field + '" is read by the workflow',
           workflow.includes('steps.request.outputs.' + field), field);
    }
}

console.log('\n5. Every argument the build passes is read by the generator');

/* THE ONE THAT WOULD HAVE CAUGHT THE REBUILD SHIPPING BROKEN. The workflow
   passed --issue 21 and the generator never mentioned options.issue, because the
   edit that would have read it was lost. Nothing failed: an unread option is
   silently ignored, the build succeeded, and it published a second demo beside
   the one it was meant to replace. */
{
    const generator = readFileSync(join(ROOT, 'factory', 'generate-demo.mjs'), 'utf8');
    const flags = [...new Set(argv.filter((token) => token.startsWith('--'))
        .map((token) => token.slice(2)))];

    ok('the step passes at least eight arguments, so this found the real command',
       flags.length >= 8, flags);

    for (const flag of flags) {
        const read = new RegExp('options\\.' + flag + '\\b|options\\[\'' + flag + '\'\\]');
        ok('--' + flag + ' is read by the generator', read.test(generator), flag);
    }
}

console.log('\n6. An attached CSV reaches it too');

/* The CSV comes from its own step rather than from the parser, so it is the one
   argument this seam could lose without any parser output going missing. */
{
    const withCsv = argvFor(outputs, 21, '/tmp/attached.csv');
    is('the csv path arrives', readArgs(withCsv).csv, '/tmp/attached.csv');
}

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
