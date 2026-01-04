import { useShows, useCurrentShow, useActivateShow } from '@/api/shows'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FolderOpen } from 'lucide-react'

export function ShowSelector() {
  const { data: shows = [] } = useShows()
  const { data: current } = useCurrentShow()
  const activate = useActivateShow()

  const handleValueChange = (value: string) => {
    if (value !== current?.show) {
      activate.mutate(value)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <FolderOpen className="h-4 w-4 text-muted-foreground" />
      <Select
        value={current?.show}
        onValueChange={handleValueChange}
        disabled={activate.isPending}
      >
        <SelectTrigger className="w-[160px] h-8 text-sm">
          <SelectValue placeholder="Select show" />
        </SelectTrigger>
        <SelectContent>
          {shows.map((show) => (
            <SelectItem key={show.id} value={show.id}>
              {show.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
