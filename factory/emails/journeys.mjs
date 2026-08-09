/* ============================================================================
   The ten journeys. Written once, rendered twice.

   Each journey is a function of (palette, ctx, mode). `mode` is 'panel' for the
   file that goes into the Dengage Code Editor, where every personalised value is
   a real {%= =%} tag and every product list is a real $from query, or 'preview'
   for the same layout with those resolved against this demo's own catalogue so it
   can be shown in a browser.

   NOTHING ABOUT THE RECIPIENT IS HARDCODED IN THE PANEL VERSION. The items in a
   basket come from shopping_cart_events, the category someone was browsing from
   page_view_events, the saved item whose price fell from wishlist_events, the
   search that found nothing from search_events, and the last order's lines from
   order_events_detail. See data.mjs for the queries and the one place column names
   are declared.

   WHERE A RECOMMENDATION RULE GOES INSTEAD. A recommendation strip is not a query
   over this contact's rows, it is a model's output, so it stays a Dengage
   Recommendation Rule rather than a $from loop. Each strip names the model it
   expects in the comment above it, and the marketer points the block at that rule
   in the panel. The markup does not change either way.

   NO PRICE IS INVENTED. Preview figures come from the demo's committed
   products.json, which came from the store. A journey needing a number the scrape
   never produced omits it.
   ========================================================================== */

import {
    shell, button, productRow, recommendationStrip,
    heading, paragraph, quietLine, eyebrow, divider
} from './layout.mjs';
import { QUERIES, COLUMNS, repeat, scalar, firstName } from './data.mjs';

function greeting(mode, ctx) {
    return 'Hi ' + firstName(mode, ctx.sampleFirstName) + ',';
}

/* The items this contact left in a basket. Real rows in panel mode. */
function cartItems(p, ctx, mode) {
    return repeat(mode, {
        query: QUERIES.abandonedCart,
        samples: ctx.cart,
        symbol: ctx.symbol,
        base: ctx.storeUrl,
        render: (item) => productRow(p, item),
        join: '\n                    <div style="height:16px;line-height:16px">&nbsp;</div>'
    });
}

function savedItems(p, ctx, mode) {
    return repeat(mode, {
        query: QUERIES.savedItems,
        samples: [ctx.hero],
        symbol: ctx.symbol,
        base: ctx.storeUrl,
        render: (item) => productRow(p, item)
    });
}

function viewedItems(p, ctx, mode) {
    return repeat(mode, {
        query: QUERIES.viewedProducts,
        samples: [ctx.hero],
        symbol: ctx.symbol,
        base: ctx.storeUrl,
        render: (item) => productRow(p, item)
    });
}

function orderLines(p, ctx, mode) {
    return repeat(mode, {
        query: QUERIES.lastOrderLines,
        samples: ctx.cart,
        symbol: ctx.symbol,
        base: ctx.storeUrl,
        render: (item) => productRow(p, item),
        join: '\n                    <div style="height:16px;line-height:16px">&nbsp;</div>'
    });
}

/* The category this contact was actually browsing, for a headline that names it. */
function browsedCategory(mode, ctx) {
    return scalar(mode, {
        query: QUERIES.viewedProducts,
        column: COLUMNS.view.category,
        fallback: 'what you were looking at',
        sample: ctx.sampleCategory
    });
}

/* The words they typed when nothing came back. */
function lastQuery(mode, ctx) {
    return scalar(mode, {
        query: QUERIES.lastSearch,
        column: COLUMNS.search.query,
        fallback: 'the one you were after',
        sample: ctx.sampleQuery
    });
}

/* -------------------------------------------------------------------------- */

function welcome(p, ctx, mode) {
    return {
        file: 'welcome', reads: 'No query. A coupon code from a Dengage coupon list with Contact Key mapped.', journey: 'Identity capture',
        subject: 'Welcome to ' + ctx.storeName,
        preheader: 'Your code is inside, and a few things worth seeing first.',
        blocks: [
            eyebrow(p, 'Welcome'),
            heading(p, 'You are in. Here is where to start.'),
            paragraph(p, greeting(mode, ctx) + ' thanks for signing up. Your code is below, and ' +
                'it is already attached to your account, so it will be waiting at checkout.'),
            couponPanel(p, mode),
            button(p, 'Start shopping', ctx.storeUrl),
            divider(p),
            /* Recommendation Rule: Trending Products. A new contact has no history,
               which is the one case a user based model cannot serve. */
            recommendationStrip(p, 'What people are buying this week', ctx.trending,
                {name: 'Top Sellers (rule based)',
                 context: 'Static'}, mode),
            quietLine(p, 'Prefer fewer emails? You can choose what you hear about at any time.')
        ]
    };
}

