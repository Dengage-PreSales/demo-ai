# CLAUDE.md: Dengage Demo Factory (operating instructions)

> Read automatically at the start of every session. This file is deliberately
> lean: it holds the goal, the rules you must not break, and a pointer to the
> document that carries the depth. That document is
> [`DEMO-FACTORY-HANDOFF.md`](DEMO-FACTORY-HANDOFF.md). Read it in full before
> writing code, not after something breaks.

---

## 0. The goal

A pre-sales colleague who has never seen this repository opens a GitHub issue,
pastes one URL of a prospect's ecommerce website, and does nothing else. Within
30 minutes, with no developer involved and no clicks in the Dengage panel, a
working demo storefront is live and ready to screen-share on a sales call.

A demo is **done** when all twelve of these are true:

1. It is live at `https://dengage-presales.github.io/demo-ai/demos/<slug>/`
2. It is themed to the prospect: their colours, their typography, their category
   structure, their real product names and product images
3. It carries the Dengage logo with the subtext "eComm Demo", and never the
   prospect's logo or word mark
4. It is a working storefront: home, product listing, product detail, cart,
   checkout, search and a wishlist
5. Every Dengage on-site widget fires on demand from an in-page launcher, and can
   be re-fired repeatedly during one call without going dark. **Amended 5 August
   2026, numbers corrected 6 August:** this said "all eight" when eight creatives
   existed. **The rule is coverage rather than a number**, because the number has
   now been wrong twice. `factory/checks/launcher.js` counts the launcher against
   the creatives on disk in both directions and is the only place worth reading a
   count from. At the time of writing it reports 25 cards: 19 creatives held in
   this repository, 4 campaigns authored in the panel, and 2 cards that are not
   campaigns at all. Product Box, Smart Search, Typeform and the five
   recommendation strategies are parked, Salil's call, 6 August: see
   `factory/panel/README.md`
6. All five inline content slots are present and targetable from the panel
7. Web push works from the shared service worker at the **origin root**, which
   lives in the `dengage-presales.github.io` repository, not this one
7a. **The App Inbox is in the storefront**, reading the messages Dengage holds
   for the device. Added 5 August 2026. It is the one capability with no panel
   template behind it: nothing in the Visual Editor draws an inbox, so
   `template/js/inbox.js` is the inbox. A demo without it has no inbox to show,
   whatever is configured in the panel
8. Every page fires **`pageView`**, without exception. That call is the only
   thing that makes a demo's rows findable at all. See §1b
9. It writes to the six standard ecommerce tables, using the SDK's own `ec:*`
   calls, exactly as a real store would. **Reversed on 4 August 2026. See §1b**
10. Contacts it creates carry the key form `DPS-<n>`. The prefix is shared across
    demos on purpose and carries no slug: storage is namespaced by slug, so a
    second demo never adopts the first one's identity, and `js/identity.js` plus
    `factory/checks/test.sh` are the two places that state it
11. It deletes itself, and its rows and contacts, 90 days later

Target volume: **5 to 7 demos a month**, each live for **90 days**.

---

## 1. The rule that outranks everything

**Nothing this repository does may ever touch `salil-dengage/dengage-demos`.**

That repository holds five customer-facing demo sites and two mobile apps used
on live sales calls.

**You can reach it, and you must not.** The GitHub identity this session runs
as can read and write that repository. Claude Code supports one GitHub
connection per account, so this was accepted deliberately rather than
overlooked. Do not read from it, write to it, clone it, or add it to the
session. If something appears to require it, stop and ask Salil. It has never
yet been the right answer.

The part that is easy to get wrong: **the isolation is not only about files.**
Writing a row into a Dengage table that repository shares is as much a breach as
editing one of its files, and it is silent.

Know exactly how much is separate, because two of five layers are not, and both
of those are held by instruction alone:

| Layer | Separate? | Enforced by |
|---|---|---|
| Repository contents and GitHub account | yes | `Dengage-PreSales`, a different account |
| **Repository write access** | **no** | **instruction only. One GitHub connection per account** |
| Browser origin, storage, notification permission | yes | the browser |
| Dengage web application, campaigns, push | yes | a distinct app guid |
| **Dengage account 28, Data Space, tables, contacts** | **no** | **instruction only** |

