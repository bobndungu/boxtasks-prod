import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  X,
  Loader2,
  GitBranch,
  CheckSquare,
} from 'lucide-react';
import {
  fetchMindMap,
  createMindMapNode,
  updateMindMapNode,
  deleteMindMapNode,
  convertNodeToCard,
  type MindMap,
  type MindMapNode,
} from '../lib/api/mindmaps';
import { fetchBoard, type Board } from '../lib/api/boards';
import { fetchListsByBoard, type BoardList } from '../lib/api/lists';
import { toast } from '../lib/stores/toast';

// Color palette for nodes
const NODE_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
];

// Custom Mind Map Node Component
function MindMapNodeComponent({ data, selected }: NodeProps) {
  const isConverted = !!data.convertedCardId;

  return (
    <div
      className={`px-4 py-3 rounded-lg shadow-md border-2 min-w-[150px] max-w-[250px] transition-all ${
        selected ? 'ring-2 ring-offset-2 ring-blue-500' : ''
      } ${isConverted ? 'opacity-75' : ''}`}
      style={{
        backgroundColor: data.color || '#3b82f6',
        borderColor: selected ? '#3b82f6' : 'rgba(255,255,255,0.3)',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-white/50 border-2 border-white"
      />
      <div className="text-white font-medium text-sm truncate">{data.label}</div>
      {data.description && (
        <div className="text-white/70 text-xs mt-1 line-clamp-2">{data.description}</div>
      )}
      {isConverted && (
        <div className="flex items-center gap-1 mt-2 text-white/80 text-xs">
          <CheckSquare className="w-3 h-3" />
          <span>Converted to card</span>
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-white/50 border-2 border-white"
      />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  mindMapNode: MindMapNodeComponent,
};

// Node Editor Panel
interface NodeEditorProps {
  node: MindMapNode | null;
  onSave: (id: string, data: { title?: string; description?: string; color?: string }) => void;
  onDelete: (id: string) => void;
  onConvert: (id: string) => void;
  onClose: () => void;
  lists: BoardList[];
  isLoading: boolean;
}

function NodeEditor({ node, onSave, onDelete, onConvert, onClose, lists, isLoading }: NodeEditorProps) {
  const [title, setTitle] = useState(node?.title || '');
  const [description, setDescription] = useState(node?.description || '');
  const [color, setColor] = useState(node?.color || '#3b82f6');
  const [selectedList, setSelectedList] = useState('');

  useEffect(() => {
    if (node) {
      setTitle(node.title);
      setDescription(node.description || '');
      setColor(node.color);
    }
  }, [node]);

  if (!node) return null;

  const handleSave = () => {
    onSave(node.id, { title, description, color });
  };

  const handleConvert = () => {
    if (selectedList) {
      onConvert(node.id);
    } else {
      toast.error('Please select a list first');
    }
  };

  return (
    <div className="absolute right-4 top-4 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-10">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">Edit Node</h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Color
          </label>
          <div className="flex flex-wrap gap-2">
            {NODE_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full border-2 ${
                  color === c ? 'border-gray-900 dark:border-white ring-2 ring-offset-2 ring-blue-500' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>

        {!node.convertedCardId && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Convert to Card
            </label>
            <select
              value={selectedList}
              onChange={(e) => setSelectedList(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-2"
            >
              <option value="">Select a list...</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.title}
                </option>
              ))}
            </select>
            <button
              onClick={handleConvert}
              disabled={!selectedList || isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              <CheckSquare className="w-4 h-4" />
              Convert to Card
            </button>
          </div>
        )}

        <button
          onClick={() => onDelete(node.id)}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          Delete Node
        </button>
      </div>
    </div>
  );
}

export default function MindMapView() {
  const { boardId, mindMapId } = useParams<{ boardId: string; mindMapId: string }>();

  const [mindMap, setMindMap] = useState<MindMap | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [lists, setLists] = useState<BoardList[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedNode, setSelectedNode] = useState<MindMapNode | null>(null);
  const [selectedListForConvert, setSelectedListForConvert] = useState('');

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Convert mind map nodes to React Flow nodes
  const convertToFlowNodes = useCallback((mindMapNodes: MindMapNode[]): Node[] => {
    return mindMapNodes.map((node) => ({
      id: node.id,
      type: 'mindMapNode',
      position: { x: node.positionX, y: node.positionY },
      data: {
        label: node.title,
        description: node.description,
        color: node.color,
        convertedCardId: node.convertedCardId,
      },
    }));
  }, []);

  // Convert mind map nodes to React Flow edges (parent-child and dependencies)
  const convertToFlowEdges = useCallback((mindMapNodes: MindMapNode[]): Edge[] => {
    const edges: Edge[] = [];

    mindMapNodes.forEach((node) => {
      // Parent-child edges (solid lines)
      if (node.parentId) {
        edges.push({
          id: `parent-${node.parentId}-${node.id}`,
          source: node.parentId,
          target: node.id,
          type: 'smoothstep',
          style: { stroke: '#6b7280', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' },
        });
      }

      // Dependency edges (dashed lines)
      node.dependencyIds.forEach((depId) => {
        edges.push({
          id: `dep-${depId}-${node.id}`,
          source: depId,
          target: node.id,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '5,5' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' },
        });
      });
    });

    return edges;
  }, []);

  // Load mind map and board data
  useEffect(() => {
    if (!mindMapId || !boardId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [mindMapData, boardData, listsData] = await Promise.all([
          fetchMindMap(mindMapId),
          fetchBoard(boardId),
          fetchListsByBoard(boardId),
        ]);

        setMindMap(mindMapData);
        setBoard(boardData);
        setLists(listsData);

        // Convert to React Flow format
        setNodes(convertToFlowNodes(mindMapData.nodes));
        setEdges(convertToFlowEdges(mindMapData.nodes));
      } catch (error) {
        console.error('Error loading mind map:', error);
        toast.error('Failed to load mind map');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [mindMapId, boardId, convertToFlowNodes, convertToFlowEdges, setNodes, setEdges]);

  // Handle node position changes
  const onNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: Node) => {
      if (!mindMap) return;

      try {
        await updateMindMapNode(node.id, {
          positionX: Math.round(node.position.x),
          positionY: Math.round(node.position.y),
        });

        // Update local state
        setMindMap((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            nodes: prev.nodes.map((n) =>
              n.id === node.id
                ? { ...n, positionX: Math.round(node.position.x), positionY: Math.round(node.position.y) }
                : n
            ),
          };
        });
      } catch (error) {
        console.error('Error updating node position:', error);
        toast.error('Failed to save position');
      }
    },
    [mindMap]
  );

  // Handle node selection
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const mindMapNode = mindMap?.nodes.find((n) => n.id === node.id);
      setSelectedNode(mindMapNode || null);
    },
    [mindMap]
  );

  // Handle connection (creating parent-child relationship)
  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target || !mindMap) return;

      try {
        setSaving(true);
        await updateMindMapNode(connection.target, {
          parentId: connection.source,
        });

        // Update edges
        setEdges((eds) =>
          addEdge(
            {
              ...connection,
              type: 'smoothstep',
              style: { stroke: '#6b7280', strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' },
            },
            eds
          )
        );

        // Update local mind map state
        setMindMap((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            nodes: prev.nodes.map((n) =>
              n.id === connection.target ? { ...n, parentId: connection.source! } : n
            ),
          };
        });

        toast.success('Connection created');
      } catch (error) {
        console.error('Error creating connection:', error);
        toast.error('Failed to create connection');
      } finally {
        setSaving(false);
      }
    },
    [mindMap, setEdges]
  );

  // Add new node
  const handleAddNode = useCallback(async () => {
    if (!mindMap) return;

    try {
      setSaving(true);
      const newNode = await createMindMapNode({
        title: 'New Node',
        mindMapId: mindMap.id,
        positionX: 200 + Math.random() * 200,
        positionY: 200 + Math.random() * 200,
        color: NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)],
      });

      // Add to React Flow
      setNodes((nds) => [
        ...nds,
        {
          id: newNode.id,
          type: 'mindMapNode',
          position: { x: newNode.positionX, y: newNode.positionY },
          data: {
            label: newNode.title,
            description: newNode.description,
            color: newNode.color,
          },
        },
      ]);

      // Update mind map state
      setMindMap((prev) => {
        if (!prev) return prev;
        return { ...prev, nodes: [...prev.nodes, newNode] };
      });

      toast.success('Node added');
    } catch (error) {
      console.error('Error adding node:', error);
      toast.error('Failed to add node');
    } finally {
      setSaving(false);
    }
  }, [mindMap, setNodes]);

  // Update node
  const handleUpdateNode = useCallback(
    async (id: string, data: { title?: string; description?: string; color?: string }) => {
      try {
        setSaving(true);
        await updateMindMapNode(id, data);

        // Update React Flow nodes
        setNodes((nds) =>
          nds.map((node) =>
            node.id === id
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    label: data.title || node.data.label,
                    description: data.description !== undefined ? data.description : node.data.description,
                    color: data.color || node.data.color,
                  },
                }
              : node
          )
        );

        // Update mind map state
        setMindMap((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            nodes: prev.nodes.map((n) =>
              n.id === id
                ? {
                    ...n,
                    title: data.title || n.title,
                    description: data.description !== undefined ? data.description : n.description,
                    color: data.color || n.color,
                  }
                : n
            ),
          };
        });

        // Update selected node
        setSelectedNode((prev) => {
          if (!prev || prev.id !== id) return prev;
          return {
            ...prev,
            title: data.title || prev.title,
            description: data.description !== undefined ? data.description : prev.description,
            color: data.color || prev.color,
          };
        });

        toast.success('Node updated');
      } catch (error) {
        console.error('Error updating node:', error);
        toast.error('Failed to update node');
      } finally {
        setSaving(false);
      }
    },
    [setNodes]
  );

  // Delete node
  const handleDeleteNode = useCallback(
    async (id: string) => {
      try {
        setSaving(true);
        await deleteMindMapNode(id);

        // Remove from React Flow
        setNodes((nds) => nds.filter((node) => node.id !== id));
        setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));

        // Update mind map state
        setMindMap((prev) => {
          if (!prev) return prev;
          return { ...prev, nodes: prev.nodes.filter((n) => n.id !== id) };
        });

        setSelectedNode(null);
        toast.success('Node deleted');
      } catch (error) {
        console.error('Error deleting node:', error);
        toast.error('Failed to delete node');
      } finally {
        setSaving(false);
      }
    },
    [setNodes, setEdges]
  );

  // Convert node to card
  const handleConvertToCard = useCallback(
    async (nodeId: string) => {
      if (!selectedListForConvert) {
        toast.error('Please select a list first');
        return;
      }

      try {
        setSaving(true);
        const result = await convertNodeToCard(nodeId, selectedListForConvert);

        // Update node data to show it's converted
        setNodes((nds) =>
          nds.map((node) =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, convertedCardId: result.cardId } }
              : node
          )
        );

        // Update mind map state
        setMindMap((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            nodes: prev.nodes.map((n) =>
              n.id === nodeId ? { ...n, convertedCardId: result.cardId } : n
            ),
          };
        });

        // Update selected node
        setSelectedNode((prev) => {
          if (!prev || prev.id !== nodeId) return prev;
          return { ...prev, convertedCardId: result.cardId };
        });

        toast.success('Node converted to card');
        setSelectedListForConvert('');
      } catch (error) {
        console.error('Error converting node to card:', error);
        toast.error('Failed to convert to card');
      } finally {
        setSaving(false);
      }
    },
    [selectedListForConvert, setNodes]
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <span className="text-gray-500 dark:text-gray-400">Loading mind map...</span>
        </div>
      </div>
    );
  }

  if (!mindMap || !board) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Mind map not found</h2>
          <Link
            to={`/board/${boardId}`}
            className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to board
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to={`/board/${boardId}`}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>{board.title}</span>
            </Link>
            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
            <div className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-blue-600" />
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                {mindMap.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAddNode}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add Node
            </button>
          </div>
        </div>
      </header>

      {/* Mind Map Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-gray-100 dark:bg-gray-900"
        >
          <Controls className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700" />
          <MiniMap
            className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700"
            nodeColor={(node) => node.data.color || '#3b82f6'}
          />
          <Background color="#cbd5e1" gap={20} />
        </ReactFlow>

        {/* Node Editor Panel */}
        {selectedNode && (
          <NodeEditor
            node={selectedNode}
            onSave={handleUpdateNode}
            onDelete={handleDeleteNode}
            onConvert={handleConvertToCard}
            onClose={() => setSelectedNode(null)}
            lists={lists}
            isLoading={saving}
          />
        )}

        {/* Legend */}
        <div className="absolute left-4 bottom-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Legend</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-gray-500" />
              <span className="text-gray-600 dark:text-gray-400">Parent-child</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-amber-500" style={{ borderStyle: 'dashed' }} />
              <span className="text-gray-600 dark:text-gray-400">Dependency</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
