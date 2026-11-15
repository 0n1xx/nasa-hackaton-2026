import { useState } from 'react'
import type { PlaceReport, RiskLevel } from '../../../shared/types.ts'
import { guidanceLevel, lower, todayOf, dayWord } from './words.ts'

// Suggestions, never orders: communities decide (voice guide). Adapted from src/actions.ts and the
// sourced guidance in docs/research/preparedness.md. Sprinkler and structure-protection specifics are
// left out on purpose: the research found no official page for them (preparedness.md §2, "Gap").

const SRC = {
  kit: { label: 'Government of Canada: making an emergency kit', url: 'https://www.canada.ca/en/services/policing/emergencies/preparedness/get-prepared/emergency-kits.html' },
  wildfire: { label: 'Government of Canada: wildfires, how to prepare', url: 'https://www.canada.ca/en/services/policing/emergencies/preparedness/get-prepared/hazards-emergencies/wildfires/how-prepare.html' },
  firesmart: { label: 'FireSmart Canada', url: 'https://firesmartcanada.ca/' },
  plan: { label: 'FireSmart Canada: community planning', url: 'https://firesmartcanada.ca/community-planning/' },
  smoke: { label: 'Health Canada: wildfire smoke and your health', url: 'https://www.canada.ca/en/health-canada/services/publications/healthy-living/wildfire-smoke-health.html' },
  smokePrep: { label: 'Health Canada: preparing for wildfire smoke', url: 'https://www.canada.ca/en/services/health/healthy-living/environment/air-quality/wildfire-smoke/preparing-events.html' },
  toolkit: { label: 'Public Health Agency of Canada: wildfires toolkit', url: 'https://www.canada.ca/en/public-health/services/publications/healthy-living/wildfires-canada-toolkit-public-health-authorities.html' },
  emap: { label: 'Indigenous Services Canada: Emergency Management Assistance Program', url: 'https://www.sac-isc.gc.ca/eng/1534954090122' },
  iscFiresmart: { label: 'Indigenous Services Canada: FireSmart funding', url: 'https://www.sac-isc.gc.ca/eng/1743440237150' },
} as const
type Src = (typeof SRC)[keyof typeof SRC]

/** The first 2–3 things to consider at each level. */
const NOW: Record<RiskLevel, string[]> = {
  Low: [
    'You may want to review the community emergency plan while things are calm.',
    'Consider testing how word gets around: radio, phone trees, social media and door-to-door lists.',
    'Consider clearing dry leaves, needles and firewood from right around homes.',
  ],
  Moderate: [
    'You may want to check the fire risk every day, and watch the wind and any new fires nearby.',
    'Consider making a list of who would need extra help: Elders, babies and people with heart or lung problems.',
    'Consider checking pumps, hoses, sprinklers and air filters.',
  ],
  High: [
    'You may want to hold a meeting with leadership and your local fire crew to check you are ready.',
    'Consider checking pumps, hoses and sprinklers.',
    'Consider setting up a clean-air room for Elders and anyone with breathing problems.',
  ],
  Critical: [
    'You may want to meet with leadership about starting the community emergency plan.',
    'Consider having a packed bag for each person, ready to grab, and vehicles fuelled, in case people are asked to leave.',
    'Consider setting up a clean-air room for Elders and anyone with breathing problems.',
  ],
}

const MORE: { title: string; items: { text: string; src: Src }[] }[] = [
  { title: 'For your household', items: [
    { text: 'Have a packed bag for each person, ready to grab, with water (about 4 litres per person per day), food, a flashlight and radio with spare batteries, chargers, a first aid kit, masks, two weeks of medicine and copies of important papers.', src: SRC.kit },
    { text: 'Make a household plan: practise your way out and a second way, and plan for Elders, children, pets and anyone with health needs. Keep the vehicle fuelled.', src: SRC.wildfire },
    { text: 'Clear dry leaves, needles and anything that burns from the first 1.5 metres around the house, and keep firewood well away from it.', src: SRC.firesmart },
    { text: 'For smoke: a portable air cleaner, spare clean filters and well-fitted N95 masks.', src: SRC.wildfire },
    { text: 'Keep a supply of your medicines, and talk to a health provider ahead of time about a plan for smoky days.', src: SRC.smokePrep },
  ] },
  { title: 'For leadership and the band office', items: [
    { text: 'Review or update the community wildfire plan. FireSmart calls this a FireSmart Community Plan.', src: SRC.plan },
    { text: 'Make a list of who needs help first: Elders, babies and young children, pregnant people, and people with heart or lung problems.', src: SRC.smoke },
    { text: 'Set up a cleaner-air space, such as a community centre or school with good filters.', src: SRC.toolkit },
    { text: 'Share short, plain updates often, in the community’s languages, and by radio and door to door as well as online.', src: SRC.toolkit },
    { text: 'Funding for emergency plans, fire training and risk assessments may be available from Indigenous Services Canada.', src: SRC.emap },
    { text: 'Indigenous Services Canada also funds FireSmart work: fire training, clearing brush and Indigenous knowledge activities such as prescribed burns.', src: SRC.iscFiresmart },
  ] },
]

/** "What you can do now": 2–3 suggestions for the level, then the full list with sources. */
export default function WhatToDo({ place, count = 3 }: { place: PlaceReport; count?: number }) {
  const [open, setOpen] = useState(false)
  const g = guidanceLevel(place)
  const items = NOW[g.level].slice(0, count)
  return <section aria-labelledby="what-to-do" className="mt-5">
    <h2 id="what-to-do" className="text-[19px] font-semibold">What you can do now</h2>
    {g.fromDate && <p className="mt-0.5 text-[15px] text-mute">Getting ready for the {lower(g.level)} risk expected {dayWord(g.fromDate, todayOf(place)) === 'tomorrow' ? 'tomorrow' : `on ${dayWord(g.fromDate, todayOf(place))}`}.</p>}
    <ul className="mt-1.5 space-y-1 text-[17px] leading-[1.45]">
      {items.map((t) => <li key={t}>{t}</li>)}
    </ul>
    <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}
      className="mt-2 inline-flex min-h-10 items-center rounded-md border border-edge bg-white px-3 text-[15px] font-semibold hover:bg-ink-800">
      {open ? 'Show fewer ways to prepare' : 'More ways to prepare'}
    </button>
    {open && <div className="fade-in mt-3 space-y-4">
      {MORE.map((g) => <div key={g.title}>
        <h3 className="text-[17px] font-semibold">{g.title}</h3>
        <ul className="mt-1 space-y-2.5">
          {g.items.map((it) => <li key={it.text} className="text-[17px] leading-[1.45]">
            {it.text}{' '}
            <a href={it.src.url} target="_blank" rel="noreferrer" className="text-[15px] text-action underline underline-offset-2 hover:text-action-deep">{it.src.label}</a>
          </li>)}
        </ul>
      </div>)}
      <p className="text-[15px] text-mute">General guidance to adapt to your community. Your community decides what fits.</p>
    </div>}
  </section>
}