**Neither split protects what matters most.** The account split does not protect
the tables, and the separate repository does not protect the core repository
from a write. Nothing separates a demo's rows from live traffic at write time at
all: what makes them **findable afterwards** is `pageView` and nothing else. See
§1b, which replaced an earlier and stronger set of protections. Nothing protects
the core repository except not touching it, and the guard's
`core-repo-isolation` check, which can only catch a reference that gets
committed here.

---

## 1b. Demos write to the standard ecommerce tables. `pageView` is the only way back to their rows

**Reversed on 4 August 2026, by Salil, deliberately.** The original design routed
every demo event into two private sandbox tables and forbade `ec:*` calls
outright. That is no longer what this repository does. Read handoff §1.3 and
§15a for the full reasoning; the short version is below.

**Why it changed.** The Dengage recommendation engine feeds off the standard
ecommerce tables. Sandbox tables would have meant a demo could never show
recommendations, which is one of the things a prospect most wants to see. The
standard tables are also already related to `master_contact`, so the contact
card, segmentation and profile enrichment work with no extra wiring.

**What demos now write**, using the SDK's own calls:

| Call | Table |
|---|---|
| `pageView` | `page_view_events` |
| `ec:addToCart`, `ec:removeFromCart`, `ec:deleteCart`, `ec:beginCheckout` | `shopping_cart_events` |
| `ec:order`, `ec:cancelOrder` | `order_events`, `order_events_detail` |
| `sendDeviceEvent` to `wishlist_events` | `wishlist_events` |
| `ec:search` | `search_events` |

The wishlist row is the one deliberate exception, changed 6 August 2026: it is
written with `sendDeviceEvent`, the SDK's documented named-table method and the
same mechanism the reference build's `wishlist.js` has always used, with the
emitter setting `event_id`, `event_type` and `is_used` itself. All three are
required for the row to be stored and none is part of the documented payload.
Same endpoint, same table, same fields; the stored row is identical. The reasoning
lives with the code in `template/js/dengageEvents.js`, and
`factory/checks/tools.mjs` pins the row field by field, so change either only with
both in view, and verify a change against a stored row rather than a green test
(§4).

**What this costs, stated plainly.** Demo rows now sit in the same six tables as
five live demo sites and two mobile apps. There is no structural separation left,
and there is no tag either.

**CORRECTED, 5 August 2026, and this is the correction that matters most in this
file.** Earlier revisions of §1b said every event carried a `demo_slug` column
and that the purge filtered on it. **`demo_slug` does not exist.** Columns cannot
be added to the six standard tables, confirmed by Salil, so no such column was
ever available to write to. The code never sent one; only this file claimed it
did. A specification that says rows are tagged when they are not is worse than
one that admits they are not, because it invites a purge filter that silently
matches nothing.

**How a demo's rows are actually found.** Only indirectly, through `pageView`.
The SDK fills `page_url`, `page_title` and `session_id` on that row itself, and
`session_id` is the only join between `page_view_events` and the other five
tables:

```
page_view_events where page_url contains the slug   ->  a list of session_id
     ->  those session_ids find its cart, order, wishlist and search rows
```

So the discipline moves rather than disappears:

1. **Every page fires `pageView`, before anything else.** This replaces the old
   `demo_slug` rule and carries the same weight. A page that skips it writes cart,
   order, wishlist and search rows whose `session_id` appears in no page view, so
   nothing can ever attribute them to a demo or clean them up. The guard's
   `pageview-required` check exists for exactly this.
2. **Events are emitted from one module only.** Nothing else in a demo calls
   `dengage('ec:...')` or `dengage('pageView')` directly. One file owns event
   emission and is the only thing CI has to audit. That is what makes rule 1
   checkable rather than hoped for.
3. **The purge does not delete rows at all.** Salil's instruction, 4 August 2026:
   demo data stays where it is, and if it ever grows enough to matter he raises a
   ticket with the backend team. Only the folder is deleted automatically, because
   a folder is in git and is recoverable. A scheduled job issuing deletes against
   production tables keyed on a join it computed itself is the most dangerous
   thing this design could contain. Handoff §10. **Do not re-automate it**
   without reopening §1a with Salil first.

**What did not change.** Prices and stock counts are still never fabricated
(§3.5). Contacts still carry `DPS-<n>`. The core repository is still
untouchable. The shared creatives are still generic.

So: a change to how this repository writes to Dengage deserves more scrutiny
than a change to how it looks. A broken layout costs a demo. A row in
`order_events` costs something nobody can see and nobody can easily undo.

If something appears to require reaching into the core repository, stop and ask
Salil. It has never yet been the right answer.

