import type {
  KnowledgeGraphEdge,
  KnowledgeGraphModel,
} from "./model.js";

export interface KnowledgeGraphLayoutNode {
  id: string;
  /** Stable force-simulation cluster. */
  groupId: string;
  /** Topological/chronological rank used by the soft hierarchy force. */
  rank: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface KnowledgeGraphLayoutEdge extends KnowledgeGraphEdge {
  path: string;
  arrowPoints?: string;
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
  groupBoundaryGap?: number;
  rowGap?: number;
  padding?: number;
  maxColumns?: number;
  strategy?: "layered" | "contextual";
  chronology?: Readonly<Record<string, number>>;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function groupIdFor(
  id: string,
  groups: ReadonlyMap<string, string | undefined>,
): string {
  const group = groups.get(id)?.trim();
  // An ID is preferable to an order-dependent generated label: consumers
  // that do not provide groups still get deterministic simulation input.
  return group || id;
}

function keepGroupsContiguous(
  ids: readonly string[],
  groups: ReadonlyMap<string, string | undefined>,
): string[] {
  const order: string[] = [];
  const members = new Map<string, string[]>();
  for (const id of ids) {
    const groupId = groupIdFor(id, groups);
    if (!members.has(groupId)) {
      order.push(groupId);
      members.set(groupId, []);
    }
    members.get(groupId)?.push(id);
  }
  return order.flatMap((groupId) => members.get(groupId) ?? []);
}

function average(values: readonly number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function directionalEdges(
  graph: KnowledgeGraphModel,
  strategy: "layered" | "contextual",
): KnowledgeGraphEdge[] {
  const acceptedKinds =
    strategy === "contextual"
      ? new Set(["prerequisite", "contextual"])
      : new Set(["prerequisite"]);
  return graph.edges
    .filter(({ kind }) => acceptedKinds.has(kind))
    .sort((left, right) => compareText(left.id, right.id));
}

function prerequisiteDepths(graph: KnowledgeGraphModel): Map<string, number> {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const depths = new Map<string, number>();
  const visiting = new Set<string>();

  const visit = (id: string): number => {
    const known = depths.get(id);
    if (known !== undefined) {
      return known;
    }
    if (visiting.has(id)) {
      throw new Error(`Cannot lay out prerequisite cycle containing "${id}".`);
    }
    const node = nodesById.get(id);
    if (!node) {
      throw new Error(`Cannot lay out missing graph node "${id}".`);
    }
    visiting.add(id);
    const depth =
      node.prerequisites.length === 0
        ? 0
        : Math.max(
            ...node.prerequisites.map(
              (prerequisite) => visit(prerequisite) + 1,
            ),
          );
    visiting.delete(id);
    depths.set(id, depth);
    return depth;
  };

  for (const { id } of graph.nodes) {
    visit(id);
  }
  return depths;
}

function contextualDepths(
  graph: KnowledgeGraphModel,
  edges: readonly KnowledgeGraphEdge[],
  chronology: Readonly<Record<string, number>>,
): Map<string, number> {
  // Prerequisite cycles are invalid in every presentation strategy.
  prerequisiteDepths(graph);

  const ids = graph.nodes.map(({ id }) => id).sort(compareText);
  const rankValues = [
    ...new Set(
      ids.flatMap((id) => {
        const rank = chronology[id];
        return Number.isFinite(rank) ? [rank as number] : [];
      }),
    ),
  ].sort((left, right) => left - right);
  const rankIndex = new Map(rankValues.map((rank, index) => [rank, index]));
  const unrankedBand = rankValues.length;
  const bandStride = ids.length + 1;
  const depths = new Map(
    ids.map((id) => {
      const rank = chronology[id];
      const band = Number.isFinite(rank)
        ? (rankIndex.get(rank as number) ?? 0)
        : unrankedBand;
      return [id, band * bandStride] as const;
    }),
  );
  const indegree = new Map(ids.map((id) => [id, 0]));
  const outgoing = new Map(ids.map((id) => [id, [] as string[]]));
  for (const edge of edges) {
    outgoing.get(edge.source)?.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }
  for (const targets of outgoing.values()) {
    targets.sort(compareText);
  }

  const queue = ids.filter((id) => indegree.get(id) === 0).sort(compareText);
  let visited = 0;
  while (queue.length > 0) {
    const source = queue.shift();
    if (!source) {
      continue;
    }
    visited += 1;
    for (const target of outgoing.get(source) ?? []) {
      depths.set(
        target,
        Math.max(depths.get(target) ?? 0, (depths.get(source) ?? 0) + 1),
      );
      const remaining = (indegree.get(target) ?? 1) - 1;
      indegree.set(target, remaining);
      if (remaining === 0) {
        queue.push(target);
        queue.sort(compareText);
      }
    }
  }

  // Contextual relations are allowed to contain a cycle. Such a cycle cannot
  // be drawn with every arrow pointing downward, so retain chronology/ID bands
  // for the cyclic part instead of starting an iterative force simulation.
  if (visited < ids.length) {
    for (const id of ids.filter((entry) => (indegree.get(entry) ?? 0) > 0)) {
      depths.set(id, depths.get(id) ?? unrankedBand * bandStride);
    }
  }

  const compressedValues = [...new Set(depths.values())].sort(
    (left, right) => left - right,
  );
  const compressed = new Map(
    compressedValues.map((depth, index) => [depth, index]),
  );
  return new Map(
    ids.map((id) => [id, compressed.get(depths.get(id) ?? 0) ?? 0]),
  );
}

function orderLayers(
  depths: ReadonlyMap<string, number>,
  edges: readonly KnowledgeGraphEdge[],
): Map<number, string[]> {
  const layers = new Map<number, string[]>();
  for (const [id, depth] of depths) {
    layers.set(depth, [...(layers.get(depth) ?? []), id]);
  }
  for (const ids of layers.values()) {
    ids.sort(compareText);
  }

  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const { source, target } of edges) {
    incoming.set(target, [...(incoming.get(target) ?? []), source]);
    outgoing.set(source, [...(outgoing.get(source) ?? []), target]);
  }
  const depthValues = [...layers.keys()].sort((left, right) => left - right);
  const positionMap = (): Map<string, number> =>
    new Map(
      depthValues.flatMap((depth) =>
        (layers.get(depth) ?? []).map((id, index) => [id, index] as const),
      ),
    );
  const reorder = (
    depth: number,
    neighbours: ReadonlyMap<string, string[]>,
    positions: ReadonlyMap<string, number>,
  ): void => {
    const ids = layers.get(depth);
    if (!ids) {
      return;
    }
    ids.sort((left, right) => {
      const leftBarycenter = average(
        (neighbours.get(left) ?? []).flatMap((id) => {
          const position = positions.get(id);
          return position === undefined ? [] : [position];
        }),
      );
      const rightBarycenter = average(
        (neighbours.get(right) ?? []).flatMap((id) => {
          const position = positions.get(id);
          return position === undefined ? [] : [position];
        }),
      );
      if (
        leftBarycenter !== undefined &&
        rightBarycenter !== undefined &&
        leftBarycenter !== rightBarycenter
      ) {
        return leftBarycenter - rightBarycenter;
      }
      if (leftBarycenter !== undefined || rightBarycenter !== undefined) {
        return leftBarycenter === undefined ? 1 : -1;
      }
      return compareText(left, right);
    });
  };

  // Alternating barycentric sweeps are deterministic and substantially reduce
  // crossings without adding a graph-layout runtime dependency.
  for (let pass = 0; pass < 4; pass += 1) {
    let positions = positionMap();
    for (const depth of depthValues.slice(1)) {
      reorder(depth, incoming, positions);
      positions = positionMap();
    }
    positions = positionMap();
    for (const depth of depthValues.slice(0, -1).toReversed()) {
      reorder(depth, outgoing, positions);
      positions = positionMap();
    }
  }
  return layers;
}

function edgeGeometry(
  edge: KnowledgeGraphEdge,
  positions: ReadonlyMap<string, KnowledgeGraphLayoutNode>,
): KnowledgeGraphLayoutEdge {
  const source = positions.get(edge.source);
  const target = positions.get(edge.target);
  if (!source || !target) {
    throw new Error(`Cannot lay out graph edge "${edge.id}".`);
  }
  const sourceCenterX = source.x + source.width / 2;
  const targetCenterX = target.x + target.width / 2;
  const targetIsBelow = target.y > source.y + source.height;
  if (targetIsBelow) {
    const startY = source.y + source.height + 4;
    const tipY = target.y - 5;
    const arrowBaseY = tipY - 13;
    const middleY = (startY + arrowBaseY) / 2;
    return {
      ...edge,
      path:
        `M ${sourceCenterX} ${startY} ` +
        `C ${sourceCenterX} ${middleY} ${targetCenterX} ${middleY} ` +
        `${targetCenterX} ${arrowBaseY}`,
      arrowPoints:
        `${targetCenterX},${tipY} ` +
        `${targetCenterX - 8},${arrowBaseY} ` +
        `${targetCenterX + 8},${arrowBaseY}`,
    };
  }

  const sourceCenterY = source.y + source.height / 2;
  const targetCenterY = target.y + target.height / 2;
  const dx = targetCenterX - sourceCenterX;
  const dy = targetCenterY - sourceCenterY;
  const distance = Math.hypot(dx, dy) || 1;
  const directionX = dx / distance;
  const directionY = dy / distance;
  const start = {
    x: sourceCenterX + directionX * (source.width / 2 + 4),
    y: sourceCenterY + directionY * (source.height / 2 + 4),
  };
  const tip = {
    x: targetCenterX - directionX * (target.width / 2 + 5),
    y: targetCenterY - directionY * (target.height / 2 + 5),
  };
  const base = {
    x: tip.x - directionX * 13,
    y: tip.y - directionY * 13,
  };
  const perpendicular = { x: -directionY * 8, y: directionX * 8 };
  return {
    ...edge,
    path: `M ${start.x} ${start.y} L ${base.x} ${base.y}`,
    arrowPoints:
      `${tip.x},${tip.y} ` +
      `${base.x + perpendicular.x},${base.y + perpendicular.y} ` +
      `${base.x - perpendicular.x},${base.y - perpendicular.y}`,
  };
}

export function layoutKnowledgeGraph(
  graph: KnowledgeGraphModel,
  options: KnowledgeGraphLayoutOptions = {},
): KnowledgeGraphLayout {
  const nodeWidth = options.nodeWidth ?? 208;
  const nodeHeight = options.nodeHeight ?? 108;
  const columnGap = options.columnGap ?? 72;
  const groupBoundaryGap = options.groupBoundaryGap ?? 220;
  const rowGap = options.rowGap ?? 180;
  const padding = options.padding ?? 72;
  const strategy = options.strategy ?? "layered";

  if (graph.nodes.length === 0) {
    return { width: padding * 2, height: padding * 2, nodes: [], edges: [] };
  }

  const edges = directionalEdges(graph, strategy);
  const depths =
    strategy === "contextual"
      ? contextualDepths(graph, edges, options.chronology ?? {})
      : prerequisiteDepths(graph);
  const layers = orderLayers(depths, edges);
  const groups = new Map(graph.nodes.map(({ id, group }) => [id, group]));
  for (const [depth, ids] of layers) {
    layers.set(depth, keepGroupsContiguous(ids, groups));
  }
  const depthValues = [...layers.keys()].sort((left, right) => left - right);
  const columnLimit = Math.max(
    1,
    Math.floor(
      options.maxColumns ??
        Math.min(9, Math.ceil(Math.sqrt(graph.nodes.length))),
    ),
  );
  const layerRows = depthValues.map((depth) => {
    const ids = layers.get(depth) ?? [];
    const rows: string[][] = [];
    for (let index = 0; index < ids.length; index += columnLimit) {
      rows.push(ids.slice(index, index + columnLimit));
    }
    return rows;
  });
  const gapBetween = (left: string, right: string): number =>
    groupIdFor(left, groups) === groupIdFor(right, groups)
      ? columnGap
      : groupBoundaryGap;
  const rowWidth = (row: readonly string[]): number =>
    row.length * nodeWidth +
    row.slice(1).reduce(
      (width, id, index) => width + gapBetween(row[index] ?? id, id),
      0,
    );
  const contentWidth = Math.max(1, ...layerRows.flat().map(rowWidth));
  const width = contentWidth + padding * 2;
  const nodes: KnowledgeGraphLayoutNode[] = [];
  let y = padding;

  for (const [layerIndex, rows] of layerRows.entries()) {
    for (const [rowIndex, ids] of rows.entries()) {
      const widthForRow = rowWidth(ids);
      let x = padding + (contentWidth - widthForRow) / 2;
      for (const [column, id] of ids.entries()) {
        nodes.push({
          id,
          groupId: groupIdFor(id, groups),
          rank: depthValues[layerIndex] ?? layerIndex,
          x,
          y,
          width: nodeWidth,
          height: nodeHeight,
        });
        const next = ids[column + 1];
        if (next) {
          x += nodeWidth + gapBetween(id, next);
        }
      }
      y += nodeHeight;
      if (rowIndex < rows.length - 1) {
        y += Math.max(36, rowGap * 0.45);
      }
    }
    if (layerIndex < layerRows.length - 1) {
      y += rowGap;
    }
  }

  const positions = new Map(nodes.map((node) => [node.id, node]));
  return {
    width,
    height: y + padding,
    nodes,
    // Related knowledge stays in the selected-node list. Omitting those
    // undirected lines keeps the prerequisite hierarchy readable at a glance.
    edges: edges.map((edge) => edgeGeometry(edge, positions)),
  };
}
