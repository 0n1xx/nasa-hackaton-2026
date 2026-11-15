// The built-in assistant: plain-language answers from the same data as the community page.
//
// Pure functions, no network and no LLM, so the demo always works offline. classifyIntent() maps a
// question to an intent with keyword rules; answer() writes at most 3 short sentences from the
// community's PlaceReport (server/place.ts), the verified contacts (docs/research/contacts.md) and the
// preparedness guidance (docs/research/preparedness.md). Voice: docs/plans/2026-11-14-community-hub.md.

import type { Mode, PlaceReport, RiskLevel } from './types.ts'
import { levelFor, levelLabel } from './risk.ts'
import { PROVINCE_NAMES, type ProvinceCode } from './province.ts'
import { SMOKE_MEDICAL, SMOKE_RANK, smokePlain } from './aqi.ts'
import { dayWord, onDayWord, outlookPhrase, relativeDays } from './outlookWords.ts'

export type Intent =
  | 'risk_now' | 'why' | 'when_worse' | 'what_to_do' | 'who_to_contact' | 'request_help' | 'smoke_health'
  | 'how_sure' | 'meaning_of_level' | 'evacuation' | 'data_sources' | 'greeting' | 'unknown'

/** The five suggested questions, one to one with built-in answers (the demo never depends on Claude). */
export const SUGGESTED: { question: string; intent: Intent }[] = [
  { question: 'Why is the risk high?', intent: 'why' },
  { question: 'What can we do this week?', intent: 'what_to_do' },
  { question: 'Who can send firefighters?', intent: 'who_to_contact' },
  { question: 'Is the smoke safe to breathe?', intent: 'smoke_health' },
  { question: 'How sure are you?', intent: 'how_sure' },
]
export const SUGGESTED_QUESTIONS = SUGGESTED.map((s) => s.question)

/** The suggested questions for a page: the first one names today's level ("Why is the risk low?"), so it never asks why a low risk is high. */
export function suggestedFor(level: RiskLevel | null | undefined): string[] {
  if (!level) return SUGGESTED_QUESTIONS
  return [`Why is the risk ${levelLabel(level).toLowerCase()}?`, ...SUGGESTED_QUESTIONS.slice(1)]
}

/**
 * A link under an answer. `to` is one of:
 * '#id' (scroll to that part of the community page), '/path' (a page in this site),
 * 'https://…', 'tel:…' or 'mailto:…' (official contacts), or 'ask:<question>' (ask that question next).
 */
export interface AssistantAction { label: string; to: string }
export interface AssistantAnswer { text: string; from: string; actions: AssistantAction[] }
export interface AssistantContext {
  /** The open community's report; null when no community is chosen or its data could not be loaded */
  report: PlaceReport | null
  mode: Mode
  /** The question as typed (lets "What does very high mean?" answer for that level) */
  question?: string
}

// ---------------------------------------------------------------------------
// Verified contacts. ONLY rows docs/research/contacts.md marks as read on an official page (fetched
// 14 November 2026). Where a number was not confirmed, the row has no number and points to the page.

export interface ProvinceContacts {
  /** Who fights wildfires on reserve in this province, as named in a sentence */
  agency: string
  /** The agency's official page (report line, contacts) */
  page: string
  /** Report-a-wildfire line in words, or null when no number was confirmed on an official page */
  report: string | null
  reportTel: string | null
  /** Official fire danger rating or fire map page */
  danger: string | null
}

