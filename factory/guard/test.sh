#!/usr/bin/env bash
#
# The guard's own test suite. Handoff 11.1.
#
# A guard that passes on an empty repository proves nothing. This runs the
# guard against input that is known to be wrong and asserts that it is rejected
# on every count, not just the first one.
#
# Four groups:
#
#   1. Every check fails on the committed known-bad fixture.
#   2. The dash check does not fail open. It is run under LC_ALL=C and under a
#      UTF-8 locale against a file containing a real em dash, and both runs
#      must report a failure. This is the test that would catch the regression
#      described in handoff 11.1, where a code point pattern silently errored
#      out under a non-UTF-8 locale and reported every file clean.
#   3. Checks that could report clean because they could not run instead fail.
#   4. The guard passes on a tree that is correct, so it is not simply
#      rejecting everything.
#
# Usage: factory/guard/test.sh

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
GUARD="$HERE/run.sh"
FIXTURE="$HERE/fixtures/naive-copy"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

TESTS=0
FAILED=0

ok()   { TESTS=$((TESTS + 1)); printf '  ok    %s\n' "$1"; }
notok(){ TESTS=$((TESTS + 1)); FAILED=$((FAILED + 1)); printf '  NOT OK  %s\n' "$1"; }

# assert_check <expected: PASS|FAIL|SKIP> <check id> <guard output> <label>
assert_check() {
    local want="$1" id="$2" out="$3" label="$4"
    if printf '%s\n' "$out" | grep -qE "^${want} ${id}(:|\$)"; then
        ok "$label"
    else
        local got
        got="$(printf '%s\n' "$out" | grep -oE "^(PASS|FAIL|SKIP) ${id}" | head -1)"
        notok "$label (expected ${want}, got ${got:-nothing})"
    fi
}

echo
echo "1. Every check fails on the known-bad fixture"
echo "   $FIXTURE"
echo

OUT="$("$GUARD" --root "$FIXTURE" 2>&1)"
STATUS=$?

if [ "$STATUS" -ne 0 ]; then
    ok "guard exits non-zero"
else
    notok "guard exits non-zero (it exited 0 on a tree that is wrong everywhere)"
fi

for id in $("$GUARD" --list); do
    assert_check FAIL "$id" "$OUT" "$id is rejected"
done

echo
echo "2. The dash check does not fail open"
echo

# Reduced to one file containing one real em dash, so nothing else can be the
# reason the check fires.
mkdir -p "$TMP/dash"
printf 'A line with an em dash \xe2\x80\x94 in it.\n' > "$TMP/dash/copy.md"

for loc in C POSIX en_US.UTF-8 C.UTF-8; do
    OUT="$(LC_ALL="$loc" LANG="$loc" "$GUARD" --root "$TMP/dash" 2>&1)"
    assert_check FAIL dashes "$OUT" "em dash is caught under LC_ALL=$loc"
done

printf 'A line with an en dash \xe2\x80\x93 in it.\n' > "$TMP/dash/copy.md"
OUT="$(LC_ALL=C LANG=C "$GUARD" --root "$TMP/dash" 2>&1)"
assert_check FAIL dashes "$OUT" "en dash is caught under LC_ALL=C"

# A hyphen and a minus sign are not dashes and must not be reported.
printf 'A hyphen - and a minus 3-2 and a range 20-30.\n' > "$TMP/dash/copy.md"
OUT="$(LC_ALL=C LANG=C "$GUARD" --root "$TMP/dash" 2>&1)"
assert_check PASS dashes "$OUT" "a hyphen is not reported as a dash"

echo
echo "3. A check that cannot run fails rather than reporting clean"
echo

# A demo exists and there is no sandbox configuration to check it against. The
# check has nothing to compare and must say so, not pass.
mkdir -p "$TMP/noconfig/demos/acme/images"
cat > "$TMP/noconfig/demos/acme/demo.config.json" <<'JSON'
{ "slug": "acme", "dengage": { "accountId": "28", "appGuid": "11111111-2222-4333-8444-555555555555" } }
JSON
OUT="$("$GUARD" --root "$TMP/noconfig" 2>&1)"
assert_check FAIL app-guid "$OUT" "unconfigured sandbox identity fails rather than passes"

# sendDeviceEvent with a variable target, which is the shape every one of the
# five modules uses and the shape CI cannot resolve.
mkdir -p "$TMP/variable/template"
cat > "$TMP/variable/template/app.js" <<'JS'
var TABLE = 'sandbox_events';
window.dengage('sendDeviceEvent', TABLE, payload);
JS
OUT="$("$GUARD" --root "$TMP/variable" 2>&1)"
assert_check FAIL table-allowlist "$OUT" "a variable table target is refused even when it holds an allowed name"

# The same call split across lines, so the literal is not where the check looks.
mkdir -p "$TMP/multiline/template"
cat > "$TMP/multiline/template/app.js" <<'JS'
window.dengage(
    'sendDeviceEvent',
    'sandbox_events',
    payload
);
JS
OUT="$("$GUARD" --root "$TMP/multiline" 2>&1)"
assert_check FAIL table-allowlist "$OUT" "a call split across lines is refused"

# A table name that nobody has invented yet. An allowlist rejects it; a
# denylist of the known standard tables would not. Handoff 11.
mkdir -p "$TMP/unknown/template"
cat > "$TMP/unknown/template/app.js" <<'JS'
window.dengage('sendDeviceEvent', 'some_new_table', payload);
JS
OUT="$("$GUARD" --root "$TMP/unknown" 2>&1)"
assert_check FAIL table-allowlist "$OUT" "a table name nobody has invented yet is refused"

