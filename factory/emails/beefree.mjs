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

import { demoLink, categoryLink } from '../demo-links.mjs';

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
            style: pad(0, 24, bottom === undefined ? 0 : bottom, 24),
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
   builder, so the block reads as an empty template rather than as a spot with a job. */
function dynamicBlock(palette, asset, id, describe) {
    if (id) {
        return '<snippet snippet_id="' + id + '" snippet_name="' + asset + '"></snippet>';
    }
    return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ' +
        'style="border-collapse:collapse;"><tr><td style="border:2px dashed ' + palette.edge +
        ';border-radius:' + palette.radius + 'px;padding:22px 20px;text-align:center;' +
        'font-family:' + palette.body + ';font-size:13px;line-height:1.6;color:' +
        palette.quiet + ';">' +
        '<strong style="color:' + palette.text + ';font-size:14px;">Dynamic Content: ' +
        asset + '</strong><br>' + describe +
        '<br>Click this block, clear it, then use Insert &gt; Dynamic Content.' +
        '</td></tr></table>';
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
        palette, storeName, storeUrl, unsubscribe,
        theme = {}, symbol = '', currency = '', snippets = {},
        categories = [], heroImage = ''
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

    /* 2. THE MASTHEAD IS THE DENGAGE MARK AND THE STORE'S NAME AS TEXT BESIDE IT.
       Non-negotiable 3, and the same arrangement layout.mjs uses, so the generated
       HTML emails and this one do not disagree about whose email it is. Text rather
       than an image because the logo is an SVG and Gmail drops SVG entirely.

       ON THE CANVAS, NOT THE CARD, and the colours are the canvas-checked pair. A
       BeeFree row is a full width band, so the floating card layout.mjs draws with a
       border and a radius cannot be reproduced here. What reproduces it is the band
       ground: masthead and footer on the canvas, everything between them on the card,
       so the colour change is the card's edge. Using card-checked text out here is how
       a demo whose page and surface differ ends up with quiet text at the wrong
       contrast on the one row nobody re-reads. */
    rows.push(row(uid(), palette, [
        [textModule(uid(), palette,
            '<a href="' + demoLink(storeUrl, 'home') + '" style="text-decoration:none;">' +
            '<strong style="font-family:' + palette.display + ';font-size:18px;color:' +
            palette.canvasText + ';letter-spacing:-0.01em;">Dengage</strong>' +
            '<span style="font-size:12px;color:' + palette.canvasQuiet + ';padding-left:6px;">' +
            'eComm Demo</span></a>',
            { size: 18, colour: palette.canvasText, linkColor: palette.canvasText })],
        [textModule(uid(), palette, storeName,
            { size: 12, colour: palette.canvasQuiet, align: 'right' })]
    ], { ground: palette.canvas, top: 22, bottom: 22 }));

    /* On a flat theme the masthead and the nav are the same colour, so the card has no
       top edge. The footer end of the card has the same problem and the same fix. */
    if (flat) hairline();

    /* 3. THE CATEGORY NAV, from the demo's own category structure. Every retail email
       has one, and here it is doing real work rather than decorating: the links go to
       the storefront filtered to that category, so on a call each one is a live page
       and the prospect sees their own taxonomy in an email nobody built by hand.

       Four at most. A nav that wraps to two lines on a phone stops looking like a nav,
       and the demo's structure is four to six categories anyway. */
    const nav = (categories || []).filter((name) => typeof name === 'string' && name.trim())
        .slice(0, 4);
    if (nav.length) {
        rows.push(row(uid(), palette, [[
            textModule(uid(), palette,
                nav.map((name) =>
                    '<a href="' + categoryLink(storeUrl, name) + '" style="color:' +
                    palette.text + ';text-decoration:none;font-size:12px;' +
                    'letter-spacing:0.06em;text-transform:uppercase;">' + name + '</a>'
                ).join('<span style="color:' + palette.quiet +
                       ';padding:0 10px;opacity:0.5;">&bull;</span>'),
                { size: 12, align: 'center', colour: palette.text, linkColor: palette.text })
        ]], { top: 16, bottom: 18 }));
        /* NO RULE UNDER IT. A divider here sat inset by 24px directly above a full
           bleed hero, so two edges of different widths stacked and the nav read as a
           floating strip. The hero's own tinted band is the separation. */
    }

    /* 4. THE HERO. Drawn per demo from its own brand colour by make-hero.mjs, so it is
       neither a stock photograph nor the prospect's own imagery, and it cannot 404
       between the build and the call. Full bleed, and it carries no text: every word in
       this email is a real module, which is what makes it readable with images off.

       Its alt text is deliberately plain rather than a second headline. A client with
       images blocked should show the shape of the email, not two competing sentences. */
    if (heroImage) {
        rows.push(row(uid(), palette, [[
            imageModule(uid(), heroImage, 'Your saved basket', demoLink(storeUrl, 'cart'))
        ]], { top: 0, bottom: 0 }));
    }

    /* 5. One headline and one line of copy. No paragraph explaining the offer,
       because there is no offer: the products are the message. */
    rows.push(row(uid(), palette, [[
        textModule(uid(), palette,
            '<span style="font-family:' + palette.display + ';font-size:28px;font-weight:700;' +
            'line-height:1.2;color:' + palette.text + ';">Still thinking it over?</span>',
            { size: 28, leading: 1.2, bottom: 12 }),
        textModule(uid(), palette,
            'Everything you added is still saved. Here is what is waiting in your basket.',
            { size: 15, colour: palette.quiet })
    ]], { top: 32, bottom: 24 }));

    /* 6. THE BASKET. */
    rows.push(row(uid(), palette, [[
        htmlModule(uid(), palette,
            dynamicBlock(palette, 'dps abandoned cart', snippets.items,
                'The visitor\'s own basket, resolved from their cart events.'))
    ]], { top: 0, bottom: 6 }));

    /* 7. THE TOTAL, on the wash so it reads as a summary rather than another product.
       It disappears by itself when the basket has no honest total to show. */
    rows.push(row(uid(), palette, [[
        htmlModule(uid(), palette,
            dynamicBlock(palette, 'dps abandoned cart total', snippets.total,
                'Subtotal, discount and total, computed from the same basket.'))
    ]], { ground: palette.wash, top: 22, bottom: 22 }));

    /* 8. THE CURRENCY, STATED ONCE, BECAUSE NO NUMBER IN THIS EMAIL CARRIES A SYMBOL.
       Both Dynamic Content assets are shared by every demo and dps_product has no
       currency column, so neither one can know which currency it is printing. It says
       so here instead, per demo, which is what an international retailer does anyway,
       and it is the only honest option that does not put a guessed symbol beside a
       real price. Omitted entirely when the demo's locale names neither. */
    const money = symbol || currency;
    if (money) {
        rows.push(row(uid(), palette, [[
            textModule(uid(), palette,
                'All prices in ' + (symbol || currency) +
                (symbol && currency ? ' (' + currency + ')' : '') + '.',
                { size: 12, colour: palette.quiet })
        ]], { top: 18, bottom: 0 }));
    }

    /* 9. ONE BUTTON, AND IT OPENS THE BASKET. Centred, because a centred primary action
       is what a phone thumb expects, and with a quiet second choice under it rather than
       a second button: two buttons of equal weight is how a call to action stops being
       one.

       It opens the basket rather than the home page. The whole proposition is that the
       basket survived, and it goes to index.html?open=cart because a demo has no
       cart.html and never did. See factory/demo-links.mjs. */
    rows.push(row(uid(), palette, [[
        buttonModule(uid(), palette, 'Return to your basket', demoLink(storeUrl, 'cart'),
                     'center'),
        textModule(uid(), palette,
            '<a href="' + demoLink(storeUrl, 'home') + '" style="color:' + palette.quiet +
            ';text-decoration:underline;">or keep browsing the store</a>',
            { size: 13, align: 'center', colour: palette.quiet, top: 14,
              linkColor: palette.quiet })
    ]], { top: money ? 18 : 8, bottom: 26 }));

    /* 10. THE ONE LINE OF URGENCY THAT IS TRUE. A countdown, a reserved basket or a
        discount that expires would all be invented, and a prospect can see through
        every one of them. What is genuinely true of any store is that a basket is not a
        reservation, and saying so is the honest version of the same nudge. */
    rows.push(row(uid(), palette, [[
        textModule(uid(), palette,
            'Prices and availability can change, and a basket is not a reservation.',
            { size: 12, align: 'center', colour: palette.quiet })
    ]], { top: 0, bottom: 28 }));

    if (flat) hairline();

    /* 11. The footer, back on the canvas, closing the card. The mark repeats small,
        because a footer with no sender in it reads as a fragment. */
    rows.push(row(uid(), palette, [[
        textModule(uid(), palette,
            '<strong style="font-family:' + palette.display + ';font-size:13px;color:' +
            palette.canvasText + ';">Dengage</strong>' +
            '<span style="font-size:12px;color:' + palette.canvasQuiet +
            ';padding-left:5px;">eComm Demo</span>',
            { size: 13, colour: palette.canvasText, bottom: 8 }),
        textModule(uid(), palette,
            'You are receiving this because you shopped with us. ' +
            '<a href="' + unsubscribe + '" style="color:' + palette.canvasQuiet +
            ';text-decoration:underline;">Manage your preferences</a> or ' +
            '<a href="' + demoLink(storeUrl, 'home') + '" style="color:' + palette.canvasQuiet +
            ';text-decoration:underline;">visit the store</a>.<br>' +
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
            title: 'Abandoned cart, ' + storeName,
            description: 'Dengage eComm Demo. Two Dynamic Content blocks, themed per demo.',
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