export const PROVINCE_CONTACTS: Partial<Record<ProvinceCode, ProvinceContacts>> = {
  ON: { agency: 'Ontario’s forest fire service', page: 'https://www.ontario.ca/page/forest-fires', report: '310-FIRE (310-3473) if you are north of the French and Mattawa rivers, or 911 south of them', reportTel: 'tel:3103473', danger: 'https://www.lioapplications.lrc.gov.on.ca/ForestFireInformationMap/index.html?viewer=FFIM.FFIM' },
  MB: { agency: 'the Manitoba Wildfire Service', page: 'https://www.gov.mb.ca/wildfire/contact.html', report: '911 or 1-800-782-0076', reportTel: 'tel:18007820076', danger: 'https://www.gov.mb.ca/wildfire/reports_updates.html' },
  SK: { agency: 'the Saskatchewan Public Safety Agency', page: 'https://www.saskpublicsafety.ca/about-the-spsa/contact-us', report: null, reportTel: null, danger: 'https://www.saskpublicsafety.ca/active-incidents/maps' },
  AB: { agency: 'Alberta Wildfire', page: 'https://www.alberta.ca/report-a-wildfire', report: '310-FIRE (310-3473), toll free, any time', reportTel: 'tel:3103473', danger: 'https://www.alberta.ca/fire-danger' },
  BC: { agency: 'the BC Wildfire Service', page: 'https://www2.gov.bc.ca/gov/content?id=F4EA16310CC541899EFC156A60D74FC9', report: '1-800-663-5555, or *5555 from a cell phone', reportTel: 'tel:18006635555', danger: 'https://www2.gov.bc.ca/gov/content/safety/wildfire-status/wildfire-situation/fire-danger' },
  NT: { agency: 'Wildfire Operations, Government of the Northwest Territories', page: 'https://www.gov.nt.ca/ecc/en/services/wildfire-operations', report: '1-877-NWT-FIRE (1-877-698-3473)', reportTel: 'tel:18776983473', danger: null },
  QC: { agency: 'SOPFEU, Quebec’s forest fire service', page: 'https://sopfeu.qc.ca/en/contact/', report: 'SOPFEU at 1-800-463-FEUX (1-800-463-3389)', reportTel: 'tel:18004633389', danger: 'https://sopfeu.qc.ca/en/prevention/fire-danger-index/' },
}

/** Indigenous Services Canada regional emergency management offices, as published on the EMAP page. */
export interface IscOffice { region: string; phone: string | null; email: string | null }
const ATLANTIC: IscOffice = { region: 'Atlantic', phone: '1-902-661-6209', email: 'at-emappagu-at@sac-isc.gc.ca' }
export const ISC_OFFICES: Partial<Record<ProvinceCode, IscOffice>> = {
  ON: { region: 'Ontario', phone: null, email: 'emergencyon-urgenceon@sac-isc.gc.ca' },
  MB: { region: 'Manitoba', phone: null, email: 'Mb.emergency@sac-isc.gc.ca' },
  SK: { region: 'Saskatchewan', phone: null, email: 'skemergency@sac-isc.gc.ca' },
  AB: { region: 'Alberta', phone: '780-495-7707', email: 'ab.emergency@sac-isc.gc.ca' },
  BC: { region: 'British Columbia', phone: '604-209-9709', email: 'bcaandc.do@sac-isc.gc.ca' },
  QC: { region: 'Quebec', phone: '418-951-2283', email: 'qbpagu-emapfinancement-funding@sac-isc.gc.ca' },
  NT: { region: 'Northwest Territories', phone: '867-669-2500', email: null },
  YT: { region: 'Yukon', phone: '1-800-661-0451', email: 'yukon@rcaanc-cirnac.gc.ca' },
  NB: ATLANTIC, NS: ATLANTIC, PE: ATLANTIC, NL: ATLANTIC,
}
export const ISC_EMAP_PAGE = 'https://www.sac-isc.gc.ca/eng/1534954090122/1535120506707'
/** National fire weather map, for provinces without a checked danger page. */
export const CWFIS_FWI_MAP = 'https://cwfis.cfs.nrcan.gc.ca/maps/fw?type=fwi'
export const AQHI_PAGE = 'https://weather.gc.ca/airquality/pages/index_e.html'
const PREPARE_PAGE = 'https://www.canada.ca/en/services/policing/emergencies/preparedness/get-prepared/hazards-emergencies/wildfires/how-prepare.html'

/** Province code for a community's province field (a code such as 'ON', or a full name). */
export function provinceCode(p: string | null | undefined): ProvinceCode | null {
  if (!p) return null
  const up = p.trim().toUpperCase()
  if (up in PROVINCE_NAMES) return up as ProvinceCode
  const hit = (Object.entries(PROVINCE_NAMES) as [ProvinceCode, string][]).find(([, name]) => name.toUpperCase() === up)
  return hit ? hit[0] : null
}

