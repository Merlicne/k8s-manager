import { useQuery } from '@tanstack/react-query'
import { getContexts, getResources } from '../services/api'
import { K8sResourceType } from '../types/k8s'

export function useContexts() {
  return useQuery({
    queryKey: ['contexts'],
    queryFn: getContexts,
  })
}

export function useResources(context: string, resourceType: K8sResourceType, refreshInterval: number = 5000) {
  return useQuery({
    queryKey: ['resources', context, resourceType],
    queryFn: () => getResources(context, resourceType),
    enabled: !!context && !!resourceType,
    refetchInterval: refreshInterval,
  })
}
