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

# An ec:* call outside the one emitting module. This is the shape every module
# in the reference build uses, and the shape the reversal made dangerous: the
# risk is no longer "wrong table", it is an event nobody audited.
mkdir -p "$TMP/scattered/template/js"
cat > "$TMP/scattered/template/js/cartManager.js" <<'JS'
window.dengage('ec:addToCart', { product_id: p.id, quantity: 1 });
JS
cat > "$TMP/scattered/template/js/dengageEvents.js" <<'JS'
window.dengage('pageView', { page_type: pageType });
JS
cat > "$TMP/scattered/template/index.html" <<'HTML'
<script src="js/dengageEvents.js"></script>
HTML
OUT="$("$GUARD" --root "$TMP/scattered" 2>&1)"
assert_check FAIL event-single-source "$OUT" "an ec:* call outside js/dengageEvents.js is refused"

# THE FAIL-OPEN CASE THIS CHECK ACTUALLY HAD, kept as a regression test.
#
# The first version matched dengage( followed by a quoted event name. It
# reported "2 calls, all in the emitter" and passed, and both were comment
# lines: the emitter's real dispatch uses a variable. A module calling
# window.dengage(anythingAtAll, payload) escaped it entirely.
#
# The second version excluded '.' from the leading character class, so
# window.dengage( did not match either. Both passed while checking nothing.
mkdir -p "$TMP/varcall/template/js"
cat > "$TMP/varcall/template/js/sneaky.js" <<'JS'
window.dengage(someVariable, payload);
JS
cat > "$TMP/varcall/template/js/dengageEvents.js" <<'JS'
var x = 1;
JS
cat > "$TMP/varcall/template/index.html" <<'HTML'
<script src="js/dengageEvents.js"></script>
HTML
OUT="$("$GUARD" --root "$TMP/varcall" 2>&1)"
assert_check FAIL event-single-source "$OUT" "a call with a VARIABLE first argument is refused"

# Same, without the window. prefix, so neither spelling can slip through.
mkdir -p "$TMP/barecall/template/js"
cat > "$TMP/barecall/template/js/sneaky.js" <<'JS'
dengage('ec:order', payload);
JS
cat > "$TMP/barecall/template/js/dengageEvents.js" <<'JS'
var x = 1;
JS
cat > "$TMP/barecall/template/index.html" <<'HTML'
<script src="js/dengageEvents.js"></script>
HTML
OUT="$("$GUARD" --root "$TMP/barecall" 2>&1)"
assert_check FAIL event-single-source "$OUT" "a bare dengage call is refused"

# pageView scattered rather than centralised is the same defect.
mkdir -p "$TMP/scatterpv/template/js"
cat > "$TMP/scatterpv/template/js/productDetail.js" <<'JS'
window.dengage('pageView', { page_type: 'product' });
JS
cat > "$TMP/scatterpv/template/index.html" <<'HTML'
<script src="js/dengageEvents.js"></script>
HTML
OUT="$("$GUARD" --root "$TMP/scatterpv" 2>&1)"
assert_check FAIL event-single-source "$OUT" "a pageView outside js/dengageEvents.js is refused"

# A page that never loads the event module fires no pageView, so its widgets are
# dark AND its rows in the shared tables can never be attributed to it.
mkdir -p "$TMP/nopv/template/js"
cat > "$TMP/nopv/template/js/dengageEvents.js" <<'JS'
window.dengage('pageView', { page_type: pageType });
JS
cat > "$TMP/nopv/template/product.html" <<'HTML'
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head><body></body></html>
HTML
OUT="$("$GUARD" --root "$TMP/nopv" 2>&1)"
assert_check FAIL pageview-required "$OUT" "a page that does not load the event module is refused"

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
echo "3a. Every workflow verifies through the shared list"
echo

