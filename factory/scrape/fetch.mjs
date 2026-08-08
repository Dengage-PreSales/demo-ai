/* ============================================================================
   HTTP for the scraper: one place that decides how this repository talks to a
   prospect's website.

   Everything the generator fetches goes through here, for three reasons that
   each cost something if they are spread out instead.

   ROBOTS IS RESPECTED, AND THAT IS A DECISION RATHER THAN AN OVERSIGHT.
   Salil's call, handoff 7.1. It costs some sites, and those fall through to the
   CSV tier. The check belongs at the fetch layer rather than in each tier,
   because a rule enforced in three places is a rule enforced in two places
   eventually.

   THE SCRAPE RUNS FROM A GITHUB ACTIONS IP. Some sites block cloud ranges
   outright, some rate limit, some are simply slow. So every request has a
   timeout and a small retry, and a refusal is reported as a REASON rather than
   thrown as an error: the caller has to be able to tell "this site said no" from
   "this site is broken", because the first falls through to the next tier and the
   second is worth reporting to the person who opened the issue.

   THIS LAYER READS TEXT: JSON, HTML, XML and CSS. Product images ARE downloaded
   since 8 August 2026 (handoff 7.3, reversed by Salil), but binary fetching
   lives in factory/scrape/images.mjs with its own size caps and content type
   checks, and it imports allowed() and UA from here so the robots decision and
   the honest user agent hold in one place for both kinds of request.
   ========================================================================== */

/* Identifies the factory honestly. A scraper that pretends to be a browser is
   asking to be treated as one, and this one wants to be told no when the answer
   is no, so it can fall through to the next tier rather than be quietly served a
   bot challenge page it would then try to parse. */
const UA = 'Mozilla/5.0 (compatible; DengageDemoFactory/1.0; +https://dengage-presales.github.io/demo-ai/)';

const TIMEOUT_MS = 20000;
const RETRIES = 2;

/* A catalogue page is JSON and a sitemap is XML, so neither is large. The cap
   exists so a misidentified URL cannot pull a video into memory on a runner. */
const MAX_BYTES = 8 * 1024 * 1024;

/* Reasons a fetch can fail, as data rather than prose, because the workflow
   turns them into a message a salesperson reads. */
export const REASON = {
    BLOCKED: 'blocked',        /* 401, 403, 429, or a bot challenge */
    NOT_FOUND: 'not-found',    /* 404 or 410: this route does not exist here */
    ROBOTS: 'robots',          /* robots.txt disallows it */
    NETWORK: 'network',        /* DNS, TLS, timeout, connection reset */
    SERVER: 'server',          /* 5xx */
    TOO_BIG: 'too-big',
    WRONG_TYPE: 'wrong-type'   /* asked for JSON, got HTML */
};

function classify(status) {
    if (status === 404 || status === 410) return REASON.NOT_FOUND;
    if (status === 401 || status === 403 || status === 429) return REASON.BLOCKED;
    if (status >= 500) return REASON.SERVER;
    return REASON.BLOCKED;
}

/* WHAT A CALLER MEANS BY accept IS A PREFERENCE, NEVER AN EXCLUSION.

   Tiers ask for what they want to parse: 'text/html' for a category page,
   'application/json' for a products.json route, 'text/plain' for robots.txt.
   Sent verbatim, 'Accept: text/html' is a strictly narrower request than any
   browser makes, and at least one CDN answers it with a 500. Isolated against
   one real store, same URL, same agent, one header apart:

     Accept: text/html                        ->  500
     Accept: text/html then the wildcard      ->  200, 940KB
     Accept: the wildcard alone               ->  200, 940KB
     Accept: a browser's own full string      ->  200, 940KB

   The store was perfectly readable and the factory had declared it unreadable,
   which is the worst failure this layer has: a salesperson is told to go and
   find a CSV for a site that would have built itself.

   So a preference is expressed the way a browser expresses one, with the
   wildcard trailing at a lower q. Nothing downstream loosens as a result: the
   type is still checked AFTER the response in getJson and robots, which is
   where a wrong body was always caught, rather than being wished away by the
   request header. */
