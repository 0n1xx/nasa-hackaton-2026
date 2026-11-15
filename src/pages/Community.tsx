// The community view, /c/:id (docs/design/critique-and-direction.md §3.3 desktop, §3.4 phone).
// It answers, in order: is fire risk coming near us and when, how sure are you, why, what can we do,
// and then the main action, Ask for help. Every number comes from one PlaceReport (usePlace).
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import HeroMap from '../components/HeroMap.tsx'
import Assistant from '../components/Assistant.tsx'
import StatusBlock from '../components/community/StatusBlock.tsx'
import LookAhead from '../components/community/LookAhead.tsx'
import WhySigns from '../components/community/WhySigns.tsx'
import WhatToDo from '../components/community/WhatToDo.tsx'
import FireAndSmoke from '../components/community/FireAndSmoke.tsx'
import { usePlace } from '../place.ts'
import { useApp } from '../state.tsx'

/** Matches a media query, live. HeroMap and Assistant are mounted once each and moved by layout,
 *  never hidden with CSS: a display:none Leaflet map mis-sizes, and two assistants would hold two conversations. */
function useMedia(query: string): boolean {
  const subscribe = useCallback((cb: () => void) => {
    const m = window.matchMedia(query)
    m.addEventListener('change', cb)
    return () => m.removeEventListener('change', cb)
  }, [query])
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
}

const ASSISTANT_KEY = 'bw.assistant'
const readOpen = () => { try { return localStorage.getItem(ASSISTANT_KEY) !== 'closed' } catch { return true } }
const saveOpen = (open: boolean) => { try { localStorage.setItem(ASSISTANT_KEY, open ? 'open' : 'closed') } catch { /* private mode */ } }

const HELP_LINE = 'Write a request for firefighters and equipment before a fire starts.'
const btnPrimary = 'inline-flex h-12 items-center justify-center rounded-md bg-action px-4 text-[17px] font-semibold text-white hover:bg-action-deep'
const btnSecondary = 'inline-flex h-12 items-center justify-center rounded-md border border-edge bg-white px-4 text-[17px] font-semibold text-fg hover:bg-ink-800'

