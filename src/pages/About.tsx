// /about: "About the data". Plain words first, details for experts in closed disclosures.
// Facts and links come only from docs/research (fetched, verified pages). Voice guide: docs/plans/2026-11-14-community-hub.md.
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import type { StatusData } from '../../shared/types.ts'
import { FACTORS, levelLabel } from '../../shared/risk.ts'
import { SIGNS_NOTE, WETTING_RAIN_MM } from '../../shared/signals.ts'
import HistoryContext from '../components/HistoryContext.tsx'
import { useApp } from '../state.tsx'

const OAG = 'https://www.canada.ca/en/auditor-general/our-work/audit-reports/parl-oag-202211-08-e.html'
const PSC_2026 = 'https://www.canada.ca/en/public-safety-canada/news/2026/05/the-government-of-canada-updates-on-the-2026-wildfire-season-preparedness-and-outlook.html'

/** Official fire danger ratings: only pages that were fetched (docs/research/contacts.md §2, preparedness.md §5). */
const OFFICIAL = [
  { where: 'All of Canada', name: 'Fire Weather Index map, Canadian Wildland Fire Information System', url: 'https://cwfis.cfs.nrcan.gc.ca/maps/fw?type=fwi' },
  { where: 'British Columbia', name: 'BC Wildfire Service', url: 'https://www2.gov.bc.ca/gov/content?id=F4EA16310CC541899EFC156A60D74FC9' },
  { where: 'Alberta', name: 'Alberta Wildfire, fire danger', url: 'https://www.alberta.ca/fire-danger' },
  { where: 'Saskatchewan', name: 'Saskatchewan Public Safety Agency, maps and daily fire danger', url: 'https://www.saskpublicsafety.ca/active-incidents/maps' },
  { where: 'Manitoba', name: 'Manitoba Wildfire Service, reports and maps', url: 'https://www.gov.mb.ca/wildfire/reports_updates.html' },
  { where: 'Ontario', name: 'Ontario forest fires, with the fire danger map', url: 'https://www.ontario.ca/page/forest-fires' },
  { where: 'Quebec', name: 'SOPFEU, fire danger index', url: 'https://sopfeu.qc.ca/en/prevention/fire-danger-index/' },
  { where: 'Northwest Territories', name: 'Wildfire operations, Government of the Northwest Territories', url: 'https://www.gov.nt.ca/ecc/en/services/wildfire-operations' },
]

const SOURCES = [
  { name: 'NASA FIRMS', url: 'https://firms.modaps.eosdis.nasa.gov/', line: 'Heat spotted by satellites. NASA’s fire information system reports hot spots seen by the VIIRS and MODIS instruments as satellites pass over.' },
  { name: 'NASA GIBS', url: 'https://nasa-gibs.github.io/gibs-api-docs/', line: 'The satellite photos on the map, including true-colour pictures, heat and smoke haze.' },
  { name: 'NASA POWER', url: 'https://power.larc.nasa.gov/', line: 'Daily weather records since 1984 for every place, so today can be compared with 42 years of the past.' },
  { name: 'Canadian Wildland Fire Information System (CWFIS)', url: 'https://cwfis.cfs.nrcan.gc.ca/', line: 'Run by Natural Resources Canada. Three things come from it: wildfires reported by provincial and territorial fire crews; satellite heat when no NASA key is set; and Canada’s official Fire Weather Index at about 800 weather stations, for today and the next two days.' },
  { name: 'Open-Meteo weather', url: 'https://open-meteo.com/en/docs', line: 'Temperature, humidity, wind, rain, how dry the plants and ground are, and snow, for the past week and the days ahead.' },
  { name: 'Open-Meteo air quality', url: 'https://open-meteo.com/en/docs/air-quality-api', line: 'Smoke in the air, from a computer model of the whole planet.' },
  { name: 'Indigenous Services Canada, First Nations locations', url: 'https://open.canada.ca/data/en/dataset/b6567c5c-8339-4055-99fa-63f92114d9e4', line: 'The public location of each First Nation community. Contains information licensed under the Open Government Licence – Canada.' },
]

