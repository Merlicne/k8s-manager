import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  getContexts, 
  getResources, 
  getResource, 
  getResourceGraph,
  listPortForwards,
  startPortForward,
  stopPortForward,
} from '../services/api'
import type { PortForwardRequest } from '../services/api'
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

export function usePortForwards() {
  return useQuery({
    queryKey: ['port-forwards'],
    queryFn: listPortForwards,
    refetchInterval: 5000,
  })
}

export function usePortForwardMutations() {
  const queryClient = useQueryClient()

  const startMutation = useMutation({
    mutationFn: (data: PortForwardRequest) => startPortForward(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['port-forwards'] })
    },
  })

  const stopMutation = useMutation({
    mutationFn: (localPort: number) => stopPortForward(localPort),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['port-forwards'] })
    },
  })

  return { startMutation, stopMutation }
}
