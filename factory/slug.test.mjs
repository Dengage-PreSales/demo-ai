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
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { freeSlug, clearForRebuild, committedPalette } from './generate-demo.mjs';

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
    console.log('\n6. And the rebuild actually clears what it reclaims');

    /* THE HALF THAT WAS NOT TESTED, which is why it shipped broken twice in one
       afternoon. freeSlug deciding to reclaim a slug is worth nothing if the
       previous build is still sitting in the folder: build-demo.sh refuses to
       overwrite, so the request stops one step later saying the demo already
       exists.

       The first version joined ROOT onto paths that were already absolute. That
       does not throw, it produces a path that exists nowhere, and rmSync with
       force succeeds against it. It reported success and removed nothing. */
    const full = PREFIX + 'full';
    mkdirSync(join(ROOT, 'demos', full), { recursive: true });
    writeFileSync(join(ROOT, 'demos', full, 'demo.config.json'),
        JSON.stringify({ slug: full, issue: '21' }));
    made.push(full);

    /* The two folders outside demos/ that a demo also owns. A rebuild that clears
       only the storefront leaves the previous build's message pack behind. */
    const panel = join(ROOT, 'factory', 'panel', 'content', full);
    const emails = join(ROOT, 'factory', 'emails', 'content', full);
    mkdirSync(panel, { recursive: true });
    mkdirSync(emails, { recursive: true });
    writeFileSync(join(panel, 'note.txt'), 'from the previous build');
    writeFileSync(join(emails, 'note.txt'), 'from the previous build');

    try {
        const cleared = clearForRebuild(full);
        is('the storefront folder is gone', existsSync(join(ROOT, 'demos', full)), false);
        is('the panel content is gone', existsSync(panel), false);
        is('the email content is gone', existsSync(emails), false);
        is('and all three are reported as cleared', cleared.length, 3);
    } finally {
        rmSync(panel, { recursive: true, force: true });
        rmSync(emails, { recursive: true, force: true });
    }

    /* Clearing a demo that owns nothing is not an error: a slug reclaimed after
       its folders were removed by hand still has to build. */
    is('clearing a demo that owns nothing removes nothing and does not throw',
       clearForRebuild(PREFIX + 'never-existed').length, 0);
    console.log('\n7. A palette committed for a demo carries colours and nothing else');

    /* It exists for a store the build machine cannot read, and it is only ever
       six hex values: the screenshot it came from stays out of a public
       repository. So everything that is not a colour is dropped, and a slug that
       is not a slug is never turned into a path. */
    const paletteDir = join(ROOT, 'factory', 'palettes');
    mkdirSync(paletteDir, { recursive: true });
    const probe = join(paletteDir, PREFIX + 'palette.json');
    writeFileSync(probe, JSON.stringify({
        ground: '#F8F8F8', ink: '#604040',
        accents: ['#f8e020', 'not a colour', '#f86020', 'javascript:alert(1)'],
        extra: 'ignored'
    }));
    try {
        const read = committedPalette(PREFIX + 'palette');
        is('a committed palette is read', read && read.ok, true);
        is('its colours are normalised', read && read.ground, '#f8f8f8');
        is('and only colours survive', JSON.stringify(read && read.accents), '["#f8e020","#f86020"]');
        is('a slug with a traversal in it is never a path', committedPalette('../etc'), null);
        is('and a demo with no palette gets none', committedPalette(PREFIX + 'nothing-here'), null);
    } finally {
        rmSync(probe, { force: true });
    }
} finally {
    for (const slug of made) rmSync(join(ROOT, 'demos', slug), { recursive: true, force: true });
}

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
