/* ============================================================================
   The five short form channels, and what each one will actually accept.

   WHY THIS FILE IS MOSTLY NUMBERS. Email is forgiving: a long subject is merely
   long. These channels are not. A push title runs out at the notification
   shade's width, an SMS silently becomes two billed messages, a WhatsApp button
   over twenty five characters is rejected at submission, and an inbox message
   with an expiry of thirty days cannot be saved. Copy that ignores those limits
   is not copy, it is a draft nobody can send.

   So every limit is declared here, once, with WHERE IT COMES FROM, because the
   three sources have very different reliability:

     dengage   stated in Dengage's own documentation. Reliable.
     meta      stated in Meta's WhatsApp template rules. Reliable, and enforced
               at submission rather than at send, so breaking one wastes an
               approval round rather than a send.
     client    where the receiving app truncates. NOT a hard limit: a longer
               string sends fine and is cut off on screen, which is worse than
               being rejected because nobody notices. These are the conservative
               end of what iOS, Android, Chrome and the notification shades show.

   A number without a source is a number somebody guessed, so there are none.
   ========================================================================== */

/* SMS LENGTH IS NOT CHARACTER COUNT. Dengage: a single SMS allows 400
   characters, and "when using non-ANSI characters each character will count as
   2". So an emoji or an accented letter costs double, and a message that looks
   short can overrun. This is the counter the whole SMS channel is measured with,
   and it is why the SMS copy below carries no emoji at all. */
export function smsCost(text) {
    let cost = 0;
    for (const character of String(text)) {
        /* The GSM range that Dengage calls ANSI. Anything outside it, emoji
           included, is charged as two. */
        cost += /^[\x20-\x7E\r\n]$/.test(character) ? 1 : 2;
    }
    return cost;
}

/* Plain character count, for every channel that is not SMS. */
export function textCost(text) {
    return [...String(text)].length;
}

/* A DENGAGE TAG COSTS WHAT IT RESOLVES TO, NOT WHAT IT LOOKS LIKE.
   "{%= $Contact.first_name =%}" is 27 characters of template and perhaps 5 of
   first name. Measuring the template would reject copy that sends perfectly, and
   measuring nothing would ship a push whose title is cut in half for anyone
   called Christopher. So a tag is replaced with a realistic worst case before
   the count: a long first name, a long product name, a long category.

   The allowances are deliberately generous. A limit met with the allowance is
   met for nearly every contact; a limit met only with a short name is not met. */
const DEFAULT_ALLOWANCE = {
    first_name: 'Christopher',
    product: 'Wireless Noise Cancelling Headphones',
    category: 'Home and Living',
    query: 'noise cancelling headphones',
    price: '1,299.00',
    code: 'WELCOME-4KJ9P',
    store: 'Northfield Outdoor'
};

/* THE ALLOWANCE HAS TO COME FROM THE DEMO, NOT FROM A GENERIC GUESS, and finding
   that out is the whole reason this parameter exists. The default product name
   above is 36 characters, which is a reasonable retail average. One real
   catalogue's names run from 56 to 120 characters with a median of 97. Measured
   against the generic allowance every push title passed; measured against that
   store's own names, three fields were over, and the sends would have been
   truncated on screen with nobody the wiser.

   So the caller passes the longest values this demo actually has. A limit met
   against the longest real name is met for every product in the catalogue. */
let ALLOWANCE = { ...DEFAULT_ALLOWANCE };

export function setAllowance(values) {
    ALLOWANCE = { ...DEFAULT_ALLOWANCE, ...(values || {}) };
}

/* A TAG THAT TRUNCATES ITSELF MUST BE MEASURED AS TRUNCATED. copy.mjs emits
   substring(0, N) inside the length critical tags, so the value that arrives is at
   most N characters plus an ellipsis however long the catalogue's name is.
   Replacing such a tag with the full allowance measures a message that cannot
   happen and reports an overrun that will never occur. So the cap written into the
   tag is read out of it and applied to the allowance. */