function checkoutRescue(p, ctx, mode) {
    return {
        file: 'checkout-rescue', reads: 'shopping_cart_events for this contact, newest first.', journey: 'Checkout rescue',
        subject: 'Your order is still waiting',
        preheader: 'Everything is saved. Delivery and returns, answered below.',
        blocks: [
            eyebrow(p, 'Almost done'),
            heading(p, 'Your basket is still saved'),
            paragraph(p, greeting(mode, ctx) + ' you were one step from finishing. Nothing has ' +
                'been lost, and picking up where you left off takes a moment.'),
            cartItems(p, ctx, mode),
            button(p, 'Finish checkout', ctx.storeUrl + 'checkout.html'),
            divider(p),
            objections(p, [
                ['Delivery', 'Standard delivery is calculated at checkout, with the arrival date shown before you pay.'],
                ['Returns', 'Thirty days to change your mind, and the return label is in your account.'],
                ['Payment', 'Card, wallet and pay later options are all accepted.']
            ]),
            quietLine(p, 'If something went wrong at the payment step, replying to this email reaches a person.')
        ]
    };
}

function cartAbandonment(p, ctx, mode) {
    return {
        file: 'cart-abandonment', reads: 'shopping_cart_events for this contact, newest first. AMP variant beside it.', journey: 'Cart abandonment',
        subject: 'You left something behind',
        preheader: 'Still in your basket, and a few things that go with it.',
        amp: true,
        blocks: [
            eyebrow(p, 'Your basket'),
            heading(p, 'Still here whenever you are'),
            paragraph(p, greeting(mode, ctx) + ' your basket is saved. Here is what is in it.'),
            cartItems(p, ctx, mode),
            button(p, 'Return to basket', ctx.storeUrl + 'cart.html'),
            divider(p),
            /* Recommendation Rule: Frequently Bought Together, context source
               Event Attribute set to the abandoned product. */
            recommendationStrip(p, 'Often bought with these', ctx.related,
                {name: 'Frequently Bought Together (Zeki AI)',
                 context: 'Event attribute, the cart product'}, mode),
            quietLine(p, 'Prices and availability can change while an item sits in a basket.')
        ]
    };
}

function browseAbandonment(p, ctx, mode) {
    return {
        file: 'browse-abandonment', reads: 'page_view_events for the category in the headline and the product shown.', journey: 'Browse abandonment',
        subject: 'Still thinking it over?',
        preheader: 'The one you looked at, plus a few close alternatives.',
        blocks: [
            eyebrow(p, 'Picking up where you left off'),
            /* The headline names the category from this contact's own page views,
               which is the difference between personalised and merely triggered. */
            heading(p, 'Still looking at ' + browsedCategory(mode, ctx) + '?'),
            paragraph(p, greeting(mode, ctx) + ' you spent a while with this one. If it was not ' +
                'quite right, the alternatives underneath are the ones other shoppers compared ' +
                'it against.'),
            viewedItems(p, ctx, mode),
            button(p, 'Take another look', ctx.storeUrl),
            divider(p),
            /* Recommendation Rules: Similar Items answers "not quite right",
               Frequently Viewed Together answers "what else did people consider". */
            recommendationStrip(p, 'Close alternatives', ctx.similar,
                {name: 'Similar Items (Zeki AI)',
                 context: 'Event attribute, the viewed product'}, mode),
            quietLine(p, 'Shown because you viewed this recently. Nothing has been added to a basket.')
        ]
    };
}

