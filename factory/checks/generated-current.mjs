/* ============================================================================
   THE SHARED PANEL CONTENT IS WHAT ITS GENERATORS PRODUCE TODAY.

     node factory/checks/generated-current.mjs

   factory/panel/content/_shared/ is written by a generator and committed, and
   for a while nothing compared the two. That gap has now cost two days.

   On 22 September 2026 retiring five demos left the shared BeeFree preview
   pointing at a retired demo's photographs. factory/panel/links.test.mjs
   catches a link to a file that is gone, so CI went red, which was the right
   answer arriving at the wrong moment: after the merge.

   The quieter half was found on the same day. Every scenario preview in the
   repository sampled a product with no photograph, because they had been built
   when the only demo was the reference one and never rebuilt since. Nothing was
   broken, nothing was red, and a colleague opening a preview to show a prospect
   what an email looks like would have seen an empty grey square where the
   product should be.

   A LINK CHECK CANNOT FIND EITHER OF THOSE EARLY. It reads what is committed
   and asks whether it still resolves, so it fires when the damage is already in
   the tree and says nothing at all when the file resolves but is out of date.
   This asks the other question: run the generators and see whether the answer
   has changed.

   It builds into a temporary directory. A check that writes over the tree it is
   judging turns a person's uncommitted work into a diff they did not make, and
   a check nobody dares run is not a check. PANEL_CONTENT_OUT is what both
   generators read to make that possible.
   ========================================================================== */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SHARED as SHARED_GENERATORS } from '../named-generators.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const SHARED = join(ROOT, 'factory', 'panel', 'content', '_shared');

/* Every generator that writes into the shared folder, from the one list in
   factory/named-generators.mjs. It was a copy kept here, which was wrong twice
   over: a generator added there and not here would go unchecked, and this file
   would have kept asserting against a set the rest of the repository had stopped
   using. */
const GENERATORS = SHARED_GENERATORS;

let passed = 0;
let failed = 0;

function ok(label)    { passed++; console.log('  ok    ' + label); }
function notok(label) { failed++; console.log('  NOT OK  ' + label); }

const out = mkdtempSync(join(tmpdir(), 'generated-current-'));

try {
    for (const generator of GENERATORS) {
        try {
            execFileSync('node', [join(ROOT, generator)], {
                cwd: ROOT,
                env: Object.assign({}, process.env, { PANEL_CONTENT_OUT: out }),
                stdio: 'pipe'
            });
            ok(generator + ' runs');
        } catch (err) {
            notok(generator + ' runs (' + String(err.message).split('\n')[0] + ')');
        }
    }

    const built = readdirSync(out).sort();
    if (!built.length) {
        notok('the generators wrote something');
    } else {
        ok('the generators wrote ' + built.length + ' files');
    }

    /* Both directions. A file that changed is stale, and a file the generators
       no longer write is one nobody will ever update again. */
    for (const name of built) {
        const committed = join(SHARED, name);
        if (!existsSync(committed)) {
            notok(name + ' is generated but not committed');
            continue;
        }
        if (readFileSync(committed, 'utf8') === readFileSync(join(out, name), 'utf8')) {
            ok(name + ' is current');
        } else {
            notok(name + ' is out of date. Run: node ' +
                GENERATORS.map((g) => g.split('/').pop()).join(', node '));
        }
    }

    for (const name of readdirSync(SHARED).sort()) {
        if (built.includes(name)) continue;
        notok(name + ' is committed but no generator writes it');
    }
} finally {
    rmSync(out, { recursive: true, force: true });
}

console.log('\n   ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
