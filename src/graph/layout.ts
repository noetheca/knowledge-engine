import type {
  KnowledgeGraphEdge,
  KnowledgeGraphModel,
} from "./model.js";

export interface KnowledgeGraphLayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface KnowledgeGraphLayoutEdge extends KnowledgeGraphEdge {
  path: string;
}

export interface KnowledgeGraphLayout {
  width: number;
  height: number;
  nodes: KnowledgeGraphLayoutNode[];
  edges: KnowledgeGraphLayoutEdge[];
}

export interface KnowledgeGraphLayoutOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  columnGap?: number;
  rowGap?: number;
  padding?: number;
}

export function layoutKnowledgeGraph(
  graph: KnowledgeGraphModel,
  options: KnowledgeGraphLayoutOptions = {},
): KnowledgeGraphLayout {
  const nodeWidth = options.nodeWidth ?? 208;
  const nodeHeight = options.nodeHeight ?? 108;
  const columnGap = options.columnGap ?? 72;
  const rowGap = options.rowGap ?? 116;
  const padding = options.padding ?? 72;

  if (graph.nodes.length === 0) {
    return { width: padding * 2, height: padding * 2, nodes: [], edges: [] };
  }

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const depths = new Map<string, number>();
  const visiting = new Set<string>();

  const findDepth = (id: string): number => {
    const known = depths.get(id);
    if (known !== undefined) {
      return known;
    }
    if (visiting.has(id)) {
      throw new Error(`Cannot lay out prerequisite cycle containing "${id}".`);
    }

    visiting.add(id);
    const node = nodeById.get(id);
    if (!node) {
      throw new Error(`Cannot lay out missing graph node "${id}".`);
    }
    const depth =
      node.prerequisites.length === 0
        ? 0
        : Math.max(
            ...node.prerequisites.map(
              (prerequisite) => findDepth(prerequisite) + 1,
            ),
          );
    visiting.delete(id);
    depths.set(id, depth);
    return depth;
  };

  for (const { id } of graph.nodes) {
    findDepth(id);
  }

  const layers = new Map<number, string[]>();
  for (const { id } of graph.nodes) {
    const depth = depths.get(id) ?? 0;
    const layer = layers.get(depth) ?? [];
    layer.push(id);
    layers.set(depth, layer);
  }

  const orderedLayers = [...layers.entries()].sort(
    ([left], [right]) => left - right,
  );
  const maxColumns = Math.max(
    ...orderedLayers.map(([, nodeIds]) => nodeIds.length),
  );
  const contentWidth =
    maxColumns * nodeWidth + Math.max(0, maxColumns - 1) * columnGap;
  const width = contentWidth + padding * 2;
  const height =
    orderedLayers.length * nodeHeight +
    Math.max(0, orderedLayers.length - 1) * rowGap +
    padding * 2;

  const nodes: KnowledgeGraphLayoutNode[] = [];
  for (const [row, [, nodeIds]] of orderedLayers.entries()) {
    const layerWidth =
      nodeIds.length * nodeWidth + Math.max(0, nodeIds.length - 1) * columnGap;
    const startX = padding + (contentWidth - layerWidth) / 2;
    const y = padding + row * (nodeHeight + rowGap);
    for (const [column, id] of nodeIds.entries()) {
      nodes.push({
        id,
        x: startX + column * (nodeWidth + columnGap),
        y,
        width: nodeWidth,
        height: nodeHeight,
      });
    }
  }

  const positions = new Map(nodes.map((node) => [node.id, node]));
  const edges = graph.edges.map((edge) => {
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!source || !target) {
      throw new Error(`Cannot lay out graph edge "${edge.id}".`);
    }
    const sourceCenter = {
      x: source.x + source.width / 2,
      y: source.y + source.height / 2,
    };
    const targetCenter = {
      x: target.x + target.width / 2,
      y: target.y + target.height / 2,
    };
    const dx = targetCenter.x - sourceCenter.x;
    const dy = targetCenter.y - sourceCenter.y;
    const distance = Math.hypot(dx, dy) || 1;
    const direction = { x: dx / distance, y: dy / distance };
    const sourceRadius = Math.min(
      Math.abs(direction.x) > 0
        ? source.width / 2 / Math.abs(direction.x)
        : Number.POSITIVE_INFINITY,
      Math.abs(direction.y) > 0
        ? source.height / 2 / Math.abs(direction.y)
        : Number.POSITIVE_INFINITY,
    );
    const targetRadius = Math.min(
      Math.abs(direction.x) > 0
        ? target.width / 2 / Math.abs(direction.x)
        : Number.POSITIVE_INFINITY,
      Math.abs(direction.y) > 0
        ? target.height / 2 / Math.abs(direction.y)
        : Number.POSITIVE_INFINITY,
    );
    const sourcePoint = {
      x: sourceCenter.x + direction.x * (sourceRadius + 4),
      y: sourceCenter.y + direction.y * (sourceRadius + 4),
    };
    const targetPoint = {
      x: targetCenter.x - direction.x * (targetRadius + 14),
      y: targetCenter.y - direction.y * (targetRadius + 14),
    };
    return {
      ...edge,
      path:
        `M ${sourcePoint.x} ${sourcePoint.y} ` +
        `L ${targetPoint.x} ${targetPoint.y}`,
    };
  });

  return { width, height, nodes, edges };
}
