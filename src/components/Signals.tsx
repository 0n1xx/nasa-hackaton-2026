import type { RegionRisk, RiskDay, RiskLevel } from '../../shared/types.ts'
import { daysBuilding, type WarningSign } from '../../shared/signals.ts'
import { levelLabel } from '../../shared/risk.ts'
import { InfoPopover } from './ui.tsx'

// CONTRACT (used by Overview, Risk and Brief): keep these props stable.
//   <SignList signs={...} />            full list: label, value, detail, the rule as visible small text
//   <SignList signs={...} compact />    one line per sign, for tight spaces and the printed brief
//
// Active signs come first, in the order shared/signals.ts produces them; inactive signs follow, quietly.

/** Dates in the data are YYYY-MM-DD; parse at local noon, as shared/signals.ts does, so the weekday never slips. */
const at = (iso: string) => new Date(`${iso}T12:00:00`)
export const weekdayOf = (iso: string, style: 'long' | 'short' = 'long') => at(iso).toLocaleDateString('en-CA', { weekday: style })
export const longDate = (iso: string) => at(iso).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })
const shortDate = (iso: string) => at(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
/** "Mon, Nov 9": weekday plus date, because a 7-day window can contain the same weekday twice. */
export const sinceLabel = (iso: string) => at(iso).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })

/**
 * shared/signals.ts writes labels and rules in the model's words ("Critical in the forecast", "PM2.5", "heat signature").
 * They are shown here in the UI's words (glossary in docs/plans/2026-11-14-community-hub.md); the meaning is unchanged.
 */
const LABELS: Record<string, string> = {
  'Fire detected nearby': 'Heat spotted nearby', 'Smoke thickening': 'Smoke getting thicker',
  'Critical in the forecast': 'Very high fire risk ahead', 'Risk rising': 'Fire risk rising',
}
export const plain = (t: string) => (LABELS[t] ?? t)
  .replace(/\bCritical\b/g, 'Very high').replace(/\bModerate\b/g, 'Medium')
  .replace(/\b(T|t)he index\b/g, (_m, c: string) => (c === 'T' ? 'Fire risk' : 'fire risk')).replace(/\brisk index\b/gi, 'fire risk')
  .replace(/\b(\d+) detections?\b/g, (_m, n: string) => `${n} spot${n === '1' ? '' : 's'} of heat`)
  .replace(/heat signatures?/g, (m) => (m.endsWith('s') ? 'hot spots' : 'hot spot')).replace(/\bsatellite fire detections\b/g, 'heat spotted by satellites')
  .replace(/% PM2\.5\b/g, '% fine smoke').replace(/\bforecast to\b/g, 'expected to').replace(/\bwetting rain\b/g, 'soaking rain')
  .replace(/^Active when\b/, 'Shows when').replace(/^Active after\b/, 'Shows after')

function sortSigns(signs: WarningSign[]) {
  return [...signs.filter((s) => s.active), ...signs.filter((s) => !s.active)]
    .map((s) => ({ ...s, label: plain(s.label), value: plain(s.value), detail: plain(s.detail), rule: plain(s.rule) }))
}

export function SignList({ signs, compact = false }: { signs: WarningSign[]; compact?: boolean }) {
  if (!signs.length) return <p className="text-[13px] text-mute">Warning signs could not be worked out from the data available.</p>
  const sorted = sortSigns(signs)

  if (compact) {
    return <ul className="divide-y divide-line border-y border-line text-[12.5px]">
      {sorted.map((s) => <li key={s.key} title={s.rule} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 py-1.5">
        <Marker active={s.active} small />
        <InfoPopover k={`sign.${s.key}`} className={`min-w-[9.5rem] ${s.active ? 'font-semibold text-fg' : 'text-mute'}`}>{s.label}</InfoPopover>
        <span className={`num ${s.active ? 'font-semibold text-fg' : 'text-dim'}`}>{s.value}</span>
        <span className={`ml-auto text-right ${s.active ? 'font-medium text-fg' : 'text-dim'}`}>
          {s.active ? (s.since ? `Showing since ${shortDate(s.since)}` : 'Showing now') : 'Not showing'}
        </span>
      </li>)}
    </ul>
  }

  const active = sorted.filter((s) => s.active), quiet = sorted.filter((s) => !s.active)
  return <div className="@container w-full">
    {active.length > 0 && <ul className="grid grid-cols-1 gap-x-10 gap-y-7 @xl:grid-cols-2 @4xl:grid-cols-3">
      {active.map((s) => <li key={s.key} className="min-w-0 border-t-2 border-ember pt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h3 className="text-[15px] font-semibold tracking-normal"><span className="sr-only">Showing now: </span><InfoPopover k={`sign.${s.key}`}>{s.label}</InfoPopover></h3>
          {s.since && <span className="text-[12.5px] whitespace-nowrap text-mute">since {sinceLabel(s.since)}</span>}
        </div>
        <p className="num mt-1.5 text-[22px] leading-tight font-semibold text-fg">{s.value}</p>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-mute">{s.detail}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-mute">{s.rule}</p>
      </li>)}
    </ul>}
    {quiet.length > 0 && <div className={active.length ? 'mt-8' : ''}>
      {active.length > 0 && <p className="mb-1 text-[12.5px] font-medium text-mute">Not showing now</p>}
      <ul className="grid grid-cols-1 gap-x-10 @xl:grid-cols-2 @4xl:grid-cols-3">
        {quiet.map((s) => <li key={s.key} title={`${s.detail} ${s.rule}`} className="flex min-w-0 items-baseline gap-2.5 border-t border-line py-2 text-[13px]">
          <Marker active={false} />
          <InfoPopover k={`sign.${s.key}`} className="text-mute">{s.label}</InfoPopover>
          <span className="num ml-auto shrink-0 text-dim">{s.value}</span>
        </li>)}
      </ul>
    </div>}
  </div>
}

