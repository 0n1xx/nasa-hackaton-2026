// Small, dependency-free statistics for short daily time series (about 5–15 values).
//
// - linearTrend: ordinary least squares on x = 0..n−1, with a two-sided t-test on the slope.
// - predictBand: 95% confidence band for the fitted mean at any x (including x beyond the data).
// - mannKendall: non-parametric monotonic trend test (normal approximation, ties-corrected variance).
// - zScore: standard score.
//
// The Student-t CDF uses the regularized incomplete beta function, evaluated with the
// Numerical Recipes continued fraction. Accuracy is far better than these short series need.

export interface LinearTrend {
  /** units per step (per day for daily data) */
  slope: number
  intercept: number
  /** coefficient of determination, 0–1 */
  r2: number
  /** two-sided p-value for H0: slope = 0 (df = n − 2) */
  pValue: number
  /** standard error of the slope */
  se: number
  n: number
  /** residual standard deviation, used by predictBand */
  resSd: number
  xMean: number
  sxx: number
}

export interface MannKendall {
  S: number
  tau: number
  z: number
  pValue: number
  trend: 'rising' | 'falling' | 'none'
}

/** log Γ(x) for x > 0 (Lanczos approximation, g = 7). */
function lnGamma(x: number): number {
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x)
  x -= 1
  let a = c[0]
  const t = x + 7.5
  for (let i = 1; i < 9; i++) a += c[i] / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

/** Continued fraction for the incomplete beta function (modified Lentz). */
function betacf(a: number, b: number, x: number): number {
  const EPS = 3e-14, FPMIN = 1e-300
  const qab = a + b, qap = a + 1, qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d; h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

/** Regularized incomplete beta I_x(a, b), 0 ≤ x ≤ 1. */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b
}

/** Two-sided p-value P(|T| ≥ |t|) for Student's t with df degrees of freedom. */
export function tTwoSidedP(t: number, df: number): number {
  if (!Number.isFinite(t)) return 0
  return Math.min(1, Math.max(0, incompleteBeta(df / (df + t * t), df / 2, 0.5)))
}

/** Critical value t* with P(|T| ≥ t*) = alpha (bisection on the two-sided p). */
export function tCritical(df: number, alpha = 0.05): number {
  let lo = 0, hi = 1000
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    if (tTwoSidedP(mid, df) > alpha) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Standard normal CDF Φ(z) via erf (Abramowitz & Stegun 7.1.26, |error| < 1.5e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf)
}

/**
 * Least-squares line through y against x = 0..n−1, with a two-sided t-test on the slope (df = n − 2).
 * Fewer than 3 points: slope is reported but pValue is 1 (no test possible).
 */
export function linearTrend(y: number[]): LinearTrend {
  const n = y.length
  const xMean = (n - 1) / 2
  const yMean = n ? y.reduce((a, v) => a + v, 0) / n : 0
  let sxx = 0, sxy = 0, syy = 0
  for (let i = 0; i < n; i++) {
    sxx += (i - xMean) ** 2
    sxy += (i - xMean) * (y[i] - yMean)
    syy += (y[i] - yMean) ** 2
  }
  const slope = sxx > 0 ? sxy / sxx : 0
  const intercept = yMean - slope * xMean
  let sse = 0
  for (let i = 0; i < n; i++) sse += (y[i] - (intercept + slope * i)) ** 2
  const r2 = syy > 0 ? Math.max(0, 1 - sse / syy) : 0
  if (n < 3) return { slope, intercept, r2, pValue: 1, se: NaN, n, resSd: NaN, xMean, sxx }
  const resSd = Math.sqrt(sse / (n - 2))
  const se = resSd / Math.sqrt(sxx)
  const pValue = se > 0 ? tTwoSidedP(slope / se, n - 2) : slope !== 0 ? 0 : 1
  return { slope, intercept, r2, pValue, se, n, resSd, xMean, sxx }
}

