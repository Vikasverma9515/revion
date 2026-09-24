#!/bin/sh
# Regenerates the JSON the TypeScript tests compare against.
# Needs only python3 (standard library). problem1_c_design.py takes ~90 s.
set -e
cd "$(dirname "$0")/../reference/python"
out=../../lib/__fixtures__
python3 problem1_ab.py --json > $out/problem1_ab.json
python3 problem1_b_assumption.py --json > $out/problem1_b_assumption.json
python3 problem1_c_design.py --json > $out/problem1_c_design.json
python3 problem2.py --json > $out/problem2.json
python3 problem2_direction_check.py --json > $out/problem2_direction_check.json
python3 -c "
import json
from rng import Rng
r = Rng(42)
print(json.dumps({
  'uniform': [r.uniform() for _ in range(5)],
  'normal': [r.normal() for _ in range(5)],
  'binomial_small': [r.binomial(316, 0.00623) for _ in range(5)],
  'binomial_large': [r.binomial(2000000, 0.09) for _ in range(5)],
  'gamma': [r.gamma(0.5), r.gamma(2.5), r.gamma(20.5)],
  'beta': [r.beta(2.5, 314.5) for _ in range(3)],
}))" > $out/rng.json
echo "fixtures written"
