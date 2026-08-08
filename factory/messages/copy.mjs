/* ============================================================================
   The copy: ten journeys across six short form channels.

   Each journey returns one entry per channel it should use, and deliberately not
   every channel for every journey. A programme that fires on all six is a
   programme that gets somebody to unsubscribe from all six, so the channel mix
   per journey follows the playbook's own escalation: on-site and push where speed
   matters, inbox where the message should survive being missed, SMS and WhatsApp
   only where the value justifies interrupting somebody on their phone.

   TAGS ARE REAL, AND MODE DECIDES WHETHER THEY ARE RESOLVED. Panel mode emits
   Dengage's own syntax and queries; preview mode resolves them against the demo's
   catalogue so a deck can be shown on a call. Same shape as the email set.

   TWO CHANNELS HAVE RULES THE COPY ITSELF HAS TO RESPECT:

   SMS carries no emoji. Dengage charges non-ANSI characters double, so an emoji
   costs two of a 400 character budget and, worse, makes the cost of a message
   hard to eyeball. Every SMS below is plain ANSI and ends with the documented
   {{unsubscribe-link}}, because an opt out is mandatory.

   ON-SITE STAYS GENERIC. Those creatives are shared by every live demo, so the
   words cannot name a product, a price, a brand or a vertical. On that channel
   the personalisation lives in the targeting, not the copy.
   ========================================================================== */

import { COLUMNS, QUERIES } from '../emails/data.mjs';

/* The value of a column for this contact, as a tag or as a sample. Short form has
   no room for a loop, so these are all scalars: the FIRST row, not a list. */
function one(mode, spec, column, fallback, sample) {
    if (mode !== 'panel') return sample || fallback;
    const query = spec.expr;
    return '{% var r = ' + query + '; %}' +
        '{% if (r.length && r[0].' + column + ') { %}{%= r[0].' + column + ' =%}' +
        '{% } else { %}' + fallback + '{% } %}';
}

/* A VALUE THAT CANNOT OVERRUN, WHATEVER THE CATALOGUE HOLDS. one() above emits
   the column as it is, which is right for a WhatsApp body with a thousand
   characters to spare and wrong for a push title with fifty. A store whose
   product names run to 120 characters can never fit one in a title, so the tag
   itself does the cutting: Dengage's {%= =%} evaluates JavaScript, so a ternary
   and substring resolve at send time and the message fits by construction rather
   than by hoping the catalogue is tidy. */
function short(mode, spec, column, max, fallback, sample) {
    if (mode !== 'panel') {
        const value = sample || fallback;
        return value.length > max ? value.slice(0, max - 3).trimEnd() + '...' : value;
    }
    const at = 'r[0].' + column;
    return '{% var r = ' + spec.expr + '; %}' +
        '{% if (r.length && ' + at + ') { %}' +
        '{%= ' + at + '.length > ' + max + ' ? ' + at + '.substring(0, ' + (max - 3) +
        ') + "..." : ' + at + ' =%}' +
        '{% } else { %}' + fallback + '{% } %}';
}

function name(mode, ctx) {
    if (mode !== 'panel') return ctx.sampleFirstName;
    return '{% if ($Contact.first_name) { %}{%= $Contact.first_name =%}{% } else { %}there{% } %}';
}

/* -------------------------------------------------------------------------- */