function capped(tag, value) {
    const match = /\.substring\(\s*0\s*,\s*(\d+)\s*\)/.exec(tag);
    if (!match) return value;
    const at = Number(match[1]);
    return value.length > at ? value.slice(0, at) + '...' : value;
}

export function resolved(text) {
    return String(text)
        /* Conditional blocks resolve to their first branch, which is the branch
           that contains the value and is therefore the longer one. */
        .replace(/\{%\s*if[^%]*%\}/g, '')
        .replace(/\{%\s*\}\s*else\s*\{\s*%\}[\s\S]*?\{%\s*\}\s*%\}/g, '')
        .replace(/\{%\s*\}\s*%\}/g, '')
        .replace(/\{%=?\s*\$Contact\.first_name\s*=?%\}/g, ALLOWANCE.first_name)
        .replace(/\{%=?[^%]*(product_name|productName)[^%]*=?%\}/g,
            (tag) => capped(tag, ALLOWANCE.product))
        .replace(/\{%=?[^%]*category[^%]*=?%\}/g,
            (tag) => capped(tag, ALLOWANCE.category))
        .replace(/\{%=?[^%]*search_query[^%]*=?%\}/g,
            (tag) => capped(tag, ALLOWANCE.query))
        .replace(/\{%=?[^%]*(unit_price|price)[^%]*=?%\}/g, ALLOWANCE.price)
        .replace(/\{%=?[^%]*\$Coupon\.code[^%]*=?%\}/g, ALLOWANCE.code)
        /* Anything else left over: a short generic value rather than zero, so an
           unrecognised tag is still counted as something. */
        .replace(/\{%[\s\S]*?%\}/g, 'value')
        .replace(/\{\{[^}]*\}\}/g, 'https://dng.link/abcdef')
        .trim();
}

/* -------------------------------------------------------------------------- */