function backInStock(p, ctx, mode) {
    return {
        file: 'back-in-stock', reads: 'search_events for the words typed, wishlist_events for the item.', journey: 'Failed search recovery',
        subject: 'Back in stock',
        preheader: 'You looked for this when we had none. It is back.',
        blocks: [
            eyebrow(p, 'Back in stock'),
            /* Names the actual words they typed, from search_events. */
            heading(p, 'You searched for ' + lastQuery(mode, ctx) + '. It is back.'),
            paragraph(p, greeting(mode, ctx) + ' you looked for this when we had none to show ' +
                'you. It is available again, and stock on a return like this tends not to last.'),
            savedItems(p, ctx, mode),
            button(p, 'See it now', ctx.storeUrl),
            divider(p),
            /* Recommendation Rule: Category Best Sellers, category from this
               contact's own last category path. */
            recommendationStrip(p, 'Also popular in this category', ctx.trending,
                {name: 'Category Best Sellers (rule based)',
                 context: 'Event attribute, the category'}, mode),
            quietLine(p, 'You are only told about items you searched for or saved.')
        ]
    };
}

function priceDrop(p, ctx, mode) {
    return {
        file: 'price-drop', reads: 'wishlist_events for the saved item whose price changed.', journey: 'Wishlist triggers',
        subject: 'The price dropped on something you saved',
        preheader: 'One of your saved items costs less than when you saved it.',
        blocks: [
            eyebrow(p, 'Price drop'),
            heading(p, 'Cheaper than when you saved it'),
            paragraph(p, greeting(mode, ctx) + ' this has been sitting on your saved list, and ' +
                'it now costs less than it did then.'),
            savedItems(p, ctx, mode),
            button(p, 'View your saved items', ctx.storeUrl + 'wishlist.html'),
            divider(p),
            /* Recommendation Rule: Category Discounted Products, filtered to the
               categories this contact has actually saved from. */
            recommendationStrip(p, 'Other reductions in your categories', ctx.discounted,
                {name: 'Category Discounted Products (rule based)',
                 context: 'User attribute, the category'}, mode),
            quietLine(p, 'Sent only when a saved item genuinely changes price or comes back into stock.')
        ]
    };
}

function orderConfirmation(p, ctx, mode) {
    return {
        file: 'order-confirmation', reads: 'order_events_detail for the lines on the order.', journey: 'Basket building',
        subject: 'Order confirmed',
        preheader: 'Thanks. Here is what is coming, and what goes with it.',
        blocks: [
            eyebrow(p, 'Order confirmed'),
            heading(p, 'Thanks, that is all confirmed'),
            paragraph(p, greeting(mode, ctx) + ' your order is placed. We will email again the ' +
                'moment it ships.'),
            orderSummary(p, ctx, mode),
            button(p, 'Track this order', ctx.storeUrl + 'account.html'),
            divider(p),
            /* The highest open rate in the programme, which is why a Frequently
               Bought Together strip earns its place here. */
            recommendationStrip(p, 'Goes with what you just bought', ctx.related,
                {name: 'Frequently Bought Together (Zeki AI)',
                 context: 'Event attribute, the ordered product'}, mode),
            quietLine(p, 'A confirmation is transactional, so it is sent regardless of marketing preferences.')
        ]
    };
}

function replenishment(p, ctx, mode) {
    return {
        file: 'replenishment', reads: 'order_events_detail for what was bought last time.', journey: 'Replenishment',
        subject: 'Running low?',
        preheader: 'Reordering what you bought last time takes one tap.',
        blocks: [
            eyebrow(p, 'Time to reorder'),
            heading(p, 'About time for another?'),
            paragraph(p, greeting(mode, ctx) + ' judging by when you last ordered this, you are ' +
                'probably near the end of it. Reordering the same thing takes one tap.'),
            orderLines(p, ctx, mode),
            button(p, 'Reorder in one tap', ctx.storeUrl + 'cart.html'),
            divider(p),
            recommendationStrip(p, 'Others also restock these', ctx.related,
                {name: 'Frequently Bought Together (Zeki AI)',
                 context: 'Event attribute, the ordered product'}, mode),
            quietLine(p, 'Timed from your own order history, not from a fixed schedule.')
        ]
    };
}