---

## 1a. Never delete or truncate anything in Dengage without written approval

**Salil's explicit instruction. It is never skipped, never assumed, and never
inferred from context.**

Get approval **in writing, in the conversation, for that specific object, before
the call is made.** Not afterwards. Not because the object looks empty,
disposable, wrong, or because you created it yourself five minutes ago. Not
because a previous message sounded like it was heading that way. An offer to
handle something manually is not an approval, and neither is a general
discussion of cleanup.

This covers, at minimum:

| Action | Endpoint or surface |
|---|---|
| Drop a table | `DELETE /rest/dataspace/tables/{id}/drop` |
| Truncate a table | `DELETE /rest/dataspace/tables/{id}/truncate` |
| Delete rows | `DELETE /rest/dataspace/sync/delete`, `/async/delete` |
| Delete or merge contacts | any contact endpoint, and the panel |
| Delete a campaign, creative, segment or application | the panel |

**Why it is absolute here.** The Data Space is shared with five live demo sites
and two mobile apps. A dropped table cannot be restored from this side, the
blast radius is invisible from the demo, and by the time anyone notices, the
call it broke has already happened.

**This binds the 90 day purge too** (handoff §10). A scheduled job that deletes
rows and contacts is this same action on a timer. It is designed and reviewed
with Salil before it is ever armed, it names exactly what it will remove, and
it never widens its own filter.

**Reading is always fine.** `GET` a table, count its rows, inspect a schema,
report what you found and what you would remove. Then stop and ask.

---

## 2. Read these before touching the thing they cover

| File | When |
|---|---|
| `DEMO-FACTORY-HANDOFF.md` | **before writing any code.** The complete specification. Everything below is a summary of it |
| handoff §2 | anything with a counterpart someone must click in the Dengage panel |
| handoff §2.2a | before writing or changing any shared creative |
| handoff §5.3 | **before copying any module out of `seed/`.** The most consequential section in the document |
| handoff §12 | before "fixing" anything that looks oddly indirect. Ten traps, every one already paid for |
| handoff §14 | what is blocked on Salil, and what is settled and must not be reopened |
| `factory/panel/content/_dynamic/README.md` | **before writing any Dynamic Content asset, for any channel.** Its "Writing the next scenario" section is the reusable half: six steps, of which a new scenario changes two, and eight facts about the template engine that were each found by a failed send rather than by reading. None of it is in Dengage's documentation, so it exists nowhere else |

---

## 3. Non-negotiables

1. **Every page fires `pageView`, and events come from one module only.**
   See §1b. `ec:*` calls are now expected rather than forbidden, so the old
   table allowlist is gone and this replaces it. There is no `demo_slug` column
   and there never was one: columns cannot be added to the six standard tables,
   so `pageView` is the only thing that makes a demo's rows findable, through
   `page_url` and the `session_id` join. A page that skips it writes cart, order
   and wishlist rows that belong to no identifiable demo. CI enforces both halves:
   `pageview-required` checks every page loads the event module, and
   `event-single-source` refuses an SDK call anywhere else. Neither alone is
   sufficient.
2. **Every generated demo fires the `dengage_demo_` prefix and nothing else.**
   The campaigns exist once and serve every demo. A demo never gets its own, and
   the set does not grow when a demo is built. `factory/checks/launcher.js` is
   the count, not this file.
3. **The Dengage logo, never the prospect's.** Their colours, typography,
   category structure, product names and product photography are used. Their
   logo and word mark are not.
4. **No external asset hosting at runtime.** Product images are downloaded,
   compressed and committed. A demo must never depend on a third-party CDN,
   because the prospect can change it between the build and the call.
5. **Never fabricate a number to fill a column.** No price, no `stock_count`,
   no order value that the scrape did not genuinely produce. Omit the column.
   `Number(null)` is `0`, and that trap has shipped the same bug twice on the
   core repository.
   **One exception, added 7 August 2026, and it is the only one.**
   `factory/scrape/fallback.mjs` invents a whole catalogue, prices included, for a
   store that refuses every automated reader. Asking for a CSV instead had become
   the normal path rather than the exception, and a factory that stops for a
   spreadsheet is not automatic. The distinction that keeps this from swallowing
   the rule: **inventing a figure for a REAL product is still forbidden
   everywhere**, because nothing downstream can tell it from a scraped one. The
   exception covers inventing an entire catalogue that **announces itself as
   invented**, in three places that are all load bearing: `tier: 'generated'` in
   the report, `catalogueSource: 'generated'` in `demo.config.json`, and the first
   line of the issue comment. `stockCount` is still never invented, even there.
   No product name in it may name a real brand or model, or the distinction
   collapses.
