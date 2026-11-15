// Before the Smoke wildfire risk index — a transparent, rule-based PROTOTYPE.
//
// It is a weighted sum of nine dryness/hazard sub-scores, each scaled 0–1 by a
// simple linear ramp. One of them is Canada's official Fire Weather Index (FWI)
// at the nearest fire weather station, when one is in range (shared/fwi.ts).
//
// Drying power: wind, a dry spell and the regional baseline only matter when the
// air can dry fuels. They are multiplied by `drying` (0–1, from the vapour pressure
// deficit), so a cold, damp, windy November day is not scored like a hot, dry one.
// On the weather alone it was checked against the official FWI at 80 communities on 15 November 2026
// (server/risk-calibration.test.ts): 66 of 71 official-low places Low, 23 before drying power.
//
// Every number below is a documented assumption chosen for interpretability. It has
// NOT been trained or validated against fire occurrence, and its output is a
// relative index, not a probability of ignition.

import type { RiskFactor, RiskLevel, RiskResult } from './types.ts'

export interface RiskInputs {
  tMax: number | null       // °C, daily maximum
  rhMin: number | null      // %, daily minimum
  windMax: number | null    // km/h
  precip7d: number | null   // mm over the previous 7 days
  soil: number | null       // m³/m³
  vpdMax: number | null     // kPa — how hard the air pulls moisture out of vegetation
  hotspots100km: number | null
  historyIndex: number | null
  snow: number | null       // m
  /** Canada's Fire Weather Index at the nearest station still reporting (null or absent when none in range) */
  fwi?: number | null
  /** how much of the input is live data: affects confidence only */
  quality: 'observed' | 'forecast' | 'simulated'
}

const clamp = (x: number) => Math.max(0, Math.min(1, x))

interface FactorDef {
  key: keyof RiskInputs; label: string; unit: string; weight: number
  score: (v: number) => number; explain: string
}

export const FACTORS: FactorDef[] = [
  { key: 'fwi', label: 'Canada’s Fire Weather Index (nearest station)', unit: '', weight: 0.25, score: (v) => clamp(v / 30), explain: 'The official Canadian index from Natural Resources Canada’s fire weather stations. 0 scores 0; 30 or more (extreme) scores 1. From the nearest station within 200 km that is still reporting. Stations cover today and the next 2 days; later days hold the last reading. When there is no station, it is left out without lowering confidence.' },
  { key: 'rhMin', label: 'Relative humidity (daily min)', unit: '%', weight: 0.135, score: (v) => clamp((70 - v) / 50), explain: '70% or wetter scores 0; 20% or drier scores 1. Dry air dries fine fuels within hours.' },
  { key: 'precip7d', label: 'Rain, last 7 days', unit: 'mm', weight: 0.12, score: (v) => clamp(1 - v / 25), explain: '25 mm or more scores 0; no rain scores 1. Multiplied by drying power.' },
  { key: 'windMax', label: 'Wind speed (daily max)', unit: 'km/h', weight: 0.105, score: (v) => clamp(v / 40), explain: 'Calm scores 0; 40 km/h or more scores 1. Wind drives spread. Multiplied by drying power.' },
  { key: 'tMax', label: 'Temperature (daily max)', unit: '°C', weight: 0.09, score: (v) => clamp((v - 5) / 27), explain: '5 °C or colder scores 0; 32 °C or hotter scores 1.' },
  { key: 'hotspots100km', label: 'Satellite fire detections within 100 km', unit: '', weight: 0.09, score: (v) => clamp(Math.log1p(v) / Math.log1p(50)), explain: 'Log scale: none scores 0; 50 or more scores 1. Fire already on the landscape.' },
  { key: 'vpdMax', label: 'Vapour pressure deficit (vegetation dryness proxy)', unit: 'kPa', weight: 0.075, score: (v) => clamp(v / 2.5), explain: '0 kPa scores 0; 2.5 kPa or more scores 1. A proxy, not a measured fuel moisture.' },
  { key: 'soil', label: 'Surface soil moisture', unit: 'm³/m³', weight: 0.075, score: (v) => clamp((0.35 - v) / 0.25), explain: '0.35 or wetter scores 0; 0.10 or drier scores 1. Modelled, top 1 cm.' },
  { key: 'historyIndex', label: 'Historical fire activity (regional baseline)', unit: 'index', weight: 0.06, score: (v) => clamp(v), explain: 'A fixed 0–1 regional baseline set by hand. An assumption, not computed from records. Multiplied by drying power.' },
]

/** Inputs that only count as far as the air can dry fuels (see dryingPower). */
export const DRYING_SCALED = new Set<keyof RiskInputs>(['windMax', 'precip7d', 'historyIndex'])
/** Inputs whose absence does not lower confidence: the official index only exists near stations, for 3 days. */
const OPTIONAL = new Set<keyof RiskInputs>(['fwi'])

