import { Outlet, useNavigate, useMatch } from 'react-router-dom'
import { Server, ChevronDown } from 'lucide-react'
import { useContexts } from '../hooks/useK8s'

export function Layout() {
  const navigate = useNavigate()
  const match = useMatch('/:context/*')
  const context = match?.params.context
  const { data: contexts, isLoading: loadingContexts } = useContexts()

  const handleContextChange = (newContext: string) => {
    if (newContext) {
      navigate(`/${newContext}/pods`)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900">
      {/* Sidebar / Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-stone-200 z-50 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div 
          className="flex items-center gap-3 cursor-pointer" 
          onClick={() => navigate('/')}
        >
          <div className="bg-stone-800 p-2 rounded-lg">
            <Server className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-stone-700 to-amber-900">
            K8s Manager
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <select 
              className="appearance-none pl-4 pr-10 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-900/20 focus:border-amber-900 transition-all cursor-pointer min-w-[200px]"
              value={context || ''}
              onChange={(e) => handleContextChange(e.target.value)}
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
        <Outlet />
      </main>
    </div>
  )
}
