#!/usr/bin/env bash
# =============================================================================
# WHAT IS ACTUALLY LIVE, read without opening the panel.
#
#   bash factory/panel/live-campaigns.sh
#
# Everything here is a public unauthenticated GET of files the SDK already fetches
# in every visitor's browser. Nothing is written and no event is recorded, so this
# is safe against the shared account. Handoff 1a: reading is always fine.
#
# WHY THIS EXISTS. "Is the campaign live?" was being answered by looking at the
# panel and by firing the launcher and watching. Both are slow and one of them is
# unreliable, because a widget that does not appear looks the same whether the
# campaign is missing, inactive, mis-triggered or misnamed. This prints the answer.
#
# WHAT IT SHOWS, corrected 5 August 2026 by observation. This tool was documented as
# unable to see Data Layer Event campaigns, on the assumption that only up front
# triggers reach the static manifest. That is wrong for this application: with
# eleven campaigns live, all eleven appeared here, Data Layer Event ones included,
# alongside EXIT_INTENT and ON_SCROLL. So treat this as a COMPLETE inventory rather
# than a partial one.
#
# Which makes it the fastest way to catch three things that are otherwise invisible
# until a prospect is watching: a campaign left inactive, two campaigns sharing one
# event name, and an event name that no launcher card will ever push. The duplicate
# case is the nastiest, because one widget silently never fires while another fires
# twice, and both look like ordinary configuration in the panel.
#
# It also catches a campaign accidentally left on a NAVIGATION trigger, which would
# fire on every page load of every demo.
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONF="$ROOT/factory/sandbox.json"

ACCOUNT="$(python3 -c "import json,io;print(json.load(io.open('$CONF'))['accountId'])" 2>/dev/null)"
APP="$(python3 -c "import json,io;print(json.load(io.open('$CONF'))['appGuid'])" 2>/dev/null)"
if [ -z "${ACCOUNT:-}" ] || [ -z "${APP:-}" ]; then
    echo "Could not read accountId and appGuid from factory/sandbox.json"
    exit 2
fi

BASE="https://pcdn.dengage.com/p/push/$ACCOUNT/$APP"
echo "Application $ACCOUNT / $APP"
echo

# The loader names the current manifest, and its hash changes whenever a campaign
# is edited. That is the only way to know which manifest is current.
LOADER="$(curl -sf --max-time 25 "$BASE/dengage_sdk_loader.js")" || {
    echo "Could not fetch the SDK loader. Check the account id and app guid."
    exit 1
}
HASH="$(printf '%s' "$LOADER" | grep -o 'campaigns\.[a-z0-9]*\.js' | head -1)"
SDK="$(printf '%s' "$LOADER" | grep -o 'sdk/[0-9.]*/' | head -1 | tr -d '/' | sed 's/^sdk//')"
echo "SDK version      ${SDK:-unknown}"
echo "Manifest         ${HASH:-none named}"

if [ -z "$HASH" ]; then
    echo
    echo "The loader names no campaign manifest, which means on-site messaging has"
    echo "never been configured for this application."
    exit 0
fi

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
code="$(curl -s -o "$TMP" -w '%{http_code}' --max-time 25 "$BASE/onsite/$HASH")"
if [ "$code" != "200" ]; then
    echo
    echo "The manifest the loader names returned HTTP $code."
    echo "That happens for a short while after a campaign change, because the loader"
    echo "is updated before the manifest is published. Wait and run this again."
    exit 1
fi

echo
node - "$TMP" <<'NODE'
const fs = require('fs');
let list = null;
global.__dn_set_messages__ = m => { list = m; };
eval(fs.readFileSync(process.argv[2], 'utf8').replace(/^﻿/, ''));

if (!Array.isArray(list) || !list.length) {
  console.log('No campaigns in the static manifest.');
  console.log('For this application that means none are live, including Data Layer');
  console.log('Event ones. Create them in the panel, trigger names in factory/creatives/.');
  process.exit(0);
}

console.log(list.length + ' campaign(s) in the static manifest:\n');
for (const c of list) {
  const t = c.triggerSettings || {};
  const d = c.displayCondition || {};
  console.log('  ' + (c.publicId || '(no id)'));
  console.log('    status        ' + c.status + (c.isAbCampaign ? '   [A/B]' : ''));
  console.log('    trigger       ' + t.triggerBy +
    (t.eventName ? '  event: ' + t.eventName : '') +
    (t.scrollPercentage ? '  scroll: ' + t.scrollPercentage + '%' : '') +
    (t.delay ? '  delay: ' + t.delay : ''));
  console.log('    frequency     every ' + t.showEveryXMinutes +
    ' min, max ' + t.maxShowCount +
    (t.dontShowAfterClick ? ', stops after a click' : ''));
  console.log('    where         ' + (d.whereToDisplay || []).join(' ' + (d.whereToDisplayLogicOperator || 'OR') + ' '));
  console.log('    platform      ' + d.onsitePlatform);
  const rules = (d.ruleSet || {}).rules || [];
  console.log('    audience      ' + (rules.length ? rules.length + ' rule(s)' : 'everyone'));
  console.log('    runs          ' + (c.startDate || '').slice(0, 10) + ' to ' +
    ((c.endDate || '').startsWith('9999') ? 'no end date' : (c.endDate || '').slice(0, 10)));
  console.log('');
}

/* A NAVIGATION trigger on a shared campaign is worth flagging loudly: it fires on
   every page load of every demo, which is almost never what a shared creative
   wants and is invisible until a prospect sees a popup nobody asked for. */
/* TWO CAMPAIGNS ON ONE EVENT NAME. Found live on 5 August 2026: a campaign meant to
   be dengage_demo_image-popup carried the subscription event name instead, so the
   Image popup card fired nothing while the Subscription card fired two campaigns.
   Nothing in the panel looks wrong, and on a call it reads as a broken widget. */
const byEvent = {};
for (const c of list) {
  const n = (c.triggerSettings || {}).eventName;
  if (n) (byEvent[n] = byEvent[n] || []).push(c.publicId || '(no id)');
}
const dupes = Object.keys(byEvent).filter(n => byEvent[n].length > 1);
if (dupes.length) {
  console.log('DUPLICATE EVENT NAMES. Each of these is on more than one campaign, so one');
  console.log('widget fires twice and whichever campaign should have owned the other name');
  console.log('fires not at all:');
  for (const n of dupes) console.log('  ' + n + '  ->  ' + byEvent[n].join('  '));
  console.log('');
}

const nav = list.filter(c => (c.triggerSettings || {}).triggerBy === 'NAVIGATION' &&
                             c.status === 'ACTIVE');
if (nav.length) {
  console.log('NOTE: ' + nav.length + ' ACTIVE campaign(s) trigger on NAVIGATION, so they fire on');
  console.log('every page load of every demo on this application. For a campaign meant to be');
  console.log('fired from the launcher, the trigger should be Data Layer Event instead.');
}
NODE
