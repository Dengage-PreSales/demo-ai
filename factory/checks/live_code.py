"""Blank out JavaScript comments so a text search sees live code only.

    python3 factory/checks/live_code.py template/js/panels.js | grep "slug: 'x'"

WHY THIS EXISTS. js/panels.js parks a campaign by commenting its entry out rather
than deleting it, so the card comes back by putting one line back. Product Box,
Smart Search, Typeform and Dengage's own recommendation engine all sit inside
block comments today, each with a note saying how to restore it. That is the right
way to park them, and it makes a plain text search over the file wrong in two
opposite directions:

  a parked entry is read as live      a count says 6 where the page offers 3
  a slug removed from the live list   still matches, because a comment mentions it

factory/checks/launcher.js is not affected and never was: it reads the evaluated
window.Panels.SCENARIOS out of the running page, so a commented-out entry does not
exist as far as it is concerned. factory/checks/test.sh does read the file's text,
to build a known-bad fixture out of it, and that is what this helper is for.

WHAT IT DOES. Returns the source with every comment body replaced by spaces and
newlines left where they are, so the masked copy is the same length as the
original and every line number still matches. Search the masked copy, edit the
original.

STRINGS ARE RESPECTED, and that is not decoration. panels.js carries the text
'file:// page.' inside a quoted string, so a line comment stripper that did not
know about strings would blank the rest of that line and could drop a live entry
from view.

SCOPE. This masks the source this repository writes. It is not a JavaScript
parser, and a regular expression literal containing // or /* is not handled.
panels.js has one regex literal today and it contains neither.
"""
import io
import sys


def live_source(src):
    """src with comment bodies blanked, length and line numbers preserved."""
    out = []
    i, n = 0, len(src)
    state = None          # None, 'line', 'block', or the quote character in use

    while i < n:
        c = src[i]
        nxt = src[i + 1] if i + 1 < n else ''

        if state is None:
            if c == '/' and nxt == '/':
                state = 'line'
                out.append('  ')
                i += 2
                continue
            if c == '/' and nxt == '*':
                state = 'block'
                out.append('  ')
                i += 2
                continue
            if c in ('"', "'", '`'):
                state = c
            out.append(c)
            i += 1
            continue

        if state == 'line':
            # A line comment ends at the newline, which is kept so the line count
            # does not move.
            if c == '\n':
                state = None
                out.append('\n')
            else:
                out.append(' ')
            i += 1
            continue

        if state == 'block':
            if c == '*' and nxt == '/':
                state = None
                out.append('  ')
                i += 2
                continue
            out.append('\n' if c == '\n' else ' ')
            i += 1
            continue

        # Inside a string. An escape pair is copied verbatim rather than blanked,
        # so a \' does not read as the end of the string and a line continuation
        # keeps its newline.
        if c == '\\' and nxt:
            out.append(c)
            out.append(nxt)
            i += 2
            continue
        if c == state:
            state = None
        out.append(c)
        i += 1

    return ''.join(out)


def live_lines(path):
    """The file's lines with comments blanked, index i matching the real line i."""
    return live_source(io.open(path, encoding='utf-8').read()).split('\n')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.stderr.write('usage: live_code.py <file>\n')
        sys.exit(2)
    sys.stdout.write(live_source(io.open(sys.argv[1], encoding='utf-8').read()))
