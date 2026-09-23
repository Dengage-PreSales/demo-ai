/* ============================================================================
   RETIRE A DEMO WHEN ITS NINETY DAYS ARE UP.

     node factory/purge.mjs                  list what is due, remove nothing
     node factory/purge.mjs --remove         delete the folders that are due
     node factory/purge.mjs --slug <slug>    retire one demo now, by name
     node factory/purge.mjs --json out.json  the same answer, machine readable

   CLAUDE.md 0.11 says a demo deletes itself after ninety days, and handoff 10
   describes this file. Until 22 September 2026 neither existed: every demo
   wrote an expiresAt into its config, factory/build-feed.mjs correctly dropped
   expired demos out of the product feed, and nothing ever deleted anything. The
   demos stayed live at their addresses for good, quietly missing from the feed,
   which is the worst of both answers.

   IT DELETES FOLDERS AND NOTHING ELSE, and that is not an omission.

   A demo's ROWS stay where they are. Salil's instruction, 4 August 2026, and
   CLAUDE.md 1a is the rule behind it: the six standard ecommerce tables are
   shared with five live demo sites and two mobile apps, columns cannot be added
   to them so no demo_slug exists to filter on, and a demo's rows can only be
   found indirectly by joining session_id back through page_view_events. A
   scheduled job issuing deletes against production tables on a join it computed
   itself is the most dangerous thing this design could contain. If the data ever
   grows enough to matter, a person raises a ticket with the backend team.

   A folder is different in every way that counts: it is in git, the deletion is
   one commit, and restoring it is one revert.

   HOW A DEMO IS EXEMPTED. It carries no expiresAt. showcase is the reference
   build every check runs against and is never retired; a generated demo always
   gets a date ninety days out. Nothing here invents a date for a demo that has
   none, so exemption is a property of the demo rather than a list kept in here.
   ========================================================================== */
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { rebuild } from './named-generators.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DEMOS = join(ROOT, 'demos');

const args = {};
for (let i = 2; i < process.argv.length; i++) {
    const token = process.argv[i];
    if (!token.startsWith('--')) continue;
    const next = process.argv[i + 1];
    args[token.slice(2)] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) i++;
}

const today = String(args.today || new Date().toISOString().slice(0, 10));

/* Everything a build writes for one demo, so retiring it leaves nothing behind.
   The panel content is the half that is easy to forget: it lives outside
   demos/ because it is setup material rather than pages, and a demo retired
   without it leaves a message pack for a storefront that is gone. */
function belongingsOf(slug) {
    return [
        join(DEMOS, slug),
        join(ROOT, 'factory', 'panel', 'content', slug),
        join(ROOT, 'factory', 'emails', 'content', slug)
    ].filter((path) => existsSync(path));
}

export function due(when) {
    const out = [];
    if (!existsSync(DEMOS)) return out;
    for (const slug of readdirSync(DEMOS).sort()) {
        const dir = join(DEMOS, slug);
        if (!statSync(dir).isDirectory()) continue;
        const configPath = join(dir, 'demo.config.json');
        if (!existsSync(configPath)) continue;
        let config;
        try { config = JSON.parse(readFileSync(configPath, 'utf8')); }
        catch (err) { continue; }

        const expiresAt = config.expiresAt || null;
        const entry = {
            slug,
            expiresAt,
            storeName: config.storeName || '',
            paths: belongingsOf(slug).map((p) => p.slice(ROOT.length + 1))
        };
        if (!expiresAt) { entry.state = 'exempt'; }
        else if (String(expiresAt) < when) { entry.state = 'due'; }
        else { entry.state = 'live'; }
        out.push(entry);
    }
    return out;
}

/* EVERYTHING THAT NAMES A DEMO IS REBUILT BEFORE THE RETIREMENT IS COMMITTED.

   Deleting the folder is only half of retiring a demo. The product feed names
   demos, and the shared panel content SAMPLES one, so retiring the sampled demo
   leaves those previews pointing at photographs that are gone.

   The list lives in factory/named-generators.mjs, with the reasoning, because
   adding a demo makes exactly the same things stale and the build has to rebuild
   the same set. Two copies of that list is how the build spent an afternoon
   refusing every request. */
function regenerate() {
    console.log('\nRebuilding what names a demo:');
    try {
        for (const script of rebuild()) console.log('  rebuilt ' + script);
    } catch (err) {
        console.error('  FAILED  ' + String((err && err.message) || err).split('\n')[0]);
        console.error('\nThe folders are gone and something that names a demo did not');
        console.error('rebuild. Do not commit this tree until it does.');
        process.exit(1);
    }
    console.log('');
}

function main() {
    const named = args.slug && args.slug !== true ? String(args.slug) : '';
    const rows = due(today);
    const chosen = named
        ? rows.filter((r) => r.slug === named)
        : rows.filter((r) => r.state === 'due');

    if (named && !chosen.length) {
        console.error('No demo called ' + named + '.');
        process.exit(2);
    }

    console.log('\nAs at ' + today + ':\n');
    for (const row of rows) {
        const mark = chosen.some((c) => c.slug === row.slug) ? '->' : '  ';
        console.log('  ' + mark + ' ' + row.slug.padEnd(26) +
            row.state.padEnd(8) + (row.expiresAt || 'never'));
    }

    if (!chosen.length) {
        console.log('\nNothing is due.\n');
        if (args.json && args.json !== true) {
            writeFileSync(String(args.json), JSON.stringify({ today, rows, removed: [] }, null, 2) + '\n');
        }
        return;
    }

    console.log('\n' + chosen.length + ' demo(s) to retire:');
    for (const row of chosen) for (const path of row.paths) console.log('    ' + path);

    if (!args.remove) {
        console.log('\nNothing was removed. Add --remove to do it.\n');
    } else {
        for (const row of chosen) {
            for (const path of row.paths) rmSync(join(ROOT, path), { recursive: true, force: true });
            console.log('  retired ' + row.slug);
        }
        regenerate();
    }

    if (args.json && args.json !== true) {
        writeFileSync(String(args.json), JSON.stringify(
            { today, rows, removed: args.remove ? chosen : [] }, null, 2) + '\n');
    }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
