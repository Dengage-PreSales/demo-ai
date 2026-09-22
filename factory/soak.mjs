/* ============================================================================
   DOES THE FACTORY STILL READ REAL STORES? Run it against all of them at once.

     node factory/soak.mjs                        every store in factory/soak.json
     node factory/soak.mjs --url https://x.com    one store, not from the list
     node factory/soak.mjs --json report.json     machine readable as well
     node factory/soak.mjs --jobs 3               how many at a time

   WHY THIS EXISTS. Every fault this factory has had was found by a colleague
   pasting a URL into an issue and getting nothing back. Each was then fixed
   against that one store, which is how the next store found the next fault: a
   browser named by a path that only exists on one machine, a category rule that
   preferred 7 percent coverage to 68, a header that rendered six shelves out of
   nine. None of them needed a prospect to discover. All of them needed more than
   one store.

   So this reads the stores in factory/soak.json, which are the real requests
   from the Issues tab including the ones that are hard, and reports what a demo
   built from each would actually contain. It builds nothing and commits
   nothing, so it is safe to run at any time and cheap enough to run often.

   WHAT IT JUDGES, and it is deliberately about the DEMO rather than the scrape:

     products   a demo with 12 products is a sample, not a storefront
     shelves    navigable categories, excluding the tail group
     tail       how much of the catalogue landed in More, which is the number
                that told us the category rule was broken while every other
                figure looked healthy
     theme      whether the store's own colour and typeface were found, or the
                standard palette was used
     currency   read from the store rather than defaulted, because a wrong
                currency is the most expensive kind of wrong on a call

   A STORE THAT CANNOT BE READ IS NOT A FAILURE OF THIS CHECK. Some stores
   refuse every automated reader, and the designed answer is a clean refusal
   with a request for a CSV. That path is reported as "refused" and is a pass,
   because it is what the factory is supposed to do. The failure this catches is
   a store that USED to read and stopped, or one that reads and produces a demo
   nobody would show.
   ========================================================================== */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const args = {};
for (let i = 2; i < process.argv.length; i++) {
    const token = process.argv[i];
    if (!token.startsWith('--')) continue;
    const next = process.argv[i + 1];
    args[token.slice(2)] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) i++;
}

/* One store must never hold the whole run. A store that hangs is itself a
   finding, so the timeout is reported rather than thrown. */
const PER_STORE_MS = Number(args.timeout || 600000);

/* A FEW STORES A NIGHT RATHER THAN ALL OF THEM, rotating, so the whole list is
   covered every few days and no single run is a burst of traffic at anybody.
   The offset comes from the date, so consecutive nights take different stores
   without anything having to be remembered between runs. --all overrides it for
   a person who wants the whole picture now. */
const SLICE = 3;

function stores() {
    if (args.url && args.url !== true) return [{ url: String(args.url) }];
    const list = JSON.parse(readFileSync(join(HERE, 'soak.json'), 'utf8')).stores;
    if (args.all || args.url === true) return list;
    const size = Math.max(1, Number(args.slice || SLICE));
    if (size >= list.length) return list;
    const day = Math.floor(Date.now() / 86400000);
    const start = (day * size) % list.length;
    const picked = [];
    for (let i = 0; i < size; i++) picked.push(list[(start + i) % list.length]);
    return picked;
}

const withTimeout = (promise, ms, onTimeout) => Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(onTimeout), ms))
]);

async function readStore(entry) {
    const started = Date.now();
    const out = { url: entry.url, note: entry.note || '', expect: entry.expect || null };
    try {
        const { catalogue, CATEGORY_CAP } = await import('./scrape/catalogue.mjs');
        const { theme } = await import('./scrape/theme.mjs');
        const base = JSON.parse(readFileSync(join(ROOT, 'template', 'demo.config.json'), 'utf8'));

        const found = await withTimeout(
            catalogue(entry.url, null, { generateIfUnreadable: false }),
            PER_STORE_MS, { ok: false, reason: 'timeout', attempts: [] });

        out.elapsedMs = Date.now() - started;
        out.attempts = (found.attempts || []).map((a) =>
            a.tier + (a.ok ? ':' + (a.found || 0) : ':' + (a.reason || 'no')));

        if (!found.ok) {
            /* Refused is the designed answer for an unreadable store, so it is
               reported as such rather than as a break. */
            out.state = 'refused';
            out.reason = found.reason || (found.thin !== undefined ? 'thin:' + found.thin : 'unreadable');
            return out;
        }

        out.state = 'read';
        out.tier = found.tier;
        out.products = found.products.length;
        out.currency = found.currency || null;

        const counts = new Map();
        for (const p of found.products) counts.set(p.category, (counts.get(p.category) || 0) + 1);
        out.categories = found.categories;
        out.shelves = found.categories.filter((c) => c !== 'More' && c !== 'All products').length;
        out.cap = CATEGORY_CAP;
        const tail = (counts.get('More') || 0) + (counts.get('All products') || 0);
        out.tail = tail;
        out.tailShare = found.products.length ? Number((tail / found.products.length).toFixed(2)) : 0;
        out.spread = [...counts.entries()].sort((a, b) => b[1] - a[1]);

        /* The theme is read second, and a failure in it never fails the store:
           a demo with the standard palette is still a demo. It is reported
           because a store themed from nothing looks generic on a call. */
        const painted = await withTimeout(theme(entry.url, base.theme), PER_STORE_MS,
            { theme: base.theme, found: {} });
        out.primary = painted.theme.primary;
        out.font = painted.theme.displayFont;
        out.themeFound = !!painted.found.primary;
        out.themeSource = painted.found.primarySource || 'standard';
        out.rendered = painted.rendered ? (painted.rendered.ok ? 'ok' : painted.rendered.reason) : 'not run';
    } catch (err) {
        out.state = 'error';
        out.error = String((err && err.message) || err).split('\n')[0];
        out.elapsedMs = Date.now() - started;
    }
    return out;
}

