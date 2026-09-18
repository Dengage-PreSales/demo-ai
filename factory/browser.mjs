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

import { existsSync, readFileSync } from 'node:fs';
import { createHash, createPublicKey } from 'node:crypto';

/* A NAMED PATH IS HONOURED EVEN IF IT IS NOT THERE. Then the pre-installed path
   this repository's own environments use. Then nothing, which lets Playwright do
   what it normally does.

   THE ORDER MATTERS AND SO DOES THE MISSING existsSync, which is the part that
   looks like a bug and is not. Somebody naming a browser has said where it is,
   so a launch has to fail loudly rather than quietly succeed against a different
   one. Two tests depend on exactly that: they point CHROMIUM_PATH at nothing to
   prove a tier degrades instead of crashing when no browser is available, and
   falling through to the sandbox path would have made both of them pass on a
   machine where that path exists and prove nothing.

   BOTH NAMES ARE READ because both were already in use: CHROMIUM_PATH in the
   scrape tiers, PW_CHROMIUM in the checks. Four copies of this resolution had
   drifted apart by the time they were collected here, so they are one function
   now, with both names, and the differences that mattered kept. */
export function launchOptions(extra) {
    const options = Object.assign({}, extra || {});

    const named = process.env.CHROMIUM_PATH || process.env.PW_CHROMIUM;
    if (named) {
        options.executablePath = named;
        return options;
    }
    if (existsSync('/opt/pw-browsers/chromium')) {
        options.executablePath = '/opt/pw-browsers/chromium';
        return options;
    }
    return options;
}

/* -------------------------------------------------------------------------- */

/* WHEN THE MACHINE TERMINATES TLS WITH ITS OWN AUTHORITY, THE BROWSER HAS TO
   KNOW, and until 18 September 2026 it did not. This is the second half of the
   same problem the executable path above solves: a build machine that is
   correctly set up for everything else and wrong for the browser alone.

   WHAT WENT WRONG, because it is the reason this is worth the code. Some
   environments route outbound HTTPS through a proxy that re-signs every
   certificate with a local authority. Node is told about it, curl is told about
   it, every fetch in factory/scrape works perfectly. Chromium is told nothing,
   so it refused the store's certificate and painted its own "Your connection is
   not private" page instead. Every browser tier then read that page and none of
   them noticed: the catalogue's render tier found no products on it, and
   theme-rendered.mjs found a page, an ink colour and a button, so it reported
   success and themed a Saudi fruit retailer in the blue of Chromium's own Back
   to safety button. The demo shipped that way and the fault was reported as
   "the theme is not accurate", which is not a sentence anyone would trace to a
   certificate.

   THIS TRUSTS EXACTLY THOSE KEYS AND NOTHING ELSE. The flag takes the SHA-256
   of each certificate's public key, so the browser accepts a certificate signed
   by that authority and still refuses every other bad certificate on the
   internet. Verification stays on. The alternative offered by every search
   result, --ignore-certificate-errors, turns verification off wholesale and
   would make a compromised connection indistinguishable from a good one, so it
   is not used here and should not be added later.

   NOTHING ABOUT ANY PARTICULAR MACHINE IS WRITTEN DOWN. The authority is read
   from whichever file the environment already names, the hashes are computed
   when the browser starts, and on a machine that names no file this adds no
   flags at all. A GitHub runner reaches the internet directly and takes this
   path unchanged. */
