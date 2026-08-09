/* ============================================================================
   A BeeFree template, generated per demo, for uploading straight into the Email
   Builder.

     import { beefreeAbandonedCart } from './beefree.mjs';
     const template = beefreeAbandonedCart({ palette, storeName, storeUrl, ... });

   WHY A GENERATOR RATHER THAN A TEMPLATE TO PICK FROM. Dengage's Email Builder is
   BeeFree, and it imports its own JSON. That import is the only route by which a
   demo's actual brand colour, actual typeface and actual currency arrive in an email
   without anybody styling anything: choosing a stock template means restyling it by
   hand on every build, which is the one thing this factory exists not to do.

   IT IS DELIBERATELY SHORT. Masthead, one line of copy, the basket, the total, one
   button, a footer. Eight rows, and every one of them is a block a salesperson can
   point at and explain in a sentence. A long template demonstrates BeeFree; a short
   one demonstrates that the products in it came from the visitor's own basket, which
   is the thing being sold.

   THE TWO DYNAMIC CONTENT BLOCKS ARE THE POINT OF THE WHOLE FILE. Everything else is
   scaffolding around them. Pass their snippet ids and the template arrives finished;
   pass nothing and each one arrives as a labelled dashed box saying which asset goes
   there, because Dengage assigns snippet_id when an asset is saved and nothing here
   can know it in advance.
   ========================================================================== */

/* BeeFree's own module type names. Wrong here and the import is rejected or, worse,
   accepted with the block dropped, so they are named once. */
const TEXT = 'mailup-bee-newsletter-modules-text';
const HTML = 'mailup-bee-newsletter-modules-html';
const BUTTON = 'mailup-bee-newsletter-modules-button';
const DIVIDER = 'mailup-bee-newsletter-modules-divider';
const IMAGE = 'mailup-bee-newsletter-modules-image';

const WIDTH = 600;

/* Deterministic ids, because two builds of one demo have to produce the same file.
   BeeFree wants uniqueness within the document and nothing more, so a counter is
   enough and a random uuid would only make the output impossible to diff. */
function ids(prefix) {
    let n = 0;
    return () => prefix + '-' + String(++n).padStart(2, '0');
}

function pad(top, right, bottom, left) {
    return {
        'padding-top': top + 'px',
        'padding-right': right + 'px',
        'padding-bottom': bottom + 'px',
        'padding-left': left + 'px'
    };
}

function textModule(uuid, palette, html, style) {
    const size = (style && style.size) || 15;
    return {
        type: TEXT,
        uuid,
        descriptor: {
            text: {
                computedStyle: { linkColor: (style && style.linkColor) || palette.brandText },
                html: '<div class="txtTinyMce-wrapper" style="font-family:' + palette.body +
                      ';font-size:' + size + 'px;line-height:' + ((style && style.leading) || 1.6) +
                      ';color:' + ((style && style.colour) || palette.text) + ';">' + html + '</div>',
                style: {
                    color: (style && style.colour) || palette.text,
                    'font-family': palette.body,
                    'font-size': size + 'px',
                    'line-height': String((style && style.leading) || 1.6)
                }
            },
            style: Object.assign(
                { 'text-align': (style && style.align) || 'left' },
                pad((style && style.top) || 0, 24, (style && style.bottom) || 0, 24)
            ),
            computedStyle: { hideContentOnMobile: false }
        }
    };
}

/* AN HTML MODULE, WHICH IS THE ONLY MODULE THAT LEAVES ITS CONTENT ALONE. A text
   module runs its content through the rich text editor, and a Dengage tag put through
   that comes out escaped or reflowed. So both Dynamic Content blocks are HTML
   modules, and that is not a stylistic choice. */
function htmlModule(uuid, palette, html, bottom) {
    return {
        type: HTML,
        uuid,
        descriptor: {
            html: {
                html,
                style: { 'font-family': palette.body, 'font-size': '15px' },
                computedStyle: { hideContentOnMobile: false }
            },
            /* NO SIDE PADDING HERE ON PURPOSE. BeeFree does not apply it to an HTML
               block, and themed() puts it inside the content where it does apply, so
               declaring it in both places would leave two sources and no way to tell
               which one a client honoured. */
            style: pad(0, 0, bottom === undefined ? 0 : bottom, 0),
            computedStyle: { hideContentOnMobile: false }
        }
    };
}

