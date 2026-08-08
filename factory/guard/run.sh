#!/usr/bin/env bash
#
# Demo Factory CI guardrails. Handoff section 11.
#
# Runs every check, always. It does not stop at the first failure, because the
# guard's own test suite asserts that a known-bad tree is rejected on every
# count rather than only the first one. Exit status is 1 if any check failed.
#
# Usage:
#   factory/guard/run.sh                 check the repository
#   factory/guard/run.sh --root DIR      check DIR instead, for the test suite
#   factory/guard/run.sh --list          print the check ids and exit
#
# Every check prints one line beginning PASS, FAIL or SKIP followed by its
# check id, so the test suite can assert on individual checks by name.
#
# Locale: the dash check matches raw UTF-8 bytes rather than code points, so it
# behaves identically under any locale. See check "dashes" and handoff 11.1.

set -uo pipefail

ROOT="."
LIST_ONLY=0

# The guard's own tooling, found relative to THIS script rather than to --root.
# --root is the tree being inspected, which for the fixtures in factory/guard/test.sh
# is a synthetic tree containing no factory/ at all. Resolving a tool through it
# silently produced an empty result that read as a drifted file.
GUARD_HOME="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRUB="$GUARD_HOME/factory/scrub-demo.py"

while [ $# -gt 0 ]; do
    case "$1" in
        --root) ROOT="$2"; shift 2 ;;
        --list) LIST_ONLY=1; shift ;;
        *) echo "unknown argument: $1" >&2; exit 2 ;;
    esac
done

CHECK_IDS="core-repo-isolation event-single-source pageview-required off-origin-assets image-locations dashes app-guid template-purity seed-removed demo-js-current"

if [ "$LIST_ONLY" -eq 1 ]; then
    for id in $CHECK_IDS; do echo "$id"; done
    exit 0
fi

if [ ! -d "$ROOT" ]; then
    echo "guard: root directory not found: $ROOT" >&2
    exit 2
fi

FAILURES=0
SUMMARY=""

pass()  { printf 'PASS %s: %s\n' "$1" "$2"; SUMMARY="${SUMMARY}PASS $1"$'\n'; }
skip()  { printf 'SKIP %s: %s\n' "$1" "$2"; SUMMARY="${SUMMARY}SKIP $1"$'\n'; }
fail()  {
    printf 'FAIL %s: %s\n' "$1" "$2"
    SUMMARY="${SUMMARY}FAIL $1"$'\n'
    FAILURES=$((FAILURES + 1))
}
detail() { printf '       %s\n' "$1"; }

# Print at most 12 offending lines under a failure, so CI output stays readable
# on a tree that is wrong everywhere.
show() {
    local n=0
    while IFS= read -r line; do
        n=$((n + 1))
        if [ "$n" -gt 12 ]; then detail "... and more"; break; fi
        detail "$line"
    done
}

# ---------------------------------------------------------------------------
# What is in scope
#
# seed/ is excluded until Phase 1 deletes it: it is a verbatim copy of another
# repository's branded site and fails every check below by design (handoff 3.1,
# 11). The seed-removed check is what stops that exclusion outliving its
# purpose.
#
# factory/guard/fixtures/ is excluded because it is deliberately known-bad
# input for the guard's own test suite. Nothing is served from it.
# ---------------------------------------------------------------------------
EXCLUDED_DIRS=".git seed node_modules factory/guard/fixtures"

# find_files <extension> [extension ...]
# Prints repository-relative paths of committed files with those extensions,
# excluding the directories above.
find_files() {
    local args=() ext first=1
    for ext in "$@"; do
        if [ $first -eq 1 ]; then first=0; else args+=("-o"); fi
        args+=("-name" "*.${ext}")
    done

    local prune=() dir pfirst=1
    for dir in $EXCLUDED_DIRS; do
        if [ $pfirst -eq 1 ]; then pfirst=0; else prune+=("-o"); fi
        prune+=("-path" "./${dir}")
    done

    ( cd "$ROOT" 2>/dev/null || exit 0
      find . \( "${prune[@]}" \) -prune -o -type f \( "${args[@]}" \) -print \
        | sed 's|^\./||' | sort )
}

