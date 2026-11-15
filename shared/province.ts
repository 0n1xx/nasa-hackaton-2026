// Province or territory for a point in Canada, from approximate border lines.
//
// Used to pick the right wildfire agency and contacts for a community whose
// source data has no province field (the Indigenous Services Canada First
// Nations location dataset). Borders are simplified to straight segments, so a
// point within a few kilometres of a border can land on the wrong side; the
// community list hand-checks the ones we show by name. This is a lookup for
// choosing contacts, not a legal boundary.

export type ProvinceCode = 'BC' | 'AB' | 'SK' | 'MB' | 'ON' | 'QC' | 'NB' | 'NS' | 'PE' | 'NL' | 'YT' | 'NT' | 'NU'

export const PROVINCE_NAMES: Record<ProvinceCode, string> = {
  BC: 'British Columbia', AB: 'Alberta', SK: 'Saskatchewan', MB: 'Manitoba', ON: 'Ontario', QC: 'Quebec',
  NB: 'New Brunswick', NS: 'Nova Scotia', PE: 'Prince Edward Island', NL: 'Newfoundland and Labrador',
  YT: 'Yukon', NT: 'Northwest Territories', NU: 'Nunavut',
}

const lerp = (lat: number, lat0: number, lon0: number, lat1: number, lon1: number) => lon0 + ((lat - lat0) * (lon1 - lon0)) / (lat1 - lat0)

/** BC/AB border: Continental Divide from (49, −114.05) to (53.8, −120), then the 120th meridian. */
const bcAbBorder = (lat: number) => (lat < 53.8 ? lerp(lat, 49, -114.05, 53.8, -120) : -120)
/** SK/MB border: about −101.36 at 49° N to −102.0 at 60° N. */
const skMbBorder = (lat: number) => lerp(lat, 49, -101.36, 60, -102)
/** MB/ON border: −95.15 up to 52.82° N, then north-east to Hudson Bay at (56.85, −88.95). */
const mbOnBorder = (lat: number) => (lat <= 52.82 ? -95.15 : lerp(Math.min(lat, 56.85), 52.82, -95.15, 56.85, -88.95))
/** ON/QC border: −79.52 north of Lake Timiskaming (46.5° N); south of it, the Ottawa River to about (45.4, −74.4). */
const onQcBorder = (lat: number) => (lat >= 46.5 ? -79.52 : lat >= 45.4 ? lerp(lat, 46.5, -79.52, 45.4, -74.4) : -74.4)

export function provinceAt(lat: number, lon: number): ProvinceCode {
  // North of 60: the territories.
  if (lat >= 60) {
    if (lon < -123.8) return 'YT'
    if (lon < -102) return 'NT'
    // Quebec reaches north of 60 east of Hudson Bay (Nunavik).
    if (lon > -79.5 && lon < -64.5) return 'QC'
    return 'NU'
  }
  // Atlantic provinces.
  if (lon > -59.5 && lat > 46.5) return 'NL'              // Island of Newfoundland
  if (lat > 51.5 && lon > -64.2) return 'NL'              // Labrador (approximate)
  if (lat < 48.1 && lon > -69.05) {
    if (lon > -64.3 && lat < 47.1 && lat > 45.9 && lon < -61.9) return 'PE'
    if (lat < 45.0) return 'NS'                            // south of the Bay of Fundy
    if (lon > -64.2 && lat < 46.1) return 'NS'             // east of the Chignecto isthmus
    if (lon > -61.5) return 'NS'                           // Cape Breton
    return 'NB'
  }
  if (lon < bcAbBorder(lat)) return 'BC'
  if (lon < -110) return 'AB'
  if (lon < skMbBorder(lat)) return 'SK'
  if (lon < mbOnBorder(lat)) return 'MB'
  if (lon < onQcBorder(lat)) return 'ON'
  return 'QC'
}
