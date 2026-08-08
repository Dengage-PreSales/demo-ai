#!/usr/bin/env bash
# =============================================================================
# Runs the template's browser checks. Handoff 9.1.
#
#   bash factory/checks/run.sh
#
# It builds its own fixtures, starts its own servers, and cleans both up. The
# only thing it needs from the machine is a browser and Playwright.
#
# THE SECOND SERVER IS THE POINT, so do not simplify it away. The namespacing bug
# in handoff 12.11 was invisible with one demo open, and localStorage is scoped
# per ORIGIN, so two servers on two ports would not reproduce it either: they are
# two origins and would pass no matter how broken the namespacing was. What is
# needed is two demo folders, different slugs, ONE origin. That is how they sit
# on Pages, and it is the only arrangement where the bug shows.
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT_TEMPLATE="${PORT_TEMPLATE:-8101}"
PORT_TWO="${PORT_TWO:-8102}"
WORK="$(mktemp -d)"
PIDS=()

cleanup() {
    for pid in "${PIDS[@]:-}"; do
        [ -n "$pid" ] && kill "$pid" 2>/dev/null
    done
    rm -rf "$WORK"
}
trap cleanup EXIT

command -v node >/dev/null 2>&1 || { echo "node is required"; exit 2; }
node -e "require('playwright')" 2>/dev/null || {
    echo "Playwright is required:  npm install playwright"
    exit 2
}

# ---- fixtures: two demos, two slugs, one origin -----------------------------
for slug in alpha beta; do
    cp -r "$ROOT/template" "$WORK/$slug"
    python3 - "$WORK/$slug" "$slug" <<'PY'
import io, json, sys
base, slug = sys.argv[1].rstrip('/') + '/', sys.argv[2]
for name in ('index.html', 'product.html'):
    text = io.open(base + name, encoding='utf-8').read()
    # The generator writes this attribute; here we stand in for it.
    text = text.replace('data-demo-slug="template"', 'data-demo-slug="%s"' % slug)
    io.open(base + name, 'w', encoding='utf-8').write(text)
config = json.load(io.open(base + 'demo.config.json', encoding='utf-8'))
config['slug'] = slug
json.dump(config, io.open(base + 'demo.config.json', 'w', encoding='utf-8'), indent=2)
PY
done

# ---- servers ----------------------------------------------------------------
# The template is served from the REPOSITORY ROOT, the way Pages serves it, so
# relative paths resolve identically.
python3 -m http.server "$PORT_TEMPLATE" --directory "$ROOT" >/dev/null 2>&1 &
PIDS+=("$!")
python3 -m http.server "$PORT_TWO" --directory "$WORK" >/dev/null 2>&1 &
PIDS+=("$!")

for _ in 1 2 3 4 5 6 7 8 9 10; do
    if curl -sf -o /dev/null "http://localhost:$PORT_TEMPLATE/template/index.html" \
       && curl -sf -o /dev/null "http://localhost:$PORT_TWO/alpha/index.html"; then
        break
    fi
    sleep 0.4
done

export TEMPLATE_URL="http://localhost:$PORT_TEMPLATE/template/"
export TWO_DEMOS_URL="http://localhost:$PORT_TWO/"

# ---- Dengage's own on-site resources, for the creative contract check --------
# Account independent, so no application identifier is involved and the guard's
# app-guid check has nothing to object to. curl is used rather than node because
# it already honours this environment's proxy settings.
DN_RESOURCE_DIR="$WORK/dn"
mkdir -p "$DN_RESOURCE_DIR"
have_resources=1
for f in form-handler.js shared.js shared.css.js container.css.js; do
    out="$DN_RESOURCE_DIR/dn-$f"
    if ! curl -sf --max-time 25 "https://pcdn.dengage.com/onsite-message/$f" \
         -o "$out"; then
        have_resources=0
        continue
    fi
    # A 200 WITH THE WRONG BODY IS NOT A RESOURCE. A proxy or a captive portal
    # can answer 200 with an HTML error page, and an empty file satisfies
    # curl -sf too, so success above only proves a response arrived. Every real
    # resource here is a JavaScript wrapper around a template literal, so its
    # first non whitespace byte is never '<'. An empty body or one that starts
    # like HTML means the engine never arrived, and the section below must skip
    # loudly rather than run the checks against a page with no engine in it.
    first="$(tr -d '[:space:]' < "$out" | head -c 1)"
    if [ -z "$first" ] || [ "$first" = "<" ]; then
        have_resources=0
    fi
