/* ============================================================================
   WHICH DEMO A BUILD WRITES OVER, AND WHICH IT MUST NOT.

     node factory/slug.test.mjs

   Two rules pull against each other here, and both are real.

   Handoff 7.1: two demos requested for the same domain must not overwrite each
   other. A colleague requesting a store somebody else already requested must not
   silently replace their demo mid call.

   And a retry is a rebuild. A colleague retries because what they got was not
   usable, so handing them a second address while the unusable one stays live at
   the first is the least useful answer available. Queima Diaria on 23 September
   2026 would have been exactly that: the wrong demo at queimadiaria, the right
   one at queimadiaria-2, and the issue linking to the first.

   The issue number is what separates them, so a demo records the request it
   answers. Everything below is one assertion about that, including the cases
   where the record is missing or unreadable, which must both fall back to the
   older rule rather than to the newer one: overwriting nothing is always safe,
   and overwriting the wrong demo is not.
   ========================================================================== */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { freeSlug } from './generate-demo.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Real folders under demos/, because freeSlug asks the filesystem and a stub
   would be testing the stub. The names carry a prefix nothing else uses and are
   removed again whatever happens. */
const PREFIX = 'zz-slug-test-';
const made = [];

function demo(name, issue) {
    const slug = PREFIX + name;
    const dir = join(ROOT, 'demos', slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'demo.config.json'),
        issue === null ? JSON.stringify({ slug }) : JSON.stringify({ slug, issue }));
    made.push(slug);
    return slug;
}

let pass = 0;
let fail = 0;
function is(label, got, want) {
    if (JSON.stringify(got) === JSON.stringify(want)) {
        pass++; console.log('   ok    ' + label); return;
    }
    fail++;
    console.log('   FAIL  ' + label + '  <' + JSON.stringify(got) + ' wanted ' + JSON.stringify(want) + '>');
}

try {
    console.log('\n1. A slug nobody holds');
    is('is taken as it is', freeSlug(PREFIX + 'free', '21'),
       { slug: PREFIX + 'free', suffixed: false });

    console.log('\n2. A slug this same request holds');
    const mine = demo('mine', '21');
    is('is taken back, and the build replaces it',
       freeSlug(mine, '21'), { slug: mine, suffixed: false, rebuilt: true });
    is('and the issue number is compared as text, so 21 and "21" are one request',
       freeSlug(mine, 21), { slug: mine, suffixed: false, rebuilt: true });

    console.log('\n3. A slug somebody else holds');
    is('is never taken, whoever asks', freeSlug(mine, '99'),
       { slug: mine + '-2', suffixed: true });
    is('and a build with no request behind it never takes one',
       freeSlug(mine, ''), { slug: mine + '-2', suffixed: true });

    console.log('\n4. A demo that cannot say which request it answers');

    /* Both of these fall back to suffixing. A demo published before any of this
       existed carries no issue number, and a config that will not parse tells us
       nothing, so neither may be overwritten: the older rule is the safe one and
       it is what an absence of evidence has to reach. */
    const older = demo('older', null);
    is('a demo built before the record existed is left alone',
       freeSlug(older, '21'), { slug: older + '-2', suffixed: true });

    const broken = demo('broken', '21');
    writeFileSync(join(ROOT, 'demos', broken, 'demo.config.json'), 'not json at all');
    is('and so is one whose config will not parse',
       freeSlug(broken, '21'), { slug: broken + '-2', suffixed: true });

    console.log('\n5. The suffix keeps counting');
    const first = demo('busy', '1');
    demo('busy-2', '2');
    is('past a slug that is already suffixed',
       freeSlug(first, '9'), { slug: first + '-3', suffixed: true });
} finally {
    for (const slug of made) rmSync(join(ROOT, 'demos', slug), { recursive: true, force: true });
}

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