export default function Community() {
  const { id = '' } = useParams()
  const { mode, setDay } = useApp()
  const place = usePlace(id)
  const wide = useMedia('(min-width: 768px)')    // panel + map
  const desk = useMedia('(min-width: 1024px)')   // panel + map + assistant column
  const [assistantOpen, setAssistantOpenRaw] = useState(readOpen)
  const setAssistantOpen = (v: boolean) => { setAssistantOpenRaw(v); saveOpen(v) }

  // One day for the whole screen: start on Today, and leave Today behind for the next screen.
  useEffect(() => { setDay(null); return () => setDay(null) }, [id, setDay])

  // The 42-year NASA record downloads on first request: ask again until it is in (a few tries).
  const { reload } = place
  const historyLoading = place.data?.historyStatus === 'loading'
  const [tries, setTries] = useState(0)
  useEffect(() => {
    if (!historyLoading || tries >= 6) return
    const t = setTimeout(() => { setTries((n) => n + 1); reload() }, 5000)
    return () => clearTimeout(t)
  }, [historyLoading, tries, reload])

  // Keep showing the last report while a new look-ahead loads; only a different community blanks the panel.
  const data = place.data && (place.data.community.id === id || !place.loading) ? place.data : null
  const focus = useMemo(() => (data ? { id: data.community.id, name: data.community.name, lat: data.community.lat, lon: data.community.lon } : null), [data])
  const example = mode === 'sim'

  if (!data && place.error) {
    const missing = /unknown community/i.test(place.error)
    return <div className="mx-auto max-w-[640px] px-4 py-10 text-[17px]">
      <h1 className="text-[26px] font-semibold">{missing ? 'We couldn’t find that community.' : 'We couldn’t load this community right now.'}</h1>
      <p className="mt-2 text-mute">{missing ? 'The link may be old, or the name may be spelled differently.' : 'The fire risk service did not answer. It may be busy.'}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link to="/" className={btnPrimary}>Search for your community</Link>
        {!missing && <button type="button" onClick={reload} className={btnSecondary}>Try again</button>}
      </div>
    </div>
  }

  const body = (mapSlot: ReactNode = null) => data ? <div className="fade-in" key={data.community.id}>
    <StatusBlock place={data} />
    <LookAhead place={data} layout={wide ? 'cells' : 'list'} />
    <WhySigns place={data} />
    <WhatToDo place={data} count={2} />
    <FireAndSmoke place={data} example={example} />
    {mapSlot}
  </div> : <Skeleton />

  const map = focus ? <HeroMap focus={focus} /> : <div className="skeleton absolute inset-0 rounded-none" />

  // Phone (§3.4): one page scroll, the map below "Nearest fire and smoke", a sticky bar with the two actions.
  if (!wide) {
    return <div className="flex min-h-full flex-col">
      <div className="flex-1 px-4 pt-4 pb-6">
        {body(<div className="relative isolate mt-5 h-[220px] overflow-hidden rounded-md border border-line">{map}</div>)}
      </div>
      <nav aria-label="Get help" className="sticky bottom-0 z-[1100] grid grid-cols-2 gap-2 border-t border-line bg-white px-4 pt-2 pb-[max(8px,env(safe-area-inset-bottom))]">
        <Link to={`/c/${encodeURIComponent(id)}/help`} className={btnPrimary}>Ask for help</Link>
        <Link to={`/c/${encodeURIComponent(id)}/ask`} className={btnSecondary}>Ask a question</Link>
      </nav>
    </div>
  }

  // Tablet and desktop (§3.3): the panel scrolls inside itself with Ask for help pinned at its foot.
  return <div className="flex h-full min-h-0">
    <aside aria-label="Fire risk for this community" className="relative z-[1000] flex w-[440px] shrink-0 flex-col border-r border-line bg-white">
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-6 pt-4 pb-6">
        {body()}
        {/* 768–1023: no room for a third column, so the assistant follows the panel content. */}
        {!desk && data && <section className="mt-6 min-h-[420px] border-t border-line pt-2"><Assistant communityId={id} variant="column" /></section>}
      </div>
      <div className="shrink-0 border-t border-line bg-white px-6 pt-3 pb-4">
        <p className="text-[15px] leading-snug text-mute">{HELP_LINE}</p>
        <Link to={`/c/${encodeURIComponent(id)}/help`} className={`${btnPrimary} mt-2 w-full`}>Ask for help</Link>
      </div>
    </aside>

    <div className="relative isolate min-w-0 flex-1">
      <div className="absolute inset-0">{map}</div>
    </div>

    {desk && (assistantOpen
      ? <aside aria-label="Ask a question" className="relative flex w-[320px] shrink-0 flex-col border-l border-line bg-white xl:w-[360px]">
        <button type="button" onClick={() => setAssistantOpen(false)} aria-label="Hide the questions panel"
          className="absolute top-2 right-2 z-10 inline-flex min-h-9 items-center rounded-md bg-white px-2.5 text-[15px] text-action underline underline-offset-2 hover:text-action-deep">Hide</button>
        <div className="flex min-h-0 flex-1 flex-col">{data ? <Assistant communityId={id} variant="column" /> : null}</div>
      </aside>
      : <aside aria-label="Ask a question" className="flex w-12 shrink-0 border-l border-line bg-white">
        <button type="button" onClick={() => setAssistantOpen(true)} aria-label="Ask a question: show the questions panel"
          className="flex w-full items-center justify-center py-4 text-[15px] font-semibold text-action hover:bg-ink-800">
          <span className="rotate-180 whitespace-nowrap [writing-mode:vertical-rl]">Ask a question</span>
        </button>
      </aside>)}
  </div>
}

/** Loading: the panel's shape, so nothing jumps when the report arrives. */
function Skeleton() {
  return <div aria-busy="true" aria-label="Loading this community" className="space-y-3">
    <div className="skeleton h-4 w-28" />
    <div className="skeleton h-8 w-3/4" />
    <div className="skeleton h-4 w-24" />
    <div className="skeleton mt-6 h-20 w-full" />
    <div className="skeleton h-6 w-1/2" />
    <div className="skeleton mt-6 h-14 w-full" />
    <div className="skeleton mt-6 h-24 w-full" />
    <div className="skeleton mt-6 h-28 w-full" />
  </div>
}