export function acceptHeader(accept) {
    if (!accept) return '*/*';
    if (accept.includes('*')) return accept;
    if (accept === 'text/html') {
        return 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
    }
    return accept + ',*/*;q=0.8';
}

/* Every call answers with the same shape, so no caller has to remember whether
   this one throws. { ok: true, ... } or { ok: false, reason, status }. */
function fail(reason, status, detail) {
    return { ok: false, reason, status: status || 0, detail: detail || '' };
}

async function once(url, accept) {
    const control = new AbortController();
    const timer = setTimeout(() => control.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            redirect: 'follow',
            signal: control.signal,
            headers: { 'user-agent': UA, accept: acceptHeader(accept) }
        });
        if (!response.ok) return fail(classify(response.status), response.status);

        const length = Number(response.headers.get('content-length') || 0);
        if (length > MAX_BYTES) return fail(REASON.TOO_BIG, response.status);

        const body = await response.text();
        if (body.length > MAX_BYTES) return fail(REASON.TOO_BIG, response.status);

        return {
            ok: true,
            status: response.status,
            url: response.url,
            type: (response.headers.get('content-type') || '').toLowerCase(),
            body
        };
    } catch (err) {
        /* An abort is a timeout here, and a timeout is worth distinguishing from
           a refusal: a slow site may answer on the retry, a refusal will not. */
        return fail(REASON.NETWORK, 0, err.name === 'AbortError' ? 'timeout' : err.message);
    } finally {
        clearTimeout(timer);
    }
}

/* Retries only what retrying can fix. A 403 is an answer and repeating the
   question does not change it; a timeout or a 502 might. */
function worthRetrying(result) {
    return result.reason === REASON.NETWORK || result.reason === REASON.SERVER;
}

async function withRetry(url, accept) {
    let result = await once(url, accept);
    for (let attempt = 1; attempt <= RETRIES && !result.ok && worthRetrying(result); attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
        result = await once(url, accept);
    }
    return result;
}

/* -------------------------------------------------------------------------- */
/* robots.txt                                                                 */

/* Parsed once per origin and kept, because a sitemap crawl asks about dozens of
   paths and re-fetching robots.txt for each would be both slow and rude. */
const robotsCache = new Map();

/* Only the groups that apply to us: the wildcard agent and our own name. A
   group for Googlebot is not ours to obey or to disobey. */
