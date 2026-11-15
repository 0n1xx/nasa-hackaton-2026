import test from 'node:test'
import assert from 'node:assert/strict'
import { provinceAt } from './province.ts'

// Hand-checked community locations (server/data/communities.ts) and a few
// well-known places near borders.
const cases: [string, number, number, string][] = [
  ['Whitesand', 50.30, -89.04, 'ON'],
  ['Lac La Croix', 48.36, -92.11, 'ON'],
  ['Wabaseemoong (near MB border)', 50.14, -94.93, 'ON'],
  ['Deer Lake', 52.62, -94.06, 'ON'],
  ['Sandy Lake', 53.07, -93.34, 'ON'],
  ['Kasabonika Lake', 53.53, -88.61, 'ON'],
  ['Pimicikamak', 54.62, -97.77, 'MB'],
  ['Mathias Colomb', 55.74, -101.32, 'MB'],
  ['Peter Ballantyne', 55.19, -102.93, 'SK'],
  ['Lac La Ronge', 55.10, -105.28, 'SK'],
  ['Fort Chipewyan', 58.77, -111.12, 'AB'],
  ['Sturgeon Lake Cree', 55.05, -117.50, 'AB'],
  ['Lytton', 50.23, -121.58, 'BC'],
  ['Westbank', 49.86, -119.60, 'BC'],
  ['Kátł’odeeche', 60.83, -115.75, 'NT'],
  ['Kenora town', 49.77, -94.49, 'ON'],
  ['Winnipeg', 49.90, -97.14, 'MB'],
  ['Regina', 50.45, -104.62, 'SK'],
  ['Calgary', 51.05, -114.07, 'AB'],
  ['Banff (just inside AB)', 51.18, -115.57, 'AB'],
  ['Chibougamau', 49.91, -74.37, 'QC'],
  ['Rouyn-Noranda', 48.24, -79.02, 'QC'],
  ['Timmins', 48.48, -81.33, 'ON'],
  ['Moncton', 46.09, -64.78, 'NB'],
  ['Halifax', 44.65, -63.58, 'NS'],
  ['Whitehorse', 60.72, -135.06, 'YT'],
]

for (const [name, lat, lon, want] of cases) {
  test(`${name} is in ${want}`, () => assert.equal(provinceAt(lat, lon), want))
}
