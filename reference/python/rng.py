"""Seeded random numbers shared by every script.

mulberry32 is used (not Python's `random`) so the TypeScript port in
lib/stats/rng.ts produces the *same* draws for the same seed.
Every draw below consumes uniforms in a fixed order; the TS code mirrors it.
"""
import math

MASK = 0xFFFFFFFF


def _imul(a, b):
    return (a * b) & MASK


class Rng:
    def __init__(self, seed):
        self.a = seed & MASK

    def uniform(self):
        """mulberry32: a float in [0, 1)."""
        self.a = (self.a + 0x6D2B79F5) & MASK
        t = self.a
        t = _imul(t ^ (t >> 15), t | 1)
        t = ((t + _imul(t ^ (t >> 7), t | 61)) & MASK) ^ t
        return ((t ^ (t >> 14)) & MASK) / 4294967296

    def normal(self):
        """Box-Muller, one value per call (two uniforms)."""
        u1 = 1.0 - self.uniform()  # (0, 1], avoids log(0)
        u2 = self.uniform()
        return math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)

    def bernoulli(self, p):
        return 1 if self.uniform() < p else 0

    def binomial(self, n, p):
        """Exact (sum of Bernoullis) for n <= 1000.
        Above that, a normal approximation rounded and clamped to [0, n];
        at n = 2,000,000 and p = 0.09 its error is far below one count."""
        if n <= 1000:
            return sum(1 for _ in range(n) if self.uniform() < p)
        x = round(n * p + math.sqrt(n * p * (1 - p)) * self.normal())
        return min(n, max(0, x))

    def gamma(self, shape):
        """Marsaglia-Tsang. For shape < 1 use Gamma(shape+1) * U^(1/shape)."""
        if shape < 1:
            g = self.gamma(shape + 1)
            return g * self.uniform() ** (1.0 / shape)
        d = shape - 1.0 / 3.0
        c = 1.0 / math.sqrt(9.0 * d)
        while True:
            x = self.normal()
            v = 1.0 + c * x
            if v <= 0:
                continue
            v = v * v * v
            u = self.uniform()
            if math.log(u if u > 0 else 1e-300) < 0.5 * x * x + d - d * v + d * math.log(v):
                return d * v

    def beta(self, a, b):
        x = self.gamma(a)
        y = self.gamma(b)
        return x / (x + y)


def quantile(sorted_values, q):
    """Linear interpolation between order statistics (numpy's default)."""
    pos = q * (len(sorted_values) - 1)
    lo = math.floor(pos)
    hi = min(lo + 1, len(sorted_values) - 1)
    return sorted_values[lo] + (pos - lo) * (sorted_values[hi] - sorted_values[lo])


def normal_cdf(z):
    return 0.5 * math.erfc(-z / math.sqrt(2))
