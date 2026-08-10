/* ============================================================================
   One AMP for Email sample: the browse abandonment email, with the products in a
   carousel the recipient can swipe inside the inbox.

     import { ampScenario } from './amp-scenario.mjs';

   WHY ONE AND NOT SEVEN. AMP earns its place where interaction earns its place. A
   carousel of the products somebody actually looked at is a thing an HTML email cannot
   do, and it is the moment worth showing on a call. A carousel of a basket they have
   already chosen, or of one saved item, is a carousel for its own sake. So this is a
   sample rather than a set, and browse abandonment is the scenario that gains most.

   THE RULES WERE READ OFF THE OFFICIAL VALIDATOR, not off memory, and two of them are
   the opposite of what is usually assumed:

     `<img>` IS FORBIDDEN. Every image is an `amp-img`, and an amp-img needs explicit
     width and height. That is the constraint that shapes this file.

     INLINE `style` ATTRIBUTES ARE ALLOWED, even with data-css-strict. So the shell can
     be styled the same way the HTML emails are, which is what keeps the two in the same
     visual family instead of diverging into two design systems.

   Also required, and all of it asserted in scenarios.test.mjs against the real validator:
   the `amp4email` attribute on `<html>`, a `<meta charset>`, the v0.js script, the
   `<style amp4email-boilerplate>` line exactly, at most one `<style amp-custom>`, a
   `custom-element` script for every amp component used, and no `!important` anywhere.

   THE IMAGES ARE THE 1200x600 PUSH BANNERS, and that is what makes amp-img possible at
   all. A product photograph is whatever aspect the prospect's studio shot it at, so no
   single width and height is right for all of them. A banner is always 1200x600, its
   margin is already trimmed, and factory/push-images.test.mjs asserts one exists beside
   every committed photograph. So the carousel gets a known ratio and a picture that fills
   it, from a file that is guaranteed to be there.

   A PRODUCT WITH NO BANNER STILL GETS A SLIDE, with its name and price and no image,
   because dropping it would silently shorten the carousel.

   WHAT THIS FILE CANNOT DO IS MAKE GMAIL RENDER IT. AMP for Email only displays when the
   sending domain is registered with the mailbox provider, and until then every provider
   falls back to the HTML part. That is a Dengage and Google matter, not a markup one, and
   factory/panel/SCENARIO-EMAILS.md says so where somebody is about to paste this.
   ========================================================================== */

import { resolveBlock } from './resolve.mjs';
import { masthead, footer, band, eyebrow, headline, lede, button } from './scenario-html.mjs';

/* The carousel's box. 600 wide to match every other email here, and 512 tall because a
   2:1 banner at 600 is 300, leaving room for the category, the name and the price without
   the slides changing height between products. A slide taller than its box scrolls, which
   in an inbox reads as broken, so the box is generous rather than tight. */
const SLIDE_WIDTH = 600;
const SLIDE_HEIGHT = 512;

const BANNER_WIDTH = 1200;
const BANNER_HEIGHT = 600;

/* One slide per product. Inline styles, which the validator accepts, so this matches the
   HTML emails rather than inventing a second visual language. */
function slide(palette) {
    return '{% for (var i = 0; i < view.length; i++) { var card = view[i]; %}' +
        '<div style="text-align:center;">' +
        '{% if (card.banner !== "") { %}' +
        '<amp-img src="{%= card.banner %}" width="' + BANNER_WIDTH + '" height="' +
        BANNER_HEIGHT + '" layout="responsive" alt="{%= card.title %}"></amp-img>' +
        '{% } %}' +
        '{% if (card.category !== "") { %}' +
        '<div style="font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:' +
        palette.quiet + ';padding:20px 0 6px 0;">{%= card.category %}</div>{% } %}' +
        '<div style="font-family:' + palette.display + ';font-size:18px;line-height:1.35;' +
        'font-weight:700;color:' + palette.text + ';padding:' +
        '{%= card.category === "" ? 20 : 0 %}px 24px 8px 24px;">{%= card.title %}</div>' +
        '{% if (card.price !== "") { %}' +
        '<div style="font-size:16px;line-height:1.4;color:' + palette.text + ';">' +
        '{% if (card.cut !== "") { %}<span style="font-weight:bold;">{%= card.cut %}</span>' +
        '<span style="text-decoration:line-through;color:' + palette.quiet +
        ';padding-left:8px;">{%= card.price %}</span>' +
        '{% } else { %}<span style="font-weight:bold;">{%= card.price %}</span>{% } %}' +
        '</div>{% } %}' +
        '{% if (card.link !== "") { %}' +
        '<div style="padding:16px 0 0 0;"><a href="{%= card.link %}" target="_blank" ' +
        'style="font-size:13px;color:' + palette.brandText + ';">Open this one</a></div>' +
        '{% } %}' +
        '</div>{% } %}';
}

