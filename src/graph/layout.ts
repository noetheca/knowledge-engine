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
  maxColumns?: number;
  strategy?: "layered" | "contextual";
  chronology?: Readonly<Record<string, number>>;
}

interface SimulationNode {
  id: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function deterministicDirection(left: string, right: string): {
  x: number;
  y: number;
} {
  let hash = 2166136261;
  for (const character of `${left}\0${right}`) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  const angle = ((hash >>> 0) / 2 ** 32) * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function createLayoutEdges(
  graph: KnowledgeGraphModel,
  nodes: KnowledgeGraphLayoutNode[],
): KnowledgeGraphLayoutEdge[] {
  const positions = new Map(nodes.map((node) => [node.id, node]));
  return graph.edges.map((edge) => {
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
    const targetGap = edge.kind === "prerequisite" ? 14 : 4;
    const targetPoint = {
      x: targetCenter.x - direction.x * (targetRadius + targetGap),
      y: targetCenter.y - direction.y * (targetRadius + targetGap),
    };
    return {
      ...edge,
      path:
        `M ${sourcePoint.x} ${sourcePoint.y} ` +
        `L ${targetPoint.x} ${targetPoint.y}`,
    };
  });
}

function settleContextualNodes(
  simulationNodes: SimulationNode[],
  edges: KnowledgeGraphEdge[],
  ticks: number,
  nodeWidth: number,
  nodeHeight: number,
  collisionGap: number,
  chronology: Readonly<Record<string, number>>,
): void {
  const simulatedById = new Map(
    simulationNodes.map((node) => [node.id, node]),
  );
  const activeEdges = edges.filter(
    ({ source, target }) =>
      simulatedById.has(source) && simulatedById.has(target),
  );
  const linkDistance = Math.max(nodeWidth * 1.45, nodeHeight * 2.35);
  const rankedNodes = simulationNodes.flatMap((node) => {
    const rank = chronology[node.id];
    return Number.isFinite(rank) ? [{ node, rank: rank as number }] : [];
  });
  const rankMinimum =
    rankedNodes.length > 0
      ? Math.min(...rankedNodes.map(({ rank }) => rank))
      : 0;
  const rankMaximum =
    rankedNodes.length > 0
      ? Math.max(...rankedNodes.map(({ rank }) => rank))
      : 0;
  const rankRange = rankMaximum - rankMinimum;
  const chronologyHeight =
    Math.sqrt(Math.max(1, simulationNodes.length)) *
    (nodeHeight + collisionGap) *
    1.12;

  for (let tick = 0; tick < ticks; tick += 1) {
    const cooling = 0.18 + (1 - tick / ticks) * 0.82;

    for (const edge of activeEdges) {
      const source = simulatedById.get(edge.source);
      const target = simulatedById.get(edge.target);
      if (!source || !target) {
        continue;
      }
      let dx = target.x - source.x;
      let dy = target.y - source.y;
      let distance = Math.hypot(dx, dy);
      if (distance < 0.001) {
        const direction = deterministicDirection(source.id, target.id);
        dx = direction.x;
        dy = direction.y;
        distance = 1;
      }
      const spring = (distance - linkDistance) * 0.011 * cooling;
      const forceX = (dx / distance) * spring;
      const forceY = (dy / distance) * spring;
      source.velocityX += forceX;
      source.velocityY += forceY;
      target.velocityX -= forceX;
      target.velocityY -= forceY;
    }

    for (let index = 0; index < simulationNodes.length; index += 1) {
      const first = simulationNodes[index];
      if (!first) {
        continue;
      }
      for (
        let comparisonIndex = index + 1;
        comparisonIndex < simulationNodes.length;
        comparisonIndex += 1
      ) {
        const second = simulationNodes[comparisonIndex];
        if (!second) {
          continue;
        }
        let dx = second.x - first.x;
        let dy = second.y - first.y;
        let distance = Math.hypot(dx, dy);
        if (distance < 0.001) {
          const direction = deterministicDirection(first.id, second.id);
          dx = direction.x;
          dy = direction.y;
          distance = 1;
        }
        const repulsion = Math.min(9, 76_000 / (distance * distance));
        const forceX = (dx / distance) * repulsion * cooling;
        const forceY = (dy / distance) * repulsion * cooling;
        first.velocityX -= forceX;
        first.velocityY -= forceY;
        second.velocityX += forceX;
        second.velocityY += forceY;

        const overlapX = nodeWidth + collisionGap - Math.abs(dx);
        const overlapY = nodeHeight + collisionGap - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) {
          continue;
        }
        if (overlapX < overlapY) {
          const collision = Math.sign(dx || 1) * overlapX * 0.09;
          first.velocityX -= collision;
          second.velocityX += collision;
        } else {
          const collision = Math.sign(dy || 1) * overlapY * 0.09;
          first.velocityY -= collision;
          second.velocityY += collision;
        }
      }
    }

    for (const { node, rank } of rankedNodes) {
      const rankRatio = rankRange > 0 ? (rank - rankMinimum) / rankRange : 0.5;
      const targetY = (rankRatio - 0.5) * chronologyHeight;
      node.velocityY += (targetY - node.y) * 0.0065 * cooling;
    }

    for (const node of simulationNodes) {
      node.velocityX += -node.x * 0.0009 * cooling;
      node.velocityY += -node.y * 0.0009 * cooling;
      node.velocityX *= 0.76;
      node.velocityY *= 0.76;
      node.x += node.velocityX;
      node.y += node.velocityY;
    }
  }
}

function enforceChronologyBands(
  simulationNodes: SimulationNode[],
  chronology: Readonly<Record<string, number>>,
  nodeWidth: number,
  nodeHeight: number,
  collisionGap: number,
): void {
  const rankedGroups = new Map<number, SimulationNode[]>();
  const unrankedNodes: SimulationNode[] = [];
  for (const node of simulationNodes) {
    const rank = chronology[node.id];
    if (!Number.isFinite(rank)) {
      unrankedNodes.push(node);
      continue;
    }
    const group = rankedGroups.get(rank as number) ?? [];
    group.push(node);
    rankedGroups.set(rank as number, group);
  }
  if (rankedGroups.size === 0) {
    return;
  }

  const orderedGroups = [...rankedGroups.entries()].sort(
    ([left], [right]) => left - right,
  );
  const bandGap = nodeHeight + collisionGap;
  const firstBandY = -((orderedGroups.length - 1) * bandGap) / 2;
  for (const [index, [, nodes]] of orderedGroups.entries()) {
    const bandY = firstBandY + index * bandGap;
    for (const node of nodes) {
      node.y = bandY;
      node.velocityY = 0;
    }
  }

  // Concepts without a reliable date belong after the dated chronology. They
  // share one final band because no relative order can be inferred for them.
  const lastBandY = firstBandY + (orderedGroups.length - 1) * bandGap;
  for (const node of unrankedNodes) {
    node.y = lastBandY + bandGap;
    node.velocityY = 0;
  }

  // Chronology owns the vertical axis. Resolve the only remaining collisions
  // horizontally so neither link forces nor dense same-year groups can invert
  // the old-to-new order.
  const horizontalGap = nodeWidth + collisionGap;
  for (let pass = 0; pass < 160; pass += 1) {
    let moved = false;
    for (let index = 0; index < simulationNodes.length; index += 1) {
      const first = simulationNodes[index];
      if (!first) {
        continue;
      }
      for (
        let comparisonIndex = index + 1;
        comparisonIndex < simulationNodes.length;
        comparisonIndex += 1
      ) {
        const second = simulationNodes[comparisonIndex];
        if (!second) {
          continue;
        }
        const overlapY =
          nodeHeight + collisionGap - Math.abs(second.y - first.y);
        const deltaX = second.x - first.x;
        const overlapX = horizontalGap - Math.abs(deltaX);
        if (overlapX <= 0 || overlapY <= 0) {
          continue;
        }
        moved = true;
        const direction =
          Math.abs(deltaX) > 0.001
            ? Math.sign(deltaX)
            : compareText(first.id, second.id) <= 0
              ? 1
              : -1;
        const shift = direction * (overlapX / 2 + 0.01);
        first.x -= shift;
        second.x += shift;
        first.velocityX = 0;
        second.velocityX = 0;
      }
    }
    if (!moved) {
      break;
    }
  }
}

function layoutContextualKnowledgeGraph(
  graph: KnowledgeGraphModel,
  nodeWidth: number,
  nodeHeight: number,
  padding: number,
  chronology: Readonly<Record<string, number>>,
): KnowledgeGraphLayout {
  const orderedIds = graph.nodes.map(({ id }) => id).sort((left, right) => {
    const leftRank = chronology[left];
    const rightRank = chronology[right];
    const leftRanked = Number.isFinite(leftRank);
    const rightRanked = Number.isFinite(rightRank);
    if (leftRanked && rightRanked && leftRank !== rightRank) {
      return (leftRank as number) - (rightRank as number);
    }
    if (leftRanked !== rightRanked) {
      return leftRanked ? -1 : 1;
    }
    return compareText(left, right);
  });
  const radiusStep = Math.max(nodeWidth, nodeHeight) * 0.74;
  const collisionGap = 32;
  const orderedEdges = [...graph.edges].sort((left, right) =>
    compareText(left.id, right.id),
  );
  const simulationNodes: SimulationNode[] = [];
  const simulatedById = new Map<string, SimulationNode>();

  // Insert one concept at a time. Connected concepts start near neighbours
  // that have already settled; disconnected concepts use a stable phyllotaxis
  // seed. Short relaxation between insertions avoids first-paint grid shapes
  // while keeping the entire process reproducible on the server.
  for (const [index, id] of orderedIds.entries()) {
    const neighbours = orderedEdges.flatMap(({ source, target }) => {
      const neighbourId = source === id ? target : target === id ? source : "";
      const neighbour = neighbourId ? simulatedById.get(neighbourId) : undefined;
      return neighbour ? [neighbour] : [];
    });
    let x: number;
    let y: number;
    if (neighbours.length > 0) {
      const centerX =
        neighbours.reduce((sum, neighbour) => sum + neighbour.x, 0) /
        neighbours.length;
      const centerY =
        neighbours.reduce((sum, neighbour) => sum + neighbour.y, 0) /
        neighbours.length;
      const direction = deterministicDirection(id, `insertion:${index}`);
      x = centerX + direction.x * radiusStep;
      y = centerY + direction.y * radiusStep;
    } else {
      const radius = Math.sqrt(index + 0.35) * radiusStep;
      const angle = index * GOLDEN_ANGLE;
      x = Math.cos(angle) * radius;
      y = Math.sin(angle) * radius;
    }
    const inserted: SimulationNode = {
      id,
      x,
      y,
      velocityX: 0,
      velocityY: 0,
    };
    simulationNodes.push(inserted);
    simulatedById.set(id, inserted);
    settleContextualNodes(
      simulationNodes,
      orderedEdges,
      22,
      nodeWidth,
      nodeHeight,
      collisionGap,
      chronology,
    );
  }

  settleContextualNodes(
    simulationNodes,
    orderedEdges,
    420,
    nodeWidth,
    nodeHeight,
    collisionGap,
    chronology,
  );

  // A final positional collision pass removes tiny residual overlaps without
  // introducing runtime randomness or changing the graph topology.
  for (let pass = 0; pass < 80; pass += 1) {
    let moved = false;
    for (let index = 0; index < simulationNodes.length; index += 1) {
      const first = simulationNodes[index];
      if (!first) {
        continue;
      }
      for (
        let comparisonIndex = index + 1;
        comparisonIndex < simulationNodes.length;
        comparisonIndex += 1
      ) {
        const second = simulationNodes[comparisonIndex];
        if (!second) {
          continue;
        }
        const dx = second.x - first.x;
        const dy = second.y - first.y;
        const overlapX = nodeWidth + collisionGap - Math.abs(dx);
        const overlapY = nodeHeight + collisionGap - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) {
          continue;
        }
        moved = true;
        if (overlapX < overlapY) {
          const shift = Math.sign(dx || 1) * (overlapX / 2 + 0.01);
          first.x -= shift;
          second.x += shift;
        } else {
          const shift = Math.sign(dy || 1) * (overlapY / 2 + 0.01);
          first.y -= shift;
          second.y += shift;
        }
      }
    }
    if (!moved) {
      break;
    }
  }

