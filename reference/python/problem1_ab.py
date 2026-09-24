"""Problem 1 (a) and (b): Rogan-Gladen estimate, delta-method CI, kappa.

Also replays the whole study many times in a world where the point
estimates are the truth, to check the interval's coverage.

Run: python3 problem1_ab.py [--json]
"""
import json
import math
import sys

from rng import Rng

# Calibration: 400 responses, majority label vs judge.
TP, FN = 20, 4        # 24 majority violations, judge caught 20
TN, FP = 352, 24      # 376 clean, judge flagged 24
Q = 0.09              # production flag rate
N = 2_000_000         # production volume
Z = 1.959963984540054


def rogan_gladen(tp, fn, tn, fp, q, n):
    se = tp / (tp + fn)
    sp = tn / (tn + fp)
    j = se + sp - 1                       # Youden's J
    pi = (q + sp - 1) / j
    var_q = q * (1 - q) / n
    var_se = se * (1 - se) / (tp + fn)
    var_sp = sp * (1 - sp) / (tn + fp)
    # First-order delta method: d pi/dq = 1/J, d pi/dSp = (1-pi)/J, d pi/dSe = -pi/J
    parts = {
        "flag_rate": var_q / j**2,
        "specificity": (1 - pi) ** 2 * var_sp / j**2,
        "sensitivity": pi**2 * var_se / j**2,
    }
    var = sum(parts.values())
    se_pi = math.sqrt(var)
    return {
        "sensitivity": se, "specificity": sp, "J": j, "pi": pi, "se": se_pi,
        "lo": pi - Z * se_pi, "hi": pi + Z * se_pi,
        "input_se": {"flag_rate": math.sqrt(var_q), "sensitivity": math.sqrt(var_se),
                     "specificity": math.sqrt(var_sp)},
        "contribution_se": {k: math.sqrt(v) for k, v in parts.items()},
        "share": {k: v / var for k, v in parts.items()},
    }


def kappa(p_observed, prevalence):
    """Cohen's kappa when both raters have the same marginal rate."""
    pe = prevalence**2 + (1 - prevalence) ** 2
    return (p_observed - pe) / (1 - pe)


def replay(seed, replays, pi_true, se_true, sp_true, n_pos, n_neg, n_prod):
    """Redraw calibration and production counts; refit; check the CI.
    Class counts (24 / 376) are held fixed, as in the calibration design."""
    rng = Rng(seed)
    q_true = pi_true * se_true + (1 - pi_true) * (1 - sp_true)
    covered = below_zero = 0
    for _ in range(replays):
        tp = rng.binomial(n_pos, se_true)
        tn = rng.binomial(n_neg, sp_true)
        flags = rng.binomial(n_prod, q_true)
        fit = rogan_gladen(tp, n_pos - tp, tn, n_neg - tn, flags / n_prod, n_prod)
        if not math.isfinite(fit["se"]):
            continue  # J = 0 can only happen in absurd draws; counted as a miss
        covered += fit["lo"] <= pi_true <= fit["hi"]
        below_zero += fit["lo"] < 0
    return {"replays": replays, "coverage": covered / replays,
            "lower_below_zero": below_zero / replays}


def main():
    fit = rogan_gladen(TP, FN, TN, FP, Q, N)
    kap = kappa(0.96, 0.06)
    kap_range = [kappa(0.96, 0.05), kappa(0.96, 0.08)]
    rep = replay(seed=1, replays=2000, pi_true=fit["pi"], se_true=fit["sensitivity"],
                 sp_true=fit["specificity"], n_pos=24, n_neg=376, n_prod=N)
    out = {"fit": fit, "kappa": kap, "kappa_range_5_8": kap_range, "replay_seed1_2000": rep}
    if "--json" in sys.argv:
        print(json.dumps(out))
        return
    print(f"Sensitivity {fit['sensitivity']:.4f}  Specificity {fit['specificity']:.4f}")
    print(f"pi = {fit['pi']:.4f}   SE = {fit['se']:.4f}   95% CI [{fit['lo']:.4%}, {fit['hi']:.4%}]")
    print("Input SEs:", {k: round(v, 5) for k, v in fit["input_se"].items()})
    print("SE contributions:", {k: round(v, 4) for k, v in fit["contribution_se"].items()})
    print("Variance shares:", {k: f"{v:.2%}" for k, v in fit["share"].items()})
    print(f"Kappa at 6%: {kap:.3f}   (5%..8%: {kap_range[0]:.3f}..{kap_range[1]:.3f})")
    print(f"Replay (seed 1, 2000): coverage {rep['coverage']:.3f}, lower bound < 0 in {rep['lower_below_zero']:.3f}")


if __name__ == "__main__":
    main()