function vipEarlyAccess(p, ctx, mode) {
    return {
        file: 'vip-early-access', reads: 'No query. Audience is an RFM persona segment.', journey: 'RFM lifecycle',
        subject: 'Early access, before anyone else',
        preheader: 'You are in the first group to see this.',
        blocks: [
            eyebrow(p, 'Early access'),
            heading(p, 'Yours first, before it goes out'),
            paragraph(p, greeting(mode, ctx) + ' you are one of our most regular customers, so ' +
                'you get this a day before everyone else. No code needed and nothing to enter: ' +
                'the link below is already open to you.'),
            button(p, 'Shop early access', ctx.storeUrl),
            divider(p),
            /* Recommendation Rule: Recommended Items (User Based). This contact has
               the history that model is strongest on. */
            recommendationStrip(p, 'Chosen from what you buy', ctx.similar,
                {name: 'Recommended Items, User-Based (Zeki AI)',
                 context: 'User attribute'}, mode),
            quietLine(p, 'Access rather than a discount, because you were always going to be looked after.')
        ]
    };
}

function winBack(p, ctx, mode) {
    return {
        file: 'win-back', reads: 'page_view_events for the category named, wishlist_events for saved items.', journey: 'Win-back',
        subject: 'A few things changed since you were last here',
        preheader: 'New ranges, faster delivery, and your saved items are still saved.',
        blocks: [
            eyebrow(p, 'Since you were last here'),
            heading(p, 'A few things have changed'),
            paragraph(p, greeting(mode, ctx) + ' it has been a while. Rather than send you a ' +
                'code, here is what is actually different: new ranges in ' +
                browsedCategory(mode, ctx) + ', and your saved items are still exactly where ' +
                'you left them.'),
            savedItems(p, ctx, mode),
            button(p, 'See what is new', ctx.storeUrl),
            divider(p),
            /* Recommendation Rule: New Arrivals, filtered to the categories this
               contact bought from before they went quiet. */
            recommendationStrip(p, 'New in your categories', ctx.trending,
                {name: 'Category New Arrivals (rule based)',
                 context: 'User attribute, the category'}, mode),
            quietLine(p, 'If this is not for you any more, one click below stops it. No hard feelings.')
        ]
    };
}

/* -------------------------------------------------------------------------- */

function orderSummary(p, ctx, mode) {
    const reference = mode === 'panel' ? '{%= $Contact.contact_key =%}' : ctx.sampleOrderRef;
    return `
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr><td style="font-family:${p.body};font-size:13px;color:${p.quiet};padding-bottom:12px">
                        Order ${reference} &middot; placed today
                      </td></tr>
                      <tr><td>${orderLines(p, ctx, mode)}
                      </td></tr>
                    </table>`;
}

/* The code comes from a Dengage coupon list with Contact Key mapped on import, so
   it is unique to this contact and cannot be shared. */
function couponPanel(p, mode) {
    const code = mode === 'panel' ? '{%= $Coupon.code =%}' : 'WELCOME-4KJ9P';
    return `
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                      style="border-collapse:collapse;background-color:${p.wash};border-radius:${p.radius}px">
                      <tr><td align="center" style="padding:22px 20px">
                        <div style="font-family:${p.body};font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:${p.quiet}">Your code</div>
                        <div style="font-family:${p.display};font-size:26px;font-weight:bold;color:${p.text};letter-spacing:0.06em;padding-top:6px">${code}</div>
                        <div style="font-family:${p.body};font-size:12.5px;color:${p.quiet};padding-top:6px">Already attached to your account</div>
                      </td></tr>
                    </table>`;
}

function objections(p, pairs) {
    const rows = pairs.map(([term, answer]) => `
                      <tr>
                        <td width="94" valign="top" style="font-family:${p.body};font-size:13px;font-weight:bold;color:${p.text};padding:0 12px 12px 0">${term}</td>
                        <td valign="top" style="font-family:${p.body};font-size:13.5px;line-height:1.55;color:${p.quiet};padding:0 0 12px">${answer}</td>
                      </tr>`).join('');
    return `
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${rows}
                    </table>`;
}

export const JOURNEYS = [
    welcome, checkoutRescue, cartAbandonment, browseAbandonment, backInStock,
    priceDrop, orderConfirmation, replenishment, vipEarlyAccess, winBack
];

export function renderJourney(fn, palette, ctx, mode) {
    const spec = fn(palette, ctx, mode);
    return {
        ...spec,
        mode,
        html: shell({
            palette,
            subject: spec.subject,
            preheader: spec.preheader,
            storeName: ctx.storeName,
            storeUrl: ctx.storeUrl,
            unsubscribe: ctx.unsubscribe,
            blocks: spec.blocks
        })
    };
}
