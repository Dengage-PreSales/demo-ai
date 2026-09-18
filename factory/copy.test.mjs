/* ============================================================================
   THE STOREFRONT'S WORDS, IN EVERY LANGUAGE IT SPEAKS.

     node factory/copy.test.mjs

   WHY THIS EXISTS. template/copy.json is the English storefront and
   template/copy.pt.json and copy.ru.json are its translations, chosen per demo
   by the Language field on the request form. Three files holding the same keys
   is a shape that rots quietly: a string added to the English file and nowhere
   else does not fail a build, it renders as `undefined` on a Portuguese demo
   mid call, or leaves a button with no label at all.

   So this compares them rather than trusting them, and it is wired into the
   self test the build runs before it generates anything.

   THE PLACEHOLDER CHECK IS THE ONE THAT WILL EARN ITS KEEP. `{n}`, `{q}` and
   `{prefix}` are substituted at render time, so a translation that drops one
   silently loses the number in "Only 3 left" or the search term in "Nothing
   matched X", and a translation that invents one renders the brace as text. A
   translator working in a spreadsheet does this, and nothing else would notice.
   ========================================================================== */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = join(ROOT, 'template');

/* The languages the generator offers. Kept as a literal here rather than
   imported, so this file fails when the two disagree instead of agreeing with
   a mistake. factory/generate-demo.mjs exports LANGUAGES and the last
   assertion holds them to the same set. */
const LANGUAGES = ['en', 'pt', 'ru'];
const FILE = { en: 'copy.json', pt: 'copy.pt.json', ru: 'copy.ru.json' };

let pass = 0;
let fail = 0;
function ok(label, condition, detail) {
    if (condition) { pass++; console.log('   ok    ' + label); return; }
    fail++;
    console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : ''));
}

function load(code) {
    const path = join(TEMPLATE, FILE[code]);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8'));
}

const copies = {};
for (const code of LANGUAGES) copies[code] = load(code);

/* -------------------------------------------------------------------------- */
console.log('\n1. Every language the form offers has a file');

for (const code of LANGUAGES) {
    ok(FILE[code] + ' exists and parses', Boolean(copies[code]), FILE[code]);
}

/* -------------------------------------------------------------------------- */
console.log('\n2. The same keys, in every file');

const keysOf = (copy) => Object.keys(copy).filter((k) => k !== '_comment').sort();
const english = copies.en ? keysOf(copies.en) : [];
ok('the English file carries the keys', english.length > 50, english.length);

for (const code of LANGUAGES.filter((c) => c !== 'en')) {
    if (!copies[code]) continue;
    const theirs = keysOf(copies[code]);
    const missing = english.filter((k) => theirs.indexOf(k) === -1);
    const extra = theirs.filter((k) => english.indexOf(k) === -1);
    ok(code + ': nothing is missing', missing.length === 0, missing);
    /* AN EXTRA KEY IS A FAULT TOO, and the less obvious of the two: it is a
       string somebody translated that the storefront will never read, which
       usually means the English key was renamed and only one file followed. */
    ok(code + ': and nothing is left over', extra.length === 0, extra);
}

/* -------------------------------------------------------------------------- */
console.log('\n3. Every placeholder survives translation');

const PLACEHOLDER = /\{[a-z]+\}/g;
for (const code of LANGUAGES.filter((c) => c !== 'en')) {
    if (!copies[code]) continue;
    const wrong = [];
    for (const key of english) {
        const mine = String(copies.en[key] === undefined ? '' : copies.en[key]);
        const theirs = String(copies[code][key] === undefined ? '' : copies[code][key]);
        const want = (mine.match(PLACEHOLDER) || []).slice().sort().join(',');
        const got = (theirs.match(PLACEHOLDER) || []).slice().sort().join(',');
        if (want !== got) wrong.push({ key, want, got });
    }
    ok(code + ': every substitution is carried through, and none invented',
       wrong.length === 0, wrong.slice(0, 4));
}

/* -------------------------------------------------------------------------- */
console.log('\n4. Nothing was left in English by accident');

/* A COPIED FILE THAT WAS NEVER TRANSLATED PASSES EVERY CHECK ABOVE, which is
   exactly how a half done translation ships: the keys line up, the placeholders
   line up, and every string is still English. So the values are compared too.

   It cannot be "no value may match", because several correctly should: a brand
   name, a units abbreviation, a channel name that is English everywhere. Those
   are listed, and anything else matching is a string nobody translated. */
