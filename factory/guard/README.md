# The guardrails

    ./factory/guard/run.sh      check the repository
    ./factory/guard/test.sh     check that the checks work

Both run in CI on every change, `test.sh` first. If the checks have stopped
working, the result of running them over the repository means nothing.

---

## What these are actually protecting

The sandbox Dengage web application sits inside account 28. That gives it its
own campaigns and its own push configuration, and it does **not** give it its
own Data Space. Every table and every contact is shared with the five core demo
sites and the two mobile apps that the sales team uses on live calls.

A separate GitHub account gives this project its own browser origin, so storage
and notification permission cannot collide. It does nothing for the tables.

Three things protect those, and they are the whole of it:

1. No `ec:*` calls.
2. The table allowlist, here.
3. The event panel's runtime validation, in the storefront module itself.

None of the three is defence in depth for the others. Numbers 1 and 2 are
static analysis and cannot see a table name chosen while a demo is running.
Number 3 is runtime and cannot see code that is never executed.

A broken layout costs a demo. A row in `order_events` costs something nobody
can see and nobody can easily undo.

---

## The checks

| Check | What it rejects |
|---|---|
| `core-repo-isolation` | any reference to the core repository or its Pages origin |
| `ec-calls` | any `ec:*` call, and any on-screen copy describing one |
| `table-allowlist` | a `sendDeviceEvent` target that is not one of two literals |
| `standard-table-names` | a standard Dengage table named in the storefront's own copy. Supplementary, see below |
| `off-origin-assets` | a browser-loaded URL on a host that is not the SDK CDN, Google Fonts, this origin or localhost |
| `image-locations` | an image committed outside `assets/`, `demos/<slug>/images/` or `template/vendor/assets/` |
| `dashes` | an em dash or an en dash in committed text |
| `app-guid` | any application identifier that is not the configured sandbox one, and any identifier at all in `template/` |
| `template-purity` | a brand name in `template/`, or a colour literal below the `:root` block |
| `seed-removed` | `seed/` still present once `template/` exists |

Each prints one line beginning `PASS`, `FAIL` or `SKIP`. Every check runs on
every invocation: it does not stop at the first failure, because the test suite
asserts that a known-bad tree is rejected on every count rather than only the
first.

---

## Three of them are worth understanding

### The table allowlist is an allowlist, and that is not a detail

Every `sendDeviceEvent` call site must name its table as a **string literal**
that is one of `sandbox_events` or `sandbox_onsite_events`. A variable, a
template literal or a concatenation is rejected, because CI cannot see what it
resolves to.

A denylist of the five standard ecommerce tables looks equivalent and is not.
It catches `wishlist.js`, which writes `wishlist_events` with no `ec:` call
anywhere in the file. It **misses `cantuCatalog.js` completely**, because that
module writes `onsite_events`, which is a core account table that was not on
anybody's denylist. It would also miss any table nobody has invented yet.

`standard-table-names` is a denylist and is kept only to catch a standard table
named in the storefront's own copy, which is not a call site and which the
allowlist therefore cannot see. The event panel in the reference build
announces `order_events` to the audience on screen, and a card that describes
one table while writing to another is worse than no card.

It is supplementary, it is scoped to `template/` and `demos/` because the
factory tooling has to name these tables in order to explain why they are
forbidden, and it is not the guarantee. Nothing about it makes the allowlist
optional.

### The dash check matches bytes, not code points

It matches the raw UTF-8 bytes of U+2014 and U+2013 under `LC_ALL=C`, as fixed
strings.

A PCRE code point pattern such as `\x{2014}` requires a UTF-8 locale and
**silently errors out without one, reporting every file clean**. That is the
worst failure mode a check can have, because it is indistinguishable from
success, and it passed on a file containing a real em dash once already.

The test suite runs this check under `LC_ALL=C` and `LC_ALL=POSIX` against a
file containing a real em dash. CI runs the whole suite a second time with
`LC_ALL=C` set.

### A check that cannot run fails

`app-guid` fails when demos exist and `factory/sandbox.json` has no identifier
to check them against. It does not report clean because it had nothing to
compare. Any check that can fail open needs a test that would catch it failing
open, and those tests are in group 3 of the test suite.

---

## The test suite

`test.sh` runs the guard against input that is known to be wrong and asserts it
is rejected. A guard that passes on an empty repository proves nothing.

| Group | Asserts |
|---|---|
| 1 | every check fails on the committed fixture in `fixtures/naive-copy/` |
| 2 | the dash check catches a real em dash under four locales, and does not report a hyphen |
| 3 | checks that could report clean because they could not run fail instead |
| 4 | a correct tree passes, so the guard is not simply rejecting everything |
| 5 | `seed/site/en/` copied verbatim into `template/` is rejected, while `seed/` still exists |

Group 5 is the literal instruction: run the guard against a naive copy of the
reference build. Group 1 is the durable form of the same test, hand written so
that it survives `seed/` being deleted at the end of Phase 1.

---

## Two scopes are excluded

`seed/` is a verbatim copy of another repository's branded site and fails every
check by design. It is excluded until Phase 1 deletes it, and `seed-removed` is
what stops that exclusion outliving its purpose.

`factory/guard/fixtures/` is deliberately known-bad input for the test suite
above. Nothing is served from it.

Both exclusions are named in one place at the top of `run.sh`. Adding a third
should feel like a decision.