# grep over a newline-separated file list. Prints matches as path:line:text.
# Returns 0 if there was at least one match.
grep_list() {
    local pattern="$1" files="$2" extra="${3:-}"
    [ -z "$files" ] && return 1
    # shellcheck disable=SC2086
    printf '%s\n' "$files" \
        | ( cd "$ROOT" && xargs -d '\n' -r grep -nE $extra -- "$pattern" 2>/dev/null )
}

CODE_FILES="$(find_files html htm css js mjs json)"
TEXT_FILES="$(find_files md html htm css js mjs json yml yaml sh txt svg)"

# Files a browser loads. Deliberately not .mjs, which is this repository's
# extension for Node tooling that runs in CI and never reaches a page. A rule
# about what a page fetches at runtime should not be applied to a build script.
BROWSER_FILES="$(find_files html htm css js)"

# The served storefront: a generated demo and the template it comes from.
# Narrower than "everything", for the checks that are about what a prospect
# sees on screen rather than about what the code does.
STOREFRONT_FILES="$(printf '%s\n' "$CODE_FILES" | grep -E '^(template|demos)/')"

# ---------------------------------------------------------------------------
# core-repo-isolation
#
# Nothing here may reference salil-dengage/dengage-demos or its Pages origin.
# CLAUDE.md section 1 and handoff 1.1. This is not in the handoff's list of
# checks and is added because it is the rule that outranks every other one, a
# grep costs nothing, and the reference build does carry a link to that origin.
# ---------------------------------------------------------------------------
hits="$(grep_list 'salil-dengage|dengage-demos' "$TEXT_FILES" -i)"
# The handoff and CLAUDE.md name the core repository in order to forbid it.
hits="$(printf '%s\n' "$hits" | grep -vE '^(DEMO-FACTORY-HANDOFF|CLAUDE|README)\.md:' | grep -vE '^factory/guard/(run\.sh|test\.sh|README\.md):' | grep -v '^$')"
if [ -z "$TEXT_FILES" ]; then
    skip core-repo-isolation "no text files in scope"
elif [ -n "$hits" ]; then
    fail core-repo-isolation "reference to the core repository or its origin"
    printf '%s\n' "$hits" | show
else
    pass core-repo-isolation "no reference to salil-dengage/dengage-demos"
fi

# ---------------------------------------------------------------------------
# event-single-source
#
# THE primary protection now, and it replaced three checks that the 4 August
# reversal made meaningless. Handoff 1.3, 15a, CLAUDE.md 1b.
#
# Demos write the standard ecommerce tables through the SDK's own ec:* calls,
# so "which table" is no longer a question worth asking: the answer is always a
# real one. What matters instead is that every event a demo emits is emitted
# from ONE module, because that module is the only place identity, page context
# and omission rules can be applied once and audited once.
#
# So: dengage('ec:...'), dengage('pageView') and dengage('sendDeviceEvent')
# may appear only in js/dengageEvents.js. Anywhere else fails.
#
# Without this, "every event is tagged and shaped correctly" is a hope spread
# across twenty five modules. With it, it is one file to read.
# ---------------------------------------------------------------------------
# Any call at all, not just one with a recognisable literal first argument.
#
# An earlier version of this check matched dengage( followed by a quoted event
# name. It reported two calls and passed, and both "calls" were comment lines:
# the emitter's real dispatch is window.dengage(action, body) with a VARIABLE,
# which the pattern never saw. So a module could have called
# window.dengage(anythingAtAll, payload) and escaped the check completely.
#
# That is the failure mode handoff 11.1 is about. A check that passes without
# checking is worse than no check, because it reads as evidence.
#
# The rule now: dengage( appears only in js/dengageEvents.js, plus 'initialize'
# in the page head, which has to be there because it runs before any module
# loads. Comments are not exempt, deliberately: exempting them means parsing
# JavaScript in grep, and rewording one comment is cheaper than a parser.
EVENT_CALL="(^|[^A-Za-z0-9_])dengage[[:space:]]*\\("
event_scope="$(printf '%s\n' "$CODE_FILES" | grep -E '^(template|demos)/')"
hits="$(grep_list "$EVENT_CALL" "$event_scope")"
if [ -z "$event_scope" ]; then
    skip event-single-source "no storefront files in scope"
