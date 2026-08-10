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
import { masthead, footer, band, eyebrow, headline, lede } from './scenario-html.mjs';

/* This repository's published origin, written out so an AMP attribute can be absolute
   before the engine runs. resolve.mjs strips the same prefix to produce card.bannerPath
   and card.linkPath, and scenarios.test.mjs holds the two to the same value. */
const SITE = 'https://dengage-presales.github.io/demo-ai/';

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
function slide() {
    return '{% for (var i = 0; view.length > i; i++) { var card = view[i]; %}' +
        '<div class="s">' +
        /* A LITERAL https PREFIX, THEN A PATH EXPRESSION. Dengage validates the markup as
           authored, so `src="{%= card.banner %}"` reads to it as a relative URL and is
           rejected outright. With the origin written out, the attribute is absolute to
           anything reading the text and identical once the engine resolves it. */
        '{% if (card.bannerPath !== "") { %}' +
        '<amp-img src="' + SITE + '{%= card.bannerPath %}" width="' + BANNER_WIDTH +
        '" height="' + BANNER_HEIGHT + '" layout="responsive" alt="{%= card.title %}">' +
        '</amp-img>{% } %}' +
        /* THE CONDITION IS OUTSIDE THE TAG, NOT INSIDE THE ATTRIBUTE, and it took two
           rounds with the panel to get this right. The first version put the conditional
           padding in a style attribute; the second moved it into a class attribute, which
           failed the same way for the same reason, and the reason is narrower than "no
           tags in attributes":

           AN ATTRIBUTE IS DOUBLE QUOTED, AND THE EXPRESSION CONTAINED A DOUBLE QUOTE.
           `class="{% if (card.category === "") ... "` ends, to a parser, at the `""` in the
           comparison. Everything after it is read as more attributes, which is why the
           panel reported eight of them per slide with names like '%}n{%' and 'else'.

           So the whole div is chosen rather than the class inside it. src, href and alt
           keep their tags, because their expressions use single quotes and survive. */
        '{% if (card.category !== "") { %}<div class="c">{%= card.category %}</div>' +
        '<div class="n">{%= card.title %}</div>' +
        '{% } else { %}<div class="n t">{%= card.title %}</div>{% } %}' +
        '{% if (card.price !== "") { %}<div class="p">' +
        '{% if (card.cut !== "") { %}<span class="b">{%= card.cut %}</span>' +
        '<span class="w">{%= card.price %}</span>' +
        '{% } else { %}<span class="b">{%= card.price %}</span>{% } %}' +
        '</div>{% } %}' +
        '{% if (card.linkPath !== "") { %}' +
        '<div class="o"><a href="' + SITE + '{%= card.linkPath %}" target="_blank">' +
        'Open this one</a></div>{% } %}' +
        '</div>{% } %}';
}

/* THE BUTTON, WITH THE ORIGIN WRITTEN OUT. scenario-html.mjs's button emits
   href="{%= root + '...' %}", which every other email uses happily and which Dengage's AMP
   validator rejects as a relative URL. Same fix as the images: a literal https prefix and a
   path expression after it. Still suppressed entirely when no demo resolved, because there
   is no address correct for every demo. */
function ampButton(palette, label, pathExpression, secondary) {
    let out = '{% if (rootPath !== "") { %}' +
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">' +
        '<tr><td align="center" style="padding:0;">' +
        '<a href="' + SITE + '{%= ' + pathExpression + ' %}" target="_blank" ' +
        'style="display:inline-block;background-color:' + palette.brand + ';color:' +
        palette.onBrand + ';font-family:' + palette.body + ';font-size:16px;' +
        'font-weight:bold;line-height:1.2;padding:14px 30px;border-radius:' +
        palette.radius + 'px;text-decoration:none;">' + label + '</a></td></tr>';
    if (secondary) {
        out += '<tr><td align="center" style="padding:12px 0 0 0;font-size:13px;' +
            'line-height:1.5;"><a href="' + SITE + '{%= ' + secondary.href + ' %}" ' +
            'target="_blank" style="color:' + palette.quiet + ';text-decoration:underline;">' +
            secondary.label + '</a></td></tr>';
    }
    return out + '</table>{% } %}';
}

