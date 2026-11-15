// Saves one real day's weather for a spread of communities, so the risk model can be checked
// against real conditions offline (server/risk-calibration.test.ts). Run: npx tsx scripts/capture-weather-fixture.ts
import { writeFileSync } from 'node:fs'
import { getWeather } from '../server/sources/openMeteo.ts'

const isc = JSON.parse((await import('node:fs')).readFileSync('server/data/communities-isc.json', 'utf8')).communities as { id: string; name: string; lat: number; lon: number; province: string }[]
// Every 8th community after sorting by province and name: about 80 places, every province in proportion.
const sample = [...isc].sort((a, b) => a.province.localeCompare(b.province) || a.name.localeCompare(b.name)).filter((_, i) => i % 8 === 0)
const out: unknown[] = []
for (let i = 0; i < sample.length; i += 40) {
  const chunk = sample.slice(i, i + 40)
  const wx = await getWeather(chunk, 3)
  chunk.forEach((c, k) => out.push({ id: c.id, name: c.name, province: c.province, lat: c.lat, lon: c.lon, days: wx[k].days }))
  await new Promise((r) => setTimeout(r, 1500))
}
const file = `server/fixtures/weather-${new Date().toISOString().slice(0, 10)}.json`
writeFileSync(file, JSON.stringify({ source: 'Open-Meteo forecast API (7 days back, today, 3 ahead), aggregated to local days', captured: new Date().toISOString(), places: out }))
console.log(`saved ${out.length} places to ${file}`)