function buttonModule(uuid, palette, label, href, align) {
    return {
        type: BUTTON,
        uuid,
        descriptor: {
            button: {
                label,
                href,
                style: {
                    'background-color': palette.brand,
                    'border-bottom': '0px solid transparent',
                    'border-left': '0px solid transparent',
                    'border-radius': palette.radius + 'px',
                    'border-right': '0px solid transparent',
                    'border-top': '0px solid transparent',
                    color: palette.onBrand,
                    direction: 'ltr',
                    'font-family': palette.body,
                    'font-size': '16px',
                    'font-weight': '700',
                    'line-height': '120%',
                    'max-width': '100%',
                    'padding-bottom': '14px',
                    'padding-left': '30px',
                    'padding-right': '30px',
                    'padding-top': '14px',
                    width: 'auto'
                },
                computedStyle: { width: 'auto', hideContentOnMobile: false }
            },
            style: Object.assign({ 'text-align': align || 'left' }, pad(0, 24, 0, 24)),
            computedStyle: { hideContentOnMobile: false }
        }
    };
}

/* FULL BLEED BY DEFAULT, which is the whole reason an image module is worth having
   rather than an HTML module with an img in it: BeeFree scales it to the column and the
   builder gives it a picker, so the hero can be swapped on a call without leaving the
   editor. No side padding, so 600px of image meets 600px of column. */
function imageModule(uuid, src, alt, href, width) {
    return {
        type: IMAGE,
        uuid,
        descriptor: {
            image: {
                alt: alt || '',
                href: href || '',
                src,
                width: (width || WIDTH) + 'px',
                dynamicSrc: ''
            },
            style: Object.assign({ 'text-align': 'center', width: '100%' }, pad(0, 0, 0, 0)),
            computedStyle: {
                class: 'center autowidth fullwidth',
                width: (width || WIDTH) + 'px',
                hideContentOnMobile: false
            }
        }
    };
}

function dividerModule(uuid, palette) {
    return {
        type: DIVIDER,
        uuid,
        descriptor: {
            divider: { style: { 'border-top': '1px solid ' + palette.edge, width: '100%' } },
            style: Object.assign({ 'text-align': 'center' }, pad(0, 24, 0, 24)),
            computedStyle: { align: 'center', hideContentOnMobile: false }
        }
    };
}

function row(uuid, palette, columns, options) {
    const o = options || {};
    return {
        type: columns.length === 2 ? 'two-columns-empty' : 'one-column-empty',
        uuid,
        container: { style: { 'background-color': o.behind || 'transparent' } },
        content: {
            computedStyle: { rowColStackOnMobile: true, rowReverseColStackOnMobile: false },
            style: {
                'background-color': o.ground || palette.card,
                color: palette.text,
                width: WIDTH + 'px'
            }
        },
        columns: columns.map((modules, index) => ({
            'grid-columns': columns.length === 2 ? 6 : 12,
            modules,
            style: Object.assign(
                {
                    'background-color': 'transparent',
                    'border-bottom': '0px solid transparent',
                    'border-left': '0px solid transparent',
                    'border-right': '0px solid transparent',
                    'border-top': '0px solid transparent'
                },
                pad(o.top === undefined ? 20 : o.top, 0,
                    o.bottom === undefined ? 20 : o.bottom, 0)
            ),
            uuid: uuid + '-c' + (index + 1)
        }))
    };
}