const SHARED = new Set([
    'brand',          /* Dengage, a name */
    'cartTotal',      /* Total, which is Total in Portuguese */
    'groupPush',      /* Web push, used in English in both */
    'groupAbTest',    /* A/B, the same everywhere */
    'inboxMinutes', 'inboxHours',  /* {n} min, {n} h */
    'refAccount',     /* Conta in pt, but Account in ru usage */
    'accountAction'
]);

for (const code of LANGUAGES.filter((c) => c !== 'en')) {
    if (!copies[code]) continue;
    const untranslated = english.filter((key) => {
        if (SHARED.has(key)) return false;
        const mine = String(copies.en[key] === undefined ? '' : copies.en[key]).trim();
        const theirs = String(copies[code][key] === undefined ? '' : copies[code][key]).trim();
        return mine !== '' && mine === theirs;
    });
    /* A handful of legitimate matches is normal, a file full of them is a file
       nobody translated. The threshold is deliberately loose: this is here to
       catch a copied file, not to police word choice. */
    ok(code + ': the file is genuinely translated, not a copy of the English',
       untranslated.length <= 6, untranslated.slice(0, 10));
}

/* -------------------------------------------------------------------------- */
console.log('\n5. No string on screen counts something the code owns');

/* PAID FOR TWICE, IN THE SAME WEEK. The Recommendations panel read "Five
   strategies" while rendering six, and two checks asserted five while
   js/recommend.js held six. CLAUDE.md already says the rule is coverage rather
   than a number, because the number has been wrong before; this is that rule
   made checkable for the words a prospect actually reads.

   WHY IT REFUSES THE WORD RATHER THAN COMPARING IT. A count in copy is a second
   copy of a fact that lives in a module, and there is no render-time
   substitution behind it, so nothing can keep the two in step. Rephrasing costs
   one sentence and the drift cannot come back.

   "one" IS ALLOWED, and only "one", because in English it is the indefinite
   pronoun rather than a count: "press one and it appears" is not a claim about
   how many there are. Every other cardinal, in all three languages, is refused.
   Numerals are left alone: "{n} left" is substituted at render time and is the
   right way to put a number on screen. */
{
    /* UNICODE BOUNDARIES, NOT \b. JavaScript's \b is defined on [A-Za-z0-9_], so
       \bпять\b matches nothing at all: the first character is not a word
       character to it, and the whole Russian and half the Portuguese list would
       have been dead pattern that passed this file forever. The known-bad
       assertion below is what caught it, which is the entire reason it is here. */
    const EDGE = ['(?<![\\p{L}\\p{N}])', '(?![\\p{L}\\p{N}])'];
    const COUNTING = new RegExp(EDGE[0] + '(' + [
        'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
        'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'twenty',
        'dois', 'duas', 'tres', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito',
        'nove', 'dez', 'onze', 'doze', 'quinze', 'vinte',
        'два', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь',
        'девять', 'десять', 'одиннадцать', 'двенадцать', 'пятнадцать', 'двадцать'
    ].join('|') + ')' + EDGE[1], 'iu');

    for (const code of LANGUAGES) {
        const counted = Object.keys(copies[code]).filter((key) => {
            const value = copies[code][key];
            return typeof value === 'string' && COUNTING.test(value);
        }).map((key) => key + ': ' + copies[code][key].slice(0, 70));
        ok(code + ': no string names a count', counted.length === 0, counted);
    }

    /* The refusal is tested against known-bad input, because a pattern that
       matches nothing passes this file on any copy at all. */
    ok('and the rule would catch the sentence it was written for',
       COUNTING.test('Five strategies, all computed from this demo\'s own catalogue.') &&
       COUNTING.test('Cinco estratégias, todas calculadas a partir do catálogo.') &&
       COUNTING.test('Пять стратегий, все рассчитаны по каталогу.'));
    ok('while leaving the indefinite "one" and a substituted numeral alone',
       !COUNTING.test('Press one and it appears on this page.') &&
       !COUNTING.test('Only {n} left'));
}

/* -------------------------------------------------------------------------- */
console.log('\n6. The generator offers exactly these languages');

{
    const { LANGUAGES: offered, languageOf } = await import('./generate-demo.mjs');
    ok('the generator and this test agree on the set',
       Object.keys(offered).sort().join(',') === LANGUAGES.slice().sort().join(','),
       Object.keys(offered));
    /* The form sends the name a colleague clicked, so the generator has to take
       a name as well as a code. */
    ok('a form name resolves', languageOf('Portuguese') === 'pt' && languageOf('Russian') === 'ru');
    ok('a code resolves', languageOf('pt') === 'pt');
    ok('and anything unknown is English rather than a broken storefront',
       languageOf('Klingon') === 'en' && languageOf('') === 'en' && languageOf(undefined) === 'en');
}

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