/* THE CAROUSEL, AND THE FALLBACK IS NOT OPTIONAL. A recipient with one viewed product
   would get a one slide carousel with arrows that do nothing, which looks broken rather
   than empty. So one product renders as a plain slide and no carousel at all. */
function carousel() {
    return '{% if (view.length > 1) { %}' +
        '<amp-carousel width="' + SLIDE_WIDTH + '" height="' + SLIDE_HEIGHT + '" ' +
        'layout="responsive" type="slides" role="region" aria-label="Products you viewed" ' +
        'controls loop>' + slide() + '</amp-carousel>' +
        '<div class="h">Swipe, or use the arrows, to see all {%= view.length %}.</div>' +
        '{% } else { %}' + slide() + '{% } %}';
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
        band(palette, carousel(), { top: 0, bottom: 24 }),
        band(palette,
            '{% if (ctx.category !== "") { %}' +
            ampButton(palette, 'See more in {%= ctx.category %}',
                "rootPath + 'index.html?category=' + encodeURIComponent(ctx.category)",
                { label: 'or browse everything', href: "rootPath + 'index.html'" }) +
            '{% } else { %}' +
            ampButton(palette, 'Keep browsing', "rootPath + 'index.html'") +
            '{% } %}',
            { ground: palette.wash, top: 26, bottom: 28 }),
        footer(palette)
    ];

    /* THE DOCTYPE COMES FIRST, AND THE QUERY GOES INSIDE THE BODY. This is the fix for
       eight of the errors the panel reported on the first attempt, and none of them was
       about AMP: Dengage validates the markup before running the template engine, so a
       hundred and fifty lines of `{% %}` above `<!doctype html>` meant the doctype was not
       first, `<html>` had the wrong parent, and every head tag was parsed as body content.

       Inside `<body>` the same block is just text, which is allowed, and it resolves to
       nothing. Which only holds because the block contains no `<` character: see
       resolve.mjs. */
    return '<!doctype html>\n<html amp4email data-css-strict>\n<head>\n' +
        '<meta charset="utf-8">\n' +
        '<script async src="https://cdn.ampproject.org/v0.js"></script>\n' +
        '<script async custom-element="amp-carousel" ' +
        'src="https://cdn.ampproject.org/v0/amp-carousel-0.1.js"></script>\n' +
        '<style amp4email-boilerplate>body{visibility:hidden}</style>\n' +
        /* ONE amp-custom BLOCK, AND NO !important IN IT. AMP allows exactly one and rejects
           the declaration outright, which is why the HTML emails' responsive override
           cannot come across: it uses !important to beat a fixed table width.

           THE SLIDE'S STYLES LIVE HERE RATHER THAN INLINE, unlike the rest of this file,
           because a slide has one conditional value and a `{%= %}` inside a style attribute
           is what produced nine bogus attributes per slide in the panel's validator. */
        '<style amp-custom>\n' +
        'body{margin:0;padding:0;background-color:' + palette.canvas + ';}\n' +
        'a{color:' + palette.brandText + ';}\n' +
        'table{border-collapse:collapse;}\n' +
        '.s{text-align:center;}\n' +
        '.c{font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:' +
        palette.quiet + ';padding:20px 0 6px 0;}\n' +
        '.n{font-family:' + palette.display + ';font-size:18px;line-height:1.35;' +
        'font-weight:700;color:' + palette.text + ';padding:0 24px 8px 24px;}\n' +
        '.n.t{padding-top:20px;}\n' +
        '.p{font-size:16px;line-height:1.4;color:' + palette.text + ';}\n' +
        '.p .b{font-weight:bold;}\n' +
        '.p .w{text-decoration:line-through;color:' + palette.quiet + ';padding-left:8px;}\n' +
        '.o{padding:16px 0 0 0;font-size:13px;}\n' +
        '.h{font-size:12px;line-height:1.5;color:' + palette.quiet +
        ';text-align:center;padding:14px 0 0 0;}\n' +
        '</style>\n</head>\n' +
        '<body style="margin:0;padding:0;background-color:' + palette.canvas +
        ';font-family:' + palette.body + ';color:' + palette.text + ';">\n' +
        '{%\n' + block + '\n%}\n' +
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ' +
        'style="background-color:' + palette.canvas + ';">\n' +
        rows.join('\n') +
        '\n</table>\n</body>\n</html>\n';
}