  enforceChronologyBands(
    simulationNodes,
    chronology,
    nodeWidth,
    nodeHeight,
    collisionGap,
  );

  const minX = Math.min(...simulationNodes.map(({ x }) => x - nodeWidth / 2));
  const minY = Math.min(...simulationNodes.map(({ y }) => y - nodeHeight / 2));
  const maxX = Math.max(...simulationNodes.map(({ x }) => x + nodeWidth / 2));
  const maxY = Math.max(...simulationNodes.map(({ y }) => y + nodeHeight / 2));
  const width = Math.ceil(maxX - minX + padding * 2);
  const height = Math.ceil(maxY - minY + padding * 2);
  const centersById = new Map(simulationNodes.map((node) => [node.id, node]));
  const nodes = graph.nodes.map(({ id }) => {
    const center = centersById.get(id);
    if (!center) {
      throw new Error(`Cannot lay out missing graph node "${id}".`);
    }
    return {
      id,
      x: roundCoordinate(center.x - nodeWidth / 2 - minX + padding),
      y: roundCoordinate(center.y - nodeHeight / 2 - minY + padding),
      width: nodeWidth,
      height: nodeHeight,
    };
  });

  return {
    width,
    height,
    nodes,
    edges: createLayoutEdges(graph, nodes),
  };
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