/* THE CAROUSEL, AND THE FALLBACK IS NOT OPTIONAL. A recipient with one viewed product
   would get a one slide carousel with arrows that do nothing, which looks broken rather
   than empty. So one product renders as a plain slide and no carousel at all. */
function carousel(palette) {
    return '{% if (view.length > 1) { %}' +
        '<amp-carousel width="' + SLIDE_WIDTH + '" height="' + SLIDE_HEIGHT + '" ' +
        'layout="responsive" type="slides" role="region" aria-label="Products you viewed" ' +
        'controls loop>' + slide(palette) + '</amp-carousel>' +
        '<div style="font-size:12px;line-height:1.5;color:' + palette.quiet +
        ';text-align:center;padding:14px 0 0 0;">Swipe, or use the arrows, to see all ' +
        '{%= view.length %}.</div>' +
        '{% } else { %}' + slide(palette) + '{% } %}';
}

export function ampScenario(scenario, palette) {
    const block = resolveBlock({
        table: scenario.table,
        fold: scenario.fold,
        extra: scenario.extra,
        cap: scenario.cap,
        show: scenario.show
    });

    const rows = [
        masthead(palette),
        band(palette,
            eyebrow(palette, 'Recently viewed') +
            '{% if (ctx.category !== "") { %}' +
            headline(palette, 'More in {%= ctx.category %}') +
            '{% } else { %}' +
            headline(palette, 'Picking up where you left off') +
            '{% } %}' +
            lede(palette, 'You were looking at these. Swipe through them here, without ' +
                'leaving your inbox.'),
            { top: 36, bottom: 24 }),
        band(palette, carousel(palette), { top: 0, bottom: 24 }),
        band(palette,
            '{% if (ctx.category !== "") { %}' +
            button(palette, 'See more in {%= ctx.category %}',
                "root + 'index.html?category=' + encodeURIComponent(ctx.category)",
                { label: 'or browse everything', href: "root + 'index.html'" }) +
            '{% } else { %}' +
            button(palette, 'Keep browsing', "root + 'index.html'") +
            '{% } %}',
            { ground: palette.wash, top: 26, bottom: 28 }),
        footer(palette)
    ];

    /* THE HEAD IS EXACT. The boilerplate line, the attribute name and the script URLs are
       all validated shapes rather than approximations: a character out and the whole email
       is rejected by the mailbox provider rather than degraded. */
    return '{%\n' + block + '\n%}' +
        '<!doctype html>\n<html amp4email data-css-strict>\n<head>\n' +
        '<meta charset="utf-8">\n' +
        '<script async src="https://cdn.ampproject.org/v0.js"></script>\n' +
        '<script async custom-element="amp-carousel" ' +
        'src="https://cdn.ampproject.org/v0/amp-carousel-0.1.js"></script>\n' +
        '<style amp4email-boilerplate>body{visibility:hidden}</style>\n' +
        /* ONE amp-custom BLOCK, AND NO !important IN IT. AMP allows exactly one and
           rejects the declaration outright, which is why the HTML emails' responsive
           override cannot come across: it uses !important to beat a fixed table width. */
        '<style amp-custom>\n' +
        'body{margin:0;padding:0;background-color:' + palette.canvas + ';}\n' +
        'a{color:' + palette.brandText + ';}\n' +
        'table{border-collapse:collapse;}\n' +
        '</style>\n</head>\n' +
        '<body style="margin:0;padding:0;background-color:' + palette.canvas +
        ';font-family:' + palette.body + ';color:' + palette.text + ';">\n' +
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ' +
        'style="background-color:' + palette.canvas + ';">\n' +
        rows.join('\n') +
        '\n</table>\n</body>\n</html>\n';
}
