/* ============================================================================
   Tests for the request parser.

     node .github/scripts/parse-request.test.mjs

   A guard that passes on an empty repository proves nothing (CLAUDE.md 4), and
   the same applies here: this parser turns text a stranger wrote into command
   line arguments, so the cases that matter are the malformed ones.
   ========================================================================== */
import { parse, readLanguage, fieldFromForm, readUrl, readSlug, readCurrency, readCsvUrl, readName,
         readImageUrl }
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

    /* EVERY LABEL THE PARSER ASKS FOR, READ OUT OF THE PARSER, against a body
       rendered from the labels the FORM really uses. Both sides come from the
       file that owns them and neither is written down here.

       This used to hold three label names by hand and render the test body from
       the form's labels, then look each one up by that same label. Rendering and
       reading with the same string round trips whatever the string is, so it
       proved only that fieldFromForm can find a heading it was just handed. The
       question that matters is the other one: does the name the PARSER passes
       find the heading the FORM writes?

       It does not, for a label carrying a suffix. The form says "Product listing
       screenshot (optional)" and the parser asks for "Product listing
       screenshot", and that field read empty on every request ever filed. It was
       not in the hand written three, so nothing looked. */
    const parser = readFileSync(new URL('./parse-request.mjs', import.meta.url), 'utf8');
    const asked = [...parser.matchAll(/fieldFromForm\(\s*body\s*,\s*'([^']+)'/g)]
        .map((match) => match[1]);
    const unique = [...new Set(asked)];

    ok('the parser looks up at least five fields, so this found the call sites',
       unique.length >= 5, unique);

    /* The body is rendered the way GITHUB renders it, from the form's own labels,
       suffixes and all. */
    const rendered = labels.map((label) => '### ' + label + '\n\nvalue-for-' + label).join('\n\n');

    for (const label of unique) {
        const got = fieldFromForm(rendered, label);
        ok('the parser\'s "' + label + '" finds the field the form renders',
           got.startsWith('value-for-'), got);
    }

    /* And every label in the form is reachable, so a field cannot be added to the
       form and then be invisible to the build. */
    for (const label of labels) {
        ok('"' + label + '" is readable from a rendered form',
           fieldFromForm(rendered, label) === 'value-for-' + label,
           fieldFromForm(rendered, label));
    }

    /* THE REAL THING, not a rendering of it. GitHub writes a pasted image as an
       <img src="..."> tag rather than markdown, which is the second half of what
       went wrong on Queima Diaria: the field has to be found AND the address has
       to be read out of a tag.

       The attachment id is made up. A real one is a v4 uuid, and the guard's
       app-guid check refuses a uuid anywhere in this repository that is not the
       sandbox application's, which is exactly what it is for: an identifier
       nobody meant to commit reads the same as one somebody did. The shape under
       test is the img tag on GitHub's asset host, and that survives the id being
       a word. */
    const asGitHubWritesIt = [
        '### Prospect website address',
        '',
        'https://www.queimadiaria.com',
        '',
        '### Product listing screenshot (optional)',
        '',
        '<img width="1613" height="708" alt="Image" ' +
        'src="https://github.com/user-attachments/assets/a-pasted-screenshot" />',
        '',
        '### Language',
        '',
        'Portuguese'
    ].join('\n');
    const shot = parse({ BODY: asGitHubWritesIt, TITLE: 'Demo: Queima Diaria' });
    is('a screenshot pasted into the form is read from the img tag',
       shot.screenshot_url,
       'https://github.com/user-attachments/assets/a-pasted-screenshot');
    is('and the rest of that request still parses', shot.url, 'https://www.queimadiaria.com');

    /* WHAT THE STORE SELLS, which only matters for a store that refuses every
       reader and then matters completely: it is the hint that decides which kind
       of catalogue gets invented. The form has asked for it from the beginning
       and nothing read it, so a fitness brand was given a department store. */
    const sold = parse({
        BODY: ['### Prospect website address', '', 'https://www.queimadiaria.com', '',
               '### What the store sells', '', 'Gym classes'].join('\n'),
        TITLE: 'Demo: Queima Diaria'
    });
    is('what the store sells is read from the form', sold.sells, 'Gym classes');

    const unsaid = parse({
        BODY: ['### Prospect website address', '', 'https://example.com', '',
               '### What the store sells', '', '_No response_'].join('\n'),
        TITLE: 'Demo: Example'
    });
    is('and an unanswered field is empty rather than the placeholder', unsaid.sells, '');

    /* It is free text a colleague typed, so it is bounded rather than validated:
       nothing is executed with it and the vertical matcher ignores what it does
       not recognise. A runaway paste is not a reason to fail a request. */
    const long = parse({
        BODY: ['### Prospect website address', '', 'https://example.com', '',
               '### What the store sells', '', 'x'.repeat(400)].join('\n'),
        TITLE: 'Demo: Example'
    });
    ok('a very long answer is cut rather than refused',
       long.sells.length === 80 && long.url === 'https://example.com', long.sells.length);
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

/* THE PASTED SCREENSHOT. GitHub writes a markdown image for a paste, and only
   its own attachment hosts are read, for the same reason the CSV rule holds. */
is('a pasted screenshot markdown is read',
   readImageUrl('![Image](https://github.com/user-attachments/assets/abc-123)'),
   'https://github.com/user-attachments/assets/abc-123');
is('a bare user-images address is read',
   readImageUrl('https://user-images.githubusercontent.com/1/shot.png'),
   'https://user-images.githubusercontent.com/1/shot.png');
is('an off-host image is refused',
   readImageUrl('![Image](https://evil.example.com/shot.png)'), '');
is('an empty field is empty', readImageUrl(''), '');
{
    const body = '### Prospect website address\n\nhttps://store.example\n\n' +
        '### Product listing screenshot\n\n' +
        '![Image](https://github.com/user-attachments/assets/shot-1)\n';
    const parsed = parse({ BODY: body });
    is('the screenshot rides the parse', parsed.screenshot_url,
       'https://github.com/user-attachments/assets/shot-1');
    const viaComment = parse({ BODY: '### Prospect website address\n\nhttps://store.example\n',
        COMMENT: 'retry ![Image](https://github.com/user-attachments/assets/shot-2)' });
    is('a retry comment can supply it', viaComment.screenshot_url,
       'https://github.com/user-attachments/assets/shot-2');
}

/* -------------------------------------------------------------------------- */
console.log('\nThe language, which the form makes mandatory');

{
    is('English is en', readLanguage('English'), 'en');
    is('Portuguese is pt', readLanguage('Portuguese'), 'pt');
    is('Russian is ru', readLanguage('Russian'), 'ru');
    /* The dropdown sends a name, and a person overriding by hand sends a code. */
    is('a code works too', readLanguage('pt'), 'pt');
    is('and is case blind', readLanguage('  RUSSIAN '), 'ru');
    /* An unanswered optional field arrives as this literal, and a manual run
       sends nothing at all. Both mean "not stated" rather than a language. */
    is('no response is not a language', readLanguage('_No response_'), '');
    is('nor is empty', readLanguage(''), '');
    is('nor is undefined', readLanguage(undefined), '');
    /* Anything unrecognised is not guessed at. parse() turns this into English. */
    is('an unknown name is refused rather than guessed', readLanguage('Klingon'), '');

    /* AND THE WHOLE PARSE DEFAULTS RATHER THAN FAILING. A request filed before
       the field existed, and every manual workflow run, carry no language. */
    const body = '### Prospect website address\n\nhttps://www.example.com\n\n' +
                 '### Language\n\nPortuguese\n';
    is('the form value reaches the parse', parse({ BODY: body }).language, 'pt');
    is('and an issue with no language field builds in English',
       parse({ BODY: '### Prospect website address\n\nhttps://www.example.com\n' }).language,
       'en');
    /* A manual run overrides the form, the same way the currency does. */
    is('a manual run wins', parse({ BODY: body, IN_LANGUAGE: 'Russian' }).language, 'ru');
}

console.log('\n   ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
