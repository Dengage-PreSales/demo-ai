#!/usr/bin/env python3
"""Keeps every popup creative's theme bootstrap identical.

    python3 factory/creatives/sync-bootstrap.py            copy it into every creative,
                                                          adding it where a themed one
                                                          does not have it yet
    python3 factory/creatives/sync-bootstrap.py --check     fail if any copy has drifted
    python3 factory/creatives/sync-bootstrap.py --list      name the creatives it covers

WHY THIS EXISTS. Fourteen popup creatives need the same forty lines of theme
bootstrap, and survey.html is where it is written. Copying it by hand fourteen
times produces fourteen slightly different bootstraps, and the one that matters is
always the one nobody re-read. factory/creatives/inline/ already solved the same
problem the same way, by generating from one source rather than trusting a copy.

WHAT COUNTS AS THE SAME. Everything except the root element id, which is the only
thing that legitimately differs between creatives. The comparison normalises the id
out, so a real change to the logic is caught and a different id is not.

--check IS THE HALF THAT MATTERS, and it runs in CI. A generator nobody runs is a
generator that silently stops being true.
"""
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(HERE, 'survey.html')
SOURCE_ID = 'dnf-sv'

OPEN_MARK = '  <!-- THE THEME BOOTSTRAP.'
CLOSE_MARK = "if(b.onload){b.onload();}\">"

# An inline creative renders in the page's own document and reads var(--primary)
# directly, so it needs no bootstrap and is deliberately absent from this list.
SKIP_DIRS = ('inline',)


def block_of(text, path):
    """The bootstrap as it appears in one file, or None."""
    if OPEN_MARK not in text:
        return None
    start = text.index(OPEN_MARK)
    close = text.index(CLOSE_MARK, start)
    end = text.index('\n', close) + 1
    return text[start:end]


def root_id_of(text, path):
    match = re.search(r'<(?:form|div)[^>]*\sid="(dn[a-z0-9-]+)"', text)
    if not match:
        raise SystemExit('%s: could not find the root element id' % path)
    return match.group(1)


def creatives():
    """Every popup creative, source first so it is never treated as a copy."""
    found = []
    for base, dirs, files in os.walk(HERE):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in sorted(files):
            if not name.endswith('.html'):
                continue
            path = os.path.join(base, name)
            if path != SOURCE:
                found.append(path)
    return [SOURCE] + found


def main(argv):
    mode = argv[1] if len(argv) > 1 else '--write'

    source_text = io.open(SOURCE, encoding='utf-8').read()
    canonical = block_of(source_text, SOURCE)
    if canonical is None:
        raise SystemExit('%s carries no bootstrap, so there is nothing to copy' % SOURCE)
    template = canonical.replace(SOURCE_ID, '__ROOT__')

    if mode == '--list':
        for path in creatives():
            text = io.open(path, encoding='utf-8').read()
            has = 'yes' if block_of(text, path) else 'no'
            print('%-4s %s' % (has, os.path.relpath(path, os.path.dirname(HERE))))
        return 0

    drifted = []
    missing = []
    written = 0
    same = 0

    for path in creatives():
        text = io.open(path, encoding='utf-8').read()
        rid = root_id_of(text, path)
        want = template.replace('__ROOT__', rid)
        have = block_of(text, path)

        if have is None:
            # NOT YET THEMED, OR THEMED AND WAITING FOR ITS FIRST COPY, and telling
            # those apart is what --c-brand-text is for. A file that declares the
            # token has had its CSS converted and is ready for the bootstrap; one
            # that has not is still on the list to do, and planting a bootstrap in
            # it would paint variables nothing reads.
            #
            # This branch is why the tool exists in this shape at all. The first
            # version only ever REPLACED an existing block, so it could keep fourteen
            # copies honest but could not onboard the fifteenth, and the three games
            # rebuilt on 7 August 2026 came out with no bootstrap and no warning that
            # they had none.
            if '--c-brand-text' not in text:
                missing.append(os.path.basename(path))
                continue
            if mode == '--check':
                drifted.append(os.path.basename(path) + ' (themed, but has no bootstrap)')
                continue
            marker = '  </style>\n'
            if text.count(marker) != 1:
                raise SystemExit('%s: expected exactly one "  </style>" to insert after,'
                                 ' found %d' % (path, text.count(marker)))
            io.open(path, 'w', encoding='utf-8').write(
                text.replace(marker, marker + '\n' + want))
            written += 1
            print('added to %s' % os.path.basename(path))
            continue

        if have == want:
            same += 1
            continue

        if mode == '--check':
            drifted.append(os.path.basename(path))
            continue

        io.open(path, 'w', encoding='utf-8').write(text.replace(have, want))
        written += 1
        print('updated %s' % os.path.basename(path))

    if mode == '--check':
        if drifted:
            print('FAILED: the theme bootstrap has drifted in %d creative(s):'
                  % len(drifted))
            for name in drifted:
                print('  %s' % name)
            print('Rewrite them from the source with:')
            print('  python3 factory/creatives/sync-bootstrap.py')
            return 1
        print('theme bootstrap identical in %d creative(s)' % same)
        if missing:
            print('not themed yet, which is expected while they are converted in'
                  ' groups: %s' % ', '.join(missing))
        return 0

    print('%d already identical, %d rewritten' % (same, written))
    if missing:
        print('no bootstrap yet: %s' % ', '.join(missing))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
