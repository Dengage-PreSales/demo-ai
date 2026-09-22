/* A check copied naively out of the machine it was written on.

   It names the browser that machine happens to have pre-installed, which is
   the fault factory/guard/run.sh's browser-path check refuses: the path exists
   in the sandbox and does not exist on a GitHub runner, so a check written
   this way passes every time its author runs it and fails every time CI does.

   That shipped twice in the real repository. The second time it discarded four
   days of demo builds that had already been read, built and verified. */
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({
        executablePath: '/opt/pw-browsers/chromium'
    });
    await browser.close();
})();
