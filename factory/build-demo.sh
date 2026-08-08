#!/usr/bin/env bash
# =============================================================================
# BUILD A DEMO FROM THE TEMPLATE.
#
#   bash factory/build-demo.sh <slug> ["Store Name"]
#
# This is the substitution half of the Phase 2 generator, extracted early because
# it was blocking everything: until a demo folder exists, nothing in this
# repository has ever run against the real SDK.
#
# WHY THAT MATTERED MORE THAN IT LOOKED. template/index.html carries
# __DENGAGE_ACCOUNT_ID__ and __DENGAGE_APP_GUID__ placeholders, and its bootstrap
# refuses to load the SDK while they are still placeholders:
#
#     if (accountId.indexOf('__') !== 0 && appGuid.indexOf('__') !== 0) { load }
#
# That guard is correct and deliberate: the guard's app-guid check forbids a real
# identifier anywhere in template/, because the template is the source and must
# carry no identity. But it also means opening template/index.html on Pages gives a
# storefront with NO SDK: no device id, no session id, no Dengage storage keys, and
# no widget can ever fire. Every check in factory/checks/ stubs window.dengage, so
# all of them pass against a page the SDK has never touched.
#
# So the template was verified and the thing that ships was not. This script is what
# closes that gap.
#
# WHAT IT DOES NOT DO. No scraping, no theme extraction, no catalogue building. Those
# are the other half of Phase 2 (handoff 7). This takes the template as it stands and
# gives it an identity, which is enough to make a demo that is live and testable.
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SLUG="${1:-}"
# The store's name, when a request carried one. It names the browser tab; the
# header mark is the Dengage one either way.
STORE="${2:-}"
# What a tab reads. "RioPneus eComm Demo" when a store is named, and the
# standard name when nothing usable came through, which is what a hand run
# from the command line gets.
if [ -n "$STORE" ]; then TITLE="$STORE eComm Demo"; else TITLE="Dengage eComm Demo"; fi
# displayName in the config is the demo's own name and is not the prospect's.
NAME="Dengage eComm Demo"

if [ -z "$SLUG" ]; then
    echo "usage: bash factory/build-demo.sh <slug> [\"Store Name\"]"
    exit 2
fi

# The slug is a URL path segment, a storage namespace and part of an order id, so
# constrain it rather than trusting the caller.
if ! printf '%s' "$SLUG" | grep -qE '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'; then
    echo "Slug must be lowercase letters, digits and hyphens, 3 to 40 characters."
    echo "It becomes a URL path, a storage namespace and part of every order id."
    exit 2
fi

CONF="$ROOT/factory/sandbox.json"
ACCOUNT="$(python3 -c "import json,io;print(json.load(io.open('$CONF'))['accountId'])")"
APP="$(python3 -c "import json,io;print(json.load(io.open('$CONF'))['appGuid'])")"
DEST="$ROOT/demos/$SLUG"

if [ -e "$DEST" ]; then
    echo "demos/$SLUG already exists. Remove it first, or choose another slug."
    exit 2
fi

echo "Building demos/$SLUG from template/"
echo "  account   $ACCOUNT"
echo "  app       $APP"
echo "  tab       $TITLE"

mkdir -p "$ROOT/demos"
cp -r "$ROOT/template" "$DEST"
mkdir -p "$DEST/images"

python3 - "$DEST" "$SLUG" "$NAME" "$ACCOUNT" "$APP" "$TITLE" <<'PY'
import io, json, sys, datetime

dest, slug, name, account, app, title = sys.argv[1:7]
dest = dest.rstrip('/') + '/'

for page in ('index.html', 'product.html'):
    t = io.open(dest + page, encoding='utf-8').read()

    # The slug lives in the markup so that identity.js can read it synchronously in
    # the head, before initialize. Handoff 12.11: a module that reads it later gets
    # nothing and every demo collapses into one shared namespace.
    t = t.replace('data-demo-slug="template"', 'data-demo-slug="%s"' % slug)

    # Identity. This is what makes the bootstrap actually load the SDK.
    t = t.replace('__DENGAGE_ACCOUNT_ID__', account)
    t = t.replace('__DENGAGE_APP_GUID__', app)

    # THE BROWSER TAB NAMES THE STORE. Every demo used to open a tab reading
    # "Dengage eComm Demo", so a screen share with three demos open showed three
    # identical tabs and the salesperson had to guess. The store's name and the
    # words "eComm Demo" both belong here: the name is what makes the tab useful,
    # and the suffix is what stops the tab claiming to be the prospect's own site.
    #
    # The HEADER IS UNTOUCHED and stays the Dengage mark with "eComm Demo" under
    # it, non-negotiable 3. A page title is a plain string naming which store the
    # demo was built from; a logo is a brand claim, and those are different things.
    t = t.replace('__DEMO_TITLE__', title)

    io.open(dest + page, 'w', encoding='utf-8').write(t)

config = json.load(io.open(dest + 'demo.config.json', encoding='utf-8'))
config['slug'] = slug
config['displayName'] = name
config['createdAt'] = datetime.date.today().isoformat()
# 90 days, handoff 10. The folder deletion is automatic; the row deletion is parked
# and is a human asking the backend team.
config['expiresAt'] = (datetime.date.today() + datetime.timedelta(days=90)).isoformat()
config['dengage']['accountId'] = account
config['dengage']['appGuid'] = app
json.dump(config, io.open(dest + 'demo.config.json', 'w', encoding='utf-8'), indent=2)
PY

# SCRUB THE INTERNAL NOTES, before anything below inspects the result, so the
# verification runs on the bytes that actually ship.
#
# template/ is commented the way the rest of this repository is commented, and a
# demo is served publicly and screen-shared to a prospect. Those two facts were in
# conflict until 7 August 2026, when the served js/panels.js was found telling any
# reader with developer tools open which Dengage capabilities were parked and why.
# CLAUDE.md 9. The comments stay in template/, the shipped copy loses them.
#
# It refuses rather than writing anything it cannot scrub correctly, and hands every
# module to node --check afterwards, so a failure here stops the build.
if ! python3 "$ROOT/factory/scrub-demo.py" --dir "$DEST"; then
    echo "FAILED: could not scrub demos/$SLUG of internal notes"
    exit 1
fi

# Verify the substitution actually happened, rather than trusting it. A leftover
# placeholder produces a storefront with no SDK, which is exactly the failure this
# script exists to prevent and which looks completely normal on screen.
left="$(grep -l '__DENGAGE_\|__DEMO_TITLE__' "$DEST"/*.html 2>/dev/null || true)"
if [ -n "$left" ]; then
    echo "FAILED: placeholders remain in $left"
    exit 1
fi
if ! grep -q "$APP" "$DEST/index.html"; then
    echo "FAILED: the app guid is not in demos/$SLUG/index.html"
    exit 1
fi
if ! grep -q "data-demo-slug=\"$SLUG\"" "$DEST/index.html"; then
    echo "FAILED: data-demo-slug was not substituted"
    exit 1
fi

echo
echo "Built demos/$SLUG"
echo "  https://dengage-presales.github.io/demo-ai/demos/$SLUG/"
echo
echo "The SDK will load on this one, so a device id and a session id will appear and"
echo "the launcher can fire real campaigns. The template itself still cannot, and"
echo "should not: it carries no identity on purpose."