# A built demo loading the SDK for an application that is not the sandbox one.
# The BFSI identifier is not written down anywhere in this repository, and does
# not need to be: anything other than the configured guid is refused.
mkdir -p "$TMP/foreignguid/demos/acme/images" "$TMP/foreignguid/factory"
cat > "$TMP/foreignguid/factory/sandbox.json" <<'JSON'
{ "accountId": "28", "appGuid": "11111111-2222-4333-8444-555555555555" }
JSON
cat > "$TMP/foreignguid/demos/acme/demo.config.json" <<'JSON'
{ "slug": "acme", "dengage": { "accountId": "28", "appGuid": "11111111-2222-4333-8444-555555555555" } }
JSON
cat > "$TMP/foreignguid/demos/acme/index.html" <<'HTML'
<script>g.src = "https://pcdn.dengage.com/p/push/28/c8d2da44-b982-1925-9ad8-e7caddf0894a/dengage_sdk_loader.js";</script>
HTML
OUT="$("$GUARD" --root "$TMP/foreignguid" 2>&1)"
assert_check FAIL app-guid "$OUT" "a demo loading a different application is refused"

# The template is never served and receives its identity at build time, so it
# must carry no identifier even when that identifier is the right one.
mkdir -p "$TMP/tplguid/template" "$TMP/tplguid/factory"
cat > "$TMP/tplguid/factory/sandbox.json" <<'JSON'
{ "accountId": "28", "appGuid": "11111111-2222-4333-8444-555555555555" }
JSON
cat > "$TMP/tplguid/template/index.html" <<'HTML'
<script>g.src = "https://pcdn.dengage.com/p/push/28/11111111-2222-4333-8444-555555555555/dengage_sdk_loader.js";</script>
HTML
OUT="$("$GUARD" --root "$TMP/tplguid" 2>&1)"
assert_check FAIL app-guid "$OUT" "an identifier in template/ is refused even when it is the sandbox one"

echo
echo "4. The guard passes on a correct tree"
echo

mkdir -p "$TMP/good/template" "$TMP/good/assets" "$TMP/good/factory"
cat > "$TMP/good/factory/sandbox.json" <<'JSON'
{ "accountId": "28", "appGuid": "11111111-2222-4333-8444-555555555555" }
JSON
cat > "$TMP/good/template/app.js" <<'JS'
window.dengage('sendDeviceEvent', 'sandbox_events', payload);
window.dengage('sendDeviceEvent', 'sandbox_onsite_events', payload);
window.dengage('pageView', { page_type: 'home' });
JS
cat > "$TMP/good/template/style.css" <<'CSS'
:root {
    --primary: #1F5C3D;
    --ink: #14181B;
}
.header { background: var(--primary); color: var(--ink); }
CSS
cat > "$TMP/good/template/index.html" <<'HTML'
<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css">
</head><body data-page-type="home"><script src="app.js"></script></body></html>
HTML
mkdir -p "$TMP/good/demos/acme/images"
cat > "$TMP/good/demos/acme/demo.config.json" <<'JSON'
{ "slug": "acme", "dengage": { "accountId": "28", "appGuid": "11111111-2222-4333-8444-555555555555" } }
JSON
# A built demo does carry the identifier, in the SDK loader URL. That is the
# normal case and it has to pass, or every generated demo would be rejected.
cat > "$TMP/good/demos/acme/index.html" <<'HTML'
<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><script>
  g.src = "https://pcdn.dengage.com/p/push/28/11111111-2222-4333-8444-555555555555/dengage_sdk_loader.js";
</script></head><body data-page-type="home"></body></html>
HTML
cp "$REPO/assets/dengage-push-icon.png" "$TMP/good/assets/dengage-push-icon.png" 2>/dev/null
cp "$REPO/assets/dengage-push-icon.png" "$TMP/good/demos/acme/images/product-1.png" 2>/dev/null

OUT="$("$GUARD" --root "$TMP/good" 2>&1)"
STATUS=$?
if [ "$STATUS" -eq 0 ]; then
    ok "guard exits zero on a correct tree"
else
    notok "guard exits zero on a correct tree"
    printf '%s\n' "$OUT" | sed 's/^/      /'
fi

echo
echo "5. The reference build itself is rejected"
echo

# The literal instruction in handoff 13: run the guard against a naive copy of
# the reference build's modules. The fixture above is the durable version of
# this, hand written so it survives seed/ being deleted at the end of Phase 1.
# While seed/ is still here, check the real thing too.
if [ -d "$REPO/seed/site/en" ]; then
    mkdir -p "$TMP/seedcopy"
    cp -r "$REPO/seed/site/en" "$TMP/seedcopy/template"
    OUT="$("$GUARD" --root "$TMP/seedcopy" 2>&1)"
    for id in core-repo-isolation ec-calls table-allowlist standard-table-names off-origin-assets image-locations app-guid template-purity; do
        assert_check FAIL "$id" "$OUT" "seed/site/en copied verbatim into template/ is rejected by $id"
    done
else
    echo "  note  seed/ is gone, so the reference build cannot be re-checked."
    echo "        The fixture in group 1 is the durable form of this test."
fi

echo
if [ "$FAILED" -eq 0 ]; then
    echo "Guard test suite passed: $TESTS assertions."
    exit 0
fi
echo "Guard test suite FAILED: $FAILED of $TESTS assertions."
exit 1
