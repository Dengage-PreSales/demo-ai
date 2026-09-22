/* ============================================================================
   WHAT EVERY STORE IN THE SOAK LIST THEMES TO, IN ONE TABLE.

     node factory/scrape/theme-across-stores.mjs

   Run it, change a colour rule, run it again, and read the two tables side by
   side. That is the whole tool.

   IT EXISTS BECAUSE A COLOUR RULE CANNOT BE JUDGED ON ONE STORE. Every rule in
   theme.mjs decides the look of every demo, and the evidence for changing one is
   always a single prospect whose demo came out wrong. On 22 September 2026 a
   change was written to fix exactly that: uniworthshop.com declares
   --btn-1-bg: #000000 for a black and white brand, the declared channel refused
   the name, and the demo shipped in a red taken out of the stylesheets by
   frequency. Reading button background tokens fixed it.

   Run across the list, the same change moved sharbatly.club off the green it
   paints 225 times and declares as its accent, onto a dark grey, because that
   store's buttons are amber and its brand is not its buttons. One store fixed,
   one broken, and only the second table showed it. The change was reverted.

   IT IS A DIAGNOSTIC RATHER THAN A CHECK, so no workflow runs it and it is not
   in factory/checks/verify-repo.sh. It reads ten real storefronts over the
   network, which is the opposite of what a check should do, and there is no
   correct answer for it to assert: whether a colour is a brand is a judgement
   made by a person looking at the store.

   THE TEXT CHANNELS ONLY. The browser channel outranks them and is where a
   themed demo usually gets its colour, so a store reading badly here can still
   build correctly. What this shows is the answer underneath, which is what a
   store falls back to when the browser cannot read it, and that fallback is
   where the surprises have been.
   ========================================================================== */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { theme } from './theme.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

/* The template's own palette, so "standard" here means the same thing it means
   in a build. */
const STANDARD = {
    primary: '#125cfa', accent: '#f5a524', ink: '#14181b',
    page: '#ffffff', surface: '#f6f7f8',
    displayFont: 'Sora', bodyFont: 'Inter', radius: '10px'
};

const stores = JSON.parse(readFileSync(join(ROOT, 'factory', 'soak.json'), 'utf8'))
    .stores.map((store) => store.url).filter(Boolean);

const only = (process.argv.find((a) => a.startsWith('--store=')) || '').replace('--store=', '');

console.log('\n  ' + 'store'.padEnd(26) + 'primary'.padEnd(12) + 'decided by'.padEnd(12) + 'note');
console.log('  ' + '-'.repeat(70));

for (const url of stores) {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (only && host.indexOf(only) === -1) continue;
    let primary = '';
    let source = '';
    let note = '';
    try {
        const out = await theme(new URL(url).origin, STANDARD, { render: false });
        primary = out.found.primary ? out.theme.primary : '(standard)';
        source = out.found.primarySource || '-';
        if (out.reason) note = 'the text channels could not read it: ' + out.reason;
    } catch (err) {
        primary = '(failed)';
        note = String(err.message).slice(0, 44);
    }
    console.log('  ' + host.padEnd(26) + primary.padEnd(12) + source.padEnd(12) + note);
}

console.log('\n  A store missing from this table is a store that did not answer, which is\n' +
            '  information too: read it as "no data", never as "no change".\n');