# THE DRIFT THIS CHECK EXISTS TO STOP, one throwaway tree per shape it takes.
#
# It has now happened twice. On 18 September a demo check was added to
# build-demo.yml and not to drill.yml, so the drill reported success every
# night while every real request failed at that step. On 22 September a
# repository test was added to guard.yml and to nothing a person could run, so
# the same gap reopened one directory away.
#
# Group 1 proves the check fires at all, and that is worth having: it is what
# caught this check being dead. What it cannot prove is the two things that
# decide whether the rule is worth anything. First, that it fires on each
# spelling a check invocation really has in these files, because the rule is a
# pattern and a pattern only covers what it was written for. Second, that it
# stays quiet on a workflow that is correct, because a rule that rejected
# everything would pass group 1 and be useless.
one_list_tree() {
    local dir="$1" wf="$2" step="$3"
    rm -rf "$dir"
    mkdir -p "$dir/factory/checks" "$dir/.github/workflows"
    printf '%s\n' '#!/usr/bin/env bash' > "$dir/factory/checks/verify-demo.sh"
    {
        printf 'name: check\njobs:\n  run:\n    steps:\n'
        printf '      - run: %s\n' "$step"
    } > "$dir/.github/workflows/$wf"
}

n=0
while IFS='|' read -r wf step label; do
    [ -n "$wf" ] || continue
    n=$((n + 1))
    one_list_tree "$TMP/onelist$n" "$wf" "$step"
    OUT="$("$GUARD" --root "$TMP/onelist$n" 2>&1)"
    assert_check FAIL verify-one-list "$OUT" "$label"
done <<'EOF'
build-demo.yml|node factory/checks/smoke.mjs --url http://localhost:8101/|a demo check run by the build workflow is refused
drill.yml|node factory/checks/standby.js|a demo check run by the nightly drill is refused
guard.yml|node factory/panel/links.test.mjs|the exact test that went red on 22 September is refused
guard.yml|node .github/scripts/parse-request.test.mjs|a workflow script test run outside the list is refused
guard.yml|./factory/guard/test.sh|the guard's own suite run outside the list is refused
guard.yml|./factory/checks/publish.sh --check|a shell check run outside the list is refused
EOF

# THE OTHER DIRECTION. Both spellings of a call to the shared script, because
# the rule is written as a pattern and an exclusion, and an exclusion that did
# not cover one of them would turn every correct workflow red.
one_list_tree "$TMP/onelistok" "build-demo.yml" 'bash factory/checks/verify-demo.sh "$SLUG" /tmp/report.json'
OUT="$("$GUARD" --root "$TMP/onelistok" 2>&1)"
assert_check PASS verify-one-list "$OUT" "a workflow calling verify-demo.sh is accepted"

one_list_tree "$TMP/onelistok2" "guard.yml" './factory/checks/verify-repo.sh'
OUT="$("$GUARD" --root "$TMP/onelistok2" 2>&1)"
assert_check PASS verify-one-list "$OUT" "a workflow calling verify-repo.sh is accepted"

# A check named in a COMMENT is discussion, not a second list. Both workflows
# explain at length which script they call and why, so a rule that read
# comments would make that explanation impossible to write.
one_list_tree "$TMP/onelistcomment" "guard.yml" 'bash factory/checks/verify-repo.sh'
printf '      # it used to run node factory/panel/links.test.mjs here\n' \
    >> "$TMP/onelistcomment/.github/workflows/guard.yml"
OUT="$("$GUARD" --root "$TMP/onelistcomment" 2>&1)"
assert_check PASS verify-one-list "$OUT" "a check named in a comment is not a second list"

# THE GENERATORS ARE NOT CHECKS. The push loop rebuilds the feed to resolve a
# rebase conflict, which is not a verification step, and dragging it into this
# rule would make the fix for one outage illegal because of another.
one_list_tree "$TMP/onelistgen" "build-demo.yml" 'node factory/build-feed.mjs'
OUT="$("$GUARD" --root "$TMP/onelistgen" 2>&1)"
assert_check PASS verify-one-list "$OUT" "rebuilding the feed is not a check"

echo
echo "4. The guard passes on a correct tree"
echo