done
export DN_RESOURCE_DIR
# The creative check writes its assembled document where the second server can
# serve it, because a document carrying injected script blocks cannot go through
# Playwright's setContent, which uses document.write. ASSEMBLED_DIR AND
# SERVE_URL MUST NAME THE SAME DIRECTORY: SERVE_URL is the http face of
# ASSEMBLED_DIR on the second server. When they diverge, the browser is handed
# the server's 404 page instead of the assembly. That page loads cleanly and
# carries no engine, and it once turned every creative's report into fourteen
# confident and wrong failures. creative.js now refuses to assert against a
# page whose engine did not run, so a mismatch here is one loud exit 2 rather
# than a page of lies, but the pairing below is still what makes it never fire.
export SERVE_URL="http://localhost:$PORT_TWO/dn/"
export ASSEMBLED_DIR="$DN_RESOURCE_DIR"
# =============================================================================
# WHY THIS SUITE USED TO TAKE A QUARTER OF AN HOUR, and why it now takes a couple of
# minutes. Added 7 August 2026.
#
# Nothing in it was slow. The pages here reach for three hosts they do not need: the
# Google Fonts stylesheet on every page, the SDK loader on every demo page, and a
# handful of published URLs the app inbox check uses as message artwork. On a machine
# that reaches the internet through an HTTP proxy which cannot serve those hosts, the
# proxy does not refuse, it simply does not answer, so Chromium waits before firing
# the load event.
#
# Measured on one page load: 12815ms before, 76ms after. The suite makes roughly a
# hundred navigations, and inbox.js alone fetches thirteen of those URLs, which is why
# that one check took 251 seconds per target. None of the run time was ever the checks.
#
# These names tell Chromium to go direct for those hosts instead of through the proxy.
# Where they are genuinely reachable this changes nothing, because a machine with no
# proxy ignores the setting. Where they are not, the request fails at once instead of
# stalling, and every one of them ALREADY failed: the checks stub window.dengage before
# they navigate, so the real SDK is never used, and the inbox check is deliberately
# asserting what a message does when its artwork does not load.
#
# IT HAS TO COME AFTER THE CURL ABOVE, which is the one thing here that genuinely
# needs the proxy: it fetches Dengage's own on-site resources so the creative contract
# check can run against the real handler. Exporting this before that loop skips that
# check with a message about the network being unavailable.
#
# The one check that does need real fonts, factory/checks/wheel.mjs, fetches them
# itself with node and inlines them, so it is unaffected.
# =============================================================================
export no_proxy="${no_proxy:+$no_proxy,}fonts.googleapis.com,fonts.gstatic.com,pcdn.dengage.com,dengage-presales.github.io"
export NO_PROXY="$no_proxy"

status=0

# WHICH TARGETS TO CHECK. The template is the source and a demo is what ships, and
# they differ in the one way that matters most: only a demo carries an application
# identity, so only a demo loads the SDK. Checking the template alone is how 153
# assertions came to pass against a page the SDK had never touched. So: both.
#
# BOTH, NOT ALL OF THEM. Narrowed 7 August 2026. This used to run all seven checks
# against the template and every demo in the tree, which is where most of the run
# time went and almost none of the coverage. The demos are copies of the same
# modules and differ only in their data: the guard's demo-js-current check already
# proves, file by file, that every demo carries the scrubbed template original. So
# a second demo tells us what the first one did, four times over.
#
# One demo is still essential, for the reason in the paragraph above: it is the only
# target that loads the SDK. Which one is deliberately the LAST by name rather than
# the first, so a newly generated demo is the one under the microscope.
#
# ALL_DEMOS=1 restores the old behaviour, which is worth doing before a release or
# after changing anything the generator writes per demo rather than per template.
TARGETS="template/"
if [ "${ALL_DEMOS:-0}" = "1" ]; then
    for d in "$ROOT"/demos/*/; do
        [ -d "$d" ] || continue
        TARGETS="$TARGETS demos/$(basename "$d")/"
    done
else
    newest="$(ls -d "$ROOT"/demos/*/ 2>/dev/null | tail -1)"
    [ -n "$newest" ] && TARGETS="$TARGETS demos/$(basename "$newest")/"