else
    # The emitter may call it. An HTML page may call it only to initialize.
    bad="$(printf '%s\n' "$hits" | grep -v '^$' \
        | grep -vE '^[^:]*js/dengageEvents\.js:' \
        | grep -vE "^[^:]*\.html?:[0-9]+:.*dengage[[:space:]]*\\([[:space:]]*(window\.__dnInit|['\"]initialize['\"])")"
    # window.dengage = ... is the SDK stub definition, not a call.
    bad="$(printf '%s\n' "$bad" | grep -v 'dengage = ' | grep -v '^$')"
    if [ -n "$bad" ]; then
        fail event-single-source "a dengage() call outside js/dengageEvents.js"
        detail "only that module may call dengage(), plus 'initialize' in the page head"
        printf '%s\n' "$bad" | show
    else
        n="$(printf '%s\n' "$hits" | grep -c . || true)"
        pass event-single-source "$n dengage() reference(s), all in the emitter or the bootstrap"
    fi
fi

# ---------------------------------------------------------------------------
# pageview-required
#
# pageView is load bearing twice over, and neither reason is analytics.
#
# It is the documented trigger for On-Site messages: the eight scenarios have
# no local code and appear only once a pageView has fired. Remove it and every
# widget in the demo goes dark, which is the entire product (handoff 6.1).
#
# It is also the per-demo manifest. Confirmed in Phase 0: the SDK fills page_url
# and session_id on the row by itself, and session_id joins page_view_events to
# the five other standard tables. So a demo's rows are findable, and therefore
# purgeable, only because its page views exist. A page that skips pageView
# writes cart and order rows that can never be attributed to it (handoff 13).
# ---------------------------------------------------------------------------
# EMAILS AND THE MESSAGE DECK ARE EXCLUDED, AND THEY HAVE TO BE. demos/<slug>/emails/
# holds journey
# messages, which are HTML but are not storefront pages: they are read in an inbox,
# they cannot run the SDK, and requiring dengageEvents.js of them would be asking a
# message to fire a page view. Their own attribution is Dengage's send and click
# tracking, not the on-site event module.
pages="$( ( cd "$ROOT" 2>/dev/null && find template demos -name '*.html' -type f 2>/dev/null \
    | grep -vE '/(emails|messages)/' | sort ) )"
if [ -z "$pages" ]; then
    skip pageview-required "no storefront pages in scope"
else
    missing=""
    for page in $pages; do
        grep -q 'dengageEvents\.js' "$ROOT/$page" 2>/dev/null || missing="${missing}${page}"$'\n'
    done
    missing="$(printf '%s' "$missing" | grep -v '^$')"
    if [ -n "$missing" ]; then
        fail pageview-required "a storefront page does not load js/dengageEvents.js"
        detail "without it no pageView fires, so every widget is dark and the rows are unattributable"
        printf '%s\n' "$missing" | show
    else
        n="$(printf '%s\n' "$pages" | grep -c .)"
        pass pageview-required "$n page(s) load the event module"
    fi
fi

# ---------------------------------------------------------------------------
# off-origin-assets
#
# Handoff 1.4 and 11. Nothing may be fetched from a host the demo does not
# control at call time.
#
# The allowed hosts are none of them a prospect's CDN, which is what the rule
# is actually about: the Dengage SDK CDN, where the SDK necessarily lives, and
# Google Fonts, which handoff 7.2 requires because the extracted body and
# display fonts are mapped onto a Google Font the template already loads.
# localhost is the local development server from handoff 4.
#
# github.com is this repository's own host, for navigating to the issue form
# that a pre-sales person files a demo request through. It is not a place a
# demo could hotlink artwork from, and the risk this rule guards against is a
# prospect changing an asset between the build and the call.
#
# Scope is what a browser loads, so .mjs tooling is not included: a build
# script calling the Dengage REST API is not a page fetching an asset.
#
# w3.org URIs are XML namespaces inside SVG, not asset fetches, so they are not
# matched at all.
# ---------------------------------------------------------------------------
# cdn.ampproject.org is on this list because amp4email REQUIRES it: an AMP email
# must load the AMP runtime from the AMP CDN, there is no self hosted option, and
# the validator refuses the document without it. It appears only in
# demos/<slug>/emails/*.amp.html, never in a storefront page.
ALLOWED_HOSTS='pcdn\.dengage\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|dengage-presales\.github\.io|github\.com|cdn\.ampproject\.org|localhost(:[0-9]+)?|127\.0\.0\.1(:[0-9]+)?'
urls="$(grep_list 'https?://[a-zA-Z0-9.:-]+' "$BROWSER_FILES" -o)"
urls="$(printf '%s\n' "$urls" | grep -v '^$' | grep -vE "https?://(www\.)?w3\.org")"
if [ -z "$BROWSER_FILES" ]; then
    skip off-origin-assets "no browser files in scope"
elif [ -z "$urls" ]; then
    pass off-origin-assets "no absolute URLs"
else
    bad="$(printf '%s\n' "$urls" | grep -vE "https?://($ALLOWED_HOSTS)")"
    if [ -n "$bad" ]; then
        fail off-origin-assets "reference to a host that is not allowed"
        detail "allowed: pcdn.dengage.com, fonts.googleapis.com, fonts.gstatic.com, dengage-presales.github.io, cdn.ampproject.org"
        printf '%s\n' "$bad" | show
    else
        pass off-origin-assets "all absolute URLs are on allowed hosts"
    fi
fi

# ---------------------------------------------------------------------------
# image-locations
#
# Handoff 11: no prospect logo committed outside the expected product image
# path. Enforced by location, which is the form the rule takes:
#
#   assets/                     shared Dengage artwork
#   template/vendor/assets/     brand free artwork that travels with the template
#   demos/<slug>/images/        a generated demo's scraped catalogue images
#   demos/<slug>/vendor/assets/ the template's vendor artwork, carried into the demo
#
# An image anywhere else is unaccounted for.
#
# The fourth path was missing until the first demo was built, and the guard caught
# it. Building a demo copies template/ wholesale, so vendor/assets/ arrives with it,
# which is exactly what makes the favicon resolve by the same relative path from
# template/ and from demos/<slug>/. The rule was incomplete rather than the layout
# being wrong.
# ---------------------------------------------------------------------------
images="$(find_files png jpg jpeg webp gif svg ico avif)"
if [ -z "$images" ]; then
    skip image-locations "no image files in scope"
else
    bad="$(printf '%s\n' "$images" | grep -vE '^(assets/|demos/[^/]+/images/|demos/[^/]+/vendor/assets/|template/vendor/assets/)')"
    if [ -n "$bad" ]; then
        fail image-locations "image committed outside an expected path"
        detail "expected: assets/, demos/<slug>/images/, demos/<slug>/vendor/assets/, template/vendor/assets/"
        printf '%s\n' "$bad" | show
    else
        pass image-locations "all images are in an expected path"
    fi
fi

# ---------------------------------------------------------------------------
# dashes
#
# Handoff 1.10 and 11.1. Matches the RAW UTF-8 BYTES of U+2014 EM DASH and
# U+2013 EN DASH under LC_ALL=C, as fixed strings.
#
# It is written this way on purpose. A PCRE code point pattern such as \x{2014}
# requires a UTF-8 locale and silently errors out without one, reporting every
# file clean, which is indistinguishable from success. A byte match has no
# locale dependency and no regex engine to fail. The test suite runs this check
# under LC_ALL=C against a file containing a real em dash, which is the test
# that would catch it failing open.
# ---------------------------------------------------------------------------
if [ -z "$TEXT_FILES" ]; then
    skip dashes "no text files in scope"
else
    hits="$(printf '%s\n' "$TEXT_FILES" \
        | ( cd "$ROOT" && LC_ALL=C xargs -d '\n' -r grep -n -a -F \
              -e "$(printf '\xe2\x80\x94')" -e "$(printf '\xe2\x80\x93')" -- 2>/dev/null ))"
    if [ -n "$hits" ]; then
        fail dashes "em dash or en dash in committed text"
        printf '%s\n' "$hits" | show
    else
        n="$(printf '%s\n' "$TEXT_FILES" | grep -c .)"
        pass dashes "$n file(s) clean, matched as raw UTF-8 bytes"
    fi
fi

# ---------------------------------------------------------------------------
# app-guid
#
# Handoff 11: the app guid in every demo is the sandbox one, never the BFSI
# application the core demos use.
#
# Written as an allowlist of the single guid configured in factory/sandbox.json,
# so the BFSI guid needs neither to be known here nor to be committed anywhere
# in this repository in order to be rejected, and so does any other identifier
# that finds its way in.
#
# Three halves:
#   1. template/ carries no identifier at all. It is never served and it
#      receives its identity at build time from demo.config.json (handoff 4).
#   2. every other guid-shaped literal, which is what a built demo's SDK
#      loader URL legitimately contains, equals the configured sandbox guid.
#   3. every demos/<slug>/demo.config.json names the configured sandbox
#      account and guid.
#
# When there is something to check and no configured guid to check it against,
# this fails. A check must never report clean because it could not run.
# ---------------------------------------------------------------------------
SANDBOX_CFG="$ROOT/factory/sandbox.json"
UUID='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'

want_guid=""; want_account=""
if [ -f "$SANDBOX_CFG" ]; then
    want_guid="$(sed -n 's/.*"appGuid"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$SANDBOX_CFG" | head -1)"
    want_account="$(sed -n 's/.*"accountId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$SANDBOX_CFG" | head -1)"
fi

guid_files="$(find_files html htm css js mjs)"
tpl_guid_files="$(printf '%s\n' "$guid_files" | grep '^template/')"
other_guid_files="$(printf '%s\n' "$guid_files" | grep -v '^template/')"
configs="$( ( cd "$ROOT" 2>/dev/null && find demos -mindepth 2 -maxdepth 2 -name demo.config.json 2>/dev/null | sort ) )"

app_guid_failed=0

hits="$(grep_list "$UUID" "$tpl_guid_files" -o)"
if [ -n "$hits" ]; then
    fail app-guid "template/ carries an application identifier"
    detail "the template receives its identity at build time, handoff 4"
    printf '%s\n' "$hits" | show
    app_guid_failed=1
fi

hits="$(grep_list "$UUID" "$other_guid_files" -o)"
if [ -n "$hits" ]; then
    if [ -z "$want_guid" ]; then
        fail app-guid "identifiers appear in code but factory/sandbox.json has no appGuid to check them against"
        detail "fill it in from the Dengage panel, handoff 2.1"
        printf '%s\n' "$hits" | show
        app_guid_failed=1
    else
        bad="$(printf '%s\n' "$hits" | grep -v ":${want_guid}\$")"
        if [ -n "$bad" ]; then
            fail app-guid "an identifier that is not the sandbox application"
            printf '%s\n' "$bad" | show
            app_guid_failed=1
        fi
    fi
fi

if [ -n "$configs" ]; then
    if [ -z "$want_guid" ] || [ -z "$want_account" ]; then
        fail app-guid "demos exist but factory/sandbox.json has no accountId and appGuid"
        detail "fill it in from the Dengage panel, handoff 2.1"
        app_guid_failed=1
    else
        for cfg in $configs; do
            got_guid="$(sed -n 's/.*"appGuid"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$ROOT/$cfg" | head -1)"
            got_account="$(sed -n 's/.*"accountId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$ROOT/$cfg" | head -1)"
            if [ "$got_guid" != "$want_guid" ] || [ "$got_account" != "$want_account" ]; then
                fail app-guid "$cfg does not name the sandbox application"
                app_guid_failed=1
            fi
        done
    fi
