import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  RefreshCw, 
  Search, 
  ChevronDown,
  Box,
  FileText
} from 'lucide-react'
import { useResources } from '../../hooks/useK8s'
import { K8sResourceType } from '../../types/k8s'
import { PodsView } from './pods'

export function ResourcesPage() {
  const { context, resourceType } = useParams<{ context: string, resourceType: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [refreshInterval, setRefreshInterval] = useState(5000)

  // Validate resource type
  const type = resourceType as K8sResourceType;
  const isValidType = Object.values(K8sResourceType).includes(type);

  const { data: resources, isLoading, isRefetching } = useResources(
    context || '', 
    type, 
    refreshInterval
  )

  const filteredResources = useMemo(() => {
    if (!resources) return []
    return resources.filter(r => {
      const name = r.metadata?.name || '';
      const namespace = r.metadata?.namespace || '';
      return name.toLowerCase().includes(search.toLowerCase()) ||
             namespace.toLowerCase().includes(search.toLowerCase())
    })
  }, [resources, search])

  if (!isValidType) {
    return <div className="p-8 text-center text-red-500">Invalid resource type: {resourceType}</div>
  }

  if (type === K8sResourceType.Pod) {
    return <PodsView context={context || ''} />
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="bg-stone-100 p-2 rounded-lg">
          <Box className="w-6 h-6 text-stone-600" />
        </div>
        <h1 className="text-2xl font-bold text-stone-900">{type}s</h1>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-stone-900">Resources</h2>
            {isRefetching && <RefreshCw className="w-4 h-4 animate-spin text-amber-900" />}
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input 
              type="text"
              placeholder={`Search ${type}...`}
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

        {isLoading && !resources ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-900 mx-auto mb-4" />
            <p className="text-stone-500">Loading resources...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-stone-500 font-medium border-b border-stone-200">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Namespace</th>
                  <th className="px-6 py-4">Age</th>
                  <th className="px-6 py-4 w-10"></th>
                  {/* Add more dynamic columns based on type if needed */}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredResources.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-stone-500">
                      No resources found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredResources.map((resource) => (
                    <tr key={resource.metadata?.uid || resource.metadata?.name} className="hover:bg-stone-50/50 transition-colors group">
                      <td className="px-6 py-4 font-medium text-stone-900">{resource.metadata?.name}</td>
                      <td className="px-6 py-4 text-stone-500">
                        <span className="px-2 py-1 bg-stone-100 rounded text-xs font-medium text-stone-600">
                          {resource.metadata?.namespace || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-stone-500">
                        {resource.metadata?.creationTimestamp ? new Date(resource.metadata.creationTimestamp).toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => navigate(`${resource.metadata?.name}?namespace=${resource.metadata?.namespace || ''}`)}
                          className="p-2 text-stone-400 hover:text-amber-900 hover:bg-amber-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="View Definition"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </td>
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
