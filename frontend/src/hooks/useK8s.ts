import { useQuery } from '@tanstack/react-query'
import { getContexts, getResources, getResource, getResourceGraph } from '../services/api'
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

export function useResource(context: string, resourceType: K8sResourceType, name: string, namespace?: string) {
  return useQuery({
    queryKey: ['resource', context, resourceType, name, namespace],
    queryFn: () => getResource(context, resourceType, name, namespace),
    enabled: !!context && !!resourceType && !!name,
  })
}

export function useResourceGraph(context: string, resourceType: K8sResourceType, name: string, namespace?: string) {
  return useQuery({
    queryKey: ['resource-graph', context, resourceType, name, namespace],
    queryFn: () => getResourceGraph(context, resourceType, name, namespace),
    enabled: !!context && !!resourceType && !!name,
  })
}
