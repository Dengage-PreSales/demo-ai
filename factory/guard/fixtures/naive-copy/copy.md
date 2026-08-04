# Known-bad fixture: dash check

The two characters below are the point of this file. It exists so that
`factory/guard/test.sh` can run the dash check against text that genuinely
contains them, under `LC_ALL=C` as well as under a UTF-8 locale, and assert
that both runs report a failure.

That assertion is what catches the dash check failing open. A PCRE code point
pattern such as `\x{2014}` requires a UTF-8 locale and silently errors out
without one, reporting every file clean. It passed on a file containing a real
em dash once already. Handoff 11.1.

An em dash — right there, between these words.

An en dash – right there, between these words.
