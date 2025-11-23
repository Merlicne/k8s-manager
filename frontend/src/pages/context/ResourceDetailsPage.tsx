import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Check, FileJson, FileCode } from 'lucide-react'
import yaml from 'js-yaml'
import hljs from 'highlight.js'
import 'highlight.js/styles/atom-one-dark.css'
import { useResource } from '../../hooks/useK8s'
import { K8sResourceType } from '../../types/k8s'

export function ResourceDetailsPage() {
  const { context, resourceType, name } = useParams<{ context: string, resourceType: string, name: string }>()
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<'yaml' | 'json'>('yaml')
  const [copied, setCopied] = useState(false)
  const codeRef = useRef<HTMLElement>(null)

  // We need to get the namespace from the query params or state if possible, 
  // but for now let's assume we might need to fetch it or it's passed in state.
  // Since the URL structure is /:context/:resourceType/:name, we don't have namespace in URL.
  // However, the backend get_resource handles namespace as an optional query param.
  // If we don't provide it, it searches all namespaces or assumes default depending on backend logic.
  // But wait, the backend logic for `get_resource` uses `Api::namespaced_with` if namespace is provided,
  // or `Api::all_with` if not. `Api::all_with(...).get(name)` might fail if there are duplicates across namespaces?
  // Actually `Api::all_with` returns a resource that can list all. It doesn't support `get` directly usually unless it's cluster scoped.
  // If it's namespaced, we MUST provide a namespace to `get` a specific item usually, or we have to list and filter.
  // Let's check the backend implementation again.
  
  // Backend: 
  // let api: Api<kube::api::DynamicObject> = if let Some(ns) = namespace {
  //     Api::namespaced_with(client, &ns, &api_resource)
  // } else {
  //     Api::all_with(client, &api_resource)
  // };
  // let resource = api.get(name).await...
  
  // `Api::all_with` creates a client for all namespaces. `get` on that client MIGHT work if the resource is cluster scoped.
  // If it's namespaced, `get` on a cluster-scoped client usually fails or is invalid for namespaced resources.
  // We should probably pass the namespace in the URL or query state.
  // For this implementation, let's assume we can get the namespace from the location state if we navigated from the list.
  
  const namespace = new URLSearchParams(window.location.search).get('namespace') || undefined;

  const { data: resource, isLoading, error } = useResource(
    context || '', 
    resourceType as K8sResourceType, 
    name || '', 
    namespace
  )

  const content = resource ? (
    viewMode === 'yaml' 
      ? yaml.dump(resource) 
      : JSON.stringify(resource, null, 2)
  ) : ''

  useEffect(() => {
    if (codeRef.current && content) {
      codeRef.current.removeAttribute('data-highlighted');
      hljs.highlightElement(codeRef.current);
    }
  }, [content, viewMode]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return <div className="p-8 text-center text-stone-500">Loading resource definition...</div>
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-500 mb-4">Failed to load resource</div>
        <button 
          onClick={() => navigate(-1)}
          className="text-amber-900 hover:underline"
        >
          Go back
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-stone-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-stone-900">{name}</h1>
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <span className="px-2 py-0.5 bg-stone-100 rounded text-xs font-medium">
                {resourceType}
              </span>
              {resource?.metadata?.namespace && (
                <span className="px-2 py-0.5 bg-stone-100 rounded text-xs font-medium">
                  {resource.metadata.namespace}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-stone-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('yaml')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                viewMode === 'yaml' 
                  ? 'bg-white text-stone-900 shadow-sm' 
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              <FileCode className="w-4 h-4" />
              YAML
            </button>
            <button
              onClick={() => setViewMode('json')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                viewMode === 'json' 
                  ? 'bg-white text-stone-900 shadow-sm' 
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              <FileJson className="w-4 h-4" />
              JSON
            </button>
          </div>
          
          <button
            onClick={handleCopy}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-500 hover:text-stone-900"
            title="Copy to clipboard"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="flex-1 bg-[#282c34] rounded-xl overflow-hidden border border-stone-800 shadow-inner">
        <pre className="h-full overflow-auto p-6 text-sm font-mono leading-relaxed">
          <code ref={codeRef} className={`language-${viewMode}`}>
            {content}
          </code>
        </pre>
      </div>
    </div>
  )
}
