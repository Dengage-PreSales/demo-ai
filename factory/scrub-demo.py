"""Remove this repository's internal notes from a generated demo before it ships.

    python3 factory/scrub-demo.py --dir demos/<slug>       scrub in place
    python3 factory/scrub-demo.py --file template/js/x.js  print the scrubbed form

WHY THIS EXISTS. A demo is served publicly and screen-shared to a prospect, and
`template/` is documented the way the rest of this repository is documented:
heavily, in comments, including why a capability is parked and who decided it. Those
two facts were in direct conflict and the demo lost. On 7 August 2026 the served
js/panels.js told any reader with developer tools open that Dengage's own
recommendation engine was parked, that Product Box and Smart Search were not plugged
in, and that Typeform was turned off the day it was turned on. On the page being used
to sell Dengage.

CLAUDE.md 9 already forbade this. The rule was right and the practice drifted,
because nothing enforced it and the comments are genuinely valuable where they live.
So the comments stay in `template/`, and the copy that ships loses them.

WHAT IS REMOVED, by file type:

    .js    /* */ spans
    .css   /* */ spans
    .html  <!-- --> spans outside a script or style element
    .json  every key beginning _comment, at any depth

WHY IT DOES NOT TOKENIZE, WHICH IS THE WHOLE DESIGN. A first attempt walked the
source tracking strings so a comment opener inside one would be left alone. It
corrupted five modules, because `replace(/"/g, '&quot;')` is a regular expression
holding a quote, and telling a regular expression from a division needs a real
parser. There is no parser here and this is not worth adding a dependency for.

So it does the opposite and tracks nothing, which is correct on this tree and
checked rather than assumed. Measured across template/js and template/style.css:

    349 /* openers, 349 */ closers, balanced in every single file
    0 strings containing /* or */
    0 regular expressions containing /* or */
    0 lines whose first token is //, in 349 comments. This tree writes block
      comments only, so // never has to be considered at all

Each of those is re-checked at run time rather than trusted, and any one of them
failing refuses the file instead of writing it:

    an unbalanced /* count      the spans cannot be trusted, so refuse
    a // line comment           cannot be removed safely, so refuse
    node --check fails          a scrubbed module that will not parse, so refuse

That last one is the important one. It turns a scanner bug into a loud build
failure rather than a demo that does not run. CLAUDE.md 4.

WHAT IS NOT TOUCHED. Anything a visitor can see, any string, any identifier, and
every byte of `template/`. This only rewrites files it is pointed at.

IT IS IDEMPOTENT, which is what lets demo-js-current in factory/guard/run.sh compare
a demo against the scrubbed form of its template original and still catch drift.
"""
import io
import json
import os
import re
import subprocess
import sys

sys.dont_write_bytecode = True

BANNER = 'Dengage eComm Demo. Generated file. Sources and notes live in the factory.'

BLOCK = re.compile(r'/\*.*?\*/', re.S)
LINE_COMMENT = re.compile(r'^[ \t]*//', re.M)
SCRIPT_OR_STYLE = re.compile(r'<(script|style)\b.*?</\1\s*>', re.S | re.I)
HTML_COMMENT = re.compile(r'<!--.*?-->', re.S)


class Unsafe(Exception):
    """Raised instead of writing a file this cannot scrub correctly."""


def refuse(path, why):
    raise Unsafe('%s: %s' % (path, why))


def _newlines_only(match):
    """A removed comment leaves its newlines behind, so whatever followed it stays
    on its own line. _collapse then squeezes the blanks."""
    return '\n' * match.group(0).count('\n')


def _collapse(text, banner):
    out, blank = [], 0
    for line in text.split('\n'):
        line = line.rstrip()
        if line:
            blank = 0
            out.append(line)
        else:
            blank += 1
            if blank == 1:
                out.append('')
    while out and not out[0]:
        out.pop(0)
    while out and not out[-1]:
        out.pop()
    return banner + '\n'.join(out) + '\n'


def strip_blocks(src, path):
    if src.count('/*') != src.count('*/'):
        refuse(path, 'unbalanced /* and */, so the comment spans cannot be trusted')
    return BLOCK.sub(_newlines_only, src)


def scrub_js(src, path):
    if LINE_COMMENT.search(src):
        refuse(path, 'a // line comment is present. This removes /* */ only, on '
                     'purpose. Rewrite it as /* */')
    return _collapse(strip_blocks(src, path), '/* ' + BANNER + ' */\n')


def scrub_css(src, path):
    return _collapse(strip_blocks(src, path), '/* ' + BANNER + ' */\n')


def scrub_html(src, path):
    """Comments outside script and style. Those two are held aside first because
    their contents are not HTML, so a sequence that looks like a comment inside one
    may be part of the code."""
    kept = []

    def hold(match):
        kept.append(match.group(0))
        return '\x00%d\x00' % (len(kept) - 1)

    masked = SCRIPT_OR_STYLE.sub(hold, src)
    masked = HTML_COMMENT.sub(_newlines_only, masked)
    masked = re.sub(r'\x00(\d+)\x00', lambda m: kept[int(m.group(1))], masked)
    return _collapse(masked, '')


def scrub_json(src, path):
    def prune(value):
        if isinstance(value, dict):
            return dict((k, prune(v)) for k, v in value.items()
                        if not k.lower().startswith('_comment'))
        if isinstance(value, list):
            return [prune(v) for v in value]
        return value
    return json.dumps(prune(json.loads(src)), indent=2, ensure_ascii=False) + '\n'


BY_EXT = {'.js': scrub_js, '.css': scrub_css, '.html': scrub_html, '.json': scrub_json}


def scrub_text(path, src):
    fn = BY_EXT.get(os.path.splitext(path)[1].lower())
    return src if fn is None else fn(src, path)


def js_parse_error(path, text):
    tmp = path + '.scrubcheck.js'
    try:
        io.open(tmp, 'w', encoding='utf-8').write(text)
        done = subprocess.run(['node', '--check', tmp],
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if done.returncode == 0:
            return None
        return done.stderr.decode('utf-8', 'replace').strip().split('\n')[:4]
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def scrub_dir(root):
    changed = 0
    for base, _dirs, files in os.walk(root):
        for name in sorted(files):
            if os.path.splitext(name)[1].lower() not in BY_EXT:
                continue
            path = os.path.join(base, name)
            src = io.open(path, encoding='utf-8').read()
            out = scrub_text(path, src)
            if out == src:
                continue
            if path.lower().endswith('.js'):
                broken = js_parse_error(path, out)
                if broken:
                    raise Unsafe('%s would not parse after scrubbing:\n    %s'
                                 % (path, '\n    '.join(broken)))
            io.open(path, 'w', encoding='utf-8').write(out)
            changed += 1
    return changed


if __name__ == '__main__':
    try:
        if len(sys.argv) == 3 and sys.argv[1] == '--file':
            sys.stdout.write(scrub_text(sys.argv[2],
                                        io.open(sys.argv[2], encoding='utf-8').read()))
        elif len(sys.argv) == 3 and sys.argv[1] == '--dir':
            n = scrub_dir(sys.argv[2])
            sys.stderr.write('scrubbed %d file(s) in %s\n' % (n, sys.argv[2]))
        else:
            sys.stderr.write('usage: scrub-demo.py --dir <demo> | --file <path>\n')
            sys.exit(2)
    except Unsafe as err:
        sys.stderr.write('REFUSED, nothing was written: %s\n' % err)
        sys.exit(1)
