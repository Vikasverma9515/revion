// Seeded random numbers. Mirrors reference/python/rng.py draw-for-draw,
// so the same seed gives the same numbers in Python and TypeScript.

export class Rng {
  private a: number;

  constructor(seed: number) {
    this.a = seed >>> 0;
  }

  /** mulberry32: a float in [0, 1). */
  uniform(): number {
    this.a = (this.a + 0x6d2b79f5) >>> 0;
    let t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (((t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0) ^ t) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Box-Muller, one value per call (two uniforms). */
  normal(): number {
    const u1 = 1 - this.uniform(); // (0, 1], avoids log(0)
    const u2 = this.uniform();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * Exact (sum of Bernoullis) for n <= 1000. Above that, a normal
   * approximation rounded and clamped to [0, n]; at n = 2,000,000 and
   * p = 0.09 its error is far below one count.
   */
  binomial(n: number, p: number): number {
    if (n <= 1000) {
      let x = 0;
      for (let i = 0; i < n; i++) if (this.uniform() < p) x++;
      return x;
    }
    const x = pyRound(n * p + Math.sqrt(n * p * (1 - p)) * this.normal());
    return Math.min(n, Math.max(0, x));
  }

  /** Marsaglia-Tsang. For shape < 1 use Gamma(shape+1) * U^(1/shape). */
  gamma(shape: number): number {
    if (shape < 1) {
      const g = this.gamma(shape + 1);
      return g * this.uniform() ** (1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      const x = this.normal();
      let v = 1 + c * x;
      if (v <= 0) continue;
      v = v * v * v;
      const u = this.uniform();
      if (Math.log(u > 0 ? u : 1e-300) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v;
    }
  }

  beta(a: number, b: number): number {
    const x = this.gamma(a);
    const y = this.gamma(b);
    return x / (x + y);
  }
}

/** Python's round(): halves go to the even neighbour. */
export function pyRound(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/** Linear interpolation between order statistics (numpy's default). */
export function quantile(sorted: number[], q: number): number {
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
}

/** Random seed for the "new seed" button. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}