export const CHANNELS = {
    webPush: {
        id: 'webPush',
        name: 'Web push',
        panel: 'Content > Push > Web Push, then a Push node in the flow',
        counter: textCost,
        limits: {
            title: { max: 50, source: 'client',
                     note: 'Chrome on Windows shows about this much before it truncates.' },
            body: { max: 120, source: 'client',
                    note: 'Two lines in most shades. Longer sends, and is cut off unread.' }
        },
        /* Dengage: Target URL, Badge URL (unsupported on macOS Safari), Icon
           (No Icon, Default or Custom, square up to 256x256), and Rich type adds
           Media and Action Buttons. */
        fields: ['title', 'body', 'targetUrl', 'icon', 'media', 'buttons'],
        buttons: { max: 2, label: { max: 20, source: 'client' } }
    },

    mobilePush: {
        id: 'mobilePush',
        name: 'Mobile push',
        panel: 'Content > Push > Mobile Push, then a Push node in the flow',
        counter: textCost,
        limits: {
            title: { max: 40, source: 'client',
                     note: 'iOS is the tighter of the two, so it sets the limit.' },
            body: { max: 110, source: 'client',
                    note: 'What a collapsed notification shows before it needs expanding.' }
        },
        /* Dengage: iOS carries a Subtitle and Android a Subtext; both take Sound,
           Badge and Target URL. Media is recommended under 600KB at 2:1. */
        fields: ['title', 'body', 'subtitle', 'targetUrl', 'media', 'badge', 'buttons'],
        media: { maxBytes: 600 * 1024, aspect: '2:1', source: 'dengage' },
        buttons: { max: 2, label: { max: 20, source: 'client' } }
    },

    sms: {
        id: 'sms',
        name: 'SMS',
        panel: 'Content > SMS, then an SMS node in the flow',
        counter: smsCost,
        limits: {
            body: { max: 400, source: 'dengage',
                    note: 'Non-ANSI characters count as two, so this copy carries no emoji.' }
        },
        fields: ['senderName', 'body'],
        /* Dengage documents both of these literally, and one of them has to be
           present: an opt out is mandatory. */
        unsubscribeTag: '{{unsubscribe-link}}',
        brandUnsubscribeTag: '{{brand-unsubscribe-link}}',
        shortenLinks: 'Shorten and Track Links'
    },

    whatsapp: {
        id: 'whatsapp',
        name: 'WhatsApp',
        panel: 'Content > WhatsApp, submitted to Meta for approval',
        counter: textCost,
        limits: {
            header: { max: 60, source: 'meta' },
            body: { max: 1024, source: 'meta' },
            footer: { max: 60, source: 'meta' },
            buttonLabel: { max: 25, source: 'dengage' }
        },
        fields: ['category', 'messageType', 'header', 'body', 'footer', 'buttons'],
        categories: ['Marketing', 'Utility', 'Authentication'],
        messageTypes: ['Blank Content', 'Carousel', 'Copy Coupon', 'Limited-Time Offer'],
        buttons: { max: 10, source: 'dengage' },
        /* THE TWO RULES THAT COST AN APPROVAL ROUND IF BROKEN. Dengage states
           both. The first is unusual enough to be worth encoding rather than
           remembering: a product link may not be the first or the last variable
           in the body. The second is that Meta reclassifies a Utility template
           carrying promotional content as Marketing, which changes what it may
           be sent for. */
        rules: {
            productLinkNotFirstOrLast: true,
            utilityMustNotPromote: true
        }
    },

    inbox: {
        id: 'inbox',
        name: 'App Inbox',
        panel: 'Content > Inbox Message, then an Inbox node in the flow',
        counter: textCost,
        limits: {
            title: { max: 60, source: 'client',
                     note: 'What the storefront inbox row shows on one line.' },
            body: { max: 220, source: 'client',
                    note: 'The row expands, so this is comfort rather than a cliff.' },
            /* Dengage, and it is a hard one: the campaign node's Expiry offers a
               duration or a fixed date and "the maximum is 7 days". Any journey
               that assumed an inbox message persists indefinitely is wrong. */
            expiryDays: { max: 7, source: 'dengage' },
            priority: { min: 1, max: 5, source: 'dengage' }
        },
        fields: ['title', 'body', 'image', 'buttons', 'expiryDays', 'priority']
    },

    onsite: {
        id: 'onsite',
        name: 'On-site',
        panel: 'Content > Onsite, placed by an Onsite campaign with targeting filters',
        counter: textCost,
        limits: {
            heading: { max: 48, source: 'client',
                       note: 'Fits one line in the shared templates at mobile width.' },
            body: { max: 140, source: 'client' },
            cta: { max: 24, source: 'client' }
        },
        fields: ['template', 'heading', 'body', 'cta'],
        /* THE ONE CHANNEL WHOSE COPY MUST STAY GENERIC, and it is a repository
           rule rather than a platform limit. The on-site creatives are SHARED by
           every live demo (CLAUDE.md 7), so naming a product, a price, a brand or
           a vertical in one of them names it on every demo at once, including
           demos already in front of a prospect. Personalisation on this channel
           comes from the TARGETING, which is per demo and per page, rather than
           from the words.

           messages.test.mjs asserts this rather than trusting it. */
        mustStayGeneric: true
    }
};

export const CHANNEL_ORDER = ['webPush', 'mobilePush', 'sms', 'whatsapp', 'inbox', 'onsite'];

/* One measurement, with everything a report needs to explain a failure. */
export function measure(channel, field, text) {
    const limit = channel.limits[field];
    if (!limit || limit.max === undefined) return null;
    const value = resolved(text);
    const cost = channel.counter(value);
    return {
        field, cost, max: limit.max, source: limit.source,
        over: cost > limit.max,
        resolvedTo: value
    };
}
