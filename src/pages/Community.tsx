// STUB (to be built): the community view, /c/:id. See docs/design/critique-and-direction.md §3.3 and §3.4.
import { useParams } from 'react-router-dom'
export default function Community() {
  const { id } = useParams()
  return <div className="p-8 text-[17px]">Community {id}</div>
}
