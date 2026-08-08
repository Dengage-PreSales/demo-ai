/* ============================================================================
   Reads a demo request out of an issue form, a retry comment, or a manual run,
   and writes the fields as GitHub Actions outputs.

     node .github/scripts/parse-request.mjs >> "$GITHUB_OUTPUT"

   THIS IS A SEPARATE FILE SO IT CAN BE TESTED. The obvious place for it is a run
   block inside the workflow, and that is exactly where it cannot be exercised
   without opening an issue to see what happens. It has a test beside it, and the
   parser has already been wrong in ways only a test would show.

   THE ISSUE BODY IS UNTRUSTED TEXT. Anyone who can open an issue writes it, and
   what comes out of here becomes command line arguments. So every field is
   validated against a narrow pattern and dropped if it does not match, rather
   than passed along and hoped about:

     url        must parse as http or https, and nothing else
     slug       lowercase letters, digits and hyphens only
     currency   exactly three letters
     csv_url    must be a github attachment address

   A field that fails is dropped rather than reported, because a request with a
   malformed optional field is still a request: the URL is the only one that
   matters, and the generator works the rest out for itself.
   ========================================================================== */

/* GitHub renders an issue form as markdown: each field becomes an h3 with the
   label, then the value, then a blank line. A field left empty renders as the
   literal "_No response_", which is the trap here: read naively it becomes the
   value, and a slug of "_No response_" fails validation while a note of it ends
   up in a summary. */
const EMPTY = /^_no response_$/i;

export function fieldFromForm(body, label) {
    if (!body) return '';
    const lines = String(body).replace(/\r\n/g, '\n').split('\n');
    const heading = new RegExp('^###\\s+' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'i');

    let index = lines.findIndex((line) => heading.test(line.trim()));
    if (index === -1) return '';

    const collected = [];
    for (let i = index + 1; i < lines.length; i++) {
        const line = lines[i];
        if (/^###\s+/.test(line.trim())) break;
        collected.push(line);
    }
    const value = collected.join('\n').trim();
    return EMPTY.test(value) ? '' : value;
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */

export function readUrl(text) {
    if (!text) return '';
    /* A form field can arrive as a bare domain, as a markdown link, or wrapped in
       angle brackets by a mail client. All three are the same request. */
    let candidate = String(text).trim()
        .replace(/^<|>$/g, '')
        .replace(/^\[.*?\]\((.*?)\)$/, '$1')
        .split(/\s+/)[0];
    if (!/^https?:\/\//i.test(candidate)) candidate = 'https://' + candidate.replace(/^\/+/, '');
    try {
        const url = new URL(candidate);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
        if (!url.hostname.includes('.')) return '';
        return url.origin;
    } catch (err) {
        return '';
    }
}

export function readSlug(text) {
    const slug = String(text || '').trim().toLowerCase();
    return /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug) ? slug : '';
}

export function readCurrency(text) {
    const code = String(text || '').trim().toUpperCase();
    return /^[A-Z]{3}$/.test(code) ? code : '';
}

/* THE STORE'S NAME, TAKEN FROM WHAT A PERSON TYPED. The issue title is the only
   place in a request that carries the store's name with its real capitalisation:
   a domain gives riopneus and a person gives RioPneus, and the second is what
   belongs in a browser tab on a shared screen.

   The "Demo:" prefix is the issue form's own, so it is stripped rather than
   shipped. Anything a title carries after a separator is a note to a colleague
   ("Demo: RioPneus, for Thursday") and is not part of the name.

   REFUSED RATHER THAN CLEANED UP when it does not look like a name. The generator
   falls back to the web address, which is always present and always sane, and a
   title of "asdf" or a 90 character sentence is worse in a tab than a plain
   domain. */
export function readName(text) {
    const name = String(text || '')
        .replace(/^\s*(demo|new demo|demo request)\s*[:\-]\s*/i, '')
        /* A comma needs no space in front of it to be a separator, which the first
           version required, so "RioPneus, for Thursday" arrived whole. A trailing
           ", Inc." is lost with it, and a tab reading the store's name without its
           legal suffix is the better of the two outcomes. */
        .split(/\s*[|;]\s*|,\s+|\s+-\s+/)[0]
        .replace(/\s+/g, ' ')
        .trim();
    if (name.length < 2 || name.length > 40) return '';
    /* A letter has to be in there somewhere, and the characters a store name
       actually uses are letters, digits, spaces and a small amount of
       punctuation. Anything else is a sentence or a paste accident. */
    if (!/[a-z]/i.test(name)) return '';
    return /^[\p{L}\p{N} .,'&+()/-]+$/u.test(name) ? name : '';
}

/* GitHub rewrites an attachment into its own asset host, so only that host is
   accepted. Fetching an arbitrary URL because an issue comment contained one is
   how a workflow becomes somebody else's download client. */
const ATTACHMENT = /https:\/\/(?:github\.com\/user-attachments\/files\/[^\s)"']+|objects\.githubusercontent\.com\/[^\s)"']+)/i;

export function readCsvUrl(text) {
    if (!text) return '';
    const match = String(text).match(ATTACHMENT);
    if (!match) return '';
    /* Markdown puts the link inside (), and a trailing paren is not part of it. */
    return match[0].replace(/[),.]+$/, '');
}

/* -------------------------------------------------------------------------- */

export function parse(env) {
    const body = env.BODY || '';
    const comment = env.COMMENT || '';

    /* A manual run wins where it is given, because that is someone deliberately
       overriding the form. */
    const url = readUrl(env.IN_URL) || readUrl(fieldFromForm(body, 'Prospect website address'));
    const slug = readSlug(env.IN_SLUG) || readSlug(fieldFromForm(body, 'Short name for the address'));
    const currency = readCurrency(env.IN_CURRENCY) ||
                     readCurrency(fieldFromForm(body, 'Currency'));
    /* From the issue title only. There is no form field for it, deliberately:
       asking for the store's name when the title already says it is one more box
       between a colleague and a demo. */
    const name = readName(env.IN_NAME) || readName(env.TITLE);

    /* The CSV only ever comes from a comment. Reading it from the issue body too
       would let the first submission skip tiers 1 and 2, and tier 3 is meant to
       stay an exception rather than become the normal route. */
    const csvUrl = readCsvUrl(comment);

    return { url, slug, currency, name, csv_url: csvUrl };
}

/* Only runs as a script, so the test can import the functions above. */
if (import.meta.url === `file://${process.argv[1]}`) {
    const fields = parse(process.env);
    if (!fields.url) {
        console.error('No usable website address was found in this request.');
        process.exit(1);
    }
    for (const [name, value] of Object.entries(fields)) {
        console.log(name + '=' + value);
    }
}
