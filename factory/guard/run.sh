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

while [ $# -gt 0 ]; do
    case "$1" in
        --root) ROOT="$2"; shift 2 ;;
        --list) LIST_ONLY=1; shift ;;
        *) echo "unknown argument: $1" >&2; exit 2 ;;
    esac
done

CHECK_IDS="core-repo-isolation ec-calls table-allowlist standard-table-names off-origin-assets image-locations dashes app-guid template-purity seed-removed"

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
# ec-calls
#
# No ec:* call anywhere. Handoff 1.3. The pattern also catches the standard
# table names being described in on-screen copy, which handoff 5.3 requires
# rewriting in the event panel.
#
# Scope is every committed file rather than only demos/ and template/, which is
# what handoff 11 says. The Phase 0 probe sits outside both and makes real
# sendDeviceEvent calls, so the narrower scope would not police it.
# ---------------------------------------------------------------------------
hits="$(grep_list '(^|[^A-Za-z0-9_])ec:[A-Za-z]' "$CODE_FILES")"
if [ -z "$CODE_FILES" ]; then
    skip ec-calls "no code files in scope"
elif [ -n "$hits" ]; then
    fail ec-calls "ec:* call or reference found"
    printf '%s\n' "$hits" | show
else
    pass ec-calls "no ec:* calls"
fi

# ---------------------------------------------------------------------------
# table-allowlist
#
# THE primary protection for the shared Data Space. Handoff 11, 14.4.
#
# Every sendDeviceEvent call site must name its table as a string literal that
# is one of the two sandbox tables. A variable, a template literal or a
# concatenation fails, because CI cannot see what it resolves to. That is the
# whole point: an allowlist of literals is the only form of this check that
# cannot be walked around statically.
#
# A call site is an occurrence of 'sendDeviceEvent' as a quoted argument. The
# string appearing inside a longer quoted string, as in a log message, is not a
# call site and is not flagged.
#
# A call split across several lines fails, since the literal is not on the same
# line as the call. That is intended: keep the call on one line.
# ---------------------------------------------------------------------------
CALL="['\"]sendDeviceEvent['\"][[:space:]]*,"
OK="['\"]sendDeviceEvent['\"][[:space:]]*,[[:space:]]*['\"](sandbox_events|sandbox_onsite_events)['\"]"
callsites="$(grep_list "$CALL" "$CODE_FILES")"
if [ -z "$CODE_FILES" ]; then
    skip table-allowlist "no code files in scope"
elif [ -z "$callsites" ]; then
    skip table-allowlist "no sendDeviceEvent call sites"
else
    bad="$(printf '%s\n' "$callsites" | grep -vE "$OK")"
    if [ -n "$bad" ]; then
        fail table-allowlist "sendDeviceEvent target is not an allowlisted literal"
        detail "allowed: 'sandbox_events', 'sandbox_onsite_events', written as a literal"
        printf '%s\n' "$bad" | show
    else
        n="$(printf '%s\n' "$callsites" | grep -c .)"
        pass table-allowlist "$n call site(s), all on the allowlist"
    fi
fi

# ---------------------------------------------------------------------------
# standard-table-names
#
# SUPPLEMENTARY, and deliberately a denylist. It catches a standard table named
# in the storefront's own copy, which the allowlist above cannot see because a
# sentence is not a call site. The event panel in the reference build announces
# order_events to the audience on screen while the rewrite writes elsewhere,
# and a card that describes the wrong table is worse than no card. Handoff 5.3.
#
# It is not the guarantee. The allowlist is. A denylist of standard table names
# is exactly what missed cantuCatalog.js writing onsite_events, and nothing
# here should be read as making the allowlist optional.
#
# Scope is the served storefront only. The factory tooling, this file included,
# has to name these tables in order to explain why they are forbidden, and the
# allowlist covers those files for anything that is an actual write.
#
# The bare name "events" is matched only where it is assigned as a table name.
# Matching it as any quoted string flags an element id and a DOM lookup, which
# is noise, and a genuine write to it is refused by the allowlist regardless.
# ---------------------------------------------------------------------------
STD='(^|[^A-Za-z0-9_])(order_events_detail|shopping_cart_events|page_view_events|wishlist_events|search_events|onsite_events|order_events)([^A-Za-z0-9_]|$)'
hits="$(grep_list "$STD" "$STOREFRONT_FILES")"
more="$(grep_list "tableName['\"]?[[:space:]]*[:=][[:space:]]*['\"]events['\"]" "$STOREFRONT_FILES")"
hits="$(printf '%s\n%s\n' "$hits" "$more" | grep -v '^$' | sort -u)"
if [ -z "$STOREFRONT_FILES" ]; then
    skip standard-table-names "no storefront files in scope"
elif [ -n "$hits" ]; then
    fail standard-table-names "a standard Dengage table is named in the storefront"
    printf '%s\n' "$hits" | show
else
    pass standard-table-names "no standard table names in the storefront"
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
# Scope is what a browser loads, so .mjs tooling is not included: a build
# script calling the Dengage REST API is not a page fetching an asset.
#
# w3.org URIs are XML namespaces inside SVG, not asset fetches, so they are not
# matched at all.
# ---------------------------------------------------------------------------
ALLOWED_HOSTS='pcdn\.dengage\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|dengage-presales\.github\.io|localhost(:[0-9]+)?|127\.0\.0\.1(:[0-9]+)?'
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
        detail "allowed: pcdn.dengage.com, fonts.googleapis.com, fonts.gstatic.com, dengage-presales.github.io"
        printf '%s\n' "$bad" | show
    else
        pass off-origin-assets "all absolute URLs are on allowed hosts"
    fi
fi

# ---------------------------------------------------------------------------
# image-locations
#
# Handoff 11: no prospect logo committed outside the expected product image
# path. Enforced by location, which is the form the rule takes: images live in
# assets/ for the shared Dengage artwork, in demos/<slug>/images/ for a
# generated demo's catalogue, and in template/vendor/assets/ for brand-free
# template artwork. An image anywhere else is unaccounted for.
# ---------------------------------------------------------------------------
images="$(find_files png jpg jpeg webp gif svg ico avif)"
if [ -z "$images" ]; then
    skip image-locations "no image files in scope"
else
    bad="$(printf '%s\n' "$images" | grep -vE '^(assets/|demos/[^/]+/images/|template/vendor/assets/)')"
    if [ -n "$bad" ]; then
        fail image-locations "image committed outside an expected path"
        detail "expected: assets/, demos/<slug>/images/, template/vendor/assets/"
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

    hits="$(grep_list 'cantu|pneus' "$tpl_files" -i)"
    if [ -n "$hits" ]; then
        fail template-purity "reference build brand name in template/"
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

echo
if [ "$FAILURES" -eq 0 ]; then
    echo "Guard passed."
    exit 0
fi
echo "Guard failed: $FAILURES check(s)."
exit 1
