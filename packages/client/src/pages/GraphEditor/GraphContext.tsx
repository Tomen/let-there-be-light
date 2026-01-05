import { createContext, useContext } from 'react'
import type { Group, Fixture, Input } from '@let-there-be-light/shared'

interface GraphContextValue {
  onParamChange: (nodeId: string, paramName: string, value: unknown) => void
  connectedInputs: Set<string>  // Format: "nodeId:inputName"
  // Data for inline param dropdowns
  groups: Group[]
  fixtures: Fixture[]
  faders: Input[]
  buttons: Input[]
}

export const GraphContext = createContext<GraphContextValue | null>(null)

export function useGraphContext() {
  const ctx = useContext(GraphContext)
  if (!ctx) throw new Error('useGraphContext must be used within GraphProvider')
  return ctx
}
