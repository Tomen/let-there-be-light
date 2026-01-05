import { createContext, useContext } from 'react'

interface GraphContextValue {
  onParamChange: (nodeId: string, paramName: string, value: unknown) => void
  connectedInputs: Set<string>  // Format: "nodeId:inputName"
}

export const GraphContext = createContext<GraphContextValue | null>(null)

export function useGraphContext() {
  const ctx = useContext(GraphContext)
  if (!ctx) throw new Error('useGraphContext must be used within GraphProvider')
  return ctx
}
