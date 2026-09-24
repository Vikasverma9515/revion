"""Problem 2 (a) and (c).

(a) Two-proportion z-test for thumbs-down 8% -> 11% on ~3,000 ratings each,
    and the design effect at which the change stops being significant.
(c) Golden-set bias: relevance labels exist only for the old system's top 20.

Golden-set toy model, per query:
- r relevant documents, r uniform on 1..10.
- Each relevant doc is outside the old top 20 with probability f (unjudged).
  Otherwise it is in the old top 10 with probability old10, else ranks 11-20.
- The new system puts it in its top 10 with probability
  k (old top 10), m (old 11-20) or c (outside old top 20).
Measured recall@10 counts only judged docs (unjudged docs are treated as
not relevant); true recall@10 counts all relevant docs. Queries with no
judged relevant doc cannot be in the golden set and are skipped.
Docs are placed independently (top-10 slot limits are ignored).

Run: python3 problem2.py [--json]
"""
import json
import math
import sys

from rng import Rng, normal_cdf

Z = 1.959963984540054


def two_proportion(x1, n1, x2, n2):
    p1, p2 = x1 / n1, x2 / n2
    pooled = (x1 + x2) / (n1 + n2)
    se_pooled = math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2))
    z = (p2 - p1) / se_pooled
    se_diff = math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2)   # unpooled, for the CI
    return {"p1": p1, "p2": p2, "diff": p2 - p1, "se_pooled": se_pooled, "z": z,
            "p_value": 2 * (1 - normal_cdf(abs(z))),
            "lo": p2 - p1 - Z * se_diff, "hi": p2 - p1 + Z * se_diff,
            # Clustering inflates variance by the design effect; z shrinks by sqrt(deff).
            "deff_break_even": (z / Z) ** 2}


GOLDEN_BASE = {"queries": 1200, "f": 0.20, "old10": 0.71, "k": 0.90, "m": 0.49, "c": 0.30}


def golden_set(p, seed, keep_queries=0):
    rng = Rng(seed)
    sums = {"old_measured": 0.0, "new_measured": 0.0, "old_true": 0.0, "new_true": 0.0}
    kept = 0
    per_query = []
    for _ in range(p["queries"]):
        r = 1 + math.floor(rng.uniform() * 10)
        judged = old_hits = new_hits_judged = new_hits_unjudged = 0
        for _ in range(r):
            if rng.uniform() < p["f"]:                       # outside old top 20
                new_hits_unjudged += rng.uniform() < p["c"]
                continue
            judged += 1
            if rng.uniform() < p["old10"]:                   # old top 10
                old_hits += 1
                new_hits_judged += rng.uniform() < p["k"]
            else:                                            # old ranks 11-20
                new_hits_judged += rng.uniform() < p["m"]
        if judged == 0:
            continue
        kept += 1
        q = {"old_measured": old_hits / judged, "new_measured": new_hits_judged / judged,
             "old_true": old_hits / r, "new_true": (new_hits_judged + new_hits_unjudged) / r}
        for key in sums:
            sums[key] += q[key]
        if len(per_query) < keep_queries:
            per_query.append(q)
    out = {k: v / kept for k, v in sums.items()}
    out["queries_kept"] = kept
    out["measured_gain"] = out["new_measured"] - out["old_measured"]
    out["true_gain"] = out["new_true"] - out["old_true"]
    if keep_queries:
        out["per_query"] = per_query
    return out


def main():
    z = two_proportion(240, 3000, 330, 3000)
    g = golden_set(GOLDEN_BASE, seed=300)
    if "--json" in sys.argv:
        print(json.dumps({"ztest": z, "golden": g}))
        return
    print(f"(a) {z['p1']:.1%} -> {z['p2']:.1%}: SE {z['se_pooled']:.4f}, z = {z['z']:.2f}, "
          f"p = {z['p_value']:.1e}, 95% CI [{z['lo']*100:.2f}, {z['hi']*100:.2f}] points")
    print(f"    Significance is lost at a design effect of {z['deff_break_even']:.2f}")
    print(f"(c) measured recall@10  old {g['old_measured']:.3f}  new {g['new_measured']:.3f}  "
          f"gain {g['measured_gain']:+.3f}")
    print(f"    true recall@10      old {g['old_true']:.3f}  new {g['new_true']:.3f}  "
          f"gain {g['true_gain']:+.3f}")


if __name__ == "__main__":
    main()