mkdir -p "$TMP/good/template" "$TMP/good/assets" "$TMP/good/factory"
cat > "$TMP/good/factory/sandbox.json" <<'JSON'
{ "accountId": "28", "appGuid": "11111111-2222-4333-8444-555555555555" }
JSON
mkdir -p "$TMP/good/template/js"
cat > "$TMP/good/template/js/dengageEvents.js" <<'JS'
/* the one module that emits. Every other module calls into this. */
window.dengage('pageView', { page_type: pageType });
window.dengage('ec:addToCart', { product_id: id, quantity: q, unit_price: price });
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
</head><body data-page-type="home"><script src="js/dengageEvents.js"></script></body></html>
HTML
mkdir -p "$TMP/good/demos/acme/images"
cat > "$TMP/good/demos/acme/demo.config.json" <<'JSON'
{ "slug": "acme", "locale": { "language": "en" },
  "dengage": { "accountId": "28", "appGuid": "11111111-2222-4333-8444-555555555555" } }
JSON
# THE STOREFRONT'S WORDS, in the same scrubbed-copy relationship as its modules.
# Without these files demo-copy-current SKIPS on the correct tree, and a check
# that skips on the only tree this suite calls correct proves nothing at all.
# Two languages, because picking the wrong original for a translated demo is the
# one way this check can be written wrongly and still look right.
cat > "$TMP/good/template/copy.json" <<'JSON'
{ "brand": "Dengage", "cartTotal": "Total", "heroTitle": "Everything you need" }
JSON
cat > "$TMP/good/template/copy.pt.json" <<'JSON'
{ "brand": "Dengage", "cartTotal": "Total", "heroTitle": "Tudo o que precisa" }
JSON
python3 "$REPO/factory/scrub-demo.py" --file "$TMP/good/template/copy.json" \
    > "$TMP/good/demos/acme/copy.json"
# A built demo does carry the identifier, in the SDK loader URL. That is the
# normal case and it has to pass, or every generated demo would be rejected.
cat > "$TMP/good/demos/acme/index.html" <<'HTML'
<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><script>
  g.src = "https://pcdn.dengage.com/p/push/28/11111111-2222-4333-8444-555555555555/dengage_sdk_loader.js";
</script></head><body data-page-type="home"><script src="js/dengageEvents.js"></script></body></html>
HTML
# SCRUBBED FROM THE TEMPLATE, not copied and not written again. A generated demo is
# the template with the internal comments removed, factory/scrub-demo.py, so in a
# correct tree the demo's module is the scrubbed form of its original and that is
# what demo-js-current compares. The fixture has to be correct in the same way the
# repository is.
#
# It used to hold a shorter hand written version, which made the fixture the one
# tree where a demo served different code from its template and nothing minded. It
# was then a plain cp, which was right until the demo stopped being a verbatim copy.
mkdir -p "$TMP/good/demos/acme/js"
python3 "$REPO/factory/scrub-demo.py" --file "$TMP/good/template/js/dengageEvents.js" \
    > "$TMP/good/demos/acme/js/dengageEvents.js"
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
echo "5. A demo serving stale template modules is rejected"
echo

# The one that would have caught the 6 August near miss. Take the correct tree
# from group 4, change the template module, leave the demo's copy alone, and the
# guard must object. Without this the check could quietly stop comparing and
# every run would still look green.
#
# It edits the TEMPLATE rather than the demo on purpose, because that is the real
# sequence: a fix is written in template/ and the live demo keeps the old file.
cp -r "$TMP/good" "$TMP/stale"
printf '%s\n' "window.dengage('ec:addToWishlist', { list_name: 'favorites' });" \
    >> "$TMP/stale/template/js/dengageEvents.js"
OUT="$("$GUARD" --root "$TMP/stale" 2>&1)"
STATUS=$?
[ "$STATUS" -ne 0 ] && ok "guard exits non-zero when a demo is behind its template" \
                    || notok "guard exits non-zero when a demo is behind its template"
assert_check FAIL demo-js-current "$OUT" "demo-js-current rejects the stale copy"
printf '%s\n' "$OUT" | grep -q 'demos/acme/js/dengageEvents.js' \
    && ok "and names the file that is behind" \
    || notok "and names the file that is behind"

