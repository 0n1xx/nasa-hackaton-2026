import { useEffect, useRef, useState } from 'react'

// Phones show the map as a small still preview inside the page scroll; tapping it opens the map full screen
// (Home and the community view). One place for that behaviour: Esc closes it, focus moves to "Close map" and
// back, it closes itself if the window grows to the side-by-side layout, and Leaflet is told to re-measure.

const SIDE_BY_SIDE = '(min-width: 768px)'

export function useMapSheet() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Leaflet only re-measures on window resize; nudge it when the map container changes size.
    window.dispatchEvent(new Event('resize'))
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const mq = window.matchMedia(SIDE_BY_SIDE)
    const onWide = () => { if (mq.matches) setOpen(false) }
    window.addEventListener('keydown', onKey)
    mq.addEventListener('change', onWide)
    return () => { window.removeEventListener('keydown', onKey); mq.removeEventListener('change', onWide) }
  }, [open])

  /** Spread on the map's container: while open it is a modal dialog. */
  const sheetProps = open ? { role: 'dialog', 'aria-modal': true, 'aria-label': 'Map' } as const : {}
  return { open, setOpen, sheetProps }
}

/** The cover over the preview ("Open the map") or, when open, the "Close map" button. Phone layouts only. */
export function MapSheetButton({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const closeBtn = useRef<HTMLButtonElement>(null)
  const openBtn = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open) closeBtn.current?.focus()
    else if (wasOpen.current) openBtn.current?.focus({ preventScroll: true })
    wasOpen.current = open
  }, [open])

  return open
    ? <button ref={closeBtn} type="button" onClick={() => setOpen(false)}
      className="absolute top-[max(12px,env(safe-area-inset-top))] right-[max(12px,env(safe-area-inset-right))] z-[1001] h-11 rounded-md border border-edge bg-white px-4 text-[17px] font-semibold text-fg shadow-sm md:hidden">
      Close map
    </button>
    // A cover over the map so a swipe scrolls the page instead of panning the map.
    : <button ref={openBtn} type="button" onClick={() => setOpen(true)} aria-label="Open the map full screen"
      className="absolute inset-0 z-[1001] flex items-end justify-center pb-3 md:hidden">
      <span className="rounded-md border border-edge bg-white px-3 py-1.5 text-[15px] font-semibold text-fg shadow-sm">Open the map</span>
    </button>
}