6. **Every demo is namespaced by its slug.** Element ids, CSS classes, the
   localStorage cart key, custom event names. All demos share one origin, so
   two open in one browser must not collide.
7. **Every shared creative is generic.** They cannot name a brand, a
   product, a price or a vertical, and they cannot use `{%= %}` tags to get
   around it. Their CTAs **report the click and dismiss, never navigate**:
   there is no URL that is correct for every demo, and a relative one resolves
   against the iframe rather than the page. Changing one creative changes every
   live demo at once.
8. **`seed/` is scaffolding and gets deleted at the end of Phase 1.** Until
   then it is excluded from CI, because it is a verbatim copy of another
   repository's branded site and will fail every check by design.
9. **This repository is public and customer-facing throughout.** Code comments,
   UI strings, commit messages, test output, issue templates. Write all of it
   as product documentation. Internal engineering notes, diagnostics and vendor
   correspondence go to Salil directly, never into a file here.
10. **No em dashes and no en dashes.** Commas, periods, colons, or rephrase.

---

## 4. How to work

### Run a demo locally

```bash
python3 -m http.server 8101
# http://localhost:8101/demos/<slug>/
```

Serve from the **repository root**, not a demo folder, so relative paths
resolve the way they do on Pages.

Web push is not testable this way. The service worker lives at the origin root,
in the `dengage-presales.github.io` repository, and the application's push
domain is the published origin. Locally there is no worker above the demo, so
push is checked on the published site rather than here.

### Verify

**Verify in a browser, not by reading a diff.** A demo that looks right in a
diff and breaks on screen costs a deal.

**Test your guards against known-bad input.** A guard that passes on an empty
repository proves nothing. This has already caught two real defects here: a
denylist that missed `onsite_events`, and a dash check whose regex silently
errored under a non-UTF-8 locale and reported every file clean. Any check that
can fail open needs a test that would catch it failing open.

The smoke test in handoff §9 is the acceptance check for a generated demo:
about thirty seconds, twelve assertions. A generated demo is disposable and
does not earn a full regression suite. Items 5, 9 and 10 protect the core
assets and the demo's credibility, so they are never skipped for speed.

**An HTTP 200 from the event endpoint means accepted, not stored.** The row in
Data Space is the only proof an event landed. Skipping that check has produced
two confident and wrong "it is working" claims on the core repository.

**`?debug=1` shows what a demo sent.** Add it to any demo URL and a readout
appears at the bottom left listing every event the page sent, newest first, with
its full payload and the table each one writes. It stays on through a click
through to a product page, and `?debug=0` or the panel's close control turns it
off. Nothing about it is visible on a normal demo URL.

```
https://dengage-presales.github.io/demos/<slug>/?debug=1
```

It answers "did pressing that button send anything, and what was in it" in one
glance, which is the question that used to take an afternoon. **It reports what
the page SENT, not what Dengage STORED**, so it narrows the search rather than
replacing the paragraph above: the row is still the only proof. Read it together
with the browser's network panel, because a request that never left the browser
and one that was accepted look the same from inside the page.

`factory/phase0/tables.mjs --counts` is the other half: run it, use the demo, run
it again. A count that moved is not proof it was your event, because the account
is shared, but a count that did not move is proof it was not.

### Build order

Four phases, in order, in handoff §13. Do not start Phase 1 before Phase 0 is
genuinely done: Phase 0 proves the panel side works, and everything after it
assumes that.

---

## 5. When the specification is wrong

The handoff was written without access to the Dengage panel, so its panel-side
details are the most likely place for it to be wrong. If something in it turns
out to be incorrect or unbuildable, **say so and propose the fix rather than
quietly working around it**, then update the handoff in the same change. A
specification that has silently diverged from the code is worse than no
specification, because the next person trusts it.

---

## 6. Tone for anything client-facing

- Plain, confident product language. No filler, no invented metrics.
- The demos are fictional storefronts built for a sales conversation. They
  carry a prospect's real product names, so never claim or imply the demo is
  the prospect's own site.
- Failure messages on an issue are read by a salesperson, not an engineer.
  "We could not read this store's catalogue automatically. Attach a CSV of 20
  to 30 products and I will retry" is right. A stack trace is not.
