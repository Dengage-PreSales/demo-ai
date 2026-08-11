#!/usr/bin/env bash
# =============================================================================
# Proves the template check would CATCH the bug it exists for. Handoff 9.1, 11.1.
#
#   bash factory/checks/test.sh
#
# CLAUDE.md: a guard that passes on a correct tree proves nothing. This one has
# already earned that rule twice over, because the first version of the storage
# assertion passed by comparing null to null in exactly the situation it existed
# to catch.
#
# So: reintroduce handoff 12.11 into a throwaway copy of the template, run the
# collision section against it, and require it to FAIL. If it passes, the check
# is decorative and the next person to break namespacing will not be told.
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PORT_BAD:-8103}"
PORT_GAP="${PORT_GAP:-8104}"
WORK="$(mktemp -d)"
PIDS=()
cleanup() {
    for pid in "${PIDS[@]:-}"; do [ -n "$pid" ] && kill "$pid" 2>/dev/null; done
    rm -rf "$WORK"
}
trap cleanup EXIT

command -v node >/dev/null 2>&1 || { echo "node is required"; exit 2; }
node -e "require('playwright')" 2>/dev/null || {
    echo "Playwright is required:  npm ci"; exit 2; }

echo "Building a known-bad copy: the slug read before it is set (handoff 12.11)"

for slug in alpha beta; do
    cp -r "$ROOT/template" "$WORK/$slug"
    python3 - "$WORK/$slug" "$slug" <<'PY'
import io, json, re, sys
base, slug = sys.argv[1].rstrip('/') + '/', sys.argv[2]

for name in ('index.html', 'product.html'):
    text = io.open(base + name, encoding='utf-8').read()
    # THE BUG: the generator never writes the attribute, so nothing in the head
    # can see the slug.
    text = text.replace(' data-demo-slug="template"', '')
    io.open(base + name, 'w', encoding='utf-8').write(text)

config = json.load(io.open(base + 'demo.config.json', encoding='utf-8'))
config['slug'] = slug
json.dump(config, io.open(base + 'demo.config.json', 'w', encoding='utf-8'), indent=2)

# THE BUG, second half: modules resolve the slug from the DOM at evaluation time,
# and boot.js sets the attribute later, so every demo falls back to 'demo'.
ident = io.open(base + 'js/identity.js', encoding='utf-8').read()
ident = re.sub(
    r"var slug = document\.documentElement\.getAttribute\('data-demo-slug'\);.*?window\.DEMO_SLUG = slug;",
    "var slug = document.documentElement.getAttribute('data-demo-slug') || 'demo';\n"
    "    window.DEMO_SLUG = slug;",
    ident, flags=re.S)
io.open(base + 'js/identity.js', 'w', encoding='utf-8').write(ident)

store = io.open(base + 'js/store.js', encoding='utf-8').read()
store = store.replace(
    "var slug = window.DEMO_SLUG || 'demo';",
    "var slug = document.documentElement.getAttribute('data-demo-slug') || 'demo';")
io.open(base + 'js/store.js', 'w', encoding='utf-8').write(store)

boot = io.open(base + 'js/boot.js', encoding='utf-8').read()
boot = re.sub(
    r"if \(results\[0\]\.slug && results\[0\]\.slug !== window\.DEMO_SLUG\) \{.*?\n        \}",
    "document.documentElement.setAttribute('data-demo-slug', results[0].slug || 'demo');",
    boot, flags=re.S)
io.open(base + 'js/boot.js', 'w', encoding='utf-8').write(boot)
PY
done

# Confirm the fixture really is broken, so a silently failed patch cannot make
# this test pass by leaving a correct tree behind.
if grep -q 'data-demo-slug="' "$WORK/alpha/index.html"; then
    echo "FAIL  the fixture still carries data-demo-slug, so it is not the bad case"
    exit 1
fi
if ! grep -q "getAttribute('data-demo-slug')" "$WORK/alpha/js/store.js"; then
    echo "FAIL  the fixture's store.js was not reverted, so it is not the bad case"
    exit 1
fi
echo "  fixture is genuinely broken: no attribute, and store.js reads the DOM"

python3 -m http.server "$PORT" --directory "$WORK" >/dev/null 2>&1 &
PIDS+=("$!")
for _ in 1 2 3 4 5 6 7 8 9 10; do
    curl -sf -o /dev/null "http://localhost:$PORT/alpha/index.html" && break
    sleep 0.4
done

echo
echo "Running the collision section against it. It MUST fail."
echo

NODE_PATH="${NODE_PATH:-}" BAD_URL="http://localhost:$PORT/" \
    node "$ROOT/factory/checks/collision.js"
status=$?

echo
if [ "$status" -eq 0 ]; then
    echo "FAIL  the check passed on a tree with handoff 12.11 reintroduced."
    echo "      It is not testing what it claims to test."
    exit 1
fi
echo "PASS  the check rejected the known-bad tree, as it must."

# =============================================================================
# SECOND BAD CASE: the launcher and the creatives folder out of step.
#
# This is the state the repository was actually in, and it is the reason
# factory/checks/launcher.js exists: fourteen creatives written, committed and
# documented, while js/panels.js still offered eight. Nothing failed. Every other
# check passed and the site was live, because a scenario with no button is not an
# error anywhere, it is simply absent.
#
# A count that only ever runs against a correct tree is the same decorative check
# as the null-to-null comparison above. So drop three entries out of the list and
# require the count to notice.
# =============================================================================
echo
echo "Second bad case: three scenarios removed from the launcher list"

