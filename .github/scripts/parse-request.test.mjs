/* ============================================================================
   Tests for the request parser.

     node .github/scripts/parse-request.test.mjs

   A guard that passes on an empty repository proves nothing (CLAUDE.md 4), and
   the same applies here: this parser turns text a stranger wrote into command
   line arguments, so the cases that matter are the malformed ones.
   ========================================================================== */
import { parse, fieldFromForm, readUrl, readSlug, readCurrency, readCsvUrl, readName }
    from './parse-request.mjs';

let pass = 0;
let fail = 0;

function ok(label, condition, detail) {
    if (condition) { pass++; console.log('   ok    ' + label); return; }
    fail++;
    console.log('   FAIL  ' + label + (detail !== undefined ? '  <' + JSON.stringify(detail) + '>' : ''));
}

function is(label, actual, expected) {
    ok(label, actual === expected, { actual, expected });
}

/* What GitHub actually renders for the form in new-demo.yml, including the empty
   field marker, which is the thing most likely to be read as a value. */
const FORM = [
    '### Prospect website address',
    '',
    'https://www.northfield-outdoor.com',
    '',
    '### Short name for the address',
    '',
    '_No response_',
    '',
    '### Currency',
    '',
    'eur',
    '',
    '### What the store sells',
    '',
    'outdoor clothing and equipment',
    '',
    '### Notes for the build',
    '',
    'Call is on Thursday. They care about back in stock.',
    ''
].join('\n');

console.log('\n1. Reading the form');
is('the url comes through', fieldFromForm(FORM, 'Prospect website address'),
   'https://www.northfield-outdoor.com');
is('an empty field is empty, not "_No response_"',
   fieldFromForm(FORM, 'Short name for the address'), '');
is('a later field is not swallowed by an earlier one',
   fieldFromForm(FORM, 'Currency'), 'eur');
is('multi-word values survive', fieldFromForm(FORM, 'What the store sells'),
   'outdoor clothing and equipment');
is('a field that is not there is empty', fieldFromForm(FORM, 'Nonexistent'), '');
is('windows line endings do not break it',
   fieldFromForm(FORM.replace(/\n/g, '\r\n'), 'Currency'), 'eur');

console.log('\n2. The address');
is('a plain address', readUrl('https://www.example.com'), 'https://www.example.com');
is('a path is reduced to the origin', readUrl('https://www.example.com/collections/all'),
   'https://www.example.com');
is('a bare domain gets a scheme', readUrl('example.com'), 'https://example.com');
is('angle brackets from a mail client', readUrl('<https://example.com>'), 'https://example.com');
is('a markdown link', readUrl('[Example](https://example.com)'), 'https://example.com');
is('trailing prose is ignored', readUrl('https://example.com and please hurry'),
   'https://example.com');
is('http stays http', readUrl('http://example.com'), 'http://example.com');
is('a non web scheme is refused', readUrl('javascript:alert(1)'), '');
is('a file scheme is refused', readUrl('file:///etc/passwd'), '');
is('a hostname with no dot is refused', readUrl('localhost'), '');
is('nothing is refused', readUrl(''), '');
is('"_No response_" is refused', readUrl('_No response_'), '');

console.log('\n3. The slug');
is('a good slug', readSlug('northfield-outdoor'), 'northfield-outdoor');
is('case is normalised', readSlug('NorthField'), 'northfield');
is('spaces are refused rather than mangled', readSlug('north field'), '');
is('a path traversal is refused', readSlug('../../etc'), '');
is('a shell metacharacter is refused', readSlug('demo;rm -rf /'), '');
is('a leading hyphen is refused', readSlug('-demo'), '');
is('two characters is too short', readSlug('ab'), '');
is('over forty characters is refused', readSlug('a'.repeat(41)), '');

console.log('\n4. The currency');
is('a code is upper cased', readCurrency('eur'), 'EUR');
is('surrounding space is trimmed', readCurrency('  gbp '), 'GBP');
is('a symbol is refused', readCurrency('€'), '');
is('a name is refused', readCurrency('euros'), '');

console.log('\n5. The CSV attachment');
const COMMENT = 'here you go, please retry\n' +
    '[products.csv](https://github.com/user-attachments/files/12345/products.csv)';
is('a github attachment is accepted', readCsvUrl(COMMENT),
   'https://github.com/user-attachments/files/12345/products.csv');
is('the objects host is accepted too',
   readCsvUrl('https://objects.githubusercontent.com/foo/bar.csv'),
   'https://objects.githubusercontent.com/foo/bar.csv');
/* THE POINT OF THIS ONE. A workflow that fetches whatever URL appears in a
   comment is a download client for anyone who can comment on the repository. */
is('an arbitrary host is refused',
   readCsvUrl('[products.csv](https://evil.example.com/payload.csv)'), '');
is('a bare word is refused', readCsvUrl('retry'), '');