/** The warning-sign rules, in the same words and thresholds as shared/signals.ts. */
const SIGN_RULES = [
  { name: 'Hotter', rule: 'Today’s high is 5 °C or more above the high about a week ago.' },
  { name: 'Dry air', rule: 'The day’s lowest humidity is 35% or below. Dry air dries out grass, needles and twigs within hours.' },
  { name: 'No soaking rain', rule: `3 or more days in a row without soaking rain. Soaking rain means ${WETTING_RAIN_MM} mm or more in a day.` },
  { name: 'Strong wind expected', rule: 'The strongest wind reaches 30 km/h today or in the next 3 days.' },
  { name: 'Heat spotted by satellites', rule: 'Satellites spot any heat within 100 km in the last 24 hours.' },
  { name: 'Smoke getting thicker', rule: 'Fine smoke (PM2.5) averages at least 15 µg/m³ over the last 24 hours and is 20% or more above the 24 hours before.' },
  { name: 'Fire risk rising', rule: 'In the days ahead, fire risk reaches Very high (75 or more), or climbs 10 points or more above today.' },
]

const LEVELS = [
  { range: 'under 25', level: 'Low' as const },
  { range: '25 to 49', level: 'Moderate' as const },
  { range: '50 to 74', level: 'High' as const },
  { range: '75 and over', level: 'Critical' as const },
]

const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="text-action underline decoration-1 underline-offset-[3px] hover:text-action-deep">{children}</a>
)

/** Reading width: about 70 characters at 17 px. */
const prose = 'max-w-[38rem]'

function H2({ id, children }: { id: string; children: ReactNode }) {
  return <h2 id={id} className="scroll-mt-6 text-[26px] font-semibold leading-tight">{children}</h2>
}

function Expert({ id, title, children, onToggle }: { id: string; title: string; children: ReactNode; onToggle?: (open: boolean) => void }) {
  return (
    <details id={id} className="group scroll-mt-6 border-t border-line" onToggle={(e) => onToggle?.(e.currentTarget.open)}>
      <summary className="cursor-pointer py-4 text-[19px] font-semibold hover:text-action">{title}</summary>
      <div className="pb-8 text-[16px] leading-relaxed">{children}</div>
    </details>
  )
}

