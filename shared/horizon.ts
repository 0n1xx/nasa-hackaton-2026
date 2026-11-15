// Forecast horizon: how many days ahead of today the risk and air views look.
// Shared by the server (to validate ?days= and size upstream requests) and the UI (to offer choices).

/** Horizons the UI offers. Any whole number from 1 to MAX_HORIZON is accepted by the API. */
export const HORIZONS = [1, 3, 7, 14] as const
export const DEFAULT_HORIZON = 3

/**
 * Open-Meteo's weather forecast API returns at most 16 forecast days, and that count includes
 * today, so 15 days ahead is the hard ceiling. 14 keeps a day of margin for time-zone edges and
 * for the last model day, which is often partial.
 */
export const MAX_HORIZON = 14

/**
 * Open-Meteo's air-quality (CAMS) API returns at most 7 forecast days including today, so air
 * series stop at 6 days ahead even when a longer weather horizon is requested.
 */
export const MAX_AIR_HORIZON = 6

/** Parse a `days` query value. Missing or empty means DEFAULT_HORIZON; anything else must be a whole number 1..MAX_HORIZON. */
export function parseHorizon(v: unknown): number {
  if (v === undefined || v === null || v === '') return DEFAULT_HORIZON
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  if (!Number.isInteger(n) || n < 1 || n > MAX_HORIZON) {
    throw new Error(`days must be a whole number from 1 to ${MAX_HORIZON} (forecast days ahead of today)`)
  }
  return n
}