// ---------------------------------------------------------------------------
// Intent rules. The question is lower-cased and stripped of punctuation first. Order matters: the
// first rule that matches wins (evacuation first; "what does very high mean" before "why"; "what can we
// do this week" before "when will it get worse").

const RULES: [Intent, RegExp[]][] = [
  ['evacuation', [/\bevac\w*/, /\b(need|have|got) to (leave|get out|go\b(?! (to|through|for|and|ahead|over|with|about|back)\b))/, /\btime to (leave|go|get out)\b/, /\b(we|i) (should|must) (leave|go\b(?! (to|through|for|and|ahead|over|with|about|back)\b))/, /\bevauc\w*/, /\bflee\b/, /\bget out\b/, /\b(should|do|must) (we|i) (leave|go)\b/, /\bleave (our |my |the )?(home|house|community|reserve)\b/]],
  ['request_help', [/\b(write|draft|prepare|make|create|send)\b.*\b(request|letter|email|e mail)\b/, /\brequest (for )?(help|resources|firefighters)\b/, /\bask(ing)? for help\b/, /\bletter\b/]],
  ['who_to_contact', [/\bwho\b.*\b(call|contact|phone|email|send|help|ask|talk|reach)\b/, /\bfire ?fi\w*/, /\bfire ?crews?\b/, /\bwater ?bombers?\b/, /\bequipment\b/, /\bphone numbers?\b/, /\bcontacts?\b/, /\b(send|get|need) help\b/, /\breport (a |the )?(wild)?fire\b/, /\b911\b/, /\bisc\b/, /\bindigenous services\b/, /\bwho (do|should|can) (we|i)\b/]],
  ['smoke_health', [/\bsmo\w*/, /\bsmk\w*/, /\bair quality\b/, /\bbr[ea]+th\w*/, /\bmasks?\b/, /\bn95\b/, /\bpm ?2/, /\baqi\b/, /\baqhi\b/, /\bcough\w*/, /\basthma\b/, /\blungs?\b/, /\bhaz[ey]\b/, /\bclean air\b/]],
  ['how_sure', [/\bhow (sure|certain|confident|accurate|reliable|good)\b/, /(?<!\bmake )\bsure\b/, /\bshure\b/, /\bcertain\w*/, /\bconfid\w*/, /\bac+ura\w*/, /\breliab\w*/, /\btrust\b/, /\buncertain\w*/]],
  ['meaning_of_level', [/\bmean(s|ing)?\b/, /\bdefin\w*/, /\bout of (a )?100\b/, /\bwhat (is|are) (a |the )?(very high|high|medium|moderate|low|levels?|score)\b/]],
  ['data_sources', [/\bdata\b/, /\bsources?\b/, /\bsatell\w*/, /\bnasa\b/, /\bhow do you know\b/, /\bwhere do (you|the numbers|these numbers) (get|come)\b/, /\bcome from\b/, /\bcalculat\w*/, /\bmodel\b/]],
  ['what_to_do', [/\bwhat (can|should|could|do|must) (we|i|our community|people)\b/, /\bwhat to do\b/, /\bprep[ae]r\w*/, /\bget ready\b/, /\bready\b/, /\bdo now\b/, /\bactions?\b/, /\bsteps?\b/, /\bplan\b/, /\bprotect\w*/, /\bhow can (we|i)\b/]],
  ['when_worse', [/\bwhen\b/, /\bwors[et]\b/, /\bpeak\w*/, /\bforecast\w*/, /\btomorrow\b/, /\bweekend\b/, /\bnext (few )?(days?|week)\b/, /\bthis week\b/, /\bcoming days\b/, /\blook ahead\b/, /\bexpect\w*/, /\bimprov\w*/, /\bease\b/, /\bget better\b/]],
  ['why', [/\bwh?y\b/, /\bwhy\w*/, /\breasons?\b/, /\bcaus\w*/, /\bexplain\w*/, /\bhow come\b/, /\bwarning signs?\b/, /\bmaking it\b/]],
  ['risk_now', [/\brisk\w*/, /\bdanger\w*/, /\bhow (bad|high|serious)\b/, /\blevel\b/, /\bstatus\b/, /\bsafe\b/, /\bfires?\b/, /\bwildfires?\b/, /\bhot ?spots?\b/, /\bnear(by)?\b/, /\btoday\b/, /\bright now\b/]],
]
const GREETING = /^(hi|hello|hey|hiya|good (morning|afternoon|evening|day)|thanks|thank you|thanks a lot|thank you very much|boozhoo|aaniin|tansi|tanisi|kwe|kwey|ok|okay)( there| so much| very much)?$/