# A module missing from the demo entirely, which is what a partial copy looks
# like. Reported separately from drift, because the fix is the same but the
# symptom on the page is not: a missing module is a page that throws.
cp -r "$TMP/good" "$TMP/partial"
rm -f "$TMP/partial/demos/acme/js/dengageEvents.js"
OUT="$("$GUARD" --root "$TMP/partial" 2>&1)"
assert_check FAIL demo-js-current "$OUT" "demo-js-current rejects a module missing from a demo"
printf '%s\n' "$OUT" | grep -q 'missing entirely' \
    && ok "and says it is missing rather than merely different" \
    || notok "and says it is missing rather than merely different"

echo
echo "5a. A demo serving stale storefront words is rejected"
echo

# THE SAME NEAR MISS AS GROUP 5, FOR THE WORDS, and it is not hypothetical: on
# 18 September 2026 template/copy.json was corrected and three live demos went
# on showing the previous sentence in the Recommendations panel, because only
# the modules were ever compared.
cp -r "$TMP/good" "$TMP/words"
cat > "$TMP/words/template/copy.json" <<'JSON'
{ "brand": "Dengage", "cartTotal": "Total", "heroTitle": "Everything, in one place" }
JSON
OUT="$("$GUARD" --root "$TMP/words" 2>&1)"
STATUS=$?
[ "$STATUS" -ne 0 ] && ok "guard exits non-zero when a demo's words are behind" \
                    || notok "guard exits non-zero when a demo's words are behind"
assert_check FAIL demo-copy-current "$OUT" "demo-copy-current rejects the stale copy file"
printf '%s\n' "$OUT" | grep -q 'demos/acme/copy.json' \
    && ok "and names the file that is behind" \
    || notok "and names the file that is behind"

# A TRANSLATED DEMO IS COMPARED TO ITS OWN LANGUAGE, which is the assertion that
# earns this group its keep. A check that always compared against the English
# file would pass every tree above and fail every Portuguese demo in the
# repository, and nothing else here would notice.
cp -r "$TMP/good" "$TMP/translated"
CONF="$TMP/translated/demos/acme/demo.config.json"
python3 -c "
import io, json, sys
conf = json.load(io.open(sys.argv[1], encoding='utf-8'))
conf['locale'] = { 'language': 'pt' }
json.dump(conf, io.open(sys.argv[1], 'w', encoding='utf-8'), indent=2)
" "$CONF"
python3 "$REPO/factory/scrub-demo.py" --file "$TMP/translated/template/copy.pt.json" \
    > "$TMP/translated/demos/acme/copy.json"
OUT="$("$GUARD" --root "$TMP/translated" 2>&1)"
assert_check PASS demo-copy-current "$OUT" \
    "a demo declaring pt is compared to template/copy.pt.json, not the English one"

# And the same demo holding the English words is then wrong, which is the other
# half of the same assertion.
cp -r "$TMP/translated" "$TMP/mislanguaged"
python3 "$REPO/factory/scrub-demo.py" --file "$TMP/mislanguaged/template/copy.json" \
    > "$TMP/mislanguaged/demos/acme/copy.json"
OUT="$("$GUARD" --root "$TMP/mislanguaged" 2>&1)"
assert_check FAIL demo-copy-current "$OUT" \
    "and a pt demo still holding the English words is rejected"

echo
echo "6. The reference build itself is rejected"
echo

# The literal instruction in handoff 13: run the guard against a naive copy of
# the reference build's modules. The fixture above is the durable version of
# this, hand written so it survives seed/ being deleted at the end of Phase 1.
# While seed/ is still here, check the real thing too.
if [ -d "$REPO/seed/site/en" ]; then
    mkdir -p "$TMP/seedcopy"
    cp -r "$REPO/seed/site/en" "$TMP/seedcopy/template"
    OUT="$("$GUARD" --root "$TMP/seedcopy" 2>&1)"
    for id in core-repo-isolation event-single-source pageview-required off-origin-assets image-locations app-guid template-purity; do
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
