import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LocateFixed, Search } from 'lucide-react'
import type { Envelope } from '../../shared/types.ts'
import type { CommunityHit } from '../place.ts'
import { useApp } from '../state.tsx'
import { placeName } from './ui.tsx'

/** The part of GET /api/places/levels this needs (server/ranked.ts PlaceLevels). */
interface PlaceLevels { places: { id: string; lat: number; lon: number }[] }

/** Further than this from every community we know, "Use my location" asks the person to search instead. */
const NEAR_KM = 300
const DEBOUNCE_MS = 180

function km(aLat: number, aLon: number, bLat: number, bLon: number) {
  const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

/**
 * Find your community: a search box (ARIA combobox with a listbox of matches) and "Use my location".
 * Both open the community view at /c/:id.
 */
export default function FindCommunity() {
  const nav = useNavigate()
  const { mode, horizon } = useApp()
  const uid = useId()
  const inputId = `${uid}-q`, listId = `${uid}-list`, optId = (i: number) => `${uid}-opt-${i}`
  const inputRef = useRef<HTMLInputElement>(null)

  const [q, setQ] = useState('')
  /** Matches and the query they answer; null until a search has come back. */
  const [result, setResult] = useState<{ term: string; hits: CommunityHit[] } | null>(null)
  const [searchError, setSearchError] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  const term = q.trim()
  useEffect(() => {
    if (!term) { setResult(null); setSearchError(false); setActive(-1); return }
    const ctrl = new AbortController()
    const t = window.setTimeout(() => {
      fetch(`/api/communities/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((b: Envelope<CommunityHit[]>) => { setResult({ term, hits: b.data ?? [] }); setSearchError(false); setActive(-1) })
        .catch((e) => { if (e?.name !== 'AbortError') { setResult(null); setSearchError(true) } })
    }, DEBOUNCE_MS)
    return () => { window.clearTimeout(t); ctrl.abort() }
  }, [term])

  // While the next search runs, keep the last matches on screen (no blink, no jump). Enter without a highlighted
  // row opens the first match only when the matches belong to what is in the box now.
  const fresh = !!result && result.term === term
  const hits = term && result ? result.hits : null
  const showList = open && !!hits && hits.length > 0
  const showEmpty = open && fresh && result!.hits.length === 0

  useEffect(() => {
    if (active >= 0) document.getElementById(optId(active))?.scrollIntoView({ block: 'nearest' })
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (h: CommunityHit) => { setOpen(false); nav(`/c/${encodeURIComponent(h.id)}`) }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setOpen(true)
      if (hits?.length) setActive((a) => Math.min(a + 1, hits.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (hits?.length) setActive((a) => Math.max(a - 1, -1))
    } else if (e.key === 'Enter') {
      if (hits?.length && active >= 0 && showList) { e.preventDefault(); go(hits[active]) }
      else if (fresh && result!.hits.length) { e.preventDefault(); go(result!.hits[0]) }
    } else if (e.key === 'Escape') {
      if (open && (showList || showEmpty)) { e.preventDefault(); setOpen(false); setActive(-1) } else if (q) { e.preventDefault(); setQ('') }
    }
  }

  // ---- Use my location ----
  const [locating, setLocating] = useState(false)
  const [locMsg, setLocMsg] = useState<string | null>(null)
  const locate = () => {
    setLocMsg(null)
    if (!('geolocation' in navigator)) { setLocMsg('This browser cannot share your location. Try searching by name.'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        // Same mode and look-ahead as the list, so it reads the same server cache.
        const res = await fetch(`/api/places/levels?mode=${mode}&days=${horizon}`)
        if (!res.ok) throw new Error(String(res.status))
        const { data } = (await res.json()) as Envelope<PlaceLevels>
        const { latitude: lat, longitude: lon } = pos.coords
        let best: { id: string; d: number } | null = null
        for (const p of data.places) { const d = km(lat, lon, p.lat, p.lon); if (!best || d < best.d) best = { id: p.id, d } }
        if (!best || best.d > NEAR_KM) { setLocMsg('We could not find a community near you. Try searching by name.'); return }
        nav(`/c/${encodeURIComponent(best.id)}`)
      } catch {
        setLocMsg('Could not load the list of communities. Try again.')
      } finally {
        setLocating(false)
      }
    }, (err) => {
      setLocating(false)
      setLocMsg(err.code === err.PERMISSION_DENIED
        ? 'Your location is turned off for this site. You can search by name instead.'
        : 'We could not find where you are. Try searching by name.')
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 })
  }

  const status = showEmpty ? 'No community found. Try another spelling or a nearby town.'
    : showList ? `${hits!.length} ${hits!.length === 1 ? 'community' : 'communities'} found. Use the up and down arrows to choose.` : ''

  return <div>
    <label htmlFor={inputId} className="sr-only">Search for a First Nation or nearby town</label>
    <div className="relative">
      <input ref={inputRef} id={inputId} type="text" value={q}
        role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? optId(active) : undefined}
        autoComplete="off" spellCheck={false} enterKeyHint="search"
        placeholder="First Nation or nearby town"
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1) }}
        // No close on blur: the list sits in the page flow, so collapsing it on mousedown would move the
        // button under the pointer before the click lands. It closes on Esc, on a choice, or when emptied.
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        className="h-12 w-full rounded-md border border-edge bg-white pr-11 pl-3.5 text-[17px] text-fg placeholder:text-dim focus:border-fg focus:outline-2 focus:outline-offset-0 focus:outline-fg" />
      <Search aria-hidden size={20} strokeWidth={2} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-fg" />
    </div>

    <ul id={listId} role="listbox" aria-label="Matching communities" hidden={!showList}
      className="mt-1.5 overflow-hidden rounded-md border border-line bg-white">
      {showList && hits!.map((h, i) => <li key={h.id} id={optId(i)} role="option" aria-selected={i === active}
        onMouseDown={(e) => e.preventDefault()} onClick={() => go(h)} onMouseMove={() => active !== i && setActive(i)}
        className={`cursor-pointer border-t border-line px-3.5 py-2.5 first:border-t-0 ${i === active ? 'bg-ink-800' : 'bg-white'}`}>
        <span className="block text-[17px] leading-snug text-fg">{h.name}</span>
        <span className="block text-[15px] leading-snug text-mute">{placeName(h.province)}</span>
      </li>)}
    </ul>
    {showEmpty && <p className="mt-2 text-[17px] text-fg">No community found. Try another spelling or a nearby town.</p>}
    {searchError && open && term && <p className="mt-2 text-[17px] text-fg">Search is not working right now. Try again in a moment.</p>}
    <div role="status" aria-live="polite" className="sr-only">{status}</div>

    <button type="button" onClick={locate} disabled={locating}
      className="mt-3 inline-flex h-11 items-center gap-2 rounded-md border border-edge bg-white px-4 text-[17px] font-semibold text-fg hover:bg-ink-850 disabled:cursor-wait disabled:text-mute">
      <LocateFixed aria-hidden size={20} strokeWidth={2} />
      {locating ? 'Finding where you are…' : 'Use my location'}
    </button>
    {locMsg && <p role="alert" className="mt-2 text-[17px] text-fg">{locMsg}</p>}
  </div>
}
