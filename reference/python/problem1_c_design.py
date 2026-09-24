"""Problem 1 (c): 500 exact labels, stratified by the judge's decision.

Neyman allocation, expected half-width, expected violations among
unflagged responses, and a coverage simulation comparing Wald,
Agresti-Coull and Jeffreys intervals for the stratified estimate.

Run: python3 problem1_c_design.py [--json]
"""
import json
import math
import sys

from rng import Rng, quantile

Z = 1.959963984540054
SE_JUDGE = 20 / 24     # judge sensitivity from calibration
SP_JUDGE = 352 / 376   # judge specificity from calibration
PI = (0.09 + SP_JUDGE - 1) / (SE_JUDGE + SP_JUDGE - 1)   # 3.40% from part (a)
Q = 0.09               # flag rate = stratum weight of "flagged"
TOTAL = 500


def stratum_rates(se, pi, q):
    """Bayes: violation rate among flagged (p1) and unflagged (p0)."""
    return se * pi / q, (1 - se) * pi / (1 - q)


def neyman(total, q, p1, p0):
    """n_h proportional to W_h * sqrt(p_h (1 - p_h)), rounded to sum to total."""
    w1 = q * math.sqrt(p1 * (1 - p1))
    w0 = (1 - q) * math.sqrt(p0 * (1 - p0))
    n1 = round(total * w1 / (w1 + w0))
    n1 = min(total - 1, max(1, n1))
    return n1, total - n1


def design(total=TOTAL, se=SE_JUDGE, pi=PI, q=Q):
    p1, p0 = stratum_rates(se, pi, q)
    n1, n0 = neyman(total, q, p1, p0)
    var = q**2 * p1 * (1 - p1) / n1 + (1 - q) ** 2 * p0 * (1 - p0) / n0
    return {"p1": p1, "p0": p0, "n1": n1, "n0": n0, "half_width": Z * math.sqrt(var),
            "expected_unflagged_violations": n0 * p0, "p_zero_unflagged": (1 - p0) ** n0}


def intervals(x1, n1, x0, n0, w1, rng, draws):
    w0 = 1 - w1
    # Wald: plug-in variance; a stratum with 0 events contributes 0 variance.
    a1, a0 = x1 / n1, x0 / n0
    est = w1 * a1 + w0 * a0
    hw = Z * math.sqrt(w1**2 * a1 * (1 - a1) / n1 + w0**2 * a0 * (1 - a0) / n0)
    wald = (est - hw, est + hw)
    # Agresti-Coull per stratum (add 2 successes and 2 failures), combined.
    t1, t0 = (x1 + 2) / (n1 + 4), (x0 + 2) / (n0 + 4)
    est = w1 * t1 + w0 * t0
    hw = Z * math.sqrt(w1**2 * t1 * (1 - t1) / (n1 + 4) + w0**2 * t0 * (1 - t0) / (n0 + 4))
    agresti = (est - hw, est + hw)
    # Jeffreys: Beta(x+0.5, n-x+0.5) posterior per stratum, combined by
    # Monte Carlo with the known weights; equal-tailed 2.5% / 97.5%.
    combo = sorted(w1 * rng.beta(x1 + 0.5, n1 - x1 + 0.5) + w0 * rng.beta(x0 + 0.5, n0 - x0 + 0.5)
                   for _ in range(draws))
    jeffreys = (quantile(combo, 0.025), quantile(combo, 0.975))
    return {"wald": wald, "agresti": agresti, "jeffreys": jeffreys}


def coverage(pi_true, n1, n0, seed, replays=2000, draws=1000, se=SE_JUDGE, sp=SP_JUDGE):
    """Fixed design (n1, n0). The true world has prevalence pi_true and the
    judge's calibrated Se / Sp, so the weights are the flag rate q(pi_true)."""
    rng = Rng(seed)
    q = pi_true * se + (1 - pi_true) * (1 - sp)
    p1, p0 = stratum_rates(se, pi_true, q)
    hits = {"wald": 0, "agresti": 0, "jeffreys": 0}
    zero_unflagged = 0
    for _ in range(replays):
        x1 = rng.binomial(n1, p1)
        x0 = rng.binomial(n0, p0)
        zero_unflagged += x0 == 0
        for name, (lo, hi) in intervals(x1, n1, x0, n0, q, rng, draws).items():
            hits[name] += lo <= pi_true <= hi
    return {"pi": pi_true, "q": q, **{k: v / replays for k, v in hits.items()},
            "zero_unflagged": zero_unflagged / replays}


PREVALENCE_GRID = [0.01, 0.02, 0.034, 0.05, 0.08]


def main():
    d = design()
    grid = [coverage(pi, d["n1"], d["n0"], seed=200 + i) for i, pi in enumerate(PREVALENCE_GRID)]
    if "--json" in sys.argv:
        print(json.dumps({"design": d, "coverage": grid}))
        return
    print(f"p1 (flagged) = {d['p1']:.4f}   p0 (unflagged) = {d['p0']:.5f}")
    print(f"Neyman allocation: {d['n1']} flagged / {d['n0']} unflagged")
    print(f"Expected half-width: {d['half_width']*100:.2f} points")
    print(f"Expected violations among unflagged: {d['expected_unflagged_violations']:.2f}, "
          f"P(zero) = {d['p_zero_unflagged']:.3f}")
    print("\nCoverage of nominal 95% intervals (2000 replays, 1000 Jeffreys draws each):")
    print(f"{'true pi':>8} {'Wald':>7} {'Agresti':>8} {'Jeffreys':>9} {'P(x0=0)':>8}")
    for g in grid:
        print(f"{g['pi']:8.3f} {g['wald']:7.3f} {g['agresti']:8.3f} {g['jeffreys']:9.3f} {g['zero_unflagged']:8.3f}")


if __name__ == "__main__":
    main()