fi

if [ "$app_guid_failed" -eq 0 ]; then
    if [ -z "$guid_files" ] && [ -z "$configs" ]; then
        skip app-guid "no code files and no demos in scope"
    elif [ -z "$configs" ]; then
        pass app-guid "no stray identifiers, and no demos to check yet"
    else
        n="$(printf '%s\n' "$configs" | grep -c .)"
        pass app-guid "$n demo(s) name the sandbox application, no stray identifiers"
    fi
fi

# ---------------------------------------------------------------------------
# template-purity
#
# Handoff 11: no brand name, colour literal or slug in template/. The template
# is never served and every brand decision reaches it through
# demo.config.json (handoff 4).
#
# Colour literals are allowed only inside the :root token block at the top of
# template/style.css. Anywhere below it and the theming silently stops working
# for that rule.
# ---------------------------------------------------------------------------
if [ ! -d "$ROOT/template" ]; then
    skip template-purity "template/ does not exist yet"
else
    tpl_failed=0
    tpl_files="$( ( cd "$ROOT" && find template -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.json' \) | sort ) )"

    # THE BRAND TOKENS ARE NOT THE REAL CUSTOMER'S NAME, and that is deliberate
    # as of 6 August 2026. They used to be, spelled out here and in the fixture,
    # in a public repository. A guard is a poor reason to publish a customer name.
    #
    # What is left is the mechanism plus the fixture's invented brand, so the code
    # path stays exercised by factory/guard/test.sh. The specific protection
    # against the reference build's own name leaking into template/ is weaker, and
    # that is the honest trade: seed/ has been deleted since Phase 1 and template/
    # has been verified brand free every run since, so the token was guarding a
    # door that is already bricked up.
    #
    # To enforce real tokens without committing them, set GUARD_BRAND_TOKENS in the
    # environment, pipe separated, and they are checked in addition to these.
    brand_tokens='vantoro|reifenwelt'
    if [ -n "${GUARD_BRAND_TOKENS:-}" ]; then
        brand_tokens="$brand_tokens|$GUARD_BRAND_TOKENS"
    fi

    hits="$(grep_list "$brand_tokens" "$tpl_files" -i)"
    if [ -n "$hits" ]; then
        fail template-purity "a brand name from the reference build in template/"
        printf '%s\n' "$hits" | show
        tpl_failed=1
    fi

    css="$ROOT/template/style.css"
    if [ -f "$css" ]; then
        # everything after the first closing brace that ends the :root block
        below="$(awk 'BEGIN{inroot=0;done=0}
                      /:root[[:space:]]*\{/{inroot=1}
                      inroot==1 && /\}/{inroot=0;done=1;next}
                      done==1{print NR": "$0}' "$css")"
        colours="$(printf '%s\n' "$below" | grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(')"
        if [ -n "$colours" ]; then
            fail template-purity "colour literal below the :root block in template/style.css"
            printf '%s\n' "$colours" | show
            tpl_failed=1
        fi
    fi

    if [ "$tpl_failed" -eq 0 ]; then
        pass template-purity "no brand names, no colour literals outside :root"
    fi