/* What a good demo looks like for this store, from the list. Only a store that
   has an expect block is judged; the rest are watched. */
/* A REFUSAL NEVER FAILS THE NIGHT, and this is the most important rule in the
   file because the first version had it wrong and the mistake was expensive.

   From inside a run, a store that genuinely refuses automated readers and a
   store that has simply had enough of this address look exactly alike: both
   answer with too few products. The soak cannot tell them apart, so it must not
   claim to.

   IT WAS THE SOAK'S OWN DOING. The first nightly run reported four Shopify
   stores as regressed, and the same job had already BUILT two of them minutes
   earlier from the same runner, sixty products each, every check green. Reading
   ten stores, each with a collection walk, spends whatever budget those stores
   allow one address, and the soak then reported the damage it had caused as a
   fault in this repository.

   SO ONLY A STORE THAT READS AND READS WORSE FAILS THE NIGHT. That cannot be
   caused by a throttle: a throttled store answers with less or with nothing, and
   is reported as watch. A store that hands over its whole catalogue and then
   yields fewer navigable shelves than it did before is this repository's code
   and nothing else. */
function judge(row) {
    if (!row.expect) return { verdict: row.state === 'error' ? 'error' : 'watch', notes: [] };
    if (row.state !== 'read') {
        return { verdict: 'watch',
                 notes: ['did not read today: ' + (row.reason || row.error) +
                         '. A refusal is not judged, see judge()'] };
    }
    const notes = [];
    if (row.products < row.expect.products) notes.push('products ' + row.products + ' < ' + row.expect.products);
    if (row.shelves < row.expect.shelves) notes.push('shelves ' + row.shelves + ' < ' + row.expect.shelves);
    if (row.expect.maxTailShare !== undefined && row.tailShare > row.expect.maxTailShare) {
        notes.push('tail ' + Math.round(row.tailShare * 100) + '% > ' +
                   Math.round(row.expect.maxTailShare * 100) + '%');
    }
    return { verdict: notes.length ? 'REGRESSED' : 'ok', notes };
}

async function main() {
    const list = stores();
    /* ONE STORE AT A TIME BY DEFAULT, and the first run taught this.
       Reading three at once, each with its own collection crawl, puts a burst
       of requests on several stores from a single address. Four Shopify stores
       that give up sixty products from a laptop came back with none, six and
       seven from a GitHub runner: not a block, which would have refused the
       first request, but a throttle part way through a crawl.

       A nightly job has all the time in the world and no reason to look like a
       scraper, so the concurrency is gone. --jobs is still there for a hurry. */
    const jobs = Math.max(1, Number(args.jobs || 1));
    console.log('\nReading ' + list.length + ' store(s), ' + jobs + ' at a time.\n');

    const rows = [];
    let cursor = 0;
    async function worker() {
        while (cursor < list.length) {
            const entry = list[cursor++];
            const row = await readStore(entry);
            rows.push(row);
            const j = judge(row);
            row.verdict = j.verdict;
            row.notes = j.notes;
            console.log('  ' + (j.verdict === 'ok' ? 'ok      ' :
                                j.verdict === 'watch' ? 'watch   ' :
                                j.verdict === 'error' ? 'ERROR   ' : 'REGRESS ') +
                        entry.url.replace(/^https?:\/\//, '').padEnd(34) +
                        (row.state === 'read'
                            ? row.tier.padEnd(9) + String(row.products).padStart(3) + 'p  ' +
                              String(row.shelves).padStart(2) + ' shelves  tail ' +
                              String(Math.round((row.tailShare || 0) * 100)).padStart(3) + '%  ' +
                              (row.currency || '??') + '  ' + row.primary + '  ' + (row.font || '')
                            : row.state + ' (' + (row.reason || row.error) + ')') +
                        (j.notes.length ? '\n             ' + j.notes.join(', ') : ''));
        }
    }
    await Promise.all(Array.from({ length: jobs }, worker));

    rows.sort((a, b) => list.findIndex((s) => s.url === a.url) - list.findIndex((s) => s.url === b.url));
    const regressed = rows.filter((r) => r.verdict === 'REGRESSED' || r.verdict === 'error');

    console.log('\n' + rows.filter((r) => r.state === 'read').length + ' read, ' +
                rows.filter((r) => r.state === 'refused').length + ' refused, ' +
                rows.filter((r) => r.state === 'error').length + ' errored, ' +
                regressed.length + ' below what this store used to give.\n');

    if (args.json && args.json !== true) {
        writeFileSync(String(args.json), JSON.stringify({ at: new Date().toISOString(), rows }, null, 2) + '\n');
        console.log('Written: ' + args.json + '\n');
    }
    process.exit(regressed.length ? 1 : 0);
}

main();
