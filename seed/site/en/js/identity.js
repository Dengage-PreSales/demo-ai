/* ============================================================================
   Resolves the Dengage contact key BEFORE dengage('initialize') runs.

   Why this file exists, and why it is loaded in the <head> ahead of the SDK
   snippet rather than with the other modules at the bottom of the page.

   The Event Collection doc is explicit:

     "if you have contact_key data at the start, you can pass it on the
      initialize method ... Any task that requires these identifications are
      going to be correct and consistent from the start. If you have these
      identifiers before calling the initialize method we recommend using this
      approach."

   We do have it at the start: a signed-in visitor's details are already in
   localStorage, readable synchronously. The previous wiring did the opposite.
   It called initialize() anonymously in the head, then a polling setInterval
   called setContactKey up to five seconds later, by which time pageView had
   already gone out. So page views landed on the anonymous device profile
   instead of the contact, which is exactly the symptom that was reported: the
   contact card showed nothing.

   Second thing this fixes: the contact key is NOT always the email address.
   A Dengage contact can have any contact_key, and the demo account's is
   "salil-demo" while the email is salil@dengage.com. Sending the email created
   a second, separate contact and the events attached to that one.

   Resolution order, first hit wins:
     1. ?ck=<key> in the URL, which then persists for the session. Use this to
        demo as any contact without touching code.
     2. a key already resolved and stored on this browser
     3. KNOWN_CONTACTS, for demo accounts whose key is not their email
     4. the email itself, which is the right default for a real signup

   Exposes window.DengageIdentity for the site's own code, and window.__dnInit
   for the SDK snippet.
   ========================================================================== */
(function () {
    'use strict';

    /* the site's localStorage key, passed on the script tag so one file serves
       every site while the per-site value stays visible in the HTML */
    var el = document.currentScript;
    var USER_STORE = (el && el.dataset && el.dataset.userStore) || 'cantupneus_user';
    var KEY_STORE = USER_STORE + '_dn_contact_key';

    /* Demo contacts whose Dengage contact_key is not their email address.
       Add a line here for any contact you want to demo as by signing up. */
    var KNOWN_CONTACTS = {
        'salil@dengage.com': 'salil-demo'
    };

    function read(store) {
        try { return localStorage.getItem(store); } catch (err) { return null; }
    }
    function write(store, value) {
        try { localStorage.setItem(store, value); } catch (err) { /* private mode */ }
    }

    function fromUrl() {
        var m = /[?&]ck=([^&#]+)/.exec(window.location.search);
        return m ? decodeURIComponent(m[1]) : null;
    }

    function storedEmail() {
        var raw = read(USER_STORE);
        if (!raw) return null;
        try { return (JSON.parse(raw) || {}).email || null; } catch (err) { return null; }
    }

    /* the contact key for a given email, without touching storage */
    function keyFor(email) {
        if (!email) return null;
        return KNOWN_CONTACTS[String(email).toLowerCase()] || email;
    }

    function resolve() {
        var url = fromUrl();
        if (url) { write(KEY_STORE, url); return url; }

        var kept = read(KEY_STORE);
        if (kept) return kept;

        var key = keyFor(storedEmail());
        if (key) { write(KEY_STORE, key); return key; }

        return null;   /* anonymous visitor, and that is fine */
    }

    var contactKey = resolve();

    window.DengageIdentity = {
        contactKey: contactKey,
        keyFor: keyFor,
        /* called on signup: resolve, persist, and hand back the key to send */
        adopt: function (email) {
            var key = keyFor(email);
            if (key) { write(KEY_STORE, key); this.contactKey = key; }
            return key;
        },
        forget: function () {
            try { localStorage.removeItem(KEY_STORE); } catch (err) { /* noop */ }
            this.contactKey = null;
        }
    };

    /* The SDK snippet reads this. It stays undefined for an anonymous visitor so
       the snippet calls initialize() exactly as before, unchanged behaviour. */
    if (contactKey) window.__dnInit = { contactKey: contactKey };
})();