fi

# ---------------------------------------------------------------------------
# seed-removed
#
# Handoff 3.1: seed/ is scaffolding and is deleted once template/ exists. Every
# check above excludes seed/, so this is what stops that exclusion from
# outliving its purpose and leaving another repository's branded assets sitting
# in a public repository.
# ---------------------------------------------------------------------------
if [ -d "$ROOT/template" ] && [ -d "$ROOT/seed" ]; then
    fail seed-removed "template/ exists, so seed/ should have been deleted"
    detail "handoff 3.1"
elif [ -d "$ROOT/seed" ]; then
    skip seed-removed "template/ not built yet, seed/ is expected"
else
    pass seed-removed "seed/ is gone"
fi

# ---------------------------------------------------------------------------
# demo-js-current
#
# A generated demo is a verbatim copy of template/ (factory/build-demo.sh runs
# cp -r), and only index.html and demo.config.json are rewritten. So every
# demos/<slug>/js/*.js must still be byte identical to its template original.
#
# WHY THIS IS A CHECK AND NOT A CONVENTION. Fix a module in template/ and every
# live demo keeps the old copy, silently. The repository looks correct, the diff
# looks correct, the test suite that runs against template/ passes, and the demo
# on the call is unchanged. That is not hypothetical: on 6 August 2026 a wishlist
# fix was written, tested and believed done while the live demo still served the
# previous file, and what caught it was a browser test that happened to run
# against the demo rather than the template.
#
# It reports every drifted file rather than the first, because a template change
# usually touches more than one module and finding them one run at a time is how
# a partial sync ships.
# ---------------------------------------------------------------------------
if [ ! -d "$ROOT/template/js" ]; then
    skip demo-js-current "template/js does not exist yet"
