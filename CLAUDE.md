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

A demo is **done** when all eleven of these are true:

1. It is live at `https://dengage-presales.github.io/demo-ai/demos/<slug>/`
2. It is themed to the prospect: their colours, their typography, their category
   structure, their real product names and product images
3. It carries the Dengage logo with the subtext "eComm Demo", and never the
   prospect's logo or word mark
4. It is a working storefront: home, product listing, product detail, cart,
   checkout, search and a wishlist
5. All eight Dengage on-site widgets fire on demand from an in-page launcher,
   and can be re-fired repeatedly during one call without going dark
6. All five inline content slots are present and targetable from the panel
7. Web push works from the shared service worker at the repository root
8. Every event it records lands in `sandbox_onsite_events` or `sandbox_events`,
   tagged with its `demo_slug`. The only exception is `pageView`, which stays
9. It writes nothing to `shopping_cart_events`, `order_events`,
   `order_events_detail`, `wishlist_events` or `search_events`, and makes no
   `ec:*` call at all
10. Contacts it creates carry the key form `ddemo-<slug>-<n>`
11. It deletes itself, and its rows and contacts, 90 days later

Target volume: **5 to 7 demos a month**, each live for **90 days**.

---

## 1. The rule that outranks everything

**Nothing this repository does may ever touch `salil-dengage/dengage-demos`.**

That repository holds five customer-facing demo sites and two mobile apps used
on live sales calls. This session has no access to it and must not request any.

The part that is easy to get wrong: **the isolation is not only about files.**
Writing a row into a Dengage table that repository shares is as much a breach as
editing one of its files, and it is silent.

Know exactly how much is separate, because three of four layers are, and the
fourth is the one that matters:

| Layer | Separate? | Enforced by |
|---|---|---|
| Repository and GitHub account | yes | `Dengage-PreSales`, a different account |
| Browser origin, storage, notification permission | yes | the browser |
| Dengage web application, campaigns, push | yes | a distinct app guid |
| **Dengage account 28, Data Space, tables, contacts** | **no** | **nothing but discipline** |

**The account split does not protect the tables.** Three things do, and they
are the whole of it: no `ec:*` calls, the table allowlist in CI, and the event
panel's runtime validation. None is redundant with the others.

So: a change to how this repository writes to Dengage deserves more scrutiny
than a change to how it looks. A broken layout costs a demo. A row in
`order_events` costs something nobody can see and nobody can easily undo.

If something appears to require reaching into the core repository, stop and ask
Salil. It has never yet been the right answer.

---

## 2. Read these before touching the thing they cover

| File | When |
|---|---|
| `DEMO-FACTORY-HANDOFF.md` | **before writing any code.** The complete specification. Everything below is a summary of it |
| handoff §2 | anything with a counterpart someone must click in the Dengage panel |
| handoff §2.2a | before writing or changing any of the eight shared creatives |
| handoff §5.3 | **before copying any module out of `seed/`.** The most consequential section in the document |
| handoff §12 | before "fixing" anything that looks oddly indirect. Ten traps, every one already paid for |
| handoff §14 | what is blocked on Salil, and what is settled and must not be reopened |

---

## 3. Non-negotiables

1. **No `ec:*` calls, ever. Table names are an ALLOWLIST, not a denylist.** The
   only two permitted are `sandbox_events` and `sandbox_onsite_events`. A
   denylist of the standard tables misses `cantuCatalog.js`, which writes
   `onsite_events`. CI enforces the allowlist, and it cannot see the one hole
   that matters: the event panel validates its table name at runtime too.
2. **Every generated demo fires the `dengage_demo_` prefix and nothing else.**
   Eight campaigns exist once and serve every demo. A demo never gets its own.
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
6. **Every demo is namespaced by its slug.** Element ids, CSS classes, the
   localStorage cart key, custom event names. All demos share one origin, so
   two open in one browser must not collide.
7. **The eight creatives are shared and generic.** They cannot name a brand, a
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

Serve from the **repository root**, not a demo folder, so the shared service
worker resolves.

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
