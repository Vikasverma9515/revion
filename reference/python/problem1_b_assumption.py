"""Problem 1 (b): what does the Rogan-Gladen estimate track?

A toy world. Each response is either clear or ambiguous (share h).
- Clear items: everyone perceives the true label.
- Ambiguous items: there is one shared impression ("reads as a violation"
  with probability s), independent of the true label (true rate pi_h).
  Annotators always read that impression; the judge reads it with
  probability f, otherwise it reads the truth.
Three annotators then add independent noise (false-positive rate e0,
false-negative rate e1) and the majority label is taken. The judge flags
with its own sensitivity / specificity relative to what it perceives.

We calibrate the judge against the majority label on n_cal items, then
apply Rogan-Gladen to a production sample from the same world, and
compare three numbers: the true rate, the annotators' rate, the estimate.

Bias formulas (majority-label accuracies a1 = sensitivity, a0 = specificity):
  shared impression bias = h * (s - pi_h)
  annotator noise bias   = (1 - a0)(1 - pi*) - (1 - a1) pi*
where pi* = pi + shared bias is the rate the annotators perceive
(pi* = pi when h = 0). Their sum is the annotators' bias against truth.
This script does not assume a sign for either; it only reports them.

Run: python3 problem1_b_assumption.py [--json]
"""
import json
import sys

from rng import Rng

SCENARIOS = [
    # name, overrides of BASE
    ("Clean annotators, no ambiguity", {}),
    ("Noisy annotators, no ambiguity", {"e0": 0.03, "e1": 0.20}),
    ("Ambiguous items read as violations", {"h": 0.10, "pi_h": 0.10, "s": 0.50}),
    ("Ambiguous items read as clean", {"h": 0.10, "pi_h": 0.20, "s": 0.03}),
    ("As row 3, judge reads the truth instead", {"h": 0.10, "pi_h": 0.10, "s": 0.50, "f": 0.0}),
    ("Noise and ambiguity together", {"h": 0.05, "pi_h": 0.30, "s": 0.10, "e0": 0.02, "e1": 0.15}),
]

BASE = {
    "pi": 0.034,      # true violation rate
    "h": 0.0,         # share of ambiguous items
    "pi_h": 0.0,      # true violation rate among ambiguous items
    "s": 0.0,         # P(shared impression says "violation") on ambiguous items
    "f": 1.0,         # P(judge shares the impression) on ambiguous items
    "e0": 0.01,       # per-annotator false-positive rate
    "e1": 0.05,       # per-annotator false-negative rate
    "judge_se": 0.85,
    "judge_sp": 0.94,
    "n_cal": 200_000,   # large, so sampling noise does not hide the pattern
    "n_prod": 200_000,
}


def majority_accuracy(err):
    """P(majority of 3 is right) when each annotator is right with prob 1-err."""
    a = 1 - err
    return a**3 + 3 * a**2 * (1 - a)


def formulas(p):
    a0 = majority_accuracy(p["e0"])
    a1 = majority_accuracy(p["e1"])
    shared = p["h"] * (p["s"] - p["pi_h"])
    pi_star = p["pi"] + shared
    noise = (1 - a0) * (1 - pi_star) - (1 - a1) * pi_star
    return {"a0": a0, "a1": a1, "shared_bias": shared, "noise_bias": noise,
            "annotator_rate_expected": p["pi"] + shared + noise}


def draw_item(rng, p, pi_clear):
    """Returns (truth, majority_label, judge_flag). Draw order is fixed."""
    ambiguous = rng.uniform() < p["h"]
    truth = rng.uniform() < (p["pi_h"] if ambiguous else pi_clear)
    impression = (rng.uniform() < p["s"]) if ambiguous else truth
    votes = 0
    for _ in range(3):
        u = rng.uniform()
        votes += (u >= p["e1"]) if impression else (u < p["e0"])
    majority = votes >= 2
    judge_sees = impression if (ambiguous and rng.uniform() < p["f"]) else truth
    flag = rng.uniform() < (p["judge_se"] if judge_sees else 1 - p["judge_sp"])
    return truth, majority, flag


def simulate(p, seed):
    pi_clear = (p["pi"] - p["h"] * p["pi_h"]) / (1 - p["h"])
    if not 0 <= pi_clear <= 1:
        raise ValueError("pi, h and pi_h are inconsistent (clear-item rate outside [0, 1])")
    rng = Rng(seed)
    # Calibration: judge vs majority label.
    tp = fn = tn = fp = 0
    for _ in range(p["n_cal"]):
        _, m, j = draw_item(rng, p, pi_clear)
        if m:
            tp += j
            fn += not j
        else:
            fp += j
            tn += not j
    # Production: same world.
    true_n = maj_n = flag_n = 0
    for _ in range(p["n_prod"]):
        t, m, j = draw_item(rng, p, pi_clear)
        true_n += t
        maj_n += m
        flag_n += j
    se = tp / (tp + fn)
    sp = tn / (tn + fp)
    q = flag_n / p["n_prod"]
    rg = (q + sp - 1) / (se + sp - 1)
    return {"true_rate": true_n / p["n_prod"], "annotator_rate": maj_n / p["n_prod"],
            "rogan_gladen": rg, "judge_rate": q, "J": se + sp - 1, "cal_sensitivity": se, "cal_specificity": sp}


def main():
    rows = []
    for i, (name, over) in enumerate(SCENARIOS):
        p = {**BASE, **over}
        sim = simulate(p, seed=100 + i)
        rows.append({"name": name, "params": p, **sim, **formulas(p),
                     "bias_vs_truth": sim["rogan_gladen"] - sim["true_rate"],
                     "gap_to_annotators": sim["rogan_gladen"] - sim["annotator_rate"]})
    if "--json" in sys.argv:
        print(json.dumps({"scenarios": rows}))
        return
    print(f"{'scenario':42} {'true':>7} {'annot.':>7} {'RG':>7} {'RG-true':>8} {'RG-annot':>9} {'formula':>8}")
    for r in rows:
        print(f"{r['name']:42} {r['true_rate']:7.2%} {r['annotator_rate']:7.2%} {r['rogan_gladen']:7.2%} "
              f"{r['bias_vs_truth']*100:+8.2f} {r['gap_to_annotators']*100:+9.2f} "
              f"{(r['shared_bias'] + r['noise_bias'])*100:+8.2f}")
    print("\nRG tracks the annotators' rate; its gap to the truth is the annotators' own bias.")
    print("The small RG-annot gap is sampling noise scaled by 1/J; it shrinks as n_cal grows.")


if __name__ == "__main__":
    main()
