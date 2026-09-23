#!/usr/bin/env bash
# ============================================================================
# EVERY CHECK THAT JUDGES THE REPOSITORY, IN ONE PLACE, CALLED BY EVERYTHING.
#
#   bash factory/checks/verify-repo.sh
#
# The sibling of factory/checks/verify-demo.sh, and here for the same reason.
# That file exists because the build workflow and the nightly drill each kept
# their own copy of the checks a BUILT DEMO must pass, the two drifted, and four
# days of broken builds hid behind a green routine.
#
# This one closes the same hole one level up. The Guard workflow ran fourteen
# commands that no local command ran, so "the guard passes" meant
# factory/guard/run.sh and nothing else, and a change could pass everything a
# person could reasonably run and still go red in CI. It did, on 22 September:
# retiring five demos left a shared email preview pointing at a retired demo's
# images, factory/panel/links.test.mjs catches exactly that, and nothing local
# ran it.
#
# So there is one list. The Guard workflow calls this, a person calls this, and
# the guard's own verify-one-list check refuses a workflow that runs these
# checks itself instead.
#
# THE BUILD WORKFLOW CALLS THIS TOO, and that is the second half of the same
# repair. It used to prove the scrape pipeline with twelve lines of its own
# before touching a prospect's site, eight of which were in no other list: a
# change could break factory/copy.test.mjs, pass the Guard workflow, and fail
# every real demo request. That is the 18 September outage with the two files
# swapped round.
#
# A BROWSER IS REQUIRED. Three of these suites render fixtures served from
# 127.0.0.1, which is what proves a dark store produces a dark demo, so every
# workflow calling this installs chromium first. They are here rather than
# excused because a repository whose render tier is broken cannot build a demo,
# and a list that leaves out the slow half is the drift this file exists to end.
#
# WHAT IS NOT HERE: the browser suite in factory/checks/run.sh, which needs a
# server and several minutes, and the per demo checks in verify-demo.sh. Those
# are separate on purpose and are run separately.
# ============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

FAILED=""

run() {
    local name="$1"; shift
    echo
    echo "--- $name"
    if ! "$@"; then
        FAILED="${FAILED}  ${name}"$'\n'
    fi
}

# The guard's own test suite first and always. A guard that passes on an empty
# repository proves nothing, so the evidence these checks work is that they
# reject a tree known to be wrong, on every count.
run "the guard's own test suite"        ./factory/guard/test.sh
LC_ALL=C LANG=C run "the same suite in a non-UTF-8 locale" ./factory/guard/test.sh
run "the guardrails"                    ./factory/guard/run.sh

run "generator decisions"               node factory/scrape/scrape.test.mjs
run "the issue request parser"          node .github/scripts/parse-request.test.mjs
# The two if: expressions that decide who may start a build, evaluated
# against the situations that have actually happened. They are the only lines
# here that cannot be run outside GitHub Actions, and both times they have
# been wrong the symptom was a correct refusal delivered as silence.
run "the front door"                    node .github/scripts/gate.test.mjs

# THE SCRAPE PIPELINE, which decides whether a demo has photographs, a theme and
# a catalogue at all. A regression in any of these ships a demo that is quietly
# degraded rather than one that is obviously broken, which is the worst kind to
# find on a call.
run "product photographs"               node factory/scrape/images.test.mjs
run "the render tier"                   node factory/scrape/render.test.mjs
run "the screenshot fallback"           node factory/scrape/screenshot.test.mjs
run "the storefront's words"            node factory/copy.test.mjs
run "stock counts"                      node factory/scrape/stock.test.mjs
# The rendered theme channel, which is what makes a dark store produce a dark
# demo. Its fixtures are served from 127.0.0.1, so it is quick and touches no
# network, but it does need the browser.
run "the rendered theme channel"        node factory/scrape/theme-rendered.test.mjs

# THE SCHEMA CHECK RUNS BEFORE THE CONTENT SUITES, because every one of them
# assumes the column names are real. It needs no credentials and no network: it
# compares the code against factory/phase0/SCHEMA.md, which was read off the live
# account, so it runs on a runner the Dengage IP allowlist would refuse.
run "the table schema"                  node factory/phase0/schema.test.mjs
run "the product feed"                  node factory/feed.test.mjs
run "the product feed is up to date"    node factory/build-feed.mjs --check
run "push banners"                      node factory/push-images.test.mjs
run "scenario emails"                   node factory/emails/scenarios.test.mjs
run "the dynamic cart asset"            node factory/panel/content/_dynamic/cart.test.mjs
run "short form assets"                 node factory/snippets.test.mjs
# The short form pack: the length checker in both directions, SMS counted the way
# Dengage charges it, WhatsApp's submission rules, and the on-site copy staying
# generic because those creatives are shared by every demo.
run "the short form pack"               node factory/messages/messages.test.mjs
run "the BeeFree template"              node factory/emails/beefree.test.mjs
run "every link in the panel content"   node factory/panel/links.test.mjs
# AND THAT IT IS STILL WHAT ITS GENERATORS PRODUCE. The link check reads what
# is committed and asks whether it resolves, so it cannot see a preview that
# resolves and is years out of date. Both halves of that were true on
# 22 September: one preview pointed at a retired demo, and all seven of the
# others still sampled a product with no photograph.
run "the shared content is current"     node factory/checks/generated-current.mjs
run "the creatives' theme bootstrap"    python3 factory/creatives/sync-bootstrap.py --check
run "the sample push"                   node factory/panel/send-instant-push.mjs --self-test
run "the publication wait"              ./factory/checks/publish.sh

echo
if [ -n "$FAILED" ]; then
    echo "Repository checks FAILED:"
    printf '%s' "$FAILED"
    exit 1
fi
echo "Repository checks passed."