/* A Dynamic Content block. WITH AN ID it is the real tag and the template is
   finished on upload. WITHOUT ONE it is a dashed box naming the asset, which is what
   the builder shows a person who then clicks it and picks the asset from the list.

   The placeholder is not a comment, deliberately. An HTML comment is invisible in the
   builder, so the block reads as an empty template rather than as a spot with a job.

   IT IS WRAPPED IN A DIV THAT CARRIES THE TYPEFACE AND THE SIDE PADDING, and that
   wrapper is the fix for the two things that looked wrong in real sends. Both have the
   same cause: BEEFREE DECORATES A BLOCK, BUT NOT AN HTML BLOCK. It writes a typeface
   inline on every other block and puts padding on a td around it, and it does neither
   for raw HTML, which it passes through untouched.

   So a module's own descriptor.style is not an ancestor of what an HTML module contains,
   and two things followed from assuming it was:

     1. The assets style themselves font-family:inherit, because one asset serves every
        demo and an explicit family would beat whatever the email said. With nothing above
        them declaring one, inherit resolved to the client default and every product name
        came out in Times under a sans headline.
     2. The module's 24px of side padding never applied either, so the totals table sat
        flush against both edges of the email while the text blocks were inset. The
        product cards escaped notice only because their content is centred, so they looked
        inset when they were not.

   A div written into the block's own content is an ancestor, because it is inside the
   snippet's own document. So it carries both, and the module itself carries neither: one
   source for each rather than two that can disagree about which one applied. */
const GUTTER = 24;

function themed(palette, inner) {
    return '<div style="font-family:' + palette.body + ';font-size:15px;line-height:1.6;' +
        'color:' + palette.text + ';padding:0 ' + GUTTER + 'px;">' + inner + '</div>';
}

function dynamicBlock(palette, asset, id, describe) {
    if (id) {
        return themed(palette,
            '<snippet snippet_id="' + id + '" snippet_name="' + asset + '"></snippet>');
    }
    return themed(palette,
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ' +
        'style="border-collapse:collapse;"><tr><td style="border:2px dashed ' + palette.edge +
        ';border-radius:' + palette.radius + 'px;padding:22px 20px;text-align:center;' +
        'font-family:' + palette.body + ';font-size:13px;line-height:1.6;color:' +
        palette.quiet + ';">' +
        '<strong style="color:' + palette.text + ';font-size:14px;">Dynamic Content: ' +
        asset + '</strong><br>' + describe +
        '<br>Click this block, clear it, then use Insert &gt; Dynamic Content.' +
        '</td></tr></table>');
}

/* A Google Fonts entry, so the builder previews the demo's own typeface rather than
   its fallback. Only for the face the theme actually named: guessing a URL for a font
   nobody asked for would load nothing and say it loaded something. */
function webFonts(theme, palette) {
    const names = [theme && theme.displayFont, theme && theme.bodyFont]
        .filter((name) => typeof name === 'string' && name.trim() !== '');
    const unique = [];
    for (const name of names) if (unique.indexOf(name) === -1) unique.push(name);
    return unique.map((name) => ({
        name,
        fontFamily: "'" + name + "', " + palette.body,
        url: 'https://fonts.googleapis.com/css2?family=' +
            encodeURIComponent(name).replace(/%20/g, '+') +
            ':wght@400;600;700&display=swap'
    }));
}

