/* ============================================================================
   EVERYTHING THAT NAMES A DEMO, REBUILT IN ONE PLACE.

     node factory/named-generators.mjs        rebuild them all

   Three things in this repository are generated from whichever demos exist at
   the time: the product feed lists them, and the shared BeeFree preview and the
   seven scenario previews each SAMPLE one, showing its real products and
   photographs so a colleague can see what an email actually looks like.

   That means the set of demos changing makes all of them stale, in both
   directions, and both directions have now cost a day.

   REMOVING ONE, 22 September 2026. Five demos were retired by hand and the
   shared BeeFree preview kept pointing at a retired demo's photographs. CI went
   red on factory/panel/links.test.mjs after the merge.

   ADDING ONE, 23 September 2026, and this is the worse of the two. A demo was
   built and committed. The generators then sampled the new demo, so every
   committed preview was stale the moment it landed, and
   factory/checks/generated-current.mjs refuses a stale preview. That check runs
   at the START of a build, before the prospect's site is read, so the next
   request failed instantly and so would every request after it. Adding a demo
   had stopped the factory from adding demos.

   The fix for both is the same and it is dull: whatever changes the set of
   demos rebuilds these before it commits. The purge does it, the build does it,
   and this file is the list so neither can hold a different one.
   ========================================================================== */
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

/* shared: writes into factory/panel/content/_shared/, which is what
   factory/checks/generated-current.mjs compares. The feed is not in that folder
   and is checked by factory/build-feed.mjs --check instead. */
export const NAMED = [
    { script: 'factory/build-feed.mjs', shared: false },
    { script: 'factory/emails/build-scenarios.mjs', shared: true },
    { script: 'factory/emails/build-beefree.mjs', shared: true }
];

export const SHARED = NAMED.filter((entry) => entry.shared).map((entry) => entry.script);

/* Runs them in order and throws on the first failure, because a half rebuilt
   tree committed is worse than a build that stopped. */
export function rebuild(options) {
    const settings = options || {};
    const done = [];
    for (const entry of NAMED) {
        execFileSync('node', [join(ROOT, entry.script)], {
            cwd: ROOT,
            env: settings.out
                ? Object.assign({}, process.env, { PANEL_CONTENT_OUT: settings.out })
                : process.env,
            stdio: 'pipe'
        });
        done.push(entry.script);
    }
    return done;
}

if (import.meta.url === 'file://' + process.argv[1]) {
    try {
        for (const script of rebuild()) console.log('  rebuilt ' + script);
    } catch (err) {
        console.error('Rebuilding what names a demo failed: ' +
            String((err && err.message) || err).split('\n')[0]);
        process.exit(1);
    }
}
