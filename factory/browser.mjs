/* ============================================================================
   Where Chromium is, for the scripts that render something in a browser.

     import { launchOptions } from '../browser.mjs';
     const browser = await chromium.launch(launchOptions());

   THREE PLACES LOOK FOR IT AND THEY HAVE TO AGREE. Playwright expects a browser it
   downloaded into its own cache; several of the environments this repository runs in
   have one pre-installed somewhere else and set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD, so
   the default lookup fails with "Executable doesn't exist" while a perfectly good
   Chromium sits on disk. Each script that solved that separately was one more place to
   forget, and the failure only shows on the machine that has the other layout.
   ========================================================================== */

import { existsSync } from 'node:fs';

/* PW_CHROMIUM first, so a machine with an unusual layout can say where it is without
   editing anything. Then the pre-installed path this repository's own environments use.
   Then nothing, which lets Playwright do what it normally does. */
export function launchOptions(extra) {
    const options = Object.assign({}, extra || {});

    if (process.env.PW_CHROMIUM && existsSync(process.env.PW_CHROMIUM)) {
        options.executablePath = process.env.PW_CHROMIUM;
        return options;
    }
    if (existsSync('/opt/pw-browsers/chromium')) {
        options.executablePath = '/opt/pw-browsers/chromium';
        return options;
    }
    return options;
}
