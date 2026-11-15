// US EPA Air Quality Index helpers.
// IMPORTANT: this is the US AQI (0–500). Canada's official index is the AQHI
// (1–10+), a different formula built from O3, NO2 and PM2.5. We never mix them.

export interface AqiBand { max: number; label: string; color: string; advice: string }

export const AQI_BANDS: AqiBand[] = [
  { max: 50, label: 'Good', color: '#3fb68b', advice: 'Air quality poses little or no risk.' },
  { max: 100, label: 'Moderate', color: '#e3c341', advice: 'Unusually sensitive people should consider reducing prolonged outdoor exertion.' },
  { max: 150, label: 'Unhealthy for sensitive groups', color: '#f08c3a', advice: 'Elders, children, pregnant people and anyone with heart or lung conditions should limit outdoor exertion.' },
  { max: 200, label: 'Unhealthy', color: '#e5484d', advice: 'Everyone may begin to feel effects. Move activities indoors where air is filtered.' },
  { max: 300, label: 'Very unhealthy', color: '#a855c7', advice: 'Health alert: everyone should avoid outdoor exertion. Use a clean-air room.' },
  { max: 9999, label: 'Hazardous', color: '#d0577a', advice: 'Emergency conditions. Stay indoors with filtered air; follow local health guidance.' },
]

export function aqiBand(aqi: number | null | undefined): AqiBand | null {
  if (aqi == null || Number.isNaN(aqi)) return null
  return AQI_BANDS.find((b) => aqi <= b.max) ?? AQI_BANDS[AQI_BANDS.length - 1]
}

// PM2.5 breakpoints, US EPA, effective May 2024 (24-hour average, µg/m³).
const PM25_BP: [number, number, number, number][] = [
  [0, 9.0, 0, 50], [9.1, 35.4, 51, 100], [35.5, 55.4, 101, 150],
  [55.5, 125.4, 151, 200], [125.5, 225.4, 201, 300], [225.5, 500, 301, 500],
]

/** AQI from a PM2.5 concentration. Strictly valid for 24 h means; for a single hour it is indicative only. */
export function aqiFromPm25(pm: number | null | undefined): number | null {
  if (pm == null || Number.isNaN(pm) || pm < 0) return null
  const c = Math.min(Math.round(pm * 10) / 10, 500)
  for (const [cl, ch, il, ih] of PM25_BP) {
    if (c <= ch) return Math.round(((ih - il) / (ch - cl)) * (Math.max(c, cl) - cl) + il)
  }
  return 500
}

// --- Smoke in plain words: ONE scale for the community page, the request letter and the assistant ---

export type SmokeWord = 'very little' | 'light' | 'moderate' | 'heavy' | 'very heavy'
export const SMOKE_RANK: Record<SmokeWord, number> = { 'very little': 0, light: 1, moderate: 2, heavy: 3, 'very heavy': 4 }

/**
 * Smoke in words on the US EPA AQI bands above (never Canada's AQHI, a different formula):
 * Good (0–50) very little, Moderate (51–100) light, Unhealthy for sensitive groups (101–150) moderate,
 * Unhealthy (151–200) heavy, Very unhealthy and Hazardous (over 200) very heavy.
 * The health line follows Health Canada "Wildfire smoke and your health" and "Preparing for wildfire
 * smoke events" (docs/research/preparedness.md §3): suggestions, not orders.
 */
const SMOKE_PLAIN: { max: number; word: SmokeWord; healthLine: string }[] = [
  { max: 50, word: 'very little', healthLine: 'No need to change your plans because of smoke.' },
  { max: 100, word: 'light', healthLine: 'Most people can carry on as usual, but take it easier outdoors if the smoke bothers you.' },
  { max: 150, word: 'moderate', healthLine: 'Elders, young children, pregnant people and anyone with heart or lung problems may want to cut back on hard work outdoors and keep windows and doors closed.' },
  { max: 200, word: 'heavy', healthLine: 'Everyone may want to cut back on time outdoors, keep windows and doors closed, and use an air cleaner or a clean-air room if you have one.' },
  { max: Infinity, word: 'very heavy', healthLine: 'Everyone may want to stay indoors with windows and doors closed and an air cleaner running if you have one, and wear a well-fitted N95 mask if you have to go out.' },
]

/** Said with heavy and very heavy smoke (and by the assistant whenever there is room). */
export const SMOKE_MEDICAL = 'Get medical help for chest pain, wheezing or trouble breathing.'

/** The one plain-words description of a US AQI reading. Null when there is no reading. */
export function smokePlain(usAqi: number | null | undefined): { word: SmokeWord; healthLine: string } | null {
  if (usAqi == null || Number.isNaN(usAqi)) return null
  const b = SMOKE_PLAIN.find((x) => usAqi <= x.max) ?? SMOKE_PLAIN[SMOKE_PLAIN.length - 1]
  return { word: b.word, healthLine: b.healthLine }
}

/** "Smoke reading: 183 on the US air quality scale (over 300 is the worst level)." The same number line everywhere. */
export const smokeReading = (usAqi: number) => `Smoke reading: ${Math.round(usAqi)} on the US air quality scale (over 300 is the worst level).`
