/* ============================================================================
   Publishes the transactional moments for the relay to read.

     node factory/transactional/build.mjs

   Writes feed/messages.json: every intent, its subject, its content ids and the
   whole of its email body, as one public file on this origin.

   WHY IT IS PUBLISHED RATHER THAN LOADED BY HAND. The relay runs in a database
   that cannot see this repository, so a template would otherwise reach it by
   somebody pasting SQL, which is the manual step this factory exists to remove
   and the one most likely to go stale. Published beside the catalogue and the
   demo index, the relay refreshes itself from a file that git already reviews.

   NOTHING SECRET IS IN IT, and nothing can be. A content id names a template in
   a shared account and is not a credential, the bodies are the same markup a
   panel paste would carry, and every message this produces still has to
   authenticate with credentials that live only in the database's vault.

   A BODY IS OPTIONAL. An intent with no html hands that moment back to the
   panel: the send carries no body, so whatever the content holds is what goes
   out. That is the right choice for anything a non developer should be able to
   edit mid quarter.
   ========================================================================== */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(ROOT, 'feed');
const SITE = 'https://dengage-presales.github.io/demo-ai';

export function load() {
    const manifest = JSON.parse(readFileSync(join(HERE, 'intents.json'), 'utf8'));
    const intents = [];
    for (const entry of manifest.intents) {
        if (!/^[a-z0-9][a-z0-9-]{1,48}$/.test(entry.intent)) {
            throw new Error('intent name is not a slug: ' + entry.intent);
        }
        let html = null;
        if (entry.html) {
            const path = join(HERE, entry.html);
            if (!existsSync(path)) throw new Error('missing body for ' + entry.intent + ': ' + entry.html);
            html = readFileSync(path, 'utf8');
            /* THE ONE THING A BODY MAY NOT CONTAIN. An expression referring to a
               key the send did not pass prints its own source code into the
               delivered message, so a template carries plain tags and nothing
               else. Refused here rather than discovered in an inbox. */
            const logic = html.match(/\{%[^=][\s\S]{0,60}?%\}|\{%=[^%]*\|\|[^%]*%\}/);
            if (logic) {
                throw new Error('a body may carry no logic, only plain tags. ' +
                    entry.intent + ' has: ' + logic[0].slice(0, 60));
            }
        }
        intents.push({
            intent: entry.intent,
            label: entry.label || entry.intent,
            subject: entry.subject || '',
            emailContentId: entry.emailContentId || null,
            pushContentId: entry.pushContentId || null,
            enabled: entry.enabled !== false,
            html
        });
    }
    return intents;
}

function main() {
    const intents = load();
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, 'messages.json'),
        JSON.stringify({ generated: new Date().toISOString(), intents }, null, 2) + '\n');

    for (const entry of intents) {
        console.log('  ' + entry.intent.padEnd(26) +
            (entry.emailContentId ? 'email ' : '      ') +
            (entry.pushContentId ? 'push ' : '     ') +
            (entry.html ? String(entry.html.length) + ' bytes of body' : 'body from the panel'));
    }
    console.log('\n' + intents.length + ' intent(s)');
    console.log(SITE + '/feed/messages.json');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