console.log('\n6. The whole request');
{
    const fields = parse({ BODY: FORM, COMMENT: '' });
    is('url', fields.url, 'https://www.northfield-outdoor.com');
    is('slug is empty and will be derived', fields.slug, '');
    is('currency', fields.currency, 'EUR');
    is('no csv on a first submission', fields.csv_url, '');
}
{
    /* A CSV in the issue BODY must not be picked up: tier 3 stays an exception
       path, reached only after the first two tiers have failed. */
    const fields = parse({
        BODY: FORM + '\n[products.csv](https://github.com/user-attachments/files/1/p.csv)',
        COMMENT: ''
    });
    is('a csv in the body is ignored', fields.csv_url, '');
}
{
    const fields = parse({ BODY: FORM, COMMENT: COMMENT });
    is('a csv in a comment is used', fields.csv_url,
       'https://github.com/user-attachments/files/12345/products.csv');
}
{
    const fields = parse({
        BODY: FORM,
        IN_URL: 'https://override.example.com', IN_SLUG: 'manual', IN_CURRENCY: 'usd'
    });
    is('a manual run overrides the form url', fields.url, 'https://override.example.com');
    is('and the slug', fields.slug, 'manual');
    is('and the currency', fields.currency, 'USD');
}
{
    const fields = parse({ BODY: '### Prospect website address\n\n_No response_\n' });
    is('an empty form yields no url', fields.url, '');
}

/* -------------------------------------------------------------------------- */
console.log('\n7. The parser reads the labels the form actually uses');

/* THE LABELS ARE THE JOINT, AND A JOINT WITH TWO COPIES DRIFTS. The form names
   its fields in new-demo.yml and this parser looks them up by that name. Rename
   one in the form and the parser silently reads nothing: the field is optional,
   so there is no error, the value is quietly dropped, and the first sign of it is
   a demo built with the wrong currency.

   So the labels are read out of the form itself rather than written down a second
   time here, which is the same reason factory/checks/launcher.js counts the
   launcher against the creatives on disk instead of holding its own list. */
{
    const { readFileSync } = await import('node:fs');
    const form = readFileSync(new URL('../ISSUE_TEMPLATE/new-demo.yml', import.meta.url), 'utf8');
    const labels = [...form.matchAll(/^\s*label:\s*(.+?)\s*$/gm)].map((match) => match[1]);

    /* Exactly the ones parse() looks up. */
    const NEEDED = ['Prospect website address', 'Short name for the address', 'Currency'];
    for (const label of NEEDED) {
        ok('the form still has a field labelled "' + label + '"',
           labels.includes(label), labels);
    }

    /* And every label in the form is reachable, so a field cannot be added to the
       form and then be invisible to the build. */
    const rendered = labels.map((label) => '### ' + label + '\n\nvalue-for-' + label).join('\n\n');
    for (const label of labels) {
        ok('"' + label + '" is readable from a rendered form',
           fieldFromForm(rendered, label) === 'value-for-' + label,
           fieldFromForm(rendered, label));
    }
}


/* -------------------------------------------------------------------------- */
console.log('\nThe store name, which becomes the browser tab');

/* The issue title is the only part of a request that carries the store's name with
   the capitalisation a person would write, so this is what stands between that and
   a tab on a shared screen. */
is('the form prefix is stripped', readName('Demo: RioPneus'), 'RioPneus');
is('capitalisation is kept exactly as typed',
   readName('Demo: HarbourGoods'), 'HarbourGoods');
is('a longer prefix is stripped too', readName('New demo: CityGym'), 'CityGym');
is('a hyphen prefix works as well as a colon', readName('Demo - CityGym'), 'CityGym');
is('a note to a colleague is not part of the name',
   readName('Demo: RioPneus, for Thursday'), 'RioPneus');
is('and neither is one after a pipe',
   readName('Demo: RioPneus | urgent'), 'RioPneus');
is('an ampersand is a real store name character',
   readName('Demo: Marks & Spencer'), 'Marks & Spencer');
is('so is an apostrophe', readName("Demo: Sainsbury's"), "Sainsbury's");
is('so are accents', readName('Demo: Café Wolf'), 'Café Wolf');
is('runs of space collapse', readName('Demo:   Rio   Pneus  '), 'Rio Pneus');

/* REFUSED RATHER THAN CLEANED UP. The generator falls back to the web address,
   which is always sane, so refusing is a real option and a bad tab title is not. */
is('an empty title is refused', readName(''), '');
is('the prefix on its own is refused', readName('Demo:'), '');
is('a title with no letters is refused', readName('Demo: 1234'), '');
is('a sentence too long for a tab is refused',
   readName('Demo: please build me a storefront for this prospect before Thursday'), '');
is('undefined is refused rather than thrown at', readName(undefined), '');

/* A store name reaches a shell in the build workflow. It is passed through the
   environment for exactly this reason, and these are the characters that make that
   necessary rather than tidy. */
for (const hostile of ['Demo: a"b', 'Demo: a`b', 'Demo: a;b', 'Demo: a|b',
                       'Demo: a$b', 'Demo: a\\b', 'Demo: a>b', 'Demo: a{b']) {
    is('shell punctuation is refused: ' + hostile, readName(hostile), '');
}

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
