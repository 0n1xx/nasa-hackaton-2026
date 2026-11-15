// The assistant as a full page on phones, /c/:id/ask (§3.8): the community's name and a way back at the
// top, the suggested questions, the thread, and the question box sticky at the bottom.
import { Link, useParams } from 'react-router-dom'
import Assistant from '../components/Assistant.tsx'
import { usePlace } from '../place.ts'

export default function AssistantPage() {
  const { id } = useParams()
  const communityId = id ?? null
  const place = usePlace(communityId)
  const name = place.data?.community.name ?? (place.loading ? 'Loading…' : 'Your community')
  const back = communityId ? `/c/${encodeURIComponent(communityId)}` : '/'
  return (
    <div className="mx-auto flex min-h-full w-full max-w-[640px] flex-col bg-ground">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-ink-950 px-4 py-3">
        <p className="min-w-0 truncate text-[17px] font-semibold text-fg">{name}</p>
        <Link to={back} className="inline-flex min-h-11 shrink-0 items-center rounded border border-edge px-4 text-[15px] font-semibold text-action hover:bg-ink-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action">
          Close
        </Link>
      </div>
      <div className="flex flex-1 flex-col">
        <Assistant communityId={communityId} variant="page" />
      </div>
    </div>
  )
}