/** Fitted value and 95% confidence band for the MEAN at x (x may lie outside 0..n−1). */
export function predictBand(trend: LinearTrend, x: number): { fit: number; lo: number; hi: number } {
  const fit = trend.intercept + trend.slope * x
  if (trend.n < 3 || !Number.isFinite(trend.resSd)) return { fit, lo: fit, hi: fit }
  const half = tCritical(trend.n - 2) * trend.resSd * Math.sqrt(1 / trend.n + (x - trend.xMean) ** 2 / trend.sxx)
  return { fit, lo: fit - half, hi: fit + half }
}

/**
 * Mann–Kendall trend test. S = Σ sign(y_j − y_i) over i < j; variance corrected for tied groups;
 * z uses a continuity correction; two-sided p from the normal approximation. trend is set only when p < 0.05.
 */
export function mannKendall(y: number[]): MannKendall {
  const n = y.length
  let S = 0
  for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) S += Math.sign(y[j] - y[i])
  const counts = new Map<number, number>()
  for (const v of y) counts.set(v, (counts.get(v) ?? 0) + 1)
  let ties = 0
  for (const t of counts.values()) if (t > 1) ties += t * (t - 1) * (2 * t + 5)
  const variance = (n * (n - 1) * (2 * n + 5) - ties) / 18
  const z = variance > 0 ? (S > 0 ? (S - 1) / Math.sqrt(variance) : S < 0 ? (S + 1) / Math.sqrt(variance) : 0) : 0
  const pValue = Math.min(1, 2 * (1 - normalCdf(Math.abs(z))))
  const pairs = (n * (n - 1)) / 2
  const tau = pairs > 0 ? S / pairs : 0
  const trend = pValue < 0.05 ? (S > 0 ? 'rising' : 'falling') : 'none'
  return { S, tau, z, pValue, trend }
}

/** Standard score: how many standard deviations value lies from mean. */
export function zScore(value: number, mean: number, sd: number): number {
  return sd > 0 ? (value - mean) / sd : 0
}

/**
 * Sen's slope (Theil–Sen estimator): the median of all pairwise slopes (y_j − y_i) / (j − i), i < j,
 * in units per step. Non-finite values are skipped (their index still counts as a step). Robust to outliers.
 */
export function senSlope(y: number[]): number {
  const slopes: number[] = []
  for (let i = 0; i < y.length - 1; i++) {
    if (!Number.isFinite(y[i])) continue
    for (let j = i + 1; j < y.length; j++) if (Number.isFinite(y[j])) slopes.push((y[j] - y[i]) / (j - i))
  }
  if (!slopes.length) return 0
  slopes.sort((a, b) => a - b)
  const m = slopes.length >> 1
  return slopes.length % 2 ? slopes[m] : (slopes[m - 1] + slopes[m]) / 2
}

/** Sample quantiles with linear interpolation (R type 7). qs are fractions 0–1. Non-finite values are ignored; empty input gives NaN. */
export function quantiles(values: number[], qs: number[]): number[] {
  const s = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!s.length) return qs.map(() => NaN)
  return qs.map((q) => {
    const h = (s.length - 1) * Math.min(1, Math.max(0, q))
    const lo = Math.floor(h)
    return lo + 1 < s.length ? s[lo] + (h - lo) * (s[lo + 1] - s[lo]) : s[lo]
  })
}

/**
 * Percentile rank (0–100) of value within an ascending array, interpolating between neighbours
 * (the inverse of quantiles(), so a 101-point percentile table maps back to its percentile).
 * Ties take the middle of the tied run. Below the minimum gives 0, above the maximum gives 100.
 */
export function percentileRank(value: number, sorted: number[]): number {
  const n = sorted.length
  if (!n || !Number.isFinite(value)) return NaN
  if (n === 1) return value < sorted[0] ? 0 : value > sorted[0] ? 100 : 50
  if (value < sorted[0]) return 0
  if (value > sorted[n - 1]) return 100
  let lo = 0
  while (lo < n && sorted[lo] < value) lo++
  let hi = lo
  while (hi < n && sorted[hi] === value) hi++
  let pos: number
  if (hi > lo) pos = (lo + hi - 1) / 2 // exact match(es)
  else pos = lo - 1 + (value - sorted[lo - 1]) / (sorted[lo] - sorted[lo - 1])
  return (pos / (n - 1)) * 100
}
