#!/usr/bin/env bash
# =============================================================================
# THE PUBLICATION WAIT, TESTED AGAINST BOTH ANSWERS.
#
# The build workflow does not say a demo is live until the published address
# answers. That check is a loop over curl, and a loop over curl has one failure
# mode worth more than all the others: reporting success without having looked.
# A wait that always says "published" is indistinguishable from no wait at all,
# and it would put the word "live" back on an address that returns 404.
#
# So this runs the step's real logic, lifted out of the workflow rather than
# retyped, against a local server where one path answers and one does not:
#
#   a path that returns 200  ->  must report published=true, and quickly
#   a path that returns 404  ->  must report published=false, and must not fail
#   a host that is not there ->  must report published=false, and must not fail
#
# The last two are the ones that matter. They are also why the step is allowed to
# give up: by the time it runs, the demo is committed and verified, so a slow
# Pages queue must not fail a build and must not reopen an issue for a retry
# that would build a second demo.
#
# TWO THINGS THIS FILE DOES THE LONG WAY ROUND, both because the short way was
# tried first and was wrong:
#
#   The fixture server binds an EPHEMERAL PORT and reports it back. A fixed port
#   meant a server left behind by an earlier run kept serving a directory that
#   had since been deleted, so the good path started returning 404 and the test
#   reported a logic failure that did not exist.
#
#   The step is extracted with plain text handling rather than a YAML library,
#   because a test that needs a package installed is a test that gets skipped.
#   What keeps that honest is the sentinel check below: the extracted text has to
#   look like the step, or this stops rather than testing an empty string.
# =============================================================================
set -uo pipefail

cd "$(dirname "$0")/../.."
workflow=".github/workflows/build-demo.yml"
step_name="Wait for the demo to be reachable"
pass=0
fail=0

ok()  { printf '  PASS %s\n' "$1"; pass=$((pass + 1)); }
bad() { printf '  FAIL %s\n' "$1"; fail=$((fail + 1)); }
die() { printf 'CANNOT RUN: %s\n' "$1"; exit 1; }

work="$(mktemp -d)"
server=""
cleanup() {
  [ -n "$server" ] && kill "$server" 2>/dev/null
  rm -rf "$work"
}
trap cleanup EXIT

# ---------------------------------------------------------------- the step
# The script as the workflow actually holds it. Retyping it here would test a
# copy, and a copy drifts from the thing that runs.
python3 - "$workflow" "$step_name" > "$work/step.sh" <<'PY' || die "could not read the step out of the workflow"
import sys
path, want = sys.argv[1], sys.argv[2]
lines = open(path).read().splitlines()

starts = [i for i, l in enumerate(lines) if l.strip() == '- name: ' + want]
if len(starts) != 1:
    sys.exit('expected exactly one step named %r, found %d' % (want, len(starts)))

i = starts[0]
# The step's own indentation, so the next step at the same level ends it.
step_indent = len(lines[i]) - len(lines[i].lstrip())
run = None
for j in range(i + 1, len(lines)):
    stripped = lines[j].strip()
    if stripped.startswith('- ') and (len(lines[j]) - len(lines[j].lstrip())) == step_indent:
        break
    if stripped in ('run: |', 'run: |-'):
        run = j
        break
if run is None:
    sys.exit('the step has no literal run block')

body_indent = len(lines[run]) - len(lines[run].lstrip())
out = []
for line in lines[run + 1:]:
    if line.strip() and (len(line) - len(line.lstrip())) <= body_indent:
        break
    out.append(line[body_indent + 2:] if line.strip() else '')
sys.stdout.write('\n'.join(out) + '\n')
PY

# The extraction has to have produced the step, not merely produced something.
for sentinel in 'published=' 'curl' 'GITHUB_OUTPUT'; do
  grep -q "$sentinel" "$work/step.sh" || die "the extracted step has no '$sentinel' in it"
done
bash -n "$work/step.sh" || die "the extracted step is not valid shell"

# ------------------------------------------------------------- the fixture
mkdir -p "$work/site/there"
echo 'the demo' > "$work/site/there/index.html"

cat > "$work/serve.py" <<'PY'
import functools, http.server, socketserver, sys
root, portfile = sys.argv[1], sys.argv[2]
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=root)
class Server(socketserver.TCPServer):
    allow_reuse_address = True
with Server(('127.0.0.1', 0), handler) as srv:
    with open(portfile, 'w') as fh:
        fh.write(str(srv.server_address[1]))
    srv.serve_forever()
PY

python3 "$work/serve.py" "$work/site" "$work/port" >/dev/null 2>&1 &
server=$!
for _ in $(seq 1 40); do
  [ -s "$work/port" ] && break
  sleep 0.25
done
[ -s "$work/port" ] || die "the fixture server never reported a port"
port="$(cat "$work/port")"
base="http://127.0.0.1:$port"

# A fixture that is not serving would fail every assertion below and look like a
# defect in the step. Checked here so that confusion is impossible.
curl -sf -o /dev/null "$base/there/" || die "the fixture server is not serving $base/there/"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$base/not-there/")" = "404" ] \
  || die "the fixture server does not 404 on a missing path"

# --------------------------------------------------------------- the cases
# One or two attempts and a one second gap, so giving up takes two seconds
# rather than ten minutes. The loop being exercised is the same loop.
run_step() {
  : > "$work/out.txt"
  DEMO_URL="$1" ATTEMPTS="$2" INTERVAL=1 GITHUB_OUTPUT="$work/out.txt" \
    bash "$work/step.sh" > "$work/log.txt" 2>&1
  echo "$?" > "$work/code.txt"
}
exit_code() { cat "$work/code.txt"; }

echo "The address answers:"
run_step "$base/there/" 3
grep -q 'published=true' "$work/out.txt" \
  && ok "reports published=true" || bad "did not report published=true"
[ "$(exit_code)" = "0" ] && ok "exits clean" || bad "exited $(exit_code)"
grep -q '::warning::' "$work/log.txt" \
  && bad "warned about an address that answered" || ok "no warning"

echo "The address returns 404:"
run_step "$base/not-there/" 2
grep -q 'published=false' "$work/out.txt" \
  && ok "reports published=false" || bad "did not report published=false"
grep -q 'published=true' "$work/out.txt" \
  && bad "also reported published=true, so which value wins is undefined" \
  || ok "reports one value only"
[ "$(exit_code)" = "0" ] \
  && ok "does not fail the build" || bad "failed the build, exit $(exit_code)"
grep -q '::warning::' "$work/log.txt" \
  && ok "warns in the run log" || bad "gave up silently"

echo "The host is unreachable:"
# Port 1 needs root to bind, so nothing can be listening on it.
run_step "http://127.0.0.1:1/there/" 2
grep -q 'published=false' "$work/out.txt" \
  && ok "reports published=false" || bad "did not report published=false"
[ "$(exit_code)" = "0" ] \
  && ok "does not fail the build" || bad "failed the build, exit $(exit_code)"
grep -q 'HTTP 000' "$work/log.txt" \
  && ok "logs the connection failure as 000" || bad "did not log a 000"

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
echo "The publication wait reports what it measured."
