// STUB (to be built): Ask for help, /c/:id/help. See docs/design/critique-and-direction.md §3.5 and §3.6.
import { useParams } from 'react-router-dom'
export default function AskForHelp() {
  const { id } = useParams()
  return <div className="text-[17px]">Ask for help for {id}</div>
}
