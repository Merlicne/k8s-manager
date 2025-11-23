import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, RefreshCw, Server } from 'lucide-react'
import { useContexts } from '../hooks/useK8s'

export function LandingPage() {
  const navigate = useNavigate()
  const { data: contexts, isLoading: loadingContexts } = useContexts()

  return (
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
              onClick={() => navigate(`/${ctx}`)}
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
  )
}
