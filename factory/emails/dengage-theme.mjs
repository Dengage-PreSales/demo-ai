/* ============================================================================
   The standard Dengage demo palette, read out of the storefront's own stylesheet.

     import { dengageTheme } from './dengage-theme.mjs';
     const palette = emailPalette(dengageTheme());

   WHY IT IS PARSED RATHER THAN WRITTEN DOWN HERE. template/style.css declares these on
   :root and every demo overrides them at runtime from demo.config.json. A second copy
   in this directory would be one more thing to keep in step, and the drift would be
   invisible: an email in last year's Dengage blue beside a storefront in this year's.

   WHAT USES IT. The shared email template, which is deliberately not themed to any
   prospect. Settled 9 August 2026, Salil's call: the template's chrome is baked at
   build time and the basket is resolved at send time, so a template themed to one demo
   can wrap another demo's basket. It did, with the wrong store name and the wrong
   currency over real prices. A neutral shell cannot contradict a basket, because it
   names no store, and it is imported once ever rather than once per demo.
   ========================================================================== */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/* The custom property each theme field comes from. Only the ones an email can use:
   shadows and colour-mix values are not expressible in a mail client. */
const FROM = {
    primary: '--primary',
    onPrimary: '--on-primary',
    accent: '--accent',
    ink: '--ink',
    muted: '--muted',
    surface: '--surface',
    page: '--page',
    line: '--line',
    radius: '--radius'
};

/* The first family in a stack, because emailPalette builds its own fallbacks and would
   otherwise be handed a stack inside a stack. */
function firstFamily(value) {
    const first = String(value || '').split(',')[0].trim().replace(/^['"]|['"]$/g, '');
    return first || '';
}

export function dengageTheme() {
    const css = readFileSync(join(ROOT, 'template', 'style.css'), 'utf8');
    /* The FIRST :root block only. The stylesheet has media query blocks after it that
       redeclare some of these, and a later match would quietly win. */
    const block = css.match(/:root\s*\{([\s\S]*?)\}/);
    if (!block) throw new Error('template/style.css has no :root block');

    const declared = {};
    const pattern = /(--[a-z-]+)\s*:\s*([^;]+);/g;
    let found;
    while ((found = pattern.exec(block[1])) !== null) {
        declared[found[1]] = found[2].trim();
    }

    const theme = {};
    for (const [field, property] of Object.entries(FROM)) {
        if (declared[property]) theme[field] = declared[property];
    }

    theme.displayFont = firstFamily(declared['--display-font']);
    theme.bodyFont = firstFamily(declared['--body-font']);

    const missing = Object.keys(FROM).filter((field) => !theme[field]);
    if (missing.length) {
        throw new Error('template/style.css :root is missing ' + missing.join(', '));
    }
    return theme;
}
