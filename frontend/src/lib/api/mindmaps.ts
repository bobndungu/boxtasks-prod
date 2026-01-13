import { getAccessToken, fetchWithCsrf } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export interface MindMapNode {
  id: string;
  title: string;
  description?: string;
  mindMapId: string;
  parentId?: string;
  positionX: number;
  positionY: number;
  color: string;
  dependencyIds: string[];
  convertedCardId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MindMap {
  id: string;
  title: string;
  description?: string;
  boardId: string;
  nodes: MindMapNode[];
  createdAt: string;
  updatedAt: string;
}

// Transform JSON:API response to MindMap
function transformMindMap(data: Record<string, unknown>, included?: Record<string, unknown>[]): MindMap {
  const attrs = data.attributes as Record<string, unknown>;
  const rels = data.relationships as Record<string, { data: { id: string } | null }> | undefined;

  const boardId = rels?.field_mindmap_board?.data?.id || '';

  // Get nodes from included if available
  const nodes: MindMapNode[] = [];
  if (included) {
    included
      .filter((item) => item.type === 'node--mind_map_node')
      .forEach((nodeData) => {
        const nodeAttrs = nodeData.attributes as Record<string, unknown>;
        const nodeRels = nodeData.relationships as Record<string, { data: { id: string } | { id: string }[] | null }> | undefined;

        const mindMapRef = nodeRels?.field_node_mindmap?.data;
        const nodeMindMapId = mindMapRef && !Array.isArray(mindMapRef) ? mindMapRef.id : '';

        if (nodeMindMapId === data.id) {
          const parentRef = nodeRels?.field_node_parent?.data;
          const convertedCardRef = nodeRels?.field_node_converted_card?.data;
          const dependenciesRef = nodeRels?.field_node_dependencies?.data;

          nodes.push({
            id: nodeData.id as string,
            title: nodeAttrs.title as string,
            description: (nodeAttrs.field_mindmap_description as { value?: string })?.value || '',
            mindMapId: nodeMindMapId,
            parentId: parentRef && !Array.isArray(parentRef) ? parentRef.id : undefined,
            positionX: (nodeAttrs.field_node_position_x as number) || 0,
            positionY: (nodeAttrs.field_node_position_y as number) || 0,
            color: (nodeAttrs.field_node_color as string) || '#3b82f6',
            dependencyIds: Array.isArray(dependenciesRef) ? dependenciesRef.map((d) => d.id) : [],
            convertedCardId: convertedCardRef && !Array.isArray(convertedCardRef) ? convertedCardRef.id : undefined,
            createdAt: nodeAttrs.created as string,
            updatedAt: nodeAttrs.changed as string,
          });
        }
      });
  }

  return {
    id: data.id as string,
    title: attrs.title as string,
    description: (attrs.field_mindmap_description as { value?: string })?.value || '',
    boardId,
    nodes,
    createdAt: attrs.created as string,
    updatedAt: attrs.changed as string,
  };
}

// Transform JSON:API response to MindMapNode
function transformMindMapNode(data: Record<string, unknown>): MindMapNode {
  const attrs = data.attributes as Record<string, unknown>;
  const rels = data.relationships as Record<string, { data: { id: string } | { id: string }[] | null }> | undefined;

  const mindMapRef = rels?.field_node_mindmap?.data;
  const parentRef = rels?.field_node_parent?.data;
  const convertedCardRef = rels?.field_node_converted_card?.data;
  const dependenciesRef = rels?.field_node_dependencies?.data;

  return {
    id: data.id as string,
    title: attrs.title as string,
    description: (attrs.field_mindmap_description as { value?: string })?.value || '',
    mindMapId: mindMapRef && !Array.isArray(mindMapRef) ? mindMapRef.id : '',
    parentId: parentRef && !Array.isArray(parentRef) ? parentRef.id : undefined,
    positionX: (attrs.field_node_position_x as number) || 0,
    positionY: (attrs.field_node_position_y as number) || 0,
    color: (attrs.field_node_color as string) || '#3b82f6',
    dependencyIds: Array.isArray(dependenciesRef) ? dependenciesRef.map((d) => d.id) : [],
    convertedCardId: convertedCardRef && !Array.isArray(convertedCardRef) ? convertedCardRef.id : undefined,
    createdAt: attrs.created as string,
    updatedAt: attrs.changed as string,
  };
}

// Fetch all mind maps for a board
export async function fetchMindMapsByBoard(boardId: string): Promise<MindMap[]> {
  const response = await fetch(
    `${API_URL}/jsonapi/node/mind_map?filter[field_mindmap_board.id]=${boardId}&sort=-created`,
    {
      headers: {
        Accept: 'application/vnd.api+json',
        Authorization: `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch mind maps');
  }

  const result = await response.json();
  const data = result.data;
  if (!Array.isArray(data)) return [];

  return data.map((item: Record<string, unknown>) => transformMindMap(item));
}

// Fetch a single mind map with its nodes
export async function fetchMindMap(id: string): Promise<MindMap> {
  // Fetch the mind map
  const mapResponse = await fetch(
    `${API_URL}/jsonapi/node/mind_map/${id}?include=field_mindmap_board`,
    {
      headers: {
        Accept: 'application/vnd.api+json',
        Authorization: `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!mapResponse.ok) {
    throw new Error('Failed to fetch mind map');
  }

  const mapResult = await mapResponse.json();

  // Fetch the nodes for this mind map
  const nodesResponse = await fetch(
    `${API_URL}/jsonapi/node/mind_map_node?filter[field_node_mindmap.id]=${id}&include=field_node_parent,field_node_dependencies,field_node_converted_card`,
    {
      headers: {
        Accept: 'application/vnd.api+json',
        Authorization: `Bearer ${getAccessToken()}`,
      },
    }
  );

  if (!nodesResponse.ok) {
    throw new Error('Failed to fetch mind map nodes');
  }

  const nodesResult = await nodesResponse.json();
  const nodesData = nodesResult.data;

  // Transform the mind map and include nodes
  const mindMap = transformMindMap(mapResult.data, mapResult.included);
  mindMap.nodes = Array.isArray(nodesData)
    ? nodesData.map((item: Record<string, unknown>) => transformMindMapNode(item))
    : [];

  return mindMap;
}

// Create a new mind map
export async function createMindMap(data: {
  title: string;
  boardId: string;
  description?: string;
}): Promise<MindMap> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/mind_map`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--mind_map',
        attributes: {
          title: data.title,
          field_mindmap_description: data.description ? { value: data.description } : null,
        },
        relationships: {
          field_mindmap_board: {
            data: { type: 'node--board', id: data.boardId },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to create mind map');
  }

  const result = await response.json();
  return transformMindMap(result.data);
}

// Update a mind map
export async function updateMindMap(
  id: string,
  data: { title?: string; description?: string }
): Promise<MindMap> {
  const attributes: Record<string, unknown> = {};
  if (data.title) attributes.title = data.title;
  if (data.description !== undefined) {
    attributes.field_mindmap_description = data.description ? { value: data.description } : null;
  }

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/mind_map/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--mind_map',
        id,
        attributes,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to update mind map');
  }

  const result = await response.json();
  return transformMindMap(result.data);
}

// Delete a mind map
export async function deleteMindMap(id: string): Promise<void> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/mind_map/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete mind map');
  }
}

// Create a new mind map node
export async function createMindMapNode(data: {
  title: string;
  mindMapId: string;
  parentId?: string;
  positionX?: number;
  positionY?: number;
  color?: string;
  description?: string;
}): Promise<MindMapNode> {
  const relationships: Record<string, unknown> = {
    field_node_mindmap: {
      data: { type: 'node--mind_map', id: data.mindMapId },
    },
  };

  if (data.parentId) {
    relationships.field_node_parent = {
      data: { type: 'node--mind_map_node', id: data.parentId },
    };
  }

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/mind_map_node`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--mind_map_node',
        attributes: {
          title: data.title,
          field_node_position_x: data.positionX || 0,
          field_node_position_y: data.positionY || 0,
          field_node_color: data.color || '#3b82f6',
          field_mindmap_description: data.description ? { value: data.description } : null,
        },
        relationships,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to create node');
  }

  const result = await response.json();
  return transformMindMapNode(result.data);
}

// Update a mind map node
export async function updateMindMapNode(
  id: string,
  data: {
    title?: string;
    description?: string;
    positionX?: number;
    positionY?: number;
    color?: string;
    parentId?: string | null;
    dependencyIds?: string[];
  }
): Promise<MindMapNode> {
  const attributes: Record<string, unknown> = {};
  const relationships: Record<string, unknown> = {};

  if (data.title) attributes.title = data.title;
  if (data.description !== undefined) {
    attributes.field_mindmap_description = data.description ? { value: data.description } : null;
  }
  if (data.positionX !== undefined) attributes.field_node_position_x = data.positionX;
  if (data.positionY !== undefined) attributes.field_node_position_y = data.positionY;
  if (data.color) attributes.field_node_color = data.color;

  if (data.parentId !== undefined) {
    relationships.field_node_parent = {
      data: data.parentId ? { type: 'node--mind_map_node', id: data.parentId } : null,
    };
  }

  if (data.dependencyIds) {
    relationships.field_node_dependencies = {
      data: data.dependencyIds.map((depId) => ({ type: 'node--mind_map_node', id: depId })),
    };
  }

  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/mind_map_node/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--mind_map_node',
        id,
        attributes,
        ...(Object.keys(relationships).length > 0 && { relationships }),
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to update node');
  }

  const result = await response.json();
  return transformMindMapNode(result.data);
}

