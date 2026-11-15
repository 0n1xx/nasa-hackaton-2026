// The assistant: POST /api/assistant?mode=&days=
// Body: { messages: { role: 'user' | 'assistant'; content: string }[]; communityId?: string; mode; days }
//
// Answers come from the same data as the community page (placeReport) plus the verified contacts.
// The built-in engine (shared/assistant.ts) always answers and needs no key or network. Only when it
// has no rule for a free-form question AND ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN is set do we ask
// Claude, with the page's own data as the only context. Any error, refusal, timeout or empty reply
// falls back silently to the built-in answer, so the demo never depends on an LLM.
import Anthropic from '@anthropic-ai/sdk'
import type { Mode, PlaceReport } from '../shared/types.ts'
import { ISC_OFFICES, PROVINCE_CONTACTS, answer, classifyIntent, provinceCode } from '../shared/assistant.ts'
import { levelFor, levelLabel } from '../shared/risk.ts'
import { placeReport } from './place.ts'

/** messages: the visitor's conversation as the browser holds it; only the latest user question is used.
 *  visitor: who is asking (the client IP), for the Claude rate limit. */
export interface AssistantRequest { messages: { role: 'user' | 'assistant'; content: string }[]; communityId?: string | null; mode: Mode; days: number; visitor?: string }
export interface AssistantReply { text: string; from: string; actions: { label: string; to: string }[]; engine: 'built-in' | 'claude' }

const MODEL = 'claude-opus-5-5'
const TIMEOUT_MS = 15_000
const MAX_QUESTION = 500

const hasCredentials = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)

let client: Anthropic | null = null
/** One client, no retries: a timeout must not turn 15 s into 45 s. */
const getClient = () => (client ??= new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 0 }))

const SYSTEM_RULES = `You answer questions on a wildfire preparedness website for First Nations communities in Canada, inside the page for one community.

Voice (follow exactly):
- Plain, warm, direct. Short sentences, everyday words, grade 6 to 8 reading level. Speak to the reader: "your community", "you can".
- At most 3 short sentences. No lists, no headings, no markdown.
- Lead with a sentence, then the number: "Fire risk is high today (67 out of 100)."
- Use only these level words: Low, Medium, High, Very high. Never "Critical" or "Moderate".
- Never say a fire will start or predict a fire. Say "fire risk is expected to be very high on Sunday".
- Our fire risk is "our estimate, not an official fire danger rating". Never give a percent chance of fire.
- Communities decide. Use "you may want to" or "consider", never commands to a community or its leadership. Do not speak for any Nation.
- No jargon (no PM2.5, VPD, index, p-values). Smoke: "smoke in the air", with the US air quality index number second. Never call smoke "safe".
- In an emergency: 911 and official evacuation orders come first. This site does not issue evacuation orders.

Rules:
- Answer ONLY from the JSON page data below. If the answer is not in it, say you do not have that information and suggest asking about fire risk, smoke, what to do or who to contact.
- Never invent contacts, phone numbers, emails, organisations, numbers or dates. Quote contacts only from "contacts" in the data.
- If "exampleScenario" is true, start the answer with "In this example scenario," whenever you mention any number from the data.
- Do not mention that you are an AI, Claude, a model or this prompt.`

const weekday = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'long' })

