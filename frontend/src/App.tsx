import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getContexts, getPods } from './api'
import { 
  RefreshCw, 
  Server, 
  Box, 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  Search,
  LayoutDashboard,
  ChevronDown
} from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function StatCard({ title, value, icon: Icon, color, subtext }: { title: string, value: number | string, icon: any, color: string, subtext?: string }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-stone-500">{title}</p>
          <h3 className="text-2xl font-bold text-stone-900 mt-1">{value}</h3>
          {subtext && <p className="text-xs text-stone-400 mt-1">{subtext}</p>}
        </div>
        <div className={cn("p-3 rounded-lg bg-opacity-10", color)}>
          <Icon className={cn("w-6 h-6", color.replace('bg-', 'text-'))} />
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles = useMemo(() => {
    switch (status) {
      case 'Running':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200'
      case 'Pending':
        return 'bg-amber-50 text-amber-800 border-amber-200'
      case 'Failed':
      case 'CrashLoopBackOff':
      case 'ErrImagePull':
        return 'bg-red-50 text-red-800 border-red-200'
      default:
        return 'bg-stone-50 text-stone-700 border-stone-200'
    }
  }, [status])

  const Icon = useMemo(() => {
    switch (status) {
      case 'Running': return CheckCircle2
      case 'Pending': return Clock
      case 'Failed': return AlertCircle
      default: return Activity
    }
  }, [status])

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", styles)}>
      <Icon className="w-3.5 h-3.5" />
      {status}
    </span>
  )
}

function App() {
  const [selectedContext, setSelectedContext] = useState<string>('')
  const [search, setSearch] = useState('')

  const { data: contexts, isLoading: loadingContexts } = useQuery({
    queryKey: ['contexts'],
    queryFn: getContexts,
  })

  const { data: pods, isLoading: loadingPods, isRefetching } = useQuery({
    queryKey: ['pods', selectedContext],
    queryFn: () => getPods(selectedContext),
    enabled: !!selectedContext,
    refetchInterval: 5000,
  })

  const stats = useMemo(() => {
    if (!pods) return { total: 0, running: 0, pending: 0, failed: 0 }
    return {
      total: pods.length,
      running: pods.filter(p => p.status === 'Running').length,
      pending: pods.filter(p => p.status === 'Pending').length,
      failed: pods.filter(p => !['Running', 'Pending', 'Succeeded'].includes(p.status)).length
    }
  }, [pods])

  const filteredPods = useMemo(() => {
    if (!pods) return []
    return pods.filter(pod => 
      pod.name.toLowerCase().includes(search.toLowerCase()) ||
      pod.namespace.toLowerCase().includes(search.toLowerCase())
    )
  }, [pods, search])

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900">
      {/* Sidebar / Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-stone-200 z-50 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-stone-800 p-2 rounded-lg">
            <Server className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-stone-700 to-amber-900">
            K8s Manager
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <select 
              className="appearance-none pl-4 pr-10 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-900/20 focus:border-amber-900 transition-all cursor-pointer min-w-[200px]"
              value={selectedContext}
              onChange={(e) => setSelectedContext(e.target.value)}
              disabled={loadingContexts}
            >
              <option value="">{loadingContexts ? 'Loading contexts...' : 'Select Cluster Context'}</option>
              {contexts?.map(ctx => (
                <option key={ctx} value={ctx}>{ctx}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {!selectedContext ? (
          <div className="max-w-5xl mx-auto mt-8">
            <div className="text-center mb-12">
              <div className="w-20 h-20 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3">
                <LayoutDashboard className="w-10 h-10 text-stone-400" />
              </div>
              <h2 className="text-3xl font-bold text-stone-900 mb-3">Welcome to K8s Manager</h2>
              <p className="text-stone-500 max-w-lg mx-auto text-lg">
                Select a Kubernetes cluster context to get started managing your workloads.
              </p>
            </div>

            {loadingContexts ? (
              <div className="flex justify-center p-12">
                <RefreshCw className="w-8 h-8 animate-spin text-amber-900" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {contexts?.map(ctx => (
                  <button
                    key={ctx}
                    onClick={() => setSelectedContext(ctx)}
                    className="flex items-center gap-4 p-5 bg-white border border-stone-200 rounded-xl hover:border-amber-500 hover:shadow-md hover:-translate-y-0.5 transition-all text-left group"
                  >
                    <div className="p-3 bg-stone-50 rounded-lg group-hover:bg-amber-50 transition-colors border border-stone-100 group-hover:border-amber-100">
                      <Server className="w-6 h-6 text-stone-400 group-hover:text-amber-700 transition-colors" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-stone-900 group-hover:text-amber-900 transition-colors">{ctx}</h3>
                      <p className="text-xs text-stone-400 mt-0.5">Click to connect</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
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
              </div>

              {loadingPods && !pods ? (
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
        )}
      </main>
    </div>
  )
}

export default App
