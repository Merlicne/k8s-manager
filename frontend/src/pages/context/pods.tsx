import { useState, useMemo } from 'react'
import { 
  RefreshCw, 
  Box, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  Search,
  ChevronDown
} from 'lucide-react'
import { useResources } from '../../hooks/useK8s'
import { StatCard } from '../../components/StatCard'
import { StatusBadge } from '../../components/StatusBadge'
import { K8sResourceType, type Pod } from '../../types/k8s'

interface PodsViewProps {
  context: string;
}

export function PodsView({ context }: PodsViewProps) {
  const [search, setSearch] = useState('')
  const [refreshInterval, setRefreshInterval] = useState(5000)

  const { data: resources, isLoading: loadingPods, isRefetching } = useResources(context, K8sResourceType.Pod, refreshInterval)
  
  // Transform raw resources to Pod interface
  const pods = useMemo(() => {
    if (!resources) return [] as Pod[];
    return resources.map((r: any) => ({
      name: r.metadata?.name || '',
      namespace: r.metadata?.namespace || '',
      status: r.status?.phase || 'Unknown',
      node: r.spec?.nodeName || ''
    }))
  }, [resources])

  const stats = useMemo(() => {
    if (!pods.length) return { total: 0, running: 0, pending: 0, failed: 0 }
    return {
      total: pods.length,
      running: pods.filter(p => p.status === 'Running').length,
      pending: pods.filter(p => p.status === 'Pending').length,
      failed: pods.filter(p => !['Running', 'Pending', 'Succeeded'].includes(p.status)).length
    }
  }, [pods])

  const filteredPods = useMemo(() => {
    if (!pods.length) return []
    return pods.filter(pod => 
      pod.name.toLowerCase().includes(search.toLowerCase()) ||
      pod.namespace.toLowerCase().includes(search.toLowerCase())
    )
  }, [pods, search])

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Pods" 
          value={stats.total} 
          icon={Box} 
          color="bg-stone-100 text-stone-700" 
        />
        <StatCard 
          title="Running" 
          value={stats.running} 
          icon={CheckCircle2} 
          color="bg-emerald-100 text-emerald-700" 
          subtext={`${Math.round((stats.running / stats.total) * 100 || 0)}% healthy`}
        />
        <StatCard 
          title="Pending" 
          value={stats.pending} 
          icon={Clock} 
          color="bg-amber-100 text-amber-700" 
        />
        <StatCard 
          title="Issues" 
          value={stats.failed} 
          icon={AlertCircle} 
          color="bg-red-100 text-red-700" 
          subtext="Requires attention"
        />
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-stone-900">Workloads</h2>
            {isRefetching && <RefreshCw className="w-4 h-4 animate-spin text-amber-900" />}
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input 
              type="text"
              placeholder="Search pods..."
              className="pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-900/20 focus:border-amber-900 w-full sm:w-64 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="relative">
            <select
              className="appearance-none pl-3 pr-8 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-900/20 focus:border-amber-900 transition-all cursor-pointer"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
            >
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
              <option value={30000}>30s</option>
              <option value={60000}>1m</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          </div>
        </div>

        {loadingPods && !pods.length ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-900 mx-auto mb-4" />
            <p className="text-stone-500">Loading cluster resources...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-stone-500 font-medium border-b border-stone-200">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Namespace</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Node</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredPods.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-stone-500">
                      No pods found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredPods.map((pod) => (
                    <tr key={pod.namespace + pod.name} className="hover:bg-stone-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-stone-900">{pod.name}</td>
                      <td className="px-6 py-4 text-stone-500">
                        <span className="px-2 py-1 bg-stone-100 rounded text-xs font-medium text-stone-600">
                          {pod.namespace}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={pod.status} />
                      </td>
                      <td className="px-6 py-4 text-stone-500 font-mono text-xs">{pod.node || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
