import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Check, FileJson, FileCode, LayoutDashboard, FileText, Tag, Network, Plug, X, Play, Square, ScrollText } from 'lucide-react'
import yaml from 'js-yaml'
import hljs from 'highlight.js'
import 'highlight.js/styles/stackoverflow-dark.css'
import ReactFlow, { 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState,
  MarkerType,
} from 'reactflow'
import type { Node, Edge } from 'reactflow'
import 'reactflow/dist/style.css'
import dagre from 'dagre'

import { useResource, useResourceGraph, usePortForwards, usePortForwardMutations, usePodLogs } from '../../hooks/useK8s'
import { K8sResourceType } from '../../types/k8s'

// Layout helper
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 180;
  const nodeHeight = 70;

  dagreGraph.setGraph({ rankdir: 'TB' });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

const getEdgeColor = (label: string) => {
  switch (label) {
    case 'selects': return '#059669'; // Emerald 600
    case 'uses': return '#2563eb';    // Blue 600
    case 'bound': return '#7c3aed';   // Violet 600
    case 'manages': return '#0891b2'; // Cyan 600
    case 'owner':
    default: return '#9ca3af';        // Gray 400
  }
};

export function ResourceDetailsPage() {
  const { context, resourceType, name } = useParams<{ context: string, resourceType: string, name: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'overview' | 'definition' | 'graph' | 'logs'>('overview')
  const [viewMode, setViewMode] = useState<'yaml' | 'json'>('yaml')
  const [copied, setCopied] = useState(false)
  const codeRef = useRef<HTMLElement>(null)

  const [showPortForwardModal, setShowPortForwardModal] = useState(false)
  const [selectedPort, setSelectedPort] = useState<number | null>(null)
  const [localPort, setLocalPort] = useState<string>('')
  
  const { data: portForwards } = usePortForwards()
  const { startMutation, stopMutation } = usePortForwardMutations()

  const namespace = new URLSearchParams(window.location.search).get('namespace') || undefined;

  const { data: resource, isLoading, error } = useResource(
    context || '', 
    resourceType as K8sResourceType, 
    name || '', 
    namespace
  )

  const { data: logs, isLoading: isLogsLoading, error: logsError } = usePodLogs(
    context || '',
    name || '',
    namespace,
    activeTab === 'logs' && resourceType === K8sResourceType.Pod
  )

  const { data: graphData, isLoading: isGraphLoading } = useResourceGraph(
    context || '',
    resourceType as K8sResourceType,
    name || '',
    namespace
  )

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (graphData && activeTab === 'graph') {
      const initialNodes: Node[] = graphData.nodes.map((node: any) => ({
        id: node.id,
        data: { 
          label: (
            <div className="flex flex-col items-center">
              <span className="font-medium text-stone-900 truncate w-full" title={node.label}>
                {node.label}
              </span>
              <span className="text-[6px] text-stone-400 uppercase tracking-widest mt-1 font-semibold">
                {node.resource_type}
              </span>
            </div>
          ),
          originalLabel: node.label,
          resourceType: node.resource_type,
          namespace: node.data?.metadata?.namespace
        },
        position: { x: 0, y: 0 }, // Layout will fix this
        style: { 
          background: node.id === resource?.metadata?.uid ? '#fffbeb' : '#fff',
          border: node.id === resource?.metadata?.uid ? '2px solid #d97706' : '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '8px',
          width: 180,
          fontSize: '12px',
          textAlign: 'center',
          cursor: 'pointer',
        },
      }));

      const initialEdges: Edge[] = graphData.edges.map((edge: any) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: 'smoothstep',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: getEdgeColor(edge.label),
        },
        style: { 
          stroke: getEdgeColor(edge.label),
          strokeWidth: 2,
        },
        labelStyle: { 
          fill: getEdgeColor(edge.label), 
          fontSize: 10,
          fontWeight: 500
        },
      }));

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges);
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    }
  }, [graphData, activeTab, resource]);

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    const { resourceType: type, originalLabel: label, namespace: ns } = node.data;
    if (type && label) {
      const url = `/${context}/${type}/${encodeURIComponent(label)}${ns ? `?namespace=${ns}` : ''}`;
      navigate(url);
    }
  };

  const content = resource ? (
    viewMode === 'yaml' 
      ? yaml.dump(resource) 
      : JSON.stringify(resource, null, 2)
  ) : ''

  useEffect(() => {
    if (activeTab === 'definition' && codeRef.current && content) {
      codeRef.current.removeAttribute('data-highlighted');
      hljs.highlightElement(codeRef.current);
    }
  }, [content, viewMode, activeTab]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleStartPortForward = () => {
    if (!selectedPort || !localPort || !context || !name) return
    
    startMutation.mutate({
      context,
      namespace: metadata.namespace || 'default',
      service_name: name,
      service_port: selectedPort,
      local_port: parseInt(localPort)
    }, {
      onSuccess: () => {
        setShowPortForwardModal(false)
        setLocalPort('')
        setSelectedPort(null)
      }
    })
  }

  if (isLoading) {
    return <div className="p-8 text-center text-stone-500">Loading resource details...</div>
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

  const metadata = resource?.metadata || {}

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 shrink-0">
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
            {metadata.namespace && (
              <span className="px-2 py-0.5 bg-stone-100 rounded text-xs font-medium">
                {metadata.namespace}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-stone-200 shrink-0">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`
              flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'overview'
                ? 'border-amber-900 text-amber-900'
                : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'}
            `}
          >
            <LayoutDashboard className="w-4 h-4" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('definition')}
            className={`
              flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'definition'
                ? 'border-amber-900 text-amber-900'
                : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'}
            `}
          >
            <FileText className="w-4 h-4" />
            Definition
          </button>
          <button
            onClick={() => setActiveTab('graph')}
            className={`
              flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'graph'
                ? 'border-amber-900 text-amber-900'
                : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'}
            `}
          >
            <Network className="w-4 h-4" />
            Graph
          </button>
          {resourceType === K8sResourceType.Pod && (
            <button
              onClick={() => setActiveTab('logs')}
              className={`
                flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === 'logs'
                  ? 'border-amber-900 text-amber-900'
                  : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'}
              `}
            >
              <ScrollText className="w-4 h-4" />
              Logs
            </button>
          )}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {activeTab === 'overview' && (
          <div className="overflow-y-auto p-1 space-y-6">
            {/* Metadata Section */}
            <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5 text-stone-400" />
                Metadata
              </h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                <div>
                  <dt className="text-sm font-medium text-stone-500">Name</dt>
                  <dd className="mt-1 text-sm text-stone-900">{metadata.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-stone-500">Namespace</dt>
                  <dd className="mt-1 text-sm text-stone-900">{metadata.namespace || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-stone-500">UID</dt>
                  <dd className="mt-1 text-sm text-stone-900 font-mono">{metadata.uid}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-stone-500">Created At</dt>
                  <dd className="mt-1 text-sm text-stone-900">
                    {metadata.creationTimestamp ? new Date(metadata.creationTimestamp).toLocaleString() : '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-stone-500">Resource Version</dt>
                  <dd className="mt-1 text-sm text-stone-900 font-mono">{metadata.resourceVersion}</dd>
                </div>
              </dl>
            </div>

            {/* Service Ports */}
            {resourceType === K8sResourceType.Service && resource?.spec?.ports && (
              <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
                  <Plug className="w-5 h-5 text-stone-400" />
                  Service Ports
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-stone-50 text-stone-500 font-medium border-b border-stone-200">
                      <tr>
                        <th className="px-4 py-2">Name</th>
                        <th className="px-4 py-2">Port</th>
                        <th className="px-4 py-2">Protocol</th>
                        <th className="px-4 py-2">Target Port</th>
                        <th className="px-4 py-2">Node Port</th>
                        <th className="px-4 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {resource.spec.ports.map((port: any, i: number) => {
                        const activeForward = portForwards?.find(pf => 
                          pf.context === context && 
                          pf.namespace === (metadata.namespace || 'default') && 
                          pf.service_name === name && 
                          pf.service_port === port.port
                        );

                        return (
                          <tr key={i} className="hover:bg-stone-50/50">
                            <td className="px-4 py-2 font-medium text-stone-900">{port.name || '-'}</td>
                            <td className="px-4 py-2">{port.port}</td>
                            <td className="px-4 py-2">{port.protocol}</td>
                            <td className="px-4 py-2">{port.targetPort}</td>
                            <td className="px-4 py-2">{port.nodePort || '-'}</td>
                            <td className="px-4 py-2">
                              {activeForward ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-200">
                                    localhost:{activeForward.local_port}
                                  </span>
                                  <button
                                    onClick={() => stopMutation.mutate(activeForward.local_port)}
                                    className="p-1 text-stone-400 hover:text-red-600 transition-colors"
                                    title="Stop forwarding"
                                  >
                                    <Square className="w-4 h-4 fill-current" />
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  className="flex items-center gap-1 text-amber-700 hover:text-amber-900 font-medium text-xs border border-amber-200 bg-amber-50 px-2 py-1 rounded hover:bg-amber-100 transition-colors"
                                  onClick={() => {
                                    setSelectedPort(port.port);
                                    setLocalPort(port.port.toString());
                                    setShowPortForwardModal(true);
                                  }}
                                  title="Forward port"
                                >
                                  <Play className="w-3 h-3 fill-current" />
                                  Forward
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Labels */}
            {metadata.labels && Object.keys(metadata.labels).length > 0 && (
              <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-stone-900 mb-4">Labels</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(metadata.labels).map(([key, value]) => (
                    <span key={key} className="px-2.5 py-1 bg-stone-100 text-stone-700 rounded-full text-xs font-medium border border-stone-200">
                      {key}: {String(value)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Annotations */}
            {metadata.annotations && Object.keys(metadata.annotations).length > 0 && (
              <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-stone-900 mb-4">Annotations</h3>
                <div className="space-y-2">
                  {Object.entries(metadata.annotations).map(([key, value]) => (
                    <div key={key} className="flex flex-col sm:flex-row sm:gap-2 text-sm">
                      <span className="font-medium text-stone-700 min-w-[200px] break-all">{key}:</span>
                      <span className="text-stone-600 break-all">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'definition' && (
          <div className="flex flex-col h-full">
            <div className="flex justify-end gap-2 mb-4 shrink-0">
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

            <div className="flex-1 bg-[#282c34] rounded-xl overflow-hidden border border-stone-800 shadow-inner min-h-0">
              <pre className="h-full overflow-auto p-6 text-sm font-mono leading-relaxed">
                <code ref={codeRef} className={`language-${viewMode}`}>
                  {content}
                </code>
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'graph' && (
          <div className="flex-1 bg-stone-50 rounded-xl border border-stone-200 overflow-hidden shadow-inner">
            {isGraphLoading ? (
              <div className="h-full flex items-center justify-center text-stone-500">
                Loading graph...
              </div>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                fitView
                attributionPosition="bottom-right"
              >
                <Background color="#e5e7eb" gap={16} />
                <Controls />
              </ReactFlow>
            )}
          </div>
        )}

        {activeTab === 'logs' && resourceType === K8sResourceType.Pod && (
          <div className="flex-1 bg-[#282c34] rounded-xl overflow-hidden border border-stone-800 shadow-inner min-h-0 flex flex-col">
             <div className="p-4 border-b border-stone-700 bg-[#21252b] flex justify-between items-center shrink-0">
                <span className="text-stone-400 text-xs font-mono">Last 50 lines (auto-refreshing)</span>
             </div>
             <pre className="flex-1 overflow-auto p-4 text-xs font-mono leading-relaxed text-stone-300">
               {logs !== undefined ? (
                 <>
                   {logs || <span className="text-stone-500 italic">No logs available</span>}
                   {logsError && (
                     <div className="mt-4 pt-2 border-t border-stone-700 text-red-400 text-xs">
                       <span className="font-bold">Error updating logs:</span> {logsError instanceof Error ? logsError.message : String(logsError)}
                     </div>
                   )}
                 </>
               ) : logsError ? (
                 <div className="text-red-400 whitespace-pre-wrap font-mono">
                   {logsError instanceof Error ? logsError.message : String(logsError)}
                 </div>
               ) : isLogsLoading ? (
                 <div className="text-stone-500">Loading logs...</div>
               ) : (
                 <span className="text-stone-500 italic">No logs available</span>
               )}
             </pre>
          </div>
        )}
      </div>

      {/* Port Forward Modal */}
      {showPortForwardModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-stone-900">Start Port Forward</h3>
              <button 
                onClick={() => setShowPortForwardModal(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Service Port
                </label>
                <div className="px-3 py-2 bg-stone-100 rounded-lg text-stone-600 text-sm">
                  {selectedPort}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Local Port
                </label>
                <input
                  type="number"
                  value={localPort}
                  onChange={(e) => setLocalPort(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-900/20 focus:border-amber-900"
                  placeholder="Enter local port"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowPortForwardModal(false)}
                  className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartPortForward}
                  disabled={!localPort || startMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-900 hover:bg-amber-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {startMutation.isPending ? 'Starting...' : 'Start Forwarding'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
