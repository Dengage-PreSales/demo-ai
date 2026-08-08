# Known-bad fixture: seed/ outliving its purpose

`template/` exists in this tree and `seed/` is still here, which is what the
`seed-removed` check rejects.

That check matters more than it looks. Every other check excludes `seed/`,
because the reference build is another repository's branded site and fails all
of them by design. This is what stops that exclusion from quietly becoming
permanent and leaving those assets in a public repository. Handoff 3.1.
