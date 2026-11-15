// Before the Smoke wildfire risk index — a transparent, rule-based PROTOTYPE.
//
// It is a weighted sum of eight dryness/hazard sub-scores, each scaled 0–1 by a
// simple linear ramp. Every number below is a documented assumption chosen for
// interpretability. It has NOT been trained or validated against fire
// occurrence, and its output is a relative index, not a probability of ignition.
// For operational fire danger, use the Canadian Forest Fire Weather Index (FWI).

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
  /** how much of the input is live data: affects confidence only */
  quality: 'observed' | 'forecast' | 'simulated'
}

const clamp = (x: number) => Math.max(0, Math.min(1, x))

interface FactorDef {
  key: keyof RiskInputs; label: string; unit: string; weight: number
  score: (v: number) => number; explain: string
}

export const FACTORS: FactorDef[] = [
  { key: 'rhMin', label: 'Relative humidity (daily min)', unit: '%', weight: 0.18, score: (v) => clamp((70 - v) / 50), explain: '70% or wetter scores 0; 20% or drier scores 1. Dry air dries fine fuels within hours.' },
  { key: 'precip7d', label: 'Rain, last 7 days', unit: 'mm', weight: 0.16, score: (v) => clamp(1 - v / 25), explain: '25 mm or more scores 0; no rain scores 1.' },
  { key: 'windMax', label: 'Wind speed (daily max)', unit: 'km/h', weight: 0.14, score: (v) => clamp(v / 40), explain: 'Calm scores 0; 40 km/h or more scores 1. Wind drives spread.' },
  { key: 'tMax', label: 'Temperature (daily max)', unit: '°C', weight: 0.12, score: (v) => clamp((v - 5) / 27), explain: '5 °C or colder scores 0; 32 °C or hotter scores 1.' },
  { key: 'hotspots100km', label: 'Satellite fire detections within 100 km', unit: '', weight: 0.12, score: (v) => clamp(Math.log1p(v) / Math.log1p(50)), explain: 'Log scale: none scores 0; 50 or more scores 1. Fire already on the landscape.' },
  { key: 'vpdMax', label: 'Vapour pressure deficit (vegetation dryness proxy)', unit: 'kPa', weight: 0.10, score: (v) => clamp(v / 2.5), explain: '0 kPa scores 0; 2.5 kPa or more scores 1. A proxy, not a measured fuel moisture.' },
  { key: 'soil', label: 'Surface soil moisture', unit: 'm³/m³', weight: 0.10, score: (v) => clamp((0.35 - v) / 0.25), explain: '0.35 or wetter scores 0; 0.10 or drier scores 1. Modelled, top 1 cm.' },
  { key: 'historyIndex', label: 'Historical fire activity (regional baseline)', unit: 'index', weight: 0.08, score: (v) => clamp(v), explain: 'A fixed 0–1 regional baseline set by hand. An assumption, not computed from records.' },
]

export function levelFor(score: number): RiskLevel {
  return score >= 75 ? 'Critical' : score >= 50 ? 'High' : score >= 25 ? 'Moderate' : 'Low'
}

/** The word the UI shows for a level (plain-English glossary in docs/plans). Display only: the RiskLevel values stay as they are. */
export function levelLabel(level: RiskLevel): string {
  return ({ Low: 'Low', Moderate: 'Medium', High: 'High', Critical: 'Very high' } as Record<RiskLevel, string>)[level] ?? level
}

export const LEVEL_COLORS: Record<RiskLevel, string> = {
  Low: '#2e8b62', Moderate: '#c79a16', High: '#e0702b', Critical: '#c9302c',
}

export function computeRisk(inp: RiskInputs): RiskResult {
  let weightPresent = 0
  let missing = 0
  const raw = FACTORS.map((f) => {
    const v = inp[f.key] as number | null
    const ok = v != null && !Number.isNaN(v)
    if (ok) weightPresent += f.weight
    else missing++
    return { f, v: ok ? v : null, s: ok ? f.score(v as number) : null }
  })

  // Snow or frozen conditions: surface fuels cannot carry fire. Scale everything down.
  const snowGate = (inp.snow != null && inp.snow > 0.02) || (inp.tMax != null && inp.tMax <= 0)
  const gate = snowGate ? 0.2 : 1

  // Missing inputs: re-normalise the remaining weights so the score stays on 0–100.
  const factors: RiskFactor[] = raw.map(({ f, v, s }) => ({
    key: f.key, label: f.label, unit: f.unit, value: v, score: s, weight: f.weight, explain: f.explain,
    contribution: s == null || weightPresent === 0 ? 0 : Math.round(((s * f.weight) / weightPresent) * 100 * gate * 10) / 10,
  }))
  const score = Math.round(factors.reduce((a, f) => a + f.contribution, 0))

  const confidence = inp.quality === 'simulated' || missing >= 3 ? 'Low' : inp.quality === 'forecast' || missing >= 1 ? 'Medium' : 'High'
  const why = [
    inp.quality === 'simulated' ? 'inputs are simulated' : inp.quality === 'forecast' ? 'inputs are forecast, not yet observed' : 'weather inputs are current model analyses',
    missing ? `${missing} of ${FACTORS.length} inputs missing` : 'all inputs present',
    'model is unvalidated',
  ].join('; ')

  return {
    score, level: levelFor(score), snowGate,
    // Heuristic band, not a statistical interval: wider with missing or forecast inputs.
    uncertainty: 8 + missing * 4 + (inp.quality === 'forecast' ? 4 : 0) + (inp.quality === 'simulated' ? 6 : 0),
    confidence, confidenceWhy: why,
    factors: factors.sort((a, b) => b.contribution - a.contribution),
  }
}