export const JOURNEY_COPY = [
    {
        id: 'identity', journey: 'Identity capture',
        channels: (mode, ctx) => ({
            onsite: {
                template: 'Spin to Win, or Subscription Popup on exit',
                heading: 'Take 10 percent off your first order',
                body: 'Spin once for a code, and we will keep it on your account until you use it.',
                cta: 'Spin to win'
            },
            webPush: {
                title: 'Your code is saved',
                body: 'It is on your account and waiting at checkout. Nothing to remember.',
                targetUrl: ctx.storeUrl
            },
            inbox: {
                title: 'Welcome. Your code is inside.',
                body: 'We have kept your code on your account, so it applies itself at checkout. ' +
                      'Here is where to start.',
                expiryDays: 7, priority: 3, targetUrl: ctx.storeUrl
            }
        })
    },

    {
        id: 'checkout', journey: 'Checkout rescue',
        channels: (mode, ctx) => ({
            onsite: {
                template: 'Modal, on exit intent at checkout',
                heading: 'Before you go',
                body: 'Your basket is saved. Delivery dates and returns are shown before you pay.',
                cta: 'Finish checkout'
            },
            webPush: {
                title: 'You were one step away',
                body: 'Your basket is still saved. Picking up where you left off takes a moment.',
                targetUrl: ctx.storeUrl + 'checkout.html'
            },
            mobilePush: {
                title: 'Still want to finish?',
                body: 'Everything is saved, including your delivery choice.',
                subtitle: 'Your basket',
                targetUrl: ctx.storeUrl + 'checkout.html'
            },
            whatsapp: {
                category: 'Utility', messageType: 'Blank Content',
                header: 'Your order is not complete',
                body: 'Hi ' + name(mode, ctx) + ', you were one step from finishing and nothing ' +
                      'has been lost. Your basket is still saved, and the delivery date is shown ' +
                      'before you pay. Reply here if something went wrong at the payment step.',
                footer: 'Reply STOP to opt out',
                buttons: [
                    { type: 'Visit Website', label: 'Finish checkout', url: ctx.storeUrl + 'checkout.html' },
                    { type: 'Quick Reply', label: 'Something went wrong' }
                ]
            }
        })
    },

    {
        id: 'cart', journey: 'Cart abandonment',
        channels: (mode, ctx) => ({
            onsite: {
                template: 'Sticky Bar, on return to the site',
                heading: 'Your basket is still here',
                body: 'Everything you added is saved and waiting.',
                cta: 'Return to basket'
            },
            webPush: {
                title: 'Still thinking about it?',
                body: short(mode, QUERIES.abandonedCart, COLUMNS.cart.name, 70,
                            'What you added', ctx.sampleProduct) +
                      ' is still in your basket.',
                targetUrl: ctx.storeUrl + 'cart.html'
            },
            inbox: {
                title: 'Your basket is saved',
                body: 'We are holding ' +
                      short(mode, QUERIES.abandonedCart, COLUMNS.cart.name, 90,
                            'what you added', ctx.sampleProduct) +
                      ' for you. Prices and stock can move while an item sits in a basket.',
                expiryDays: 7, priority: 2, targetUrl: ctx.storeUrl + 'cart.html'
            },
            sms: {
                body: 'Hi ' + name(mode, ctx) + ', your basket at ' + ctx.storeName +
                      ' is still saved. Finish here: {{shortlink}} Reply {{unsubscribe-link}} to opt out.',
                senderName: ctx.storeName
            },
            whatsapp: {
                category: 'Marketing', messageType: 'Carousel',
                header: 'None',
                body: 'Hi ' + name(mode, ctx) + ', your basket is still saved. Swipe to see what ' +
                      'goes with it, or go straight to checkout.',
                footer: 'Reply STOP to opt out',
                carousel: true,
                buttons: [
                    { type: 'Visit Website', label: 'Return to basket', url: ctx.storeUrl + 'cart.html' }
                ]
            }
        })
    },

    {
        id: 'browse', journey: 'Browse abandonment',
        channels: (mode, ctx) => ({
            onsite: {
                template: 'Inline Personalization, on the home page',
                heading: 'Pick up where you left off',
                body: 'The things you looked at last time, and a few close alternatives.',
                cta: 'Keep looking'
            },
            webPush: {
                title: 'Still looking at ' +
                       short(mode, QUERIES.viewedProducts, COLUMNS.view.category, 24,
                             'these', ctx.sampleCategory) + '?',
                body: 'The one you spent time with is still there, along with a few alternatives.',
                targetUrl: ctx.storeUrl
            },
            inbox: {
                title: 'The one you were looking at',
                body: 'Still available, and the alternatives underneath are what other shoppers ' +
                      'compared it against.',
                expiryDays: 5, priority: 3, targetUrl: ctx.storeUrl
            }
        })
    },

    {
        id: 'search', journey: 'Failed search recovery',
        channels: (mode, ctx) => ({
            onsite: {
                template: 'Product Box, on the empty results page',
                heading: 'Nothing for that search',
                body: 'Here is what is popular in the section you were browsing instead.',
                cta: 'Browse these'
            },
            webPush: {
                title: 'Back in stock',
                body: 'The ' + short(mode, QUERIES.lastSearch, COLUMNS.search.query, 55,
                                     'item you searched for', ctx.sampleQuery) +
                      ' you looked for is available again.',
                targetUrl: ctx.storeUrl
            },
            inbox: {
                title: 'What you searched for is back',
                body: 'You looked for ' +
                      short(mode, QUERIES.lastSearch, COLUMNS.search.query, 60,
                            'this', ctx.sampleQuery) +
                      ' when we had none. It is back, and a return like this can go quickly.',
                expiryDays: 3, priority: 2, targetUrl: ctx.storeUrl
            }
        })
    },

    {
        id: 'wishlist', journey: 'Wishlist triggers',
        channels: (mode, ctx) => ({
            webPush: {
                title: 'Price drop on something you saved',
                body: short(mode, QUERIES.savedItems, COLUMNS.wishlist.name, 60,
                            'A saved item', ctx.sampleProduct) +
                      ' now costs less than when you saved it.',
                targetUrl: ctx.storeUrl + 'wishlist.html'
            },
            mobilePush: {
                title: 'Cheaper than when you saved it',
                body: short(mode, QUERIES.savedItems, COLUMNS.wishlist.name, 70,
                            'Your saved item', ctx.sampleProduct) + ' has dropped in price.',
                subtitle: 'Saved items',
                targetUrl: ctx.storeUrl + 'wishlist.html'
            },
            inbox: {
                title: 'A saved item changed price',
                body: 'One of the things on your saved list costs less than it did when you ' +
                      'saved it. Saved items stay in your account.',
                expiryDays: 7, priority: 1, targetUrl: ctx.storeUrl + 'wishlist.html'
            },
            whatsapp: {
                category: 'Marketing', messageType: 'Limited-Time Offer',
                header: 'Text',
                headerText: 'Price drop on your saved item',
                body: 'Hi ' + name(mode, ctx) + ', something on your saved list has come down ' +
                      'in price. Saved items are held in your account, so it is where you left it.',
                footer: 'Reply STOP to opt out',
                buttons: [
                    { type: 'Visit Website', label: 'See saved items', url: ctx.storeUrl + 'wishlist.html' }
                ]
            }
        })
    },

    {
        id: 'basket', journey: 'Basket building',
        channels: (mode, ctx) => ({
            onsite: {
                template: 'Product Box, on the product and cart pages',
                heading: 'Often bought together',
                body: 'The things people usually add alongside this one.',
                cta: 'Add to basket'
            },
            inbox: {
                title: 'Goes with your order',
                body: 'A few things people usually add alongside what you just bought.',
                expiryDays: 7, priority: 4, targetUrl: ctx.storeUrl
            }
        })
    },

    {
        id: 'replenish', journey: 'Replenishment',
        channels: (mode, ctx) => ({
            webPush: {
                title: 'Running low?',
                body: 'Reordering ' + short(mode, QUERIES.lastOrderLines, COLUMNS.orderLine.name,
                                            75, 'your usual', ctx.sampleProduct) + ' takes one tap.',
                targetUrl: ctx.storeUrl + 'cart.html'
            },
            mobilePush: {
                title: 'Time for another?',
                body: 'Your usual is one tap away, at the same price.',
                subtitle: 'Reorder',
                targetUrl: ctx.storeUrl + 'cart.html'
            },
            sms: {
                body: 'Hi ' + name(mode, ctx) + ', running low? Reorder your usual from ' +
                      ctx.storeName + ' in one tap: {{shortlink}} ' +
                      'Reply {{unsubscribe-link}} to opt out.',
                senderName: ctx.storeName
            },
            whatsapp: {
                category: 'Utility', messageType: 'Blank Content',
                header: 'Text', headerText: 'Time to reorder',
                body: 'Hi ' + name(mode, ctx) + ', judging by when you last ordered, you are ' +
                      'probably near the end of it. Reordering the same thing takes one tap and ' +
                      'keeps the same delivery address.',
                footer: 'Reply STOP to opt out',
                buttons: [
                    { type: 'Visit Website', label: 'Reorder', url: ctx.storeUrl + 'cart.html' },
                    { type: 'Quick Reply', label: 'Not yet' }
                ]
            }
        })
    },

    {
        id: 'rfm', journey: 'RFM lifecycle',
        channels: (mode, ctx) => ({
            onsite: {
                template: 'Image Bar, for the top of the page',
                heading: 'Early access is open to you',
                body: 'You are in the first group to see this, a day before everyone else.',
                cta: 'Shop early access'
            },
            webPush: {
                title: 'Yours first',
                body: 'Early access is open to you a day before everyone else. No code needed.',
                targetUrl: ctx.storeUrl
            },
            inbox: {
                title: 'Early access, before anyone else',
                body: 'You are one of our most regular customers, so this opens for you first. ' +
                      'Nothing to enter.',
                expiryDays: 2, priority: 1, targetUrl: ctx.storeUrl
            },
            whatsapp: {
                category: 'Marketing', messageType: 'Blank Content',
                header: 'Text', headerText: 'Early access',
                body: 'Hi ' + name(mode, ctx) + ', you are in the first group to see this, a day ' +
                      'before it opens to everyone. No code and nothing to enter: the link below ' +
                      'is already open to you.',
                footer: 'Reply STOP to opt out',
                buttons: [
                    { type: 'Visit Website', label: 'Shop early access', url: ctx.storeUrl }
                ]
            }
        })
    },

    {
        id: 'winback', journey: 'Win-back',
        channels: (mode, ctx) => ({
            webPush: {
                title: 'A few things changed',
                body: 'New ranges in ' + short(mode, QUERIES.viewedProducts, COLUMNS.view.category,
                                               30, 'your categories', ctx.sampleCategory) +
                      ', and your saved items are still saved.',
                targetUrl: ctx.storeUrl
            },
            inbox: {
                title: 'Since you were last here',
                body: 'New ranges in the categories you used to buy from, and everything you ' +
                      'saved is still exactly where you left it.',
                expiryDays: 7, priority: 3, targetUrl: ctx.storeUrl
            },
            sms: {
                body: 'Hi ' + name(mode, ctx) + ', it has been a while. New ranges are in at ' +
                      ctx.storeName + ', and your saved items are still saved: {{shortlink}} ' +
                      'Reply {{unsubscribe-link}} to opt out.',
                senderName: ctx.storeName
            },
            whatsapp: {
                category: 'Marketing', messageType: 'Copy Coupon',
                header: 'Text', headerText: 'Since you were last here',
                body: 'Hi ' + name(mode, ctx) + ', rather than send you a code for nothing, here ' +
                      'is what is actually different: new ranges in the categories you used to ' +
                      'buy from, and your saved items are untouched. The code below is yours if ' +
                      'you want it.',
                footer: 'Reply STOP to opt out',
                coupon: true,
                buttons: [
                    { type: 'Visit Website', label: 'See what is new', url: ctx.storeUrl }
                ]
            }
        })
    }
];
