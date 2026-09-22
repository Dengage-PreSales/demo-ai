#!/usr/bin/env bash
# ============================================================================
# EVERYTHING A BUILT DEMO MUST PASS, IN ONE PLACE, CALLED BY EVERYTHING.
#
#   bash factory/checks/verify-demo.sh <slug> [report.json]
#
# WHY THIS FILE EXISTS, and it is the most expensive lesson in the repository
# so far. The real build workflow and the nightly drill each carried their own
# copy of this sequence, hand kept, in two different files. On 18 September 2026
# the drill's copy was carefully brought in line with the build's, and hours
# later a new check was added to the build and not to the drill.
#
# The result: from 18 to 22 September every real demo request failed at that new
# check, and the drill reported success every single night on the same commit.
# The routine that exists to find a broken factory before a colleague does was
# green for four days while the factory was totally broken, because the two
# lists were never the same list.
#
# So there is one list now. The build calls this, the drill calls this, and a
# person running it by hand calls this. A check added here reaches all three at
# once, and the guard's verify-one-list check refuses a workflow that runs a
# demo check on its own instead.
#
# WHAT IS DELIBERATELY NOT HERE: publishing and the Supabase product sync.
# Those belong to a real request only, a drill must never do either, and they
# are the two steps whose absence from a drill is intentional rather than drift.
# ============================================================================
set -uo pipefail

SLUG="${1:-}"
REPORT="${2:-/tmp/report.json}"
if [ -z "$SLUG" ]; then
    echo "usage: bash factory/checks/verify-demo.sh <slug> [report.json]" >&2
    exit 2
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

STAGE=""
SERVER=""
cleanup() { [ -n "$SERVER" ] && kill "$SERVER" 2>/dev/null; return 0; }
trap cleanup EXIT

run() {
    STAGE="$1"; shift
    echo
    echo "--- $STAGE"
    if ! "$@"; then
        echo
        echo "VERIFY FAILED at $STAGE: demos/$SLUG"
        exit 1
    fi
}

run "the guardrails"            ./factory/guard/run.sh
run "the report a colleague is sent" node factory/checks/report-step.mjs "$REPORT" --show
run "the motif artwork"         node factory/make-motif-images.mjs
run "the product feed"          node factory/build-feed.mjs
run "the push banners"          node factory/make-push-images.mjs --slug "$SLUG"
run "the push banner check"     node factory/push-images.test.mjs
run "the shared email artwork"  node factory/emails/make-hero.mjs --shared
run "this demo's email artwork" node factory/emails/make-hero.mjs --slug "$SLUG"
run "the email template"        node factory/emails/build-beefree.mjs

# THE BROWSER CHECKS SHARE ONE SERVER, because each of them costs a few seconds
# and starting three is three chances to race the port.
python3 -m http.server 8101 --directory . >/dev/null 2>&1 &
SERVER=$!
for _ in $(seq 1 20); do
    curl -sf -o /dev/null "http://localhost:8101/demos/$SLUG/index.html" && break
    sleep 0.5
done

BASE="http://localhost:8101/demos/$SLUG/"

run "the smoke test"            node factory/checks/smoke.mjs --url "$BASE"

# AND THE PATH THE SMOKE TEST CANNOT SEE. It drives the demo with the SDK hosts
# reachable, so it only ever exercises the case where Dengage answers.
# standby.js drives the other one, with both hosts refused, which is the only
# way to know whether this demo goes dark on a call or draws its own copy.
TEMPLATE_URL="$BASE" run "the standby copy" node factory/checks/standby.js

# Every shelf the store has must be reachable from the header. A demo can hold
# nine categories and show six, and nothing else here would notice.
run "the navigation"            node factory/checks/nav.mjs --url "$BASE"

echo
echo "demos/$SLUG passed every check."