const CA_VARS = ['SCRAPE_CA_FILE', 'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'CURL_CA_BUNDLE'];

/* A bundle can hold hundreds of public authorities as well as the local one, and
   pinning all of them would be pointless rather than harmful. So a file is only
   used when it is small enough to be a local authority's own chain: the flag is
   an accommodation for one machine's proxy, not a second trust store. */
const MAX_CA_CERTS = 8;

export function caSpkiHashes() {
    for (const name of CA_VARS) {
        const path = process.env[name];
        if (!path || !existsSync(path)) continue;
        let pem;
        try { pem = readFileSync(path, 'utf8'); } catch (err) { continue; }
        const blocks = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
        if (!blocks || !blocks.length || blocks.length > MAX_CA_CERTS) continue;
        const hashes = [];
        for (const block of blocks) {
            try {
                const key = createPublicKey(block);
                const der = key.export({ type: 'spki', format: 'der' });
                hashes.push(createHash('sha256').update(der).digest('base64'));
            } catch (err) { /* not a certificate this Node can read */ }
        }
        if (hashes.length) return hashes;
    }
    return [];
}

/* The same options, plus the trust accommodation. Used by everything that points
   a browser at a STORE we do not control; the checks in factory/checks point
   their browsers at localhost and do not need it. */
export function launchOptionsForScrape(extra) {
    const options = launchOptions(extra);
    const hashes = caSpkiHashes();
    if (!hashes.length) return options;
    options.args = (options.args || []).concat(
        '--ignore-certificate-errors-spki-list=' + hashes.join(','));
    return options;
}

/* -------------------------------------------------------------------------- */

/* DID THE PAGE COME FROM THE SITE, OR DID THE BROWSER WRITE IT ITSELF. Every
   tier that points a browser at a store has to ask, and until 18 September 2026
   none of them did.

   WHAT A BROWSER PAINTS WHEN A NAVIGATION FAILS is a page of its own: "Your
   connection is not private" for a certificate it will not accept, "This site
   can't be reached" for a name that does not resolve. It has a title, text, a
   background and a button, so anything reading colours, fonts or products off
   the page reads THOSE, and reads them successfully. That is how a Saudi fruit
   retailer's demo shipped in Chromium's own blue with Chromium's own fallback
   font, with every scrape tier reporting success.

   THE TEST IS THE DOCUMENT'S OWN ADDRESS, not the error message and not a guess
   about how much it painted. A browser error page is served from a scheme of the
   browser's own, chrome-error: in Chromium, so its origin is not the site's and
   never can be. That distinguishes it from every real page including a bot wall,
   a consent gate and a country picker, which are all genuinely served by the
   site and are all legitimately what that store shows a visitor.

   A TIMEOUT IS NOT A FAILURE HERE, which is why the two are separated. A slow
   store that has not fired its load event has still usually painted its header,
   its palette and its first shelf, and refusing it would lose demos this factory
   can build. So a timeout carries on and anything else refuses. */
export function navigationFailure(err) {
    const text = String((err && err.message) || err || '');
    if (/Timeout|timeout exceeded/i.test(text)) return null;
    if (/ERR_CERT|ERR_SSL|SSL_VERSION|CERT_AUTHORITY|CERT_COMMON_NAME/i.test(text)) {
        return 'certificate';
    }
    /* ERR_TUNNEL_CONNECTION_FAILED belongs here too, and it is the one that is
       not obvious. Where outbound traffic goes through a proxy, a name that does
       not resolve fails at the proxy rather than in the browser, so the browser
       never sees ERR_NAME_NOT_RESOLVED at all and reports the tunnel instead.
       Either way the store was not reached, which is what the caller is told. */
    if (/ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|ERR_ADDRESS|ERR_EMPTY_RESPONSE|ERR_TUNNEL/i
        .test(text)) {
        return 'unreachable';
    }
    return 'navigation';
}

/* True when the page currently holds a document the site served. Read after the
   page has settled, because a failed navigation reaches its own error document a
   moment after the goto rejects. */
export function pageIsSite(page, origin) {
    let here;
    try { here = page.url(); } catch (err) { return false; }
    if (!here || here === 'about:blank') return false;
    if (/^chrome-error:|^chrome:|^about:/.test(here)) return false;
    try { return new URL(here).origin === new URL(origin).origin; }
    catch (err) { return false; }
}

/* THE SENTENCE A PRE-SALES PERSON CAN ACT ON, for each way this can go wrong.
   CLAUDE.md 6: a failure on an issue is read by a salesperson. A certificate
   failure is the one that is about the machine rather than the store, so it says
   so, because the person reading it would otherwise go back to the prospect
   about a problem the prospect does not have. */
export function reachFailureNote(reason) {
    if (reason === 'certificate') {
        return 'The browser on this machine would not accept the store\'s certificate,'
            + ' so it showed itself a warning page instead of the store. This is a'
            + ' setting on the machine running the build rather than anything wrong'
            + ' with the store: if outbound traffic here is inspected by a local'
            + ' certificate authority, point SCRAPE_CA_FILE at that authority\'s'
            + ' certificate and run it again.';
    }
    if (reason === 'unreachable') {
        return 'The browser could not reach this store at all. Check the address,'
            + ' then try again.';
    }
    return 'The browser did not end up on this store\'s own pages, so nothing read'
        + ' from them would have been the store.';
}
