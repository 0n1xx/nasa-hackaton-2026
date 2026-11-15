// Builds server/data/communities-isc.json from the Indigenous Services Canada
// "First Nation Location" open dataset (GeoJSON points, one per First Nation;
// the point is the band administrative office, or inside the most populated
// reserve when the office is outside it).
//
// Source: https://geo.sac-isc.gc.ca/geomatics/rest/services/Donnees_Ouvertes-Open_Data/Premiere_Nation_First_Nation/MapServer/0
// Licence: Open Government Licence – Canada. Contains information licensed under
// the Open Government Licence – Canada.
//
// Usage: npx tsx scripts/build-communities.ts <path-to-first_nations.geojson>
import { readFileSync, writeFileSync } from 'node:fs'
import { provinceAt } from '../shared/province.ts'

const file = process.argv[2]
if (!file) { console.error('Pass the path to the downloaded GeoJSON.'); process.exit(1) }

const geo = JSON.parse(readFileSync(file, 'utf8')) as { features: { properties: Record<string, unknown>; geometry: { type: string; coordinates: [number, number] } }[] }
const round = (v: number) => Math.round(v * 100) / 100

// The source lost the glottal stop (ʔ) in a few Ktunaxa and Tsilhqot'in names and
// spells one Mi'kmaw name in capitals. Restore the names as the Nations write them.
const NAME_FIXES: Record<number, string> = {
  604: 'ʔAkisq\'nuk First Nation',
  602: 'ʔaq\'am',
  709: 'ʔEsdilagh First Nation',
  603: 'Yaqit ʔa·knuqli\'it First Nation',
  25: 'Sipekne\'katik',
}
const fixName = (band: number, name: string) => NAME_FIXES[band] ?? name.replace(/\?/g, 'ʔ').replace(/[‘’]/g, '\'')

const out = geo.features
  .filter((f) => f.geometry?.type === 'Point' && typeof f.properties.BAND_NAME === 'string' && Number.isFinite(f.properties.BAND_NUMBER))
  .map((f) => {
    const [lon, lat] = f.geometry.coordinates
    return { id: `isc-${f.properties.BAND_NUMBER}`, bandNumber: Number(f.properties.BAND_NUMBER), name: fixName(Number(f.properties.BAND_NUMBER), String(f.properties.BAND_NAME).trim()), lat: round(lat), lon: round(lon), province: provinceAt(lat, lon) }
  })
  .sort((a, b) => a.name.localeCompare(b.name))

writeFileSync(new URL('../server/data/communities-isc.json', import.meta.url), JSON.stringify({
  source: 'Indigenous Services Canada, First Nation Location (open data)',
  sourceUrl: 'https://open.canada.ca/data/en/dataset/b6567c5c-8339-4055-99fa-63f92114d9e4',
  licence: 'Contains information licensed under the Open Government Licence – Canada.',
  pointMeaning: 'Band administrative office, or a point inside the most populated reserve when the office is outside it. Rounded to 0.01 degrees.',
  retrieved: '2026-11-14',
  communities: out,
}, null, 1) + '\n')
console.log(`Wrote ${out.length} communities`)
