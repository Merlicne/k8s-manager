import { useState } from 'react'
import { Outlet, useNavigate, useMatch, NavLink } from 'react-router-dom'
import { Server, ChevronDown, Box, Layers, Database, Lock, Globe, FileText, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useContexts } from '../hooks/useK8s'
import { K8sResourceType } from '../types/k8s'

export function Layout() {
  const navigate = useNavigate()
  const match = useMatch('/:context/*')
  const context = match?.params.context
  const { data: contexts, isLoading: loadingContexts } = useContexts()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const handleContextChange = (newContext: string) => {
    if (newContext) {
      navigate(`/${newContext}`)
    } else {
      navigate('/')
    }
  }

  const resourceGroups = [
    {
      title: 'Workloads',
      icon: Box,
      resources: [
        K8sResourceType.Pod,
        K8sResourceType.Deployment,
        K8sResourceType.ReplicaSet,
        K8sResourceType.StatefulSet,
        K8sResourceType.DaemonSet,
        K8sResourceType.Job,
        K8sResourceType.CronJob,
      ]
    },
    {
      title: 'Network',
      icon: Globe,
      resources: [
        K8sResourceType.Service,
        K8sResourceType.Ingress,
      ]
    },
    {
      title: 'Storage',
      icon: Database,
      resources: [
        K8sResourceType.PersistentVolume,
        K8sResourceType.PersistentVolumeClaim,
      ]
    },
    {
      title: 'Config',
      icon: FileText,
      resources: [
        K8sResourceType.ConfigMap,
        K8sResourceType.Secret,
      ]
    },
    {
      title: 'Access',
      icon: Lock,
      resources: [
        K8sResourceType.ServiceAccount,
        K8sResourceType.Role,
        K8sResourceType.RoleBinding,
        K8sResourceType.ClusterRole,
        K8sResourceType.ClusterRoleBinding,
      ]
    },
    {
      title: 'Cluster',
      icon: Layers,
      resources: [
        K8sResourceType.Namespace,
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 flex flex-col">
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-stone-200 z-50 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {context && (
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-stone-100 rounded-lg text-stone-500 transition-colors"
              title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
            </button>
          )}
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

      <div className="flex flex-1 pt-16">
        {/* Sidebar */}
        {context && (
          <aside 
            className={`
              bg-white border-r border-stone-200 fixed bottom-0 top-16 overflow-y-auto transition-all duration-300 ease-in-out z-40
              ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full'}
            `}
          >
            <div className="p-4 space-y-6">
              {resourceGroups.map((group) => (
                <div key={group.title}>
                  <div className="flex items-center gap-2 px-2 mb-2 text-xs font-semibold text-stone-400 uppercase tracking-wider">
                    <group.icon className="w-3 h-3" />
                    {group.title}
                  </div>
                  <div className="space-y-0.5">
                    {group.resources.map((resource) => (
                      <NavLink
                        key={resource}
                        to={`/${context}/${resource}`}
                        className={({ isActive }) => `
                          block px-3 py-2 rounded-lg text-sm font-medium transition-colors
                          ${isActive 
                            ? 'bg-amber-50 text-amber-900' 
                            : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'}
                        `}
                      >
                        {resource}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Main Content Area */}
        <main 
          className={`
            flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full transition-all duration-300 ease-in-out
            ${context && isSidebarOpen ? 'md:ml-64' : ''}
          `}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