  if (options.strategy === "contextual") {
    return layoutContextualKnowledgeGraph(
      graph,
      nodeWidth,
      nodeHeight,
      padding,
      options.chronology ?? {},
    );
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
  const columnLimit = Math.max(
    1,
    Math.floor(
      options.maxColumns ?? Math.ceil(Math.sqrt(graph.nodes.length)),
    ),
  );
  const rows = orderedLayers.flatMap(([, nodeIds]) => {
    const layerRows: string[][] = [];
    for (let index = 0; index < nodeIds.length; index += columnLimit) {
      layerRows.push(nodeIds.slice(index, index + columnLimit));
    }
    return layerRows;
  });
  const widestRowColumns = Math.max(
    ...rows.map((nodeIds) => nodeIds.length),
  );
  const contentWidth =
    widestRowColumns * nodeWidth +
    Math.max(0, widestRowColumns - 1) * columnGap;
  const width = contentWidth + padding * 2;
  const height =
    rows.length * nodeHeight +
    Math.max(0, rows.length - 1) * rowGap +
    padding * 2;

  const nodes: KnowledgeGraphLayoutNode[] = [];
  for (const [row, nodeIds] of rows.entries()) {
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

  const edges = createLayoutEdges(graph, nodes);

  return { width, height, nodes, edges };
}
