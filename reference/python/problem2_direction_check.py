"""Problem 2 (c): does the golden set understate the new system's gain?

Sweeps 27 settings of the toy model in problem2.py:
  f (share of relevant docs outside the old top 20) in {0.1, 0.2, 0.3}
  c (new system's hit rate on those unjudged docs)  in {0.1, 0.25, 0.4}
  k (new system keeps an old top-10 doc)            in {0.85, 0.90, 0.95}
m is set so the new system's measured recall stays near 0.78.

Per relevant doc, true gain = (1 - f) * measured gain + f * c, so the
measured gain is below the true gain whenever c exceeds the measured gain.
The sweep checks that with simulation noise included.

Run: python3 problem2_direction_check.py [--json]
"""
import json
import sys

from problem2 import GOLDEN_BASE, golden_set

F_GRID = [0.1, 0.2, 0.3]
C_GRID = [0.1, 0.25, 0.4]
K_GRID = [0.85, 0.90, 0.95]


def sweep(seed=400):
    rows = []
    i = 0
    for f in F_GRID:
        for c in C_GRID:
            for k in K_GRID:
                m = (0.78 - GOLDEN_BASE["old10"] * k) / (1 - GOLDEN_BASE["old10"])
                p = {**GOLDEN_BASE, "f": f, "c": c, "k": k, "m": m}
                g = golden_set(p, seed=seed + i)
                i += 1
                rows.append({"f": f, "c": c, "k": k, "m": m,
                             "measured_gain": g["measured_gain"], "true_gain": g["true_gain"],
                             "understated": g["measured_gain"] < g["true_gain"]})
    return rows


def main():
    rows = sweep()
    count = sum(r["understated"] for r in rows)
    if "--json" in sys.argv:
        print(json.dumps({"rows": rows, "understated": count}))
        return
    print(f"{'f':>4} {'c':>5} {'k':>5} {'measured':>9} {'true':>7}")
    for r in rows:
        mark = "" if r["understated"] else "  <- measured >= true"
        print(f"{r['f']:4.1f} {r['c']:5.2f} {r['k']:5.2f} {r['measured_gain']:+9.3f} {r['true_gain']:+7.3f}{mark}")
    print(f"\nMeasured gain below true gain in {count} of {len(rows)} settings.")


if __name__ == "__main__":
    main()
