import { useQuery } from '@tanstack/react-query'
import { getContexts, getPods } from '../services/api'

export function useContexts() {
  return useQuery({
    queryKey: ['contexts'],
    queryFn: getContexts,
  })
}

export function usePods(context: string, refreshInterval: number = 5000) {
  return useQuery({
    queryKey: ['pods', context],
    queryFn: () => getPods(context),
    enabled: !!context,
    refetchInterval: refreshInterval,
  })
}