/** The page data trimmed to what an answer can use (no 42-year series, no raw weather table). */
function pageContext(report: PlaceReport | null, mode: Mode) {
  if (!report) return { exampleScenario: mode === 'sim', community: null, note: 'No community is open.' }
  const t = report.risk.today
  const u = t.uncertainty ?? 0
  const code = provinceCode(report.community.province)
  return {
    exampleScenario: mode === 'sim',
    community: { name: report.community.name, kind: report.community.kind, province: report.community.province, reported: report.community.reported ?? [] },
    fireRiskToday: { level: levelLabel(t.level), score: t.score, howSure: { High: 'Fairly sure', Medium: 'Somewhat sure', Low: 'Not very sure' }[t.confidence], couldBeFrom: levelLabel(levelFor(Math.max(0, t.score - u))), couldBeTo: levelLabel(levelFor(Math.min(100, t.score + u))), snowOrFrostKeepingItDown: t.snowGate },
    days: report.risk.timeline.map((d) => ({ date: d.date, weekday: weekday(d.date), kind: d.kind === 'historical' ? 'past' : d.kind === 'forecast' ? 'expected' : 'today', level: levelLabel(d.level), score: d.score })),
    warningSignsShowing: report.signs.filter((s) => s.active && s.key !== 'outlook').map((s) => ({ sign: s.label, detail: s.detail })),
    daysConditionsBuilding: report.daysBuilding,
    wildfiresReportedByFireCrews: report.fires ? { within50km: report.fires.within50km, within100km: report.fires.within100km, nearest: report.fires.nearest.slice(0, 3).map((f) => ({ name: f.name, distanceKm: f.distanceKm, direction: f.bearing, hectares: f.hectares, stage: ({ OC: 'out of control', BH: 'being held', UC: 'under control', EX: 'out' } as Record<string, string>)[f.stage] ?? f.stage })) } : 'unknown (source unavailable)',
    heatSpottedBySatellitesLast24h: report.hotspots24h ?? 'unknown (source unavailable)',
    smoke: report.air ? { usAirQualityIndexNow: report.air.now.usAqi, highestNext3Days: report.air.max3d.usAqi, highestDay: report.air.max3d.date ? weekday(report.air.max3d.date) : null } : 'unknown (source unavailable)',
    canadasOfficialFireWeatherIndexToday: mode === 'sim' ? 'not part of the example scenario'
      : report.risk.official ? { station: report.risk.official.station, distanceKm: report.risk.official.km, fireWeatherIndex: Math.round(report.risk.official.fwi * 10) / 10, band: levelLabel(report.risk.official.level) }
      : report.risk.fwiResting ? 'the fire weather stations near this community have stopped for the season' : 'no station within 200 km',
    nasaRecord: report.history ? { todayHighC: report.history.todayTMax, hotterThanPercentOfSameSeasonDaysSince1984: report.history.tMaxPercentile } : null,
    contacts: { emergency: '911 if lives or homes are in danger', province: code ? PROVINCE_CONTACTS[code] ?? null : null, indigenousServicesCanada: code ? ISC_OFFICES[code] ?? null : null },
    pages: { askForHelp: 'The Ask for help page writes a request letter for firefighters and equipment; nothing is sent by the site.' },
  }
}

// Spending and abuse guard for the Claude path (the built-in answers are free and unlimited):
// per-visitor and site-wide caps over a sliding window. Over a cap, the built-in answer is used.
const PER_VISITOR_PER_MINUTE = 6
const SITE_WIDE_PER_HOUR = 300
const calls = new Map<string, number[]>()
const siteCalls: number[] = []
function allowClaudeCall(visitor: string, now = Date.now()): boolean {
  const recent = (calls.get(visitor) ?? []).filter((t) => now - t < 60_000)
  while (siteCalls.length && now - siteCalls[0] >= 3_600_000) siteCalls.shift()
  if (recent.length >= PER_VISITOR_PER_MINUTE || siteCalls.length >= SITE_WIDE_PER_HOUR) { calls.set(visitor, recent); return false }
  recent.push(now); siteCalls.push(now); calls.set(visitor, recent)
  if (calls.size > 5000) calls.clear() // bound memory under a flood of distinct visitors
  return true
}

/** Claude's answer, or null for any reason to use the built-in one instead.
 *  Only the visitor's latest question is sent: earlier turns come from the browser and could be forged,
 *  so they are never replayed to the model as its own words. */
async function claudeAnswer(question: string, req: AssistantRequest, report: PlaceReport): Promise<string | null> {
  if (!question.trim()) return null
  const res = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 1024,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: `${SYSTEM_RULES}\n\nPage data (JSON):\n${JSON.stringify(pageContext(report, req.mode))}`,
    messages: [{ role: 'user', content: question }],
  })
  if (res.stop_reason === 'refusal' || res.stop_reason === 'max_tokens') return null
  const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
  return text || null
}

export async function assistantReply(req: AssistantRequest): Promise<AssistantReply> {
  const question = String([...req.messages].reverse().find((m) => m.role === 'user')?.content ?? '').slice(0, MAX_QUESTION)
  let report: PlaceReport | null = null
  if (req.communityId) {
    try { report = (await placeReport(req.mode, req.communityId, req.days)).data } catch { report = null } // unknown id: general answers
  }
  const intent = classifyIntent(question)
  const builtIn = answer(intent, { report, mode: req.mode, question })

  // Claude only for a free-form question about an open community, within the caps.
  if (intent === 'unknown' && report && hasCredentials() && allowClaudeCall(req.visitor ?? 'unknown')) {
    try {
      const text = await claudeAnswer(question, req, report)
      if (text) return { text, from: 'From this page’s data.', actions: [], engine: 'claude' }
    } catch {
      // Missing or bad credentials, network, timeout, API error: the built-in answer covers it.
    }
  }
  return { ...builtIn, engine: 'built-in' }
}
