# A/B testing: one campaign, three designs, a control group

Campaign: `dengage_demo_ab-test`

## The split

| Arm | Share | Sees |
|---|---|---|
| Control | 10 | **nothing at all** |
| Variant A | 30 | `variant-a.html`, plain and typographic |
| Variant B | 30 | `variant-b.html`, one strong colour field |
| Variant C | 30 | `variant-c.html`, artwork led |

## The control group is the scenario

Three designs is a design exercise. **A hold-out that sees nothing is the
experiment**, because without it the report says which variant won against the
other two and cannot say whether showing anything helped at all. That distinction
is the one worth making on a call, and it is the one prospects most often have not
thought about.

So configure the control arm in the panel and mention it out loud. A prospect who
asks "how do you know the popup helped rather than just moved clicks around" has
asked the right question, and the answer is this arm.

## Panel settings

```
Trigger              Data Layer Event
Event name           dengage_demo_ab-test
Where to display     /.*/
Status               Active
Show every X minutes 1
Max show count       100
Layout               Popup, width 420 to 460
Design               padding 0, transparent background
Close button         Layout > Close Button > "Add close button to outside"
A/B                  four arms as the table above, control 10 percent seeing nothing
```

## Why all three say the same thing

Deliberately. If the variants carried different offers the test would measure the
offer, not the design, and the report would be uninterpretable. Same promise, same
call to action, three treatments. That is what makes the result mean something, and
it is worth saying while showing it.

Each variant reports a distinguishable click so the arms are separable in the
report:

```
ab-test__variant-a      ab-test__variant-b      ab-test__variant-c
```

Get those wrong, or reuse one across two variants, and the report shows a winner
that does not exist.

## What these files may not say

The same rule as every other shared creative, handoff 2.2a. One campaign serves
every demo forever, so no brand, product, price, currency or vertical, in any of
the three. A design test does not need any of them.