function statusWords(i: StatusData['integrations'][number]) {
  if (i.lastError) {
    const reason = i.lastError.split(' — ')[1] ?? i.lastError
    return <span className="text-flame">Not working. {reason}</span>
  }
  if (i.lastOk) {
    const t = new Date(i.lastOk)
    const when = Number.isNaN(t.getTime()) ? i.lastOk : t.toLocaleString('en-CA', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    return <span className="text-moss">Working, last answered {when}</span>
  }
  return <span className="text-mute">Not used yet since the server started</span>
}

function StatusTable() {
  const { mode } = useApp()
  const [status, setStatus] = useState<StatusData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const load = useCallback(() => {
    setErr(null)
    fetch('/api/status').then((r) => r.json()).then(setStatus).catch(() => setErr('We could not check the data sources just now.'))
  }, [])
  useEffect(load, [mode, load])

  return (
    <div className="mt-6">
      <div className={`${prose} flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2`}>
        <h3 className="text-[19px] font-semibold">Is each source working right now?</h3>
        <button type="button" onClick={load} className="text-[15px] font-semibold text-action hover:underline">Check again</button>
      </div>
      {err ? <p role="alert" className="mt-3 text-[16px] text-flame">{err}</p>
        : !status ? <div className="skeleton mt-3 h-40" aria-busy="true" />
          : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-[15px]">
                <thead>
                  <tr className="border-b border-line text-mute">
                    <th scope="col" className="py-2 pr-4 font-medium">Source</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Needs a key?</th>
                    <th scope="col" className="py-2 font-medium">Last result on this server</th>
                  </tr>
                </thead>
                <tbody>
                  {status.integrations.map((i) => (
                    <tr key={i.id} className="border-b border-line/70 align-top">
                      <td className="py-3 pr-4"><span className="font-semibold">{i.name}</span><span className="mt-0.5 block text-mute">{i.purpose}</span></td>
                      <td className="py-3 pr-4">{!i.needsKey ? 'No' : i.configured ? 'Yes, it is set' : <span className="text-sun">Yes, not set</span>}</td>
                      <td className="py-3">{statusWords(i)}</td>
                    </tr>
                  ))}
                  <tr className="border-b border-line/70 align-top">
                    <td className="py-3 pr-4"><span className="font-semibold">NASA GIBS</span><span className="mt-0.5 block text-mute">Satellite photos on the map</span></td>
                    <td className="py-3 pr-4">No</td>
                    <td className="py-3 text-mute">Your browser loads these straight from NASA</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
      <p className={`${prose} mt-3 text-[15px] text-mute`}>Keys are kept on the server and never sent to your browser. If a source fails in live data, the site says so. It never fills the gap with made-up numbers.</p>
    </div>
  )
}

export default function About() {
  const { region, mode } = useApp()
  const { hash } = useLocation()
  const [historyOpen, setHistoryOpen] = useState(false)

  // /about#trend (or any disclosure id): open it and bring it into view. App scrolls <main> to the
  // top on navigation after this effect, so wait a frame before scrolling.
  useEffect(() => {
    const id = hash.replace(/^#/, '')
    if (!id) return
    const el = document.getElementById(id)
    if (!el) return
    if (el instanceof HTMLDetailsElement) el.open = true
    const t = window.setTimeout(() => el.scrollIntoView({ block: 'start' }), 60)
    return () => window.clearTimeout(t)
  }, [hash])

  return (
    <article className="text-[17px] leading-[1.65]">
      <h1 className="text-[36px] font-semibold leading-tight">About the data</h1>
      <p className={`${prose} mt-3 text-[19px] text-mute`}>How this site estimates fire risk, where the data comes from, and what it cannot do. Details for experts are at the end.</p>

      {/* How this works */}
      <section className="mt-12" aria-labelledby="how">
        <H2 id="how">How this works</H2>
        <div className={`${prose} mt-4 space-y-4`}>
          <p>This site shows an estimate of fire risk near each First Nation in Canada, for today and the coming days. It brings together heat spotted by NASA satellites, weather forecasts, Canada’s official Fire Weather Index from the nearest weather station, and 42 years of NASA weather records for each place.</p>
          <p>It is our estimate, not an official fire danger rating. It is not an alert, and it does not predict that a fire will start. It shows when the conditions that help fire start and spread are lining up: heat, dry air, no soaking rain, strong wind, and fire already nearby.</p>
          <p>It is for members of First Nations who want an early, plain picture of what is coming, and for the people they work with: fire services, Indigenous Services Canada and leadership. You can use it to ask for firefighters and equipment before a fire reaches you.</p>
          <p>Your community decides what to do. Your leadership, emergency coordinator and fire service know your land and your plans. If lives or homes are in danger, call 911 and follow official evacuation orders.</p>
          <p>The official fire danger rating is set by your provincial or territorial fire agency. You can find it here:</p>
        </div>
        <ul className={`${prose} mt-3 space-y-2`}>
          {OFFICIAL.map((o) => (
            <li key={o.url} className="border-l-2 border-line pl-4">
              <span className="block text-[15px] text-mute">{o.where}</span>
              <A href={o.url}>{o.name}</A>
            </li>
          ))}
        </ul>
      </section>

      {/* Why this matters */}
      <section className="mt-14" aria-labelledby="why">
        <H2 id="why">Why this matters</H2>
        <ul className={`${prose} mt-4 space-y-5`}>
          <li>
            <p>First Nations are about 5% of Canada’s population, but account for 42% of wildfire-related evacuations. Researchers led by Amy Cardinal Christianson found the same share in Canada’s wildfire evacuation records from 1980 to 2021: 42% of evacuation events were in majority-Indigenous communities.</p>
            <p className="mt-1 text-[15px] text-mute">From <A href={PSC_2026}>Public Safety Canada, 28 May 2026</A>. The research is by Christianson and colleagues, using the Canadian Wildland Fire Evacuation Database.</p>
          </li>
          <li>
            <p>In 2025, wildfire forced 44,920 people from 61 First Nations to leave their homes on reserve.</p>
            <p className="mt-1 text-[15px] text-mute">From <A href={PSC_2026}>Public Safety Canada, 28 May 2026</A></p>
          </li>
          <li>
            <p>From 2018–19 to 2021–22, Indigenous Services Canada spent about $828 million on emergencies in First Nations. 78% of it (about $646 million) went to responding and recovering after emergencies. Only 22% went to preparing for them and making them less harmful.</p>
            <p className="mt-1 text-[15px] text-mute">From the <A href={OAG}>Auditor General of Canada, Report 8 (2022), Emergency Management in First Nations Communities</A></p>
          </li>
          <li>
            <p>In April 2022, 39% of the eligible building projects to protect First Nations communities from emergencies were still waiting for funding. That was 112 projects.</p>
            <p className="mt-1 text-[15px] text-mute">From the <A href={OAG}>Auditor General of Canada, Report 8 (2022)</A></p>
          </li>
        </ul>
        <p className={`${prose} mt-5`}>Seeing risk a few days earlier gives a community more time to ask for crews and equipment, on its own terms.</p>
      </section>

      {/* Where the data comes from */}
      <section className="mt-14" aria-labelledby="sources">
        <H2 id="sources">Where the data comes from</H2>
        <ul className={`${prose} mt-4 space-y-4`}>
          {SOURCES.map((s) => (
            <li key={s.name}>
              <A href={s.url}>{s.name}</A>
              <p className="mt-0.5">{s.line}</p>
            </li>
          ))}
        </ul>
        <p className={`${prose} mt-4 text-[15px] text-mute`}>The background map is from Esri, and OpenStreetMap contributors on older screens.</p>
        <StatusTable />
      </section>

      {/* Limits */}
      <section className="mt-14" aria-labelledby="limits">
        <H2 id="limits">Limits</H2>
        <ul className={`${prose} mt-4 list-disc space-y-2.5 pl-5`}>
          <li>It is an estimate. It has not yet been checked against past fires.</li>
          <li>It is not an alert or evacuation tool. It can be hours behind what is happening on the ground.</li>
          <li>Satellites miss small fires and fires under cloud or thick smoke. Some heat they spot is not a wildfire.</li>
          <li>Weather and smoke come from computer models of a wide area, not from a station in your community.</li>
          <li>Days further ahead are less certain than today.</li>
          <li>Wildfires reported by fire crews are updated about once a day, and only in fire season.</li>
          <li>The 42-year NASA records describe an area about 50 km across, not a single spot.</li>
          <li>A community is shown as one public point. That point is not the whole of a Nation’s land.</li>
          <li>Students built this for NASA Space Apps without community involvement. A real version would be designed with, and governed by, the communities it serves.</li>
        </ul>
      </section>

      {/* Data and privacy */}
      <section className="mt-14" aria-labelledby="privacy">
        <H2 id="privacy">Data and privacy</H2>
        <div className={`${prose} mt-4 space-y-4`}>
          <p>We are guided by the First Nations principles of OCAP®: ownership, control, access and possession. Information about a Nation belongs to that Nation.</p>
          <p>So this site uses only public community locations that Indigenous Services Canada already publishes. It holds no cultural, land-use or health information about any Nation, and it collects no data from communities.</p>
          <p>Nothing is stored about visitors. There are no accounts, no tracking and no analytics. Your choices on the site (live data or the example, the area, and how far ahead to look) are saved only in your own browser.</p>
          <p>Map pictures load straight from NASA and Esri. The “Ask for help” letter is never sent by the site: you copy, email or print it yourself. If the assistant is set up to use Claude, your question is sent to Anthropic to write the answer.</p>
          <p className="text-[15px] text-mute">OCAP® is a registered trademark of the <A href="https://fnigc.ca/">First Nations Information Governance Centre (FNIGC)</A>.</p>
        </div>
      </section>

      {/* Details for experts */}
      <section className="mt-14" aria-labelledby="experts">
        <H2 id="experts">Details for experts</H2>
        <p className={`${prose} mt-3 mb-6 text-mute`}>The full method behind every number. Open a section to read it.</p>

        <Expert id="score" title="How the fire risk score is calculated">
          <div className={`${prose} space-y-3`}>
            <p>The score is 100 × the sum of (weight × sub-score) over nine inputs. Each sub-score is a straight-line ramp from 0 to 1, using the rule below.</p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-[15px]">
              <thead><tr className="border-b border-line text-mute"><th scope="col" className="py-2 pr-4 font-medium">Input</th><th scope="col" className="py-2 pr-4 font-medium">Weight</th><th scope="col" className="py-2 font-medium">Rule</th></tr></thead>
              <tbody>
                {FACTORS.map((f) => (
                  <tr key={f.key} className="border-b border-line/70 align-top">
                    <td className="py-2.5 pr-4 font-medium">{f.label}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{Math.round(f.weight * 100)}%</td>
                    <td className="py-2.5 text-mute">{f.explain}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className={`${prose} mt-5 list-disc space-y-2 pl-5`}>
            <li>Levels: {LEVELS.map((l, i) => <span key={l.level}>{levelLabel(l.level)} {l.range}{i < LEVELS.length - 1 ? ', ' : '.'}</span>)}</li>
            <li>Drying power: wind, the rain of the last 7 days and the regional baseline only count as far as the air can dry dead grass, needles and twigs. Their points are multiplied by a drying power from 0 to 1, set by the vapour pressure deficit: 0 at 0.2 kPa or less (cold or damp air), 1 at 1.0 kPa or more. Without it, a cold, windy November day with no rain scored like a summer fire day.</li>
            <li>Checked against Canada’s official index, on the weather alone (without the index as an input): on 15 November 2026, at 80 communities across every province, 66 of the 71 places the official Fire Weather Index rated low came out Low here. Before drying power was added, only 23 of those 71 did. The weather alone misses the dry prairies: of the 5 places the official index rated high or very high, 3 came out Low. That is why the official index is also an input; with it, all 5 come out Medium or High. This is one November day of agreement with the official index, not a test against real fires.</li>
            <li>Snow or frost: with more than 2 cm of snow on the ground, or a daily high at or below 0 °C, the score is multiplied by 0.2. Fuels under snow or frost cannot carry fire.</li>
            <li>A missing input is left out and the other weights are scaled up so the score stays out of 100. Confidence then falls: High with all live inputs, Medium for forecast days or one missing input, Low for the example scenario or three or more missing inputs. The official Fire Weather Index is the exception: it only exists within 200 km of a station that is still reporting, so when it is absent it is left out without lowering confidence. Stations that have stopped for the winter are skipped. The stations cover today and the next two days; for later days the last reading is held, so the score does not jump on the day the official index runs out.</li>
            <li>The likely range shown around a score is a rule of thumb (8 points, plus 4 for each missing input, 4 for forecast days and 6 for example data), not a statistical interval.</li>
            <li>Weights and thresholds were chosen by the team to be easy to read. They have not been fitted to, or tested against, fire records. The score is a relative estimate, not a chance of fire.</li>
            <li>Plant greenness is not an input yet. Beyond the official index’s two days, vapour pressure deficit and soil moisture stand in for how dry the plants and ground are.</li>
          </ul>
        </Expert>

        <Expert id="signs" title="Warning signs">
          <p className={prose}>Each warning sign is a simple check on the same weather, fire and smoke data the score uses. A sign counts as on when:</p>
          <dl className={`${prose} mt-4 space-y-3`}>
            {SIGN_RULES.map((s) => (
              <div key={s.name}>
                <dt className="font-semibold">{s.name}</dt>
                <dd className="text-mute">{s.rule}</dd>
              </div>
            ))}
          </dl>
          <p className={`${prose} mt-4`}>The number of days that conditions have been building is counted only when at least two of Hotter, Dry air and No soaking rain are on together. It starts from the earliest of their unbroken runs.</p>
          <p className={`${prose} mt-3 text-mute`}>{SIGNS_NOTE} A sign being on means “worth watching”, not “a fire will start”.</p>
        </Expert>

        <Expert id="trend" title="Trend tests">
          <div className={`${prose} space-y-5`}>
            <div>
              <h3 className="font-semibold">Mann–Kendall trend test</h3>
              <p className="mt-1">It compares every day with every later day and counts how often the value went up or down. If the ups clearly outnumber the downs (p &lt; 0.05), we call the rise real; this works even when the change is not a straight line.</p>
            </div>
            <div>
              <h3 className="font-semibold">Least-squares slope, t-test and 95% band</h3>
              <p className="mt-1">A straight line fitted through the past days and today gives the average change in points a day, and a t-test on its slope gives the p-value. The 95% band is the confidence band for that fitted line, which shows how far the line itself could be off.</p>
            </div>
            <div>
              <h3 className="font-semibold">Sen’s slope</h3>
              <p className="mt-1">It is the middle value of the slopes between every pair of years, so one unusual summer cannot pull it far. We use it on 42 fire-season averages to say how much the daily high has changed every 10 years.</p>
            </div>
            <p className="text-mute">Any change is called real only when p &lt; 0.05. With a week or two of daily values, these tests can miss a real change, so “not clear yet” means just that.</p>
          </div>
        </Expert>

        <Expert id="history" title="42 years of NASA records" onToggle={setHistoryOpen}>
          <p className={`${prose} text-mute`}>For the area around {region?.name ?? 'the selected place'}{mode === 'sim' ? ', with today’s values from the example scenario' : ''}.</p>
          {historyOpen ? <HistoryContext /> : null}
        </Expert>
        <div className="border-t border-line" />
      </section>
    </article>
  )
}
