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
