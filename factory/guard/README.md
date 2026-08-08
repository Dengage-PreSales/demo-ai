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

**Reversed on 4 August 2026.** Demos now write those six tables deliberately,
through the SDK's own `ec:*` calls, because the recommendation engine feeds off
them. So "which table" is no longer a question worth asking: the answer is
always a real one.

What replaced three checks with two:

1. **`event-single-source`.** Every `ec:*`, `pageView` and `sendDeviceEvent`
   call lives in `js/dengageEvents.js` and nowhere else. That module is the only
   place identity, page context and the omission rules are applied, so it is the
   only place anyone has to read.
2. **`pageview-required`.** Every page loads that module, so `pageView` always
   fires. It is the On-Site trigger, and it is also the per-demo manifest: the
   SDK fills `page_url` and `session_id` itself, and `session_id` joins
   `page_view_events` to the five other tables. A page that skips it writes rows
   that can never be attributed to the demo that caused them.

That is a weaker guarantee than the three it replaced, and worth being honest
about. The failure mode changed shape rather than going away: from "wrote to the
wrong table", which a grep catches, to "emitted an event nobody audited".

A broken layout costs a demo. A row in `order_events` costs something nobody
can see and nobody can easily undo.

---

## The checks

| Check | What it rejects |
|---|---|
| `core-repo-isolation` | any reference to the core repository or its Pages origin |
| `event-single-source` | a Dengage event call outside `js/dengageEvents.js` |
| `pageview-required` | a storefront page that does not load the event module |
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

### One emitting module is what makes the tag checkable

`event-single-source` looks like a style rule and is not. Spread event calls
across twenty five modules and "every event carries the right context" becomes
twenty five things to verify, forever, including in every module written later.
Confine them to one file and it becomes one thing to read.

The history is worth keeping: this is the same move the deleted table allowlist
relied on. That check required the table name to be a **string literal at the
call site**, refusing variables, because CI cannot resolve what a variable holds.
Both checks work by removing the places a mistake can hide rather than by trying
to detect every mistake.

`pageview-required` exists because `pageView` is the manifest. Phase 0 confirmed
the SDK fills `page_url` and `session_id` on the row unprompted, and `session_id`
is the only join between `page_view_events` and the five other standard tables.
A page that skips it produces cart and order rows belonging to no identifiable
demo, and since those tables cannot be altered or deleted from, that is
permanent.

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
