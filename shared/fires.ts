import type { ActiveFire } from './types.ts'

/**
 * When an agency last touched a fire report: the OLDER of its status date and record date, because some
 * agencies re-stamp one of the two automatically (server/fires.ts). Null when neither is known.
 */
export function lastTouched(f: Pick<ActiveFire, 'statusDate' | 'recordStart'>): string | null {
  const dates = [f.statusDate, f.recordStart].filter((d): d is string => !!d && Number.isFinite(Date.parse(d)))
  if (!dates.length) return null
  return dates.reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b))
}