export function beefreeAbandonedCart(options) {
    const {
        palette, theme = {}, snippets = {}, heroImage = ''
    } = options;

    const uid = ids('dps-cart');
    const rows = [];

    /* A THEME WHOSE PAGE AND SURFACE ARE THE SAME COLOUR, which several are. The band
       grounds below are the only thing drawing the card, so on such a theme every band
       is the same colour and the masthead, the content and the footer run together into
       one flat block. A hairline replaces the edge the colour change would have made.
       Checked rather than assumed: emailPalette returns whatever the theme gave it. */
    const flat = String(palette.card).toLowerCase() === String(palette.canvas).toLowerCase();
    const hairline = () => rows.push(
        row(uid(), palette, [[dividerModule(uid(), palette)]], { top: 0, bottom: 0 }));

    /* 1. THE PREHEADER, hidden. It is the grey line an inbox shows beside the subject,
       and with nothing in it the client picks the first words it can find, which here
       would be "Dengage eComm Demo". Standard practice, and it is real text in a real
       module rather than a trick: display:none plus a zero height, which every client
       that shows a preview reads and every client that renders the body skips. */
    rows.push(row(uid(), palette, [[
        textModule(uid(), palette,
            '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">' +
            'Your basket is saved. Here is what is still in it.</div>',
            { size: 1, colour: palette.canvas })
    ]], { ground: palette.canvas, top: 0, bottom: 0 }));

    /* 2. THE MASTHEAD, AND IT NAMES NOBODY BUT DENGAGE.

       IT USED TO CARRY THE STORE'S NAME AND A CATEGORY NAV BUILT FROM THAT DEMO'S
       TAXONOMY, and that is what this row is now deliberately without. The reason is a
       split in timing rather than taste: this template's chrome is baked when a demo is
       built, as literal text and literal hex, because an email carries no custom
       properties and no stylesheet. The basket inside it is resolved when the email is
       sent, from whichever storefront the visitor last touched. So a template themed and
       named for one demo can wrap another demo's basket, and it did: a Techiestore
       masthead and a laptop nav around four garments, over the line "All prices in
       (INR)" against dollar prices.

       A shell that names no store cannot contradict a basket. That is the whole design,
       Salil's call, 9 August 2026, and it buys something else worth having: one template
       imported once ever and one campaign, rather than one of each per demo. */
    rows.push(row(uid(), palette, [[
        textModule(uid(), palette,
            '<strong style="font-family:' + palette.display + ';font-size:18px;color:' +
            palette.canvasText + ';letter-spacing:-0.01em;">Dengage</strong>' +
            '<span style="font-size:12px;color:' + palette.canvasQuiet + ';padding-left:6px;">' +
            'eComm Demo</span>',
            { size: 18, colour: palette.canvasText })
    ]], { ground: palette.canvas, top: 24, bottom: 24 }));

    if (flat) hairline();

    /* 3. THE HERO, in the standard Dengage palette rather than a prospect's. Same
       reasoning as the masthead: a brand colour is as much a claim about whose email
       this is as a name. Full bleed, and it carries no text, so the email still reads
       with images blocked. */
    if (heroImage) {
        rows.push(row(uid(), palette, [[
            imageModule(uid(), heroImage, 'Your saved basket')
        ]], { top: 0, bottom: 0 }));
    }

    /* 4. One headline and one line of copy. No paragraph explaining the offer,
       because there is no offer: the products are the message. */
    rows.push(row(uid(), palette, [[
        textModule(uid(), palette,
            '<span style="font-family:' + palette.display + ';font-size:28px;font-weight:700;' +
            'line-height:1.2;color:' + palette.text + ';">Still thinking it over?</span>',
            { size: 28, leading: 1.2, bottom: 12 }),
        textModule(uid(), palette,
            'Everything you added is still saved. Here is what is waiting in your basket.',
            { size: 15, colour: palette.quiet })
    ]], { top: 36, bottom: 30 }));

    /* 5. THE BASKET. */
    rows.push(row(uid(), palette, [[
        htmlModule(uid(), palette,
            dynamicBlock(palette, 'dps abandoned cart', snippets.items,
                'The visitor\'s own basket, resolved from their cart events.'))
    ]], { top: 0, bottom: 10 }));

    /* 6. THE SUMMARY, on the wash so it reads as a summary rather than another product.

       IT CARRIES THE BUTTON TOO, and that is forced by the shell being shared. A basket
       link needs a demo in it, and a BeeFree button module holds one literal href, so in
       a template that serves every demo it could only ever point at the wrong storefront
       or at nothing. The saved asset already works out which demo the basket belongs to,
       so it is the only thing in this email that can address the right basket. It also
       means the totals and the way back to them can never disagree, since both come out
       of one pass over the same rows. */
    rows.push(row(uid(), palette, [[
        htmlModule(uid(), palette,
            dynamicBlock(palette, 'dps abandoned cart total', snippets.total,
                'The subtotal, the total and the button back to that basket.'))
    ]], { ground: palette.wash, top: 26, bottom: 28 }));

    /* 7. THE RECOMMENDATIONS, which are the storefront's own rail rather than a new
       idea. template/js/recommend.js computes five strategies in the browser from the
       demo's own catalogue, and it says why: the Dengage engine is fed per application
       and every demo shares one, so an engine rail would offer a fashion prospect
       phones. An email cannot run that JavaScript, so the asset runs the same strategy
       against dps_product instead, and uses the same label the site uses.

       Same cards as the basket, so the two blocks read as one email rather than two
       stitched together. It renders nothing at all when it cannot find at least two
       products, because half a rail is worse than none. */
    rows.push(row(uid(), palette, [[
        htmlModule(uid(), palette,
            dynamicBlock(palette, 'dps recommendations', snippets.recommendations,
                'More from the categories the basket is in, ranked the way the storefront ranks them.'))
    ]], { top: 0, bottom: 0 }));

    /* 8. THE ONE LINE OF URGENCY THAT IS TRUE. A countdown, a reserved basket or a
       discount that expires would all be invented, and a prospect can see through
       every one of them. What is genuinely true of any store is that a basket is not a
       reservation, and saying so is the honest version of the same nudge. */
    rows.push(row(uid(), palette, [[
        textModule(uid(), palette,
            'Prices and availability can change, and a basket is not a reservation.',
            { size: 12, align: 'center', colour: palette.quiet })
    ]], { top: 24, bottom: 30 }));

    if (flat) hairline();

    /* 9. The footer, back on the canvas, closing the card.

       NO LINK TO THE STORE, for the same reason the masthead has no name: there is no
       one storefront this email belongs to until it is sent. The unsubscribe is the one
       thing that genuinely should be here and is not, because no unsubscribe URL or tag
       for this account is known yet. It goes in as soon as one is. */
    rows.push(row(uid(), palette, [[
        textModule(uid(), palette,
            '<strong style="font-family:' + palette.display + ';font-size:13px;color:' +
            palette.canvasText + ';">Dengage</strong>' +
            '<span style="font-size:12px;color:' + palette.canvasQuiet +
            ';padding-left:5px;">eComm Demo</span>',
            { size: 13, colour: palette.canvasText, bottom: 8 }),
        textModule(uid(), palette,
            'You are receiving this because you shopped with us.<br>' +
            'If you have already completed your purchase, please disregard this email.<br>' +
            'This is a demonstration storefront built for a sales conversation.',
            { size: 12, colour: palette.canvasQuiet, linkColor: palette.canvasQuiet })
    ]], { ground: palette.canvas, top: 24, bottom: 28 }));

    /* WHERE THE ROWS GO, AND THE FIRST VERSION PUT THEM IN THE WRONG PLACE. Nesting
       them under page.body imported as an empty canvas: the builder read page.rows,
       found nothing, and drew "Drop content blocks here" with no error. That is the
       failure mode this whole format has, so it is worth stating: a template BeeFree
       cannot read does not complain, it arrives blank.

       BeeFree's own description of the native format is page.body carrying container
       and content, with rows following as a sibling. So rows are emitted at page.rows,
       and mirrored under page.body as well. The mirror is belt and braces on a format
       this repository has no way to validate offline: an importer reads one path and
       ignores the other, so the wrong guess costs bytes rather than another round trip.
       Remove it once an export from the account has confirmed which one is read. */
    const body = {
        type: 'mailup-bee-newsletter-layout-fixed-width',
        container: { style: { 'background-color': palette.canvas } },
        content: {
            computedStyle: {
                linkColor: palette.brandText,
                messageBackgroundColor: 'transparent',
                messageWidth: WIDTH + 'px'
            },
            style: { color: palette.text, 'font-family': palette.body }
        },
        webFonts: webFonts(theme, palette),
        rows
    };

    return {
        page: {
            title: 'Abandoned cart, Dengage eComm Demo',
            description: 'Two Dynamic Content blocks. Neutral shell, so one template ' +
                'serves every demo.',
            template: { name: 'template-base', type: 'basic', version: '2.0.0' },
            body,
            rows
        },
        comments: {}
    };
}

/* The rows, from whichever place a given template put them. Every reader in this
   repository goes through here, so the mirror above stays an implementation detail
   rather than something four files have to remember. */
export function templateRows(template) {
    const page = (template && template.page) || {};
    if (Array.isArray(page.rows)) return page.rows;
    if (page.body && Array.isArray(page.body.rows)) return page.body.rows;
    return [];
}