const norm = (q: string) => q.toLowerCase().replace(/[’‘`]/g, "'").replace(/'/g, '').replace(/[^a-z0-9*]+/g, ' ').trim()

/** Which built-in answer fits the question. 'unknown' when nothing matches (the server may then ask Claude). */
export function classifyIntent(question: string): Intent {
  const q = norm(question ?? '')
  if (!q) return 'unknown'
  if (GREETING.test(q)) return 'greeting'
  for (const [intent, tests] of RULES) if (tests.some((t) => t.test(q))) return intent
  return 'unknown'
}

// ---------------------------------------------------------------------------
// Wording helpers

const RANK: Record<RiskLevel, number> = { Low: 0, Moderate: 1, High: 2, Critical: 3 }
const lv = (level: RiskLevel) => levelLabel(level).toLowerCase()
const dayGap = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000)
/** "today", "tomorrow", "Sunday", or "Monday 27 July" a week or more out: the same day words as the community page. */
const day = (iso: string, todayIso: string) => dayWord(iso, todayIso)
/** "today", "tomorrow", "on Sunday", "on Monday 27 July" */
const onDay = (iso: string, todayIso: string) => onDayWord(iso, todayIso)
const COMPASS: Record<string, string> = { N: 'north', NE: 'north-east', E: 'east', SE: 'south-east', S: 'south', SW: 'south-west', W: 'west', NW: 'north-west' }
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
/** Lead-in for sentences that quote data: in the example scenario they always say so. Write s lower-case first. */
const say = (ctx: AssistantContext, s: string) => (ctx.mode === 'sim' ? `In this example scenario, ${s}` : cap(s))
const join = (parts: (string | null | undefined | false)[]) => parts.filter((p): p is string => !!p).slice(0, 3).join(' ')

const CONFIDENCE_WORDS: Record<'High' | 'Medium' | 'Low', string> = { High: 'fairly sure', Medium: 'somewhat sure', Low: 'not very sure' }

const page = (to: string): AssistantAction => ({ label: 'Show me on the page', to })
const helpLink = (r: PlaceReport): AssistantAction => ({ label: 'Write the request', to: `/c/${encodeURIComponent(r.community.id)}/help` })
const FIND: AssistantAction = { label: 'Find your community', to: '/' }

function forecast(r: PlaceReport) { return r.risk.timeline.filter((t) => t.kind === 'forecast') }

/** Where the risk goes over the look-ahead, as a clause after "fire risk is X today": the community page's status rule (shared/outlookWords.ts). */
function outlookClause(r: PlaceReport): string {
  const today = r.outlook.todayDate ?? r.risk.todayDate
  const o = outlookPhrase({ todayLevel: r.outlook.todayLevel ?? r.risk.today.level, ahead: forecast(r), firstHigherLevelDate: r.outlook.firstHigherLevelDate, horizon: r.horizon }, relativeDays(today))
  return o ? ` and is ${o.text}` : ''
}

/** Plain phrases for the active warning signs, built from the weather itself (never the sign's technical text). */
function signPhrases(r: PlaceReport): string[] {
  const active = new Set(r.signs.filter((s) => s.active).map((s) => s.key))
  const past = r.risk.days.filter((d) => d.kind === 'historical')
  const ahead = r.risk.days.filter((d) => d.kind === 'forecast')
  const today = past.at(-1), first = past[0]
  const out: string[] = []
  if (active.has('heat') && today?.tMax != null && first?.tMax != null) out.push(`it is ${Math.round(today.tMax - first.tMax)} °C hotter than a week ago`)
  if (active.has('humidity')) out.push('the air is very dry')
  if (active.has('dry')) {
    let n = 0
    for (let i = past.length - 1; i >= 0 && (past[i].precip ?? 0) < 2.5; i--) n++
    out.push(n > 0 ? `there has been no soaking rain for ${plural(n, 'day')}` : 'there has been no soaking rain')
  }
  if (active.has('fire') && r.risk.hotspots100km) out.push(`satellites spotted heat in ${plural(r.risk.hotspots100km, 'place')} within 100 km`)
  if (active.has('wind')) {
    const win = [today, ...ahead.slice(0, 3)].filter((d): d is NonNullable<typeof d> => !!d && d.windMax != null)
    const peak = win.reduce<(typeof win)[number] | null>((a, b) => (!a || b.windMax! > a.windMax! ? b : a), null)
    out.push(peak ? `strong wind is expected ${onDay(peak.date, r.risk.todayDate)}` : 'strong wind is expected')
  }
  if (active.has('smoke')) out.push('smoke in the air is getting thicker')
  return out
}

function riskSentence(ctx: AssistantContext, r: PlaceReport): string {
  const t = r.risk.today
  return say(ctx, `fire risk at ${r.community.name} is ${lv(t.level)} today (${t.score} out of 100)${outlookClause(r)}.`)
}

function nearestFireSentence(r: PlaceReport): string | null {
  if (!r.fires) return null // unknown, not "no fires"
  const f = r.fires.nearest[0]
  if (!f || f.distanceKm > 100) return 'Fire crews report no wildfires within 100 km.'
  return `The nearest wildfire reported by fire crews is ${f.distanceKm} km ${COMPASS[f.bearing] ?? ''} of you.`.replace(/ +of you/, ' of you')
}

/** An agency as a button name: "Ontario’s forest fire service", "SOPFEU" (no leading "the", nothing after a comma). */
const siteName = (agency: string) => cap(agency.replace(/^the /, '').replace(/,.*$/, ''))

function dangerPage(r: PlaceReport | null): AssistantAction {
  const code = provinceCode(r?.community.province)
  const p = code ? PROVINCE_CONTACTS[code] : undefined
  return { label: 'Official fire danger rating', to: p?.danger ?? CWFIS_FWI_MAP }
}

// ---------------------------------------------------------------------------
// Answers

const NO_PLACE: AssistantAnswer = {
  text: 'Choose your community first, and I can answer with its own fire risk, smoke and contacts.',
  from: 'Answers use the same data as the community page.',
  actions: [FIND],
}

function suggestions(): AssistantAction[] { return SUGGESTED.map((s) => ({ label: s.question, to: `ask:${s.question}` })) }

export function answer(intent: Intent, ctx: AssistantContext): AssistantAnswer {
  const r = ctx.report
  const name = r?.community.name ?? 'your community'
  const sim = ctx.mode === 'sim'

  switch (intent) {
    case 'greeting':
      return {
        text: `Hello. I can answer questions about fire risk, smoke, what you can do and who to contact for ${name}. Try one of these questions, or type your own.`,
        from: 'Answers use the same data as this page.',
        actions: suggestions(),
      }

    case 'unknown':
      return {
        text: `I can answer questions about fire risk, smoke, what to do and who to contact for ${name}. Try one of these:`,
        from: 'Answers use the same data as this page.',
        actions: suggestions(),
      }

    case 'evacuation':
      return {
        text: join([
          'If your leadership or an official order tells you to leave, leave right away, and call 911 if lives or homes are in danger.',
          'This site does not issue evacuation orders: Chief and Council and official agencies do.',
          'You may want to keep a packed bag for each person, ready to grab, and know your main and backup routes out.',
        ]),
        from: 'From Government of Canada wildfire guidance.',
        actions: [{ label: 'How to get ready to leave', to: PREPARE_PAGE }, ...(r ? [helpLink(r)] : [])],
      }

    case 'data_sources':
      return {
        text: join([
          'Our fire risk estimate uses the weather forecast, heat spotted by NASA satellites, and Canada’s official Fire Weather Index from the nearest fire weather station.',
          'Wildfires come from Canada’s wildfire information system, smoke from an air quality forecast, and the 42-year weather record from NASA.',
          sim ? 'In this example scenario, the numbers are made up for the demo and are not real conditions.' : 'It is our estimate, not an official fire danger rating.',
        ]),
        from: 'From the About the data page.',
        actions: [{ label: 'About the data', to: '/about' }],
      }

    case 'meaning_of_level': {
      const q = norm(ctx.question ?? '')
      const asked: RiskLevel | null = /\bvery high\b/.test(q) ? 'Critical' : /\bhigh\b/.test(q) ? 'High' : /\b(medium|moderate)\b/.test(q) ? 'Moderate' : /\blow\b/.test(q) ? 'Low' : null
      const level = asked ?? r?.risk.today.level ?? 'Critical'
      const MEANS: Record<RiskLevel, string> = {
        Low: 'Low means conditions are calm, though a fire can still start and spread.',
        Moderate: 'Medium means some of the conditions that help fire spread are showing, so it is worth checking each day.',
        High: 'High means it is hot and dry enough that a fire could spread quickly.',
        Critical: 'Very high means many fire conditions are lining up at once, so a fire could spread fast and be hard to control.',
      }
      return {
        text: join([
          'Our fire risk is a score out of 100 with four levels: low (under 25), medium (25 to 49), high (50 to 74) and very high (75 and over).',
          MEANS[level],
          'It is our estimate, not an official fire danger rating, and not a chance that a fire will happen.',
        ]),
        from: 'From how our fire risk estimate is built.',
        actions: [dangerPage(r), { label: 'About the data', to: '/about' }],
      }
    }

    case 'who_to_contact': {
      const code = provinceCode(r?.community.province)
      const prov = code ? PROVINCE_NAMES[code] : null
      const p = code ? PROVINCE_CONTACTS[code] : undefined
      const isc = code ? ISC_OFFICES[code] : undefined
      if (!r || !code) {
        return {
          text: join([
            'If lives or homes are in danger, call 911 first.',
            'Each province has its own wildfire report line and fire service.',
            'Choose your community, and I will show the official contacts for its province.',
          ]),
          from: 'From official provincial and Indigenous Services Canada pages, checked 14 November 2026.',
          actions: [FIND, { label: 'Indigenous Services Canada emergency help', to: ISC_EMAP_PAGE }],
        }
      }
      const report = p?.report
        ? `To report a wildfire in ${prov}, call ${p.report}.`
        : p
          ? `We could not confirm the wildfire report number for ${prov} on an official page, so check ${p.agency}’s contact page.`
          : `We do not have a checked wildfire report number for ${prov}, so check the official page.`
      const ask = isc
        ? `To ask for firefighters and equipment, Chief and Council can contact Indigenous Services Canada’s ${isc.region} emergency office${p ? ` and ${p.agency}` : ''}.`
        : 'To ask for firefighters and equipment, Chief and Council can contact Indigenous Services Canada’s regional emergency office.'
      const actions: AssistantAction[] = [helpLink(r)]
      actions.push(p ? { label: `${siteName(p.agency)} website`, to: p.page } : { label: 'Indigenous Services Canada emergency help', to: ISC_EMAP_PAGE })
      // The phone number and email live in these buttons, not in the sentence (a long address wraps badly).
      if (isc?.phone) actions.push({ label: `Call Indigenous Services Canada ${isc.region}`, to: `tel:${isc.phone.replace(/[^0-9]/g, '')}` })
      if (isc?.email) actions.push({ label: `Email Indigenous Services Canada ${isc.region}`, to: `mailto:${isc.email}` })
      return {
        text: join(['If lives or homes are in danger, call 911 first.', report, ask]),
        from: 'From official provincial and Indigenous Services Canada pages, checked 14 November 2026.',
        actions,
      }
    }

    case 'request_help': {
      if (!r) return { ...NO_PLACE, text: 'Open your community’s page first, then choose Ask for help to write a request for firefighters and equipment.' }
      const code = provinceCode(r.community.province)
      const p = code ? PROVINCE_CONTACTS[code] : undefined
      return {
        text: join([
          `The Ask for help page writes a request for firefighters and equipment for ${name}, addressed to Indigenous Services Canada${p ? ` and ${p.agency}` : ''}.`,
          say(ctx, 'it already includes today’s fire risk, the nearest fires and the warning signs.'),
          'Nothing is sent for you: you add your name and role, then copy, email or print it.',
        ]),
        from: 'From this page’s data and the official contacts for your province.',
        actions: [helpLink(r)],
      }
    }
  }

  // The rest quote the community's own data.
  if (!r) return NO_PLACE
  const t = r.risk.today

  switch (intent) {
    case 'risk_now':
      return {
        text: join([riskSentence(ctx, r), nearestFireSentence(r), 'It is our estimate, not an official fire danger rating.']),
        from: 'From the weather forecast, wildfire reports and our fire risk estimate.',
        actions: [page('#status'), dangerPage(r)],
      }

    case 'why': {
      const phrases = signPhrases(r)
      // Same count as the community page and the request letter: active signs, not counting the outlook sign.
      const n = r.signs.filter((s) => s.active && s.key !== 'outlook').length
      let first: string
      if (t.snowGate) first = say(ctx, `fire risk is ${lv(t.level)} today (${t.score} out of 100), because snow or freezing temperatures are keeping it down.`)
      else if (RANK[t.level] >= RANK.High) first = say(ctx, `fire risk is ${lv(t.level)} today (${t.score} out of 100), and ${plural(n, 'warning sign')} ${n === 1 ? 'is' : 'are'} showing.`)
      else first = say(ctx, `fire risk is ${lv(t.level)} today (${t.score} out of 100)${n ? `, but ${plural(n, 'warning sign')} ${n === 1 ? 'is' : 'are'} showing` : ''}.`)
      // Drying power (shared/risk.ts): on cold or damp days wind and a dry spell count for little.
      const damp = !t.snowGate && RANK[t.level] < RANK.High && (t.drying ?? 1) < 0.3 ? 'The air is too cool or damp to dry out grass, needles and twigs, so wind and dry days count for little right now.' : null
      const second = phrases.length ? `The biggest: ${list(phrases.slice(0, 3))}.` : 'None of the warning signs we watch are showing today.'
      const third = phrases.length > 3 ? `Also, ${list(phrases.slice(3, 5))}.` : null
      return {
        text: join([first, damp, second, third]),
        from: 'From the weather forecast, NASA satellite heat detections and our fire risk estimate.',
        actions: [page('#why')],
      }
    }

    case 'when_worse': {
      const fc = forecast(r)
      if (!fc.length) return { text: 'We have no forecast days to look at right now.', from: 'From the weather forecast and our fire risk estimate.', actions: [page('#look-ahead')] }
      const o = r.outlook
      const peakLine = o.peakDate !== r.risk.todayDate
        ? `The highest day in the next ${plural(fc.length, 'day')} is expected to be ${day(o.peakDate, r.risk.todayDate)}, at ${lv(o.peakLevel)} (${o.peakScore} out of 100).`
        : `Today is the highest day in the next ${plural(fc.length, 'day')}.`
      const act = o.actByDate
        ? (dayGap(r.risk.todayDate, o.actByDate) <= 0 ? 'You may want to have plans in place today.' : `You may want to have plans in place by ${day(o.actByDate, r.risk.todayDate)}.`)
        : 'Further ahead is less certain.'
      return {
        text: join([say(ctx, `fire risk is ${lv(t.level)} today${outlookClause(r)}.`), peakLine, act]),
        from: 'From the weather forecast and our fire risk estimate.',
        actions: [page('#look-ahead')],
      }
    }

    case 'what_to_do': {
      const level = RANK[r.outlook.peakLevel] > RANK[t.level] ? r.outlook.peakLevel : t.level
      const DO: Record<RiskLevel, [string, string]> = {
        Low: ['This is a good time to prepare: you may want to review your community emergency plan and test phone trees, radio and door-to-door lists.', 'Consider clearing dry brush, firewood and debris from around homes.'],
        Moderate: ['You may want to check conditions each day and confirm who will need extra help, such as Elders, babies and people with heart or lung problems.', 'Consider checking pumps, hoses, sprinklers and the filters for a clean-air room.'],
        High: ['You may want to hold a meeting with leadership and your local fire crew to check you are ready.', 'Consider checking pumps, hoses and sprinklers, and setting up a clean-air room for Elders and anyone with breathing problems.'],
        Critical: ['You may want to put your emergency plan into action at the level leadership chooses, and keep one trusted channel for updates.', 'Consider asking for firefighters and equipment now, while there is still time to bring them in.'],
      }
      const actions: AssistantAction[] = [{ label: 'More ways to prepare', to: '#what-to-do' }]
      if (RANK[level] >= RANK.High) actions.push(helpLink(r))
      return {
        text: join([say(ctx, `fire risk is ${lv(t.level)} today (${t.score} out of 100)${outlookClause(r)}.`), ...DO[level]]),
        from: 'From our fire risk estimate and Government of Canada and FireSmart Canada advice.',
        actions,
      }
    }

    case 'smoke_health': {
      const aqi = r.air?.now.usAqi ?? null
      if (!r.air || aqi == null) {
        return {
          text: 'We cannot get smoke information for your community right now. Check Canada’s Air Quality Health Index for your area, and get medical help for chest pain, dizziness or trouble breathing.',
          from: 'From Health Canada advice.',
          actions: [{ label: 'Air Quality Health Index', to: AQHI_PAGE }],
        }
      }
      // The same words and advice as the community page and the letter (shared/aqi.ts smokePlain).
      const plain = smokePlain(aqi)!
      const ahead = r.air.max3d.usAqi
      const later = smokePlain(ahead)
      const aheadLine = later && ahead != null && r.air.max3d.date && SMOKE_RANK[later.word] !== SMOKE_RANK[plain.word]
        ? say(ctx, `smoke is expected to be ${later.word} ${onDay(r.air.max3d.date, r.risk.todayDate)} (smoke reading: ${Math.round(ahead)}).`)
        : null
      // The number second, in the same words as the community page (docs/design/review-wave3.md #10).
      const reading = `(smoke reading: ${Math.round(aqi)} on the US air quality scale, where over 300 is the worst level)`
      const first = `there is ${plain.word} smoke in the air today ${reading}.`
      const advice = plain.healthLine
      const third = SMOKE_RANK[plain.word] >= SMOKE_RANK.heavy ? SMOKE_MEDICAL : aheadLine ?? SMOKE_MEDICAL
      return {
        text: join([say(ctx, first), advice, third]),
        from: 'From the smoke forecast and Health Canada advice.',
        actions: [page('#fire-smoke'), { label: 'Canada’s Air Quality Health Index', to: AQHI_PAGE }],
      }
    }

    case 'how_sure': {
      const u = t.uncertainty ?? 0
      const lo = levelFor(Math.max(0, t.score - u)), hi = levelFor(Math.min(100, t.score + u))
      const range = lo === hi ? `even allowing for error, fire risk today would still be ${lv(lo)}` : `fire risk today could be anywhere from ${lv(lo)} to ${lv(hi)}`
      return {
        text: join([
          say(ctx, `we are ${CONFIDENCE_WORDS[t.confidence] ?? 'not very sure'}: ${range}.`),
          sim ? 'This is example data, and our estimate has not yet been checked against past fires.' : 'Our estimate has not yet been checked against past fires, and further ahead is less certain.',
          'It is our estimate, not an official fire danger rating, so you may want to check your province’s rating too.',
        ]),
        from: 'From our fire risk estimate and how complete today’s data is.',
        actions: [page('#how-sure'), dangerPage(r)],
      }
    }
  }
  return NO_PLACE
}

/** Classify and answer in one call. */
export function builtInAnswer(question: string, ctx: Omit<AssistantContext, 'question'>): AssistantAnswer & { intent: Intent } {
  const intent = classifyIntent(question)
  return { ...answer(intent, { ...ctx, question }), intent }
}
