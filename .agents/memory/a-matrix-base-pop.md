---
name: A-matrix base population assumption
description: How to correctly handle unknown/null parents in Henderson's Tabular Method to avoid false F values.
---

When building the Additive Relationship Matrix (A-matrix) using Henderson's Tabular Method, unknown (null) parents must **never** be collapsed into a shared UNKNOWN sentinel node in the matrix.

**The bug:** Setting `A["UNKNOWN"]["UNKNOWN"] = 1.0` and using it as a real matrix entry causes `A[i][i] = 1 + 0.5 * 1.0 = 1.5`, giving F=0.5 (50%) for all foundation/base animals — completely wrong.

**The rule:** When either parent is null/unknown, treat their kinship contribution as 0:
```typescript
const aSireDam = sire && dam ? getA(sire.code, dam.code) : 0;
setA(ic, ic, 1.0 + 0.5 * aSireDam); // → 1.0 when parents unknown → F=0 ✓

const fromSire = sire ? getA(sire.code, jc) : 0;
const fromDam = dam ? getA(dam.code, jc) : 0;
setA(ic, jc, 0.5 * (fromSire + fromDam));
```

**Why:** Base population animals are assumed unrelated and non-inbred (F=0). Two "unknown" parents are distinct individuals from this base population with kinship=0 between them. Collapsing them into one UNKNOWN node implies they are the same individual (kinship=0.5 with itself), which inflates F for all descendants.

**How to apply:** Any time you implement the tabular method with nullable sire/dam references, check for null before looking up A values. The UNKNOWN sentinel can be removed entirely.
