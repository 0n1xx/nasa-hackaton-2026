// STUB (to be built): the assistant as a full page on phones, /c/:id/ask (§3.8).
import { useParams } from 'react-router-dom'
import Assistant from '../components/Assistant.tsx'
export default function AssistantPage() {
  const { id } = useParams()
  return <div className="mx-auto h-full max-w-[640px]"><Assistant communityId={id ?? null} variant="page" /></div>
}