// Delete a mind map node
export async function deleteMindMapNode(id: string): Promise<void> {
  const response = await fetchWithCsrf(`${API_URL}/jsonapi/node/mind_map_node/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete node');
  }
}

// Convert a mind map node to a card
export async function convertNodeToCard(
  nodeId: string,
  listId: string
): Promise<{ nodeId: string; cardId: string }> {
  // First, get the node details
  const nodeResponse = await fetch(`${API_URL}/jsonapi/node/mind_map_node/${nodeId}`, {
    headers: {
      Accept: 'application/vnd.api+json',
      Authorization: `Bearer ${getAccessToken()}`,
    },
  });

  if (!nodeResponse.ok) {
    throw new Error('Failed to fetch node');
  }

  const nodeResult = await nodeResponse.json();
  const node = transformMindMapNode(nodeResult.data);

  // Create a card from the node
  const cardResponse = await fetchWithCsrf(`${API_URL}/jsonapi/node/card`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--card',
        attributes: {
          title: node.title,
          field_card_description: node.description ? { value: node.description } : null,
          field_card_position: 0,
        },
        relationships: {
          field_card_list: {
            data: { type: 'node--board_list', id: listId },
          },
        },
      },
    }),
  });

  if (!cardResponse.ok) {
    const error = await cardResponse.json();
    throw new Error(error.errors?.[0]?.detail || 'Failed to create card');
  }

  const cardResult = await cardResponse.json();
  const cardId = cardResult.data.id;

  // Update the node with the converted card reference
  await updateMindMapNode(nodeId, {});
  await fetchWithCsrf(`${API_URL}/jsonapi/node/mind_map_node/${nodeId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'node--mind_map_node',
        id: nodeId,
        relationships: {
          field_node_converted_card: {
            data: { type: 'node--card', id: cardId },
          },
        },
      },
    }),
  });

  return { nodeId, cardId };
}