elif [ -z "$(find "$ROOT/demos" -mindepth 1 -maxdepth 1 -type d 2>/dev/null)" ]; then
    pass demo-js-current "no demos yet, nothing to drift"
else
    drifted=""
    missing=""
    checked=0
    for demo_dir in "$ROOT"/demos/*/; do
        [ -d "$demo_dir" ] || continue
        demo="$(basename "$demo_dir")"
        for original in "$ROOT"/template/js/*.js; do
            [ -f "$original" ] || continue
            name="$(basename "$original")"
            copy="$demo_dir/js/$name"
            if [ ! -f "$copy" ]; then
                missing="${missing}demos/$demo/js/$name"$'\n'
                continue
            fi
            checked=$((checked + 1))
            # AGAINST THE SCRUBBED FORM, not the raw file. A shipped module has the
            # internal comments removed (factory/scrub-demo.py, run by
            # factory/build-demo.sh), so byte identity with template/ is no longer
            # the right question and would fail on every demo. The question is still
            # exactly the same one: is this demo serving the current template module.
            #
            # The scrubber is idempotent, so this comparison is stable, and it still
            # catches a drifted module because a real code change survives scrubbing.
            scrubbed="$(python3 "$SCRUB" --file "$original" 2>/dev/null)"
            if [ -z "$scrubbed" ]; then
                drifted="${drifted}demos/$demo/js/$name (could not scrub its original)"$'\n'
            elif [ "$scrubbed" != "$(cat "$copy")" ]; then
                drifted="${drifted}demos/$demo/js/$name"$'\n'
            fi
        done
    done

    if [ -n "$drifted" ] || [ -n "$missing" ]; then
        fail demo-js-current "a demo is not serving the current template modules"
        if [ -n "$drifted" ]; then
            printf '%s' "$drifted" | while IFS= read -r f; do
                [ -n "$f" ] && detail "differs from its template original: $f"
            done
        fi
        if [ -n "$missing" ]; then
            printf '%s' "$missing" | while IFS= read -r f; do
                [ -n "$f" ] && detail "missing entirely: $f"
            done
        fi
        detail "re-scrub the demo so it serves the fix:"
        detail "  python3 factory/scrub-demo.py --file template/js/<name> > demos/<slug>/js/<name>"
        detail "or copy template/js over it and run: python3 factory/scrub-demo.py --dir demos/<slug>"
    else
        pass demo-js-current "$checked demo module(s) match their scrubbed template original"
    fi
fi

# ---------------------------------------------------------------------------

echo
if [ "$FAILURES" -eq 0 ]; then
    echo "Guard passed."
    exit 0
fi
echo "Guard failed: $FAILURES check(s)."
exit 1