BAD2="$WORK/gap"
cp -r "$ROOT/template" "$BAD2"
python3 - "$BAD2" "$ROOT/factory/checks" <<'PY'
import io, sys
# No __pycache__ next to the checks: importing the helper is a detail of running
# this test, not something to leave behind in the working tree.
sys.dont_write_bytecode = True
sys.path.insert(0, sys.argv[2])
from live_code import live_source

base = sys.argv[1].rstrip('/') + '/'
p = base + 'js/panels.js'
src = io.open(p, encoding='utf-8').read()
lines = src.split('\n')

# COMMENTS ARE BLANKED FOR THE SEARCH, and the file is edited through `lines`.
# panels.js parks a campaign by commenting its entry out, so the text slug: 'x'
# appears for entries the page does not offer: product-box, smart-search, typeform
# and reco-engine are all sitting in block comments. Searching the raw text would
# find a parked entry, delete the comment, leave the live entry in place, and hand
# the launcher section a fixture that is not the bad case while every assertion
# here still passed. live_source keeps the two lists the same length, so an index
# found in `masked` is the line to delete in `lines`.
masked = live_source(src).split('\n')

# THE BUG: a creative exists on disk and the launcher does not offer it. One from
# each of the three groups added after the original eight, so a check that merely
# compared totals would still be caught.
#
# Line based rather than a regular expression, because an entry may wrap onto a
# continuation line and a pattern that assumed one line silently removed two of the
# three and left the fixture half correct.
for slug in ('slide-in', 'scratch-card', 'inline-in-grid'):
    start = next((i for i, l in enumerate(masked) if ("slug: '%s'" % slug) in l), None)
    assert start is not None, 'no LIVE entry for %s, so the fixture is not the bad case' % slug
    end = start
    while end < len(masked) and '}' not in masked[end]:   # continuation lines
        end += 1
    assert end < len(masked), 'the entry for %s never closes, so the fixture is unsafe to edit' % slug
    # Both lists, so the indices stay aligned for the slugs still to come.
    del lines[start:end + 1]
    del masked[start:end + 1]

io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
PY

# Same belt and braces as above: prove the fixture is genuinely broken before
# treating a failure as meaningful. Against the LIVE code, for the reason given in
# the mutation step: a commented-out mention of a slug would answer this grep and
# report the fixture unbroken when it is exactly right.
#
# Written to a file rather than piped into grep on purpose. Under pipefail a failing
# masker makes the whole pipeline non-zero, `if` reads that as "no match", and the
# loop would wave through a fixture nobody had checked.
LIVE2="$WORK/gap-panels-live.js"
if ! python3 "$ROOT/factory/checks/live_code.py" "$BAD2/js/panels.js" > "$LIVE2"; then
    echo "FAIL  could not read the fixture's live code, so the fixture cannot be trusted"
    exit 1
fi
if [ ! -s "$LIVE2" ]; then
    echo "FAIL  the fixture's live code came back empty, so the search below proves nothing"
    exit 1
fi
# The positive control. A masker that blanked the whole file, or a grep that could
# not match anything at all, would satisfy every assertion below by finding nothing.
# So require a slug that IS still live to be found first. CLAUDE.md section 4: any
# check that can fail open needs a test that would catch it failing open.
if ! grep -q "slug: 'spin-to-win'" "$LIVE2"; then
    echo "FAIL  spin-to-win is not in the fixture's live code either, so this search"
    echo "      cannot tell a removed entry from one it simply never finds"
    exit 1
fi
for slug in slide-in scratch-card inline-in-grid; do
    if grep -q "slug: '$slug'" "$LIVE2"; then
        echo "FAIL  $slug is still in the fixture's live list, so it is not the bad case"
        exit 1
    fi
done
if [ ! -e "$ROOT/factory/creatives/slide-in.html" ]; then
    echo "FAIL  slide-in.html is not on disk, so removing its button is not a gap"
    exit 1
fi
echo "  fixture is genuinely broken: three file backed cards removed from the list"

# The launcher check derives its expected list from factory/creatives/, which is
# read from the repository rather than from the fixture, so serving the broken copy
# from the repository root is what puts the two out of step.
python3 -m http.server "$PORT_GAP" --directory "$WORK" >/dev/null 2>&1 &
PIDS+=("$!")
for _ in 1 2 3 4 5 6 7 8 9 10; do
    curl -sf -o /dev/null "http://localhost:$PORT_GAP/gap/index.html" && break
    sleep 0.4
done

echo
echo "Running the launcher section against it. It MUST fail."
echo
TEMPLATE_URL="http://localhost:$PORT_GAP/gap/" node "$ROOT/factory/checks/launcher.js"
status2=$?

echo
if [ "$status2" -eq 0 ]; then
    echo "FAIL  the check passed with three creatives missing from the launcher."
    echo "      It would not have caught the gap it was written for."
    exit 1
fi
echo "PASS  the check rejected the out of step launcher, as it must."
exit 0