export function parseRobots(text) {
    const rules = [];
    const sitemaps = [];
    let applies = false;

    for (const raw of text.split(/\r?\n/)) {
        const line = raw.replace(/#.*$/, '').trim();
        if (!line) continue;
        const split = line.indexOf(':');
        if (split === -1) continue;
        const field = line.slice(0, split).trim().toLowerCase();
        const value = line.slice(split + 1).trim();

        if (field === 'sitemap') { sitemaps.push(value); continue; }
        if (field === 'user-agent') {
            const agent = value.toLowerCase();
            applies = agent === '*' || agent.includes('dengagedemofactory');
            continue;
        }
        if (!applies) continue;
        if (field === 'allow' || field === 'disallow') {
            rules.push({ allow: field === 'allow', path: value });
        }
    }
    return { rules, sitemaps };
}

/* robots.txt wildcards: * matches any run of characters, $ anchors the end.
   Everything else is a literal prefix match. */
function toMatcher(pattern) {
    const anchored = pattern.endsWith('$');
    const body = anchored ? pattern.slice(0, -1) : pattern;
    const source = body.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp('^' + source + (anchored ? '$' : ''));
}

/* The longest matching rule wins, and Allow beats Disallow at equal length.
   That is the documented precedence, and it matters: a site that disallows /
   and allows /products/ is inviting exactly the crawl this does. */
export function decide(rules, path) {
    let best = null;
    for (const rule of rules) {
        if (!toMatcher(rule.path).test(path)) continue;
        if (!best || rule.path.length > best.path.length ||
            (rule.path.length === best.path.length && rule.allow)) {
            best = rule;
        }
    }
    /* An empty Disallow value means "nothing is disallowed", so it never blocks. */
    if (best && !best.allow && best.path === '') return true;
    return best ? best.allow : true;
}

export async function robots(origin) {
    if (robotsCache.has(origin)) return robotsCache.get(origin);

    const result = await withRetry(origin + '/robots.txt', 'text/plain');
    /* NO robots.txt MEANS NO RESTRICTIONS, which is the standard's own answer and
       not a loophole. A site that cannot serve robots.txt at all is a different
       case from one that serves a restrictive one, and treating the first as the
       second would refuse to read most small stores. */
    const parsed = result.ok && /text\/plain|text\/|^$/.test(result.type)
        ? parseRobots(result.body)
        : { rules: [], sitemaps: [], missing: true };

    robotsCache.set(origin, parsed);
    return parsed;
}

export async function allowed(url) {
    const parsed = new URL(url);
    const rules = await robots(parsed.origin);
    return decide(rules.rules, parsed.pathname + parsed.search);
}

/* -------------------------------------------------------------------------- */
/* The one entry point                                                        */

/* get() is robots-aware. Every tier calls this rather than fetch, so the rule
   holds without each tier remembering it. */
export async function get(url, accept) {
    if (!(await allowed(url))) return fail(REASON.ROBOTS, 0, url);
    return withRetry(url, accept);
}

/* -------------------------------------------------------------------------- */
/* Streaming, for sitemaps                                                    */

/* A LARGE RETAILER'S SITEMAP IS BIGGER THAN THE WHOLE CATALOGUE THIS READS.
   One national site serves a single locale sitemap over 8MB, and the sitemap
   protocol permits 50MB uncompressed. Reading that into a string to take the
   first forty URLs out of it is the wrong shape twice: it can exhaust a runner,
   and it waits for megabytes nobody needs.

   So a sitemap is read as a stream and abandoned the moment `enough` is
   satisfied. The cap stays as a backstop for a response that never satisfies it.
   Aborting mid response is deliberate and is why the AbortController is shared
   with the timeout: the connection is closed rather than left draining. */
export async function getStream(url, accept, enough) {
    if (!(await allowed(url))) return fail(REASON.ROBOTS, 0, url);

    const control = new AbortController();
    const timer = setTimeout(() => control.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            redirect: 'follow',
            signal: control.signal,
            headers: { 'user-agent': UA, accept: acceptHeader(accept) }
        });
        if (!response.ok) return fail(classify(response.status), response.status);
        if (!response.body) return fail(REASON.NETWORK, response.status, 'no body');

        const decoder = new TextDecoder('utf-8');
        let text = '';
        let truncated = false;

        for await (const chunk of response.body) {
            text += decoder.decode(chunk, { stream: true });
            if (enough && enough(text)) { truncated = true; break; }
            if (text.length > MAX_BYTES) { truncated = true; break; }
        }
        try { control.abort(); } catch (err) { /* already finished */ }

        return {
            ok: true, status: response.status, url: response.url, truncated,
            type: (response.headers.get('content-type') || '').toLowerCase(),
            body: text
        };
    } catch (err) {
        return fail(REASON.NETWORK, 0, err.name === 'AbortError' ? 'timeout' : err.message);
    } finally {
        clearTimeout(timer);
    }
}

export async function getJson(url) {
    const result = await get(url, 'application/json');
    if (!result.ok) return result;
    /* A store with no products.json route often serves its 404 page with a 200,
       so the content type is checked before the parse rather than after it
       throws. */
    if (!result.type.includes('json')) return fail(REASON.WRONG_TYPE, result.status, result.type);
    try {
        return { ok: true, status: result.status, url: result.url, data: JSON.parse(result.body) };
    } catch (err) {
        return fail(REASON.WRONG_TYPE, result.status, 'unparseable json');
    }
}

export { UA };