/** Filled ember dot for active; a hollow ring for clear, so the difference survives black-and-white printing. */
function Marker({ active, small = false }: { active: boolean; small?: boolean }) {
  const size = small ? 'h-2 w-2' : 'h-2.5 w-2.5'
  return <span aria-label={active ? 'Showing now' : 'Not showing'} role="img" className={`${size} inline-block shrink-0 translate-y-[-1px] rounded-full ${active ? 'bg-ember print:bg-fg' : 'border-[1.5px] border-dim'}`} style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }} />
}

// ---------------------------------------------------------------------------
// Hero copy for the Overview, generated from the data. Pure, so it can be checked from the command line.

const RANK: Record<RiskLevel, number> = { Low: 0, Moderate: 1, High: 2, Critical: 3 }
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
/** Level word as it reads mid-sentence: "very high". */
const lower = (l: RiskLevel) => levelLabel(l).toLowerCase()

export interface HeroCopy {
  /** e.g. "Thunder Bay District" */
  place: string
  todayIso: string
  headline: string
  subline: string
  state: 'building' | 'signs' | 'calm'
  active: number
  total: number
  /** Days the slow-building signs have been lining up (shared/signals.ts daysBuilding) */
  building: number
  /** Earliest `since` among active signs, if any */
  earliest: string | null
}

export function heroCopy(risk: RegionRisk, signs: WarningSign[]): HeroCopy {
  const place = risk.region.name.split(',')[0].trim()
  const todayEntry: RiskDay | undefined = risk.timeline.find((t) => t.kind === 'today') ?? risk.timeline.filter((t) => t.kind !== 'forecast').at(-1)
  const todayIso = todayEntry?.date ?? risk.days.filter((d) => d.kind === 'historical').at(-1)?.date ?? ''
  const active = signs.filter((s) => s.active)
  const building = todayIso ? daysBuilding(signs, todayIso) : 0
  const earliest = active.map((s) => s.since).filter((s): s is string => !!s).sort()[0] ?? null

  // "Building" is only said when the index itself is at least Moderate today or in the forecast and no
  // snow gate applies: a November warm spell can trip "Heat building" without any real fire weather.
  const meaningful = !risk.today.snowGate && risk.timeline.some((t) => t.kind !== 'historical' && t.score >= 25)
  let headline: string, state: HeroCopy['state']
  if (meaningful && building >= 2) { state = 'building'; headline = `Fire conditions in ${place} have been building for ${building} days.` }
  else if (meaningful && building === 1) { state = 'building'; headline = `Fire conditions in ${place} started building today.` }
  else if (active.length) { state = 'signs'; headline = `${WORDS[active.length] ?? active.length} warning sign${active.length === 1 ? ' is' : 's are'} showing in ${place} today.` }
  else { state = 'calm'; headline = `No warning signs in ${place} today.` }

  // Outlook: the same day the "Critical in the forecast" sign names (first day at 75+, otherwise the highest).
  const { score, level } = risk.today
  const fc = risk.timeline.filter((t) => t.kind === 'forecast')
  let outlook = ''
  if (fc.length) {
    // The highest level in the forecast, named on the first day it is reached (for Critical this is the
    // same day the "Critical in the forecast" sign names). Always a weekday, matching the sign card.
    const top = fc.reduce((a, b) => (RANK[b.level] > RANK[a.level] ? b : a)).level
    const first = fc.find((t) => RANK[t.level] >= RANK[top])!
    const last = fc[fc.length - 1]
    if (RANK[top] > RANK[level]) outlook = ` and expected to reach ${lower(top)} on ${weekdayOf(first.date)}`
    else if (fc.every((t) => t.level === level)) outlook = ` and expected to stay ${lower(level)} over the next ${fc.length} days`
    else if (RANK[last.level] < RANK[level]) outlook = ` and expected to ease to ${lower(last.level)} by ${weekdayOf(last.date)}`
    else outlook = ` and expected to stay ${lower(level)} or lower through ${weekdayOf(last.date)}`
  }
  let subline = `Fire risk is ${lower(level)} today (${score} out of 100)${outlook}.`
  if (state === 'building') subline += ` ${active.length} warning sign${active.length === 1 ? ' is' : 's are'} showing right now.`
  if (risk.today.snowGate) subline += ' Snow or freezing temperatures are keeping fire risk down.'

  return { place, todayIso, headline, subline, state, active: active.length, total: signs.length, building, earliest }
}