/** Vapour pressure deficit (kPa) from temperature (°C) and relative humidity (%), Tetens formula. */
export const vpdFrom = (t: number, rh: number) => 0.6108 * Math.exp((17.27 * t) / (t + 237.3)) * (1 - rh / 100)

/**
 * How fast the air can dry dead fuels, 0–1: 0 at a vapour pressure deficit of 0.2 kPa or less (cold or
 * damp air), 1 at 1.0 kPa or more. Thresholds chosen against the official index on 15 November 2026
 * (server/risk-calibration.test.ts), and high enough that summer fire weather (1 kPa and up) counts in full.
 */
export function dryingPower(inp: Pick<RiskInputs, 'vpdMax' | 'tMax' | 'rhMin'>): number {
  const vpd = inp.vpdMax ?? (inp.tMax != null && inp.rhMin != null ? vpdFrom(inp.tMax, inp.rhMin) : null)
  if (vpd == null) return 1
  return Math.round(clamp((vpd - 0.2) / 0.8) * 100) / 100
}

export function levelFor(score: number): RiskLevel {
  return score >= 75 ? 'Critical' : score >= 50 ? 'High' : score >= 25 ? 'Moderate' : 'Low'
}

/** The word the UI shows for a level (plain-English glossary in docs/plans). Display only: the RiskLevel values stay as they are. */
export function levelLabel(level: RiskLevel): string {
  return ({ Low: 'Low', Moderate: 'Medium', High: 'High', Critical: 'Very high' } as Record<RiskLevel, string>)[level] ?? level
}

/** Level fills (docs/design/critique-and-direction.md §2). Fills only: text on them is ink,
 *  white on Very high. No green: an unvalidated estimate should never say "safe". */
export const LEVEL_COLORS: Record<RiskLevel, string> = {
  Low: '#e6ddbf', Moderate: '#f0b43c', High: '#e36f27', Critical: '#a8231c',
}

/** Ink colour for text placed on a level fill. */
export const LEVEL_TEXT: Record<RiskLevel, string> = { Low: '#1b1f1d', Moderate: '#1b1f1d', High: '#1b1f1d', Critical: '#ffffff' }

/** Steps on the 4-segment level meter (1 = Low … 4 = Very high), so a level reads without colour. */
export const LEVEL_STEP: Record<RiskLevel, 1 | 2 | 3 | 4> = { Low: 1, Moderate: 2, High: 3, Critical: 4 }

export function computeRisk(inp: RiskInputs): RiskResult {
  let weightPresent = 0
  let missing = 0
  const raw = FACTORS.map((f) => {
    const v = inp[f.key] as number | null | undefined
    const ok = v != null && !Number.isNaN(v)
    if (ok) weightPresent += f.weight
    else if (!OPTIONAL.has(f.key)) missing++
    return { f, v: ok ? (v as number) : null, s: ok ? f.score(v as number) : null }
  })
  const counted = FACTORS.length - OPTIONAL.size

  // Snow or frozen conditions: surface fuels cannot carry fire. Scale everything down.
  const snowGate = (inp.snow != null && inp.snow > 0.02) || (inp.tMax != null && inp.tMax <= 0)
  const gate = snowGate ? 0.2 : 1
  const drying = dryingPower(inp)

  // Missing inputs: re-normalise the remaining weights so the score stays on 0–100.
  const factors: RiskFactor[] = raw.map(({ f, v, s }) => ({
    key: f.key, label: f.label, unit: f.unit, value: v, score: s, weight: f.weight, explain: f.explain,
    contribution: s == null || weightPresent === 0 ? 0 : Math.round(((s * f.weight * (DRYING_SCALED.has(f.key) ? drying : 1)) / weightPresent) * 100 * gate * 10) / 10,
  }))
  const score = Math.round(factors.reduce((a, f) => a + f.contribution, 0))

  const confidence = inp.quality === 'simulated' || missing >= 3 ? 'Low' : inp.quality === 'forecast' || missing >= 1 ? 'Medium' : 'High'
  const why = [
    inp.quality === 'simulated' ? 'inputs are simulated' : inp.quality === 'forecast' ? 'inputs are forecast, not yet observed' : 'weather inputs are current model analyses',
    missing ? `${missing} of ${counted} inputs missing` : 'all inputs present',
    'model is unvalidated',
  ].join('; ')

  return {
    score, level: levelFor(score), snowGate, drying,
    // Heuristic band, not a statistical interval: wider with missing or forecast inputs.
    uncertainty: 8 + missing * 4 + (inp.quality === 'forecast' ? 4 : 0) + (inp.quality === 'simulated' ? 6 : 0),
    confidence, confidenceWhy: why,
    factors: factors.sort((a, b) => b.contribution - a.contribution),
  }
}