fi
echo "Targets: $TARGETS"
[ "${ALL_DEMOS:-0}" = "1" ] || echo "  (one demo. ALL_DEMOS=1 checks every demo in the tree)"
echo

for target in $TARGETS; do
    export TEMPLATE_URL="http://localhost:$PORT_TEMPLATE/$target"
    echo "=== $target the account modal ============================"
    node "$ROOT/factory/checks/account.js" || status=1
    echo
    echo "=== $target the launcher covers every creative ==========="
    node "$ROOT/factory/checks/launcher.js" || status=1
    echo
    echo "=== $target inline creatives ============================="
    node "$ROOT/factory/checks/inline.js" || status=1
    echo
    echo "=== $target recommendations =============================="
    node "$ROOT/factory/checks/recommend.js" || status=1
    echo
    echo "=== $target generated product artwork ===================="
    node "$ROOT/factory/checks/artwork.js" || status=1
    echo
    echo "=== $target the app inbox ================================"
    node "$ROOT/factory/checks/inbox.js" || status=1
    echo
    echo "=== $target scenario triggers, both ways ================="
    node "$ROOT/factory/checks/triggers.mjs" || status=1
    echo
done
export TEMPLATE_URL="http://localhost:$PORT_TEMPLATE/template/"

echo
echo "=== creatives: the engine's form contract ======================"
if [ "$have_resources" -eq 0 ]; then
    echo "  SKIPPED: could not fetch Dengage's on-site resources from"
    echo "  https://pcdn.dengage.com/onsite-message/ . This check needs them,"
    echo "  because it runs the creative against the real handler rather than a"
    echo "  reimplementation of it."
else
    # Popups, banners and the A/B variants. The inline five are a different
    # contract entirely and are checked by inline.js below.
    for creative in "$ROOT"/factory/creatives/*.html "$ROOT"/factory/creatives/ab-testing/*.html \
                    "$ROOT"/factory/creatives/gamification/*.html; do
        [ -e "$creative" ] || continue
        node "$ROOT/factory/checks/creative.js" "$creative" || status=1
    done
fi



# The wheel's labels are laid out in fixed coordinates but rendered in whatever font
# the prospect's theme carries, so this is the one piece of creative geometry a diff
# cannot show. It fetches the label fonts and skips loudly if it cannot.
echo
echo "=== the prize wheel's labels clear the hub and the rim =========="
node "$ROOT/factory/checks/wheel.mjs" || status=1

echo
echo "=== inline creatives in the panel's three field form ==========="
node "$ROOT/factory/checks/inline-fields.js" || status=1

echo
echo "=== two demos, one origin: no shared namespace ================="
node "$ROOT/factory/checks/collision.js" || status=1

# Once against the template rather than per demo: the logic lives in slots.js, and the
# guard's demo-js-current check already proves every demo carries the same file.
echo
echo "=== a top bar pushes the header down, it does not cover it ======"
node "$ROOT/factory/checks/banner.mjs" || status=1

# The wishlist payload assertion here is the one that matters: a field missing
# from one emitter is invisible in a diff, invisible on the page, and the shared
# tables cannot say whose rows are whose.
echo
echo "=== diagnostic tools, and the wishlist variant id =============="
node "$ROOT/factory/checks/tools.mjs" || status=1

echo
if [ "$status" -eq 0 ]; then
    echo "Template checks passed."
else
    echo "Template checks FAILED."
fi
exit "$status"
