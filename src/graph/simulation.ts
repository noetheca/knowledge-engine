export const KNOWLEDGE_GRAPH_SIMULATION_MAX_FRAMES = 90;
export const KNOWLEDGE_GRAPH_SIMULATION_MAX_DURATION_MS = 1_100;
export const KNOWLEDGE_GRAPH_SIMULATION_STABLE_FRAMES = 7;
export const KNOWLEDGE_GRAPH_SIMULATION_STABLE_MOVEMENT = 0.035;
export const KNOWLEDGE_GRAPH_PROXIMITY_CAP_DISTANCE_TWO = 4;
export const KNOWLEDGE_GRAPH_PROXIMITY_CAP_DISTANCE_THREE = 2;

export type KnowledgeGraphSimulationDirectKind =
  | "prerequisite"
  | "contextual"
  | "related";

export interface KnowledgeGraphSimulationDirectLink {
  source: string;
  target: string;
  kind: KnowledgeGraphSimulationDirectKind;
}

export interface KnowledgeGraphSimulationAnchor {
  x: number;
  y: number;
}

export interface KnowledgeGraphSimulationLink {
  source: string;
  target: string;
  kind: KnowledgeGraphSimulationDirectKind | "proximity";
  distance: 1 | 2 | 3;
  strength: number;
  desiredDistance: number;
}

export interface KnowledgeGraphSimulationNode {
  id: string;
  groupId?: string;
  rank?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  bandMinimumY: number;
  bandMaximumY: number;
  velocityX: number;
  velocityY: number;
}

export interface KnowledgeGraphSimulationStepOptions {
  minimumX?: number;
  minimumY?: number;
  maximumX: number;
  maximumY: number;
  hierarchyStrength?: number;
  attractionStrength?: number;
  repulsionStrength?: number;
  /** Pulls members of the same semantic group toward a shared centroid. */
  groupStrength?: number;
  /** Pushes the centroids and nearby members of different groups apart. */
  groupSeparationStrength?: number;
  pinnedId?: string;
}

export interface SettleKnowledgeGraphSimulationOptions
  extends KnowledgeGraphSimulationStepOptions {
  maxFrames?: number;
  maxDurationMs?: number;
  reducedMotion?: boolean;
  stableFrames?: number;
  stableMovement?: number;
}

export interface SettledKnowledgeGraphSimulation {
  nodes: KnowledgeGraphSimulationNode[];
  frames: number;
  reason: "settled" | "frame-limit" | "reduced-motion";
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function pairKey(left: string, right: string): string {
  return left < right
    ? `${left}\u0000${right}`
    : `${right}\u0000${left}`;
}

function deterministicHash(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicDirection(left: string, right: string): {
  x: number;
  y: number;
} {
  const angle =
    (deterministicHash(`${left}\u0000${right}`) / 2 ** 32) * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function directLinkStrength(kind: KnowledgeGraphSimulationDirectKind): {
  strength: number;
  desiredDistance: number;
} {
  if (kind === "prerequisite") {
    return { strength: 1, desiredDistance: 250 };
  }
  if (kind === "contextual") {
    return { strength: 0.82, desiredDistance: 280 };
  }
  return { strength: 0.52, desiredDistance: 320 };
}

export function createKnowledgeGraphSimulationLinks(
  nodeIds: readonly string[],
  directLinks: readonly KnowledgeGraphSimulationDirectLink[],
  anchors?: ReadonlyMap<string, KnowledgeGraphSimulationAnchor>,
): KnowledgeGraphSimulationLink[] {
  const ids = [...new Set(nodeIds)].sort(compareText);
  const knownIds = new Set(ids);
  const directByPair = new Map<string, KnowledgeGraphSimulationDirectLink>();
  const adjacency = new Map(ids.map((id) => [id, new Set<string>()]));
  const priority: Record<KnowledgeGraphSimulationDirectKind, number> = {
    prerequisite: 3,
    contextual: 2,
    related: 1,
  };

  for (const link of [...directLinks].sort((left, right) =>
    compareText(
      `${left.source}\u0000${left.target}\u0000${left.kind}`,
      `${right.source}\u0000${right.target}\u0000${right.kind}`,
    ),
  )) {
    if (
      !knownIds.has(link.source) ||
      !knownIds.has(link.target) ||
      link.source === link.target
    ) {
      continue;
    }
    const key = pairKey(link.source, link.target);
    const current = directByPair.get(key);
    if (!current || priority[link.kind] > priority[current.kind]) {
      directByPair.set(key, link);
    }
    adjacency.get(link.source)?.add(link.target);
    adjacency.get(link.target)?.add(link.source);
  }

  const links: KnowledgeGraphSimulationLink[] = [];
  for (const [key, link] of [...directByPair.entries()].sort(([left], [right]) =>
    compareText(left, right),
  )) {
    const [canonicalSource, canonicalTarget] = key.split("\u0000");
    if (!canonicalSource || !canonicalTarget) {
      continue;
    }
    const directional = link.kind !== "related";
    links.push({
      source: directional ? link.source : canonicalSource,
      target: directional ? link.target : canonicalTarget,
      kind: link.kind,
      distance: 1,
      ...directLinkStrength(link.kind),
    });
  }

  // Breadth-first searches stop at distance three. The graph has fewer than a
  // few hundred nodes in current domains. A deterministic per-source sample
  // keeps dense stars from turning graph-distance-two attraction into an
  // all-pairs force during animation.
  for (const [sourceIndex, source] of ids.entries()) {
    const distances = new Map([[source, 0]]);
    const queue = [source];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      const currentDistance = distances.get(current) ?? 0;
      if (currentDistance >= 3) {
        continue;
      }
      for (const neighbour of [...(adjacency.get(current) ?? [])].sort(compareText)) {
        if (distances.has(neighbour)) {
          continue;
        }
        distances.set(neighbour, currentDistance + 1);
        queue.push(neighbour);
      }
    }
    const proximityTargets: Record<2 | 3, string[]> = { 2: [], 3: [] };
    for (const target of ids.slice(sourceIndex + 1)) {
      const distance = distances.get(target);
      if (
        (distance !== 2 && distance !== 3) ||
        directByPair.has(pairKey(source, target))
      ) {
        continue;
      }
      proximityTargets[distance].push(target);
    }
    for (const distance of [2, 3] as const) {
      const cap =
        distance === 2
          ? KNOWLEDGE_GRAPH_PROXIMITY_CAP_DISTANCE_TWO
          : KNOWLEDGE_GRAPH_PROXIMITY_CAP_DISTANCE_THREE;
      const targets = proximityTargets[distance]
        .sort((left, right) => {
          const sourceAnchor = anchors?.get(source);
          const leftAnchor = anchors?.get(left);
          const rightAnchor = anchors?.get(right);
          if (sourceAnchor && leftAnchor && rightAnchor) {
            const leftDistance = Math.hypot(
              leftAnchor.x - sourceAnchor.x,
              leftAnchor.y - sourceAnchor.y,
            );
            const rightDistance = Math.hypot(
              rightAnchor.x - sourceAnchor.x,
              rightAnchor.y - sourceAnchor.y,
            );
            if (leftDistance !== rightDistance) {
              return leftDistance - rightDistance;
            }
          }
          const rankDifference =
            deterministicHash(`${source}\u0000${left}\u0000${distance}`) -
            deterministicHash(`${source}\u0000${right}\u0000${distance}`);
          return rankDifference || compareText(left, right);
        })
        .slice(0, cap);
      for (const target of targets) {
        links.push({
          source,
          target,
          kind: "proximity",
          distance,
          strength: distance === 2 ? 0.18 : 0.07,
          desiredDistance: distance === 2 ? 410 : 520,
        });
      }
    }
  }
  return links.sort((left, right) =>
    compareText(
      `${left.source}\u0000${left.target}\u0000${left.kind}`,
      `${right.source}\u0000${right.target}\u0000${right.kind}`,
    ),
  );
}

function addForce(
  forces: Map<string, { x: number; y: number }>,
  id: string,
  x: number,
  y: number,
): void {
  const force = forces.get(id);
  if (!force) {
    return;
  }
  force.x += x;
  force.y += y;
}

function boundedOption(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  return Number.isFinite(value)
    ? clamp(value as number, minimum, maximum)
    : fallback;
}

function nodeGroupId(node: KnowledgeGraphSimulationNode): string {
  return node.groupId?.trim() || node.id;
}

function softenedInverseSquare(
  surfaceGap: number,
  cutoff: number,
  softening: number,
  scale: number,
  maximum: number,
): number {
  if (surfaceGap >= cutoff || scale <= 0) {
    return 0;
  }
  const safeGap = Math.max(0, surfaceGap);
  const shifted =
    1 / (safeGap + softening) ** 2 -
    1 / (cutoff + softening) ** 2;
  return Math.min(maximum, Math.max(0, shifted * scale));
}

function rectangleSupportRadius(
  node: KnowledgeGraphSimulationNode,
  directionX: number,
  directionY: number,
): number {
  const horizontal = Math.abs(directionX) > 1e-9
    ? node.width / 2 / Math.abs(directionX)
    : Number.POSITIVE_INFINITY;
  const vertical = Math.abs(directionY) > 1e-9
    ? node.height / 2 / Math.abs(directionY)
    : Number.POSITIVE_INFINITY;
  return Math.min(horizontal, vertical);
}

function projectSimulationCollisions(
  nodes: KnowledgeGraphSimulationNode[],
  options: KnowledgeGraphSimulationStepOptions,
): void {
  const minimumX = options.minimumX ?? 16;
  const minimumY = options.minimumY ?? 16;
  const padding = 16;
  const move = (
    node: KnowledgeGraphSimulationNode,
    axis: "x" | "y",
    delta: number,
  ): void => {
    if (node.id === options.pinnedId || delta === 0) {
      return;
    }
    if (axis === "x") {
      node.x = clamp(
        node.x + delta,
        minimumX,
        Math.max(minimumX, options.maximumX - node.width),
      );
      node.velocityX *= 0.35;
      return;
    }
    node.y = clamp(
      node.y + delta,
      minimumY,
      Math.max(minimumY, options.maximumY - node.height),
    );
    node.velocityY *= 0.35;
  };
  const separate = (
    left: KnowledgeGraphSimulationNode,
    right: KnowledgeGraphSimulationNode,
    axis: "x" | "y",
    amount: number,
    direction: number,
  ): void => {
    const required = amount + 0.05;
    if (left.id === options.pinnedId) {
      move(right, axis, direction * required);
    } else if (right.id === options.pinnedId) {
      move(left, axis, -direction * required);
    } else {
      move(left, axis, -direction * required / 2);
      move(right, axis, direction * required / 2);
    }
  };
  const resolvePair = (
    left: KnowledgeGraphSimulationNode,
    right: KnowledgeGraphSimulationNode,
  ): boolean => {
    let dx = right.x + right.width / 2 - (left.x + left.width / 2);
    let dy = right.y + right.height / 2 - (left.y + left.height / 2);
    let overlapX =
      (left.width + right.width) / 2 + padding - Math.abs(dx);
    let overlapY =
      (left.height + right.height) / 2 + padding - Math.abs(dy);
    if (overlapX <= 0 || overlapY <= 0) {
      return false;
    }
    const coincidentAxis = dx === 0 || dy === 0
      ? deterministicDirection(left.id, right.id)
      : undefined;
    const xDirection = dx === 0
      ? ((coincidentAxis?.x ?? 1) >= 0 ? 1 : -1)
      : Math.sign(dx);
    const yDirection = dy === 0
      ? ((coincidentAxis?.y ?? 1) >= 0 ? 1 : -1)
      : Math.sign(dy);
    const firstAxis = overlapX <= overlapY ? "x" : "y";
    separate(
      left,
      right,
      firstAxis,
      firstAxis === "x" ? overlapX : overlapY,
      firstAxis === "x" ? xDirection : yDirection,
    );
    dx = right.x + right.width / 2 - (left.x + left.width / 2);
    dy = right.y + right.height / 2 - (left.y + left.height / 2);
    overlapX = (left.width + right.width) / 2 + padding - Math.abs(dx);
    overlapY = (left.height + right.height) / 2 + padding - Math.abs(dy);
    if (overlapX > 0 && overlapY > 0) {
      const secondAxis = firstAxis === "x" ? "y" : "x";
      separate(
        left,
        right,
        secondAxis,
        secondAxis === "x" ? overlapX : overlapY,
        secondAxis === "x" ? xDirection : yDirection,
      );
    }
    return true;
  };

  let cellSize = 300;
  for (const node of nodes) {
    cellSize = Math.max(cellSize, node.width + padding, node.height + padding);
  }
  // Strong continuous repulsion prevents ordinary overlaps. Projection is a
  // bounded safety net for drags, boundaries, and coincident starting points.
  for (let pass = 0; pass < 2; pass += 1) {
    let collisionCount = 0;
    if (nodes.length <= 160) {
      for (let index = 0; index < nodes.length; index += 1) {
        const node = nodes[index];
        if (!node) {
          continue;
        }
        for (
          let otherIndex = index + 1;
          otherIndex < nodes.length;
          otherIndex += 1
        ) {
          const other = nodes[otherIndex];
          if (other && resolvePair(node, other)) {
            collisionCount += 1;
          }
        }
      }
      if (collisionCount === 0) {
        break;
      }
      continue;
    }
    const buckets = new Map<string, number[]>();
    for (const [index, node] of nodes.entries()) {
      const cellX = Math.floor((node.x + node.width / 2) / cellSize);
      const cellY = Math.floor((node.y + node.height / 2) / cellSize);
      const key = `${cellX}:${cellY}`;
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.push(index);
      } else {
        buckets.set(key, [index]);
      }
    }
    for (const [index, node] of nodes.entries()) {
      const cellX = Math.floor((node.x + node.width / 2) / cellSize);
      const cellY = Math.floor((node.y + node.height / 2) / cellSize);
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          const candidates =
            buckets.get(`${cellX + offsetX}:${cellY + offsetY}`) ?? [];
          for (const otherIndex of candidates) {
            const other = nodes[otherIndex];
            if (
              otherIndex > index &&
              other &&
              resolvePair(node, other)
            ) {
              collisionCount += 1;
            }
          }
        }
      }
    }
    if (collisionCount === 0) {
      break;
    }
  }
}

export function stepKnowledgeGraphSimulation(
  inputNodes: KnowledgeGraphSimulationNode[],
  links: readonly KnowledgeGraphSimulationLink[],
  options: KnowledgeGraphSimulationStepOptions,
): number {
  const nodes = [...inputNodes].sort((left, right) => compareText(left.id, right.id));
  const previousCoordinates = new Map(
    nodes.map(({ id, x, y }) => [id, { x, y }] as const),
  );
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const forces = new Map(nodes.map(({ id }) => [id, { x: 0, y: 0 }] as const));
  const hierarchy = boundedOption(options.hierarchyStrength, 1, 0, 1);
  const attraction = boundedOption(options.attractionStrength, 1, 0, 2);
  const repulsion = boundedOption(options.repulsionStrength, 1, 0, 2);
  const groupStrength = boundedOption(options.groupStrength, 0.72, 0, 2);
  const groupSeparation = boundedOption(
    options.groupSeparationStrength,
    1,
    0,
    2,
  );

  // Anchors are deliberately soft in both axes. They retain the authored map
  // as a broad orientation without freezing rows or clamping nodes to bands.
  for (const node of nodes) {
    addForce(
      forces,
      node.id,
      (node.anchorX - node.x) * hierarchy * 0.0032,
      (node.anchorY - node.y) * hierarchy * 0.0026,
    );
  }

  // A hub must not receive one full spring per incident edge: otherwise a
  // dense prerequisite star overwhelms anchors and repulsion. Weighted load
  // preserves ordinary low-degree links while reducing aggregate hub force.
  const linkLoad = new Map<string, number>(
    nodes.map(({ id }) => [id, 0] as const),
  );
  for (const link of links) {
    if (!byId.has(link.source) || !byId.has(link.target)) {
      continue;
    }
    linkLoad.set(
      link.source,
      (linkLoad.get(link.source) ?? 0) + link.strength,
    );
    linkLoad.set(
      link.target,
      (linkLoad.get(link.target) ?? 0) + link.strength,
    );
  }

  for (const link of links) {
    const source = byId.get(link.source);
    const target = byId.get(link.target);
    if (!source || !target) {
      continue;
    }
    let dx = target.x + target.width / 2 - (source.x + source.width / 2);
    let dy = target.y + target.height / 2 - (source.y + source.height / 2);
    let distance = Math.hypot(dx, dy);
    if (distance < 0.001) {
      const direction = deterministicDirection(source.id, target.id);
      dx = direction.x;
      dy = direction.y;
      distance = 1;
    }
    const maximumLoad = Math.max(
      linkLoad.get(source.id) ?? 0,
      linkLoad.get(target.id) ?? 0,
    );
    const degreeNormalization = 1 / Math.max(1, maximumLoad / 4);
    let spring = 0;
    if (link.kind === "proximity") {
      // Graph-distance-two/three links describe a neighbourhood, not a
      // mandate to pull remote parts of the map together. Their attraction is
      // captured only near the desired radius and fades smoothly to zero.
      const captureMultiplier = link.distance === 2 ? 1.65 : 1.45;
      const captureDistance = link.desiredDistance * captureMultiplier;
      if (
        distance > link.desiredDistance &&
        distance < captureDistance
      ) {
        const captureProgress =
          (captureDistance - distance) /
          (captureDistance - link.desiredDistance);
        const smoothCapture =
          captureProgress * captureProgress * (3 - 2 * captureProgress);
        spring =
          (distance - link.desiredDistance) *
          0.0017 *
          link.strength *
          degreeNormalization *
          smoothCapture *
          attraction;
      }
    } else {
      const anchorDx =
        target.anchorX + target.width / 2 -
        (source.anchorX + source.width / 2);
      const anchorDy =
        target.anchorY + target.height / 2 -
        (source.anchorY + source.height / 2);
      const authoredDistance = Math.hypot(anchorDx, anchorDy);
      const restDistance = Math.max(
        link.desiredDistance * 0.8,
        authoredDistance || link.desiredDistance,
      );
      const spatialNormalization = Math.min(
        1,
        link.desiredDistance / restDistance,
      );
      spring =
        clamp(distance - restDistance, -420, 420) *
        0.0017 *
        link.strength *
        degreeNormalization *
        spatialNormalization *
        attraction;
    }
    const forceX = (dx / distance) * spring;
    const forceY = (dy / distance) * spring;
    addForce(forces, source.id, forceX, forceY);
    addForce(forces, target.id, -forceX, -forceY);

    if (
      hierarchy > 0 &&
      (link.kind === "prerequisite" || link.kind === "contextual")
    ) {
      const rankDifference = Math.max(
        1,
        (target.rank ?? 0) - (source.rank ?? 0),
      );
      const minimumVerticalGap = Math.min(
        310,
        150 + (rankDifference - 1) * 34,
      );
      const orderError = minimumVerticalGap - dy;
      if (orderError > 0) {
        const orderForce = Math.min(2.2, orderError * 0.008 * hierarchy);
        addForce(forces, source.id, 0, -orderForce);
        addForce(forces, target.id, 0, orderForce);
      }
    }
  }

  const groups = new Map<string, KnowledgeGraphSimulationNode[]>();
  for (const node of nodes) {
    const groupId = nodeGroupId(node);
    const group = groups.get(groupId);
    if (group) {
      group.push(node);
    } else {
      groups.set(groupId, [node]);
    }
  }
  const groupEntries = [...groups.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([id, members]) => {
      const count = members.length;
      return {
        id,
        members,
        x:
          members.reduce((sum, node) => sum + node.x + node.width / 2, 0) /
          count,
        y:
          members.reduce((sum, node) => sum + node.y + node.height / 2, 0) /
          count,
        anchorX:
          members.reduce(
            (sum, node) => sum + node.anchorX + node.width / 2,
            0,
          ) / count,
        anchorY:
          members.reduce(
            (sum, node) => sum + node.anchorY + node.height / 2,
            0,
          ) / count,
        radius: 138 + 28 * Math.sqrt(count),
        semantic: members.some((node) => Boolean(node.groupId?.trim())),
      };
    });

  // Preserve each group's authored local shape around its moving centroid.
  // Pulling every member directly to the centroid has a zero rest radius and
  // inevitably turns continuous simulation into a collision loop.
  for (const group of groupEntries) {
    for (const node of group.members) {
      const centerX = node.x + node.width / 2;
      const centerY = node.y + node.height / 2;
      const targetX =
        group.x + (node.anchorX + node.width / 2 - group.anchorX);
      const targetY =
        group.y + (node.anchorY + node.height / 2 - group.anchorY);
      addForce(
        forces,
        node.id,
        (targetX - centerX) * groupStrength * 0.0016,
        (targetY - centerY) * groupStrength * 0.0011,
      );
    }
  }

  // Treat clusters as soft discs. Shifted inverse-square repulsion is strong
  // at contact, decays with distance, and reaches exactly zero at the cutoff.
  // A pair force is divided among members so group size cannot multiply it.
  for (const [groupIndex, group] of groupEntries.entries()) {
    for (const other of groupEntries.slice(groupIndex + 1)) {
      if (!group.semantic || !other.semantic) {
        continue;
      }
      let dx = other.x - group.x;
      let dy = other.y - group.y;
      let distance = Math.hypot(dx, dy);
      if (distance < 0.001) {
        const direction = deterministicDirection(group.id, other.id);
        dx = direction.x;
        dy = direction.y;
        distance = 1;
      }
      const surfaceGap = distance - group.radius - other.radius;
      const magnitude = softenedInverseSquare(
        surfaceGap,
        240,
        120,
        6_500 * groupSeparation,
        0.72,
      );
      if (magnitude === 0) {
        continue;
      }
      const forceX = (dx / distance) * magnitude;
      const forceY = (dy / distance) * magnitude;
      const groupScale = 1 / group.members.length;
      const otherScale = 1 / other.members.length;
      for (const node of group.members) {
        addForce(
          forces,
          node.id,
          -forceX * groupScale,
          -forceY * groupScale,
        );
      }
      for (const node of other.members) {
        addForce(
          forces,
          node.id,
          forceX * otherScale,
          forceY * otherScale,
        );
      }
    }
  }

  const repelNodePair = (
    node: KnowledgeGraphSimulationNode,
    other: KnowledgeGraphSimulationNode,
  ): void => {
    let dx = other.x + other.width / 2 - (node.x + node.width / 2);
    let dy = other.y + other.height / 2 - (node.y + node.height / 2);
    let distance = Math.hypot(dx, dy);
    if (distance < 0.001) {
      const direction = deterministicDirection(node.id, other.id);
      dx = direction.x;
      dy = direction.y;
      distance = 1;
    }
    const directionX = dx / distance;
    const directionY = dy / distance;
    const surfaceGap =
      distance -
      rectangleSupportRadius(node, directionX, directionY) -
      rectangleSupportRadius(other, -directionX, -directionY);
    const differentGroup = nodeGroupId(node) !== nodeGroupId(other);
    const magnitude = softenedInverseSquare(
      surfaceGap,
      differentGroup ? 260 : 180,
      80,
      3_600 * repulsion +
        (differentGroup ? 2_200 * groupSeparation : 0),
      1.2,
    );
    if (magnitude === 0) {
      return;
    }
    const forceX = directionX * magnitude;
    const forceY = directionY * magnitude;
    addForce(forces, node.id, -forceX, -forceY);
    addForce(forces, other.id, forceX, forceY);
  };

  // At the current map size a deterministic numeric all-pairs pass is cheaper
  // than allocating string keys and Sets. Larger graphs retain a broad phase.
  if (nodes.length <= 256) {
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      if (!node) {
        continue;
      }
      for (
        let otherIndex = index + 1;
        otherIndex < nodes.length;
        otherIndex += 1
      ) {
        const other = nodes[otherIndex];
        if (other) {
          repelNodePair(node, other);
        }
      }
    }
  } else {
    let cellSize = 560;
    for (const node of nodes) {
      cellSize = Math.max(cellSize, node.width + 300, node.height + 300);
    }
    const buckets = new Map<string, number[]>();
    for (const [index, node] of nodes.entries()) {
      const cellX = Math.floor((node.x + node.width / 2) / cellSize);
      const cellY = Math.floor((node.y + node.height / 2) / cellSize);
      const key = `${cellX}:${cellY}`;
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.push(index);
      } else {
        buckets.set(key, [index]);
      }
    }
    for (const [index, node] of nodes.entries()) {
      const cellX = Math.floor((node.x + node.width / 2) / cellSize);
      const cellY = Math.floor((node.y + node.height / 2) / cellSize);
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          const candidates =
            buckets.get(`${cellX + offsetX}:${cellY + offsetY}`) ?? [];
          for (const otherIndex of candidates) {
            const other = nodes[otherIndex];
            if (otherIndex > index && other) {
              repelNodePair(node, other);
            }
          }
        }
      }
    }
  }

  const minimumX = options.minimumX ?? 16;
  const minimumY = options.minimumY ?? 16;
  const targetCenterX = (minimumX + options.maximumX) / 2;
  const targetCenterY = (minimumY + options.maximumY) / 2;
  const currentCenterX =
    nodes.reduce((sum, node) => sum + node.x + node.width / 2, 0) /
    Math.max(1, nodes.length);
  const currentCenterY =
    nodes.reduce((sum, node) => sum + node.y + node.height / 2, 0) /
    Math.max(1, nodes.length);
  const restoreX = (targetCenterX - currentCenterX) * 0.0007;
  const restoreY = (targetCenterY - currentCenterY) * 0.0007;
  for (const node of nodes) {
    addForce(forces, node.id, restoreX, restoreY);
  }

  for (const node of nodes) {
    if (node.id === options.pinnedId) {
      node.velocityX = 0;
      node.velocityY = 0;
      continue;
    }
    const force = forces.get(node.id) ?? { x: 0, y: 0 };
    node.velocityX = clamp((node.velocityX + force.x) * 0.78, -6, 6);
    node.velocityY = clamp((node.velocityY + force.y) * 0.78, -6, 6);
    node.x = clamp(
      node.x + node.velocityX,
      minimumX,
      Math.max(minimumX, options.maximumX - node.width),
    );
    node.y = clamp(
      node.y + node.velocityY,
      minimumY,
      Math.max(minimumY, options.maximumY - node.height),
    );
    if (node.x === minimumX || node.x === options.maximumX - node.width) {
      node.velocityX *= 0.4;
    }
    if (node.y === minimumY || node.y === options.maximumY - node.height) {
      node.velocityY *= 0.4;
    }
  }

  projectSimulationCollisions(nodes, options);

  let maximumMovement = 0;
  for (const node of nodes) {
    const previous = previousCoordinates.get(node.id);
    if (!previous) {
      continue;
    }
    maximumMovement = Math.max(
      maximumMovement,
      Math.hypot(node.x - previous.x, node.y - previous.y),
    );
  }
  return maximumMovement;
}

export function settleKnowledgeGraphSimulation(
  inputNodes: readonly KnowledgeGraphSimulationNode[],
  links: readonly KnowledgeGraphSimulationLink[],
  options: SettleKnowledgeGraphSimulationOptions,
): SettledKnowledgeGraphSimulation {
  const nodes = inputNodes.map((node) => ({ ...node }));
  if (options.reducedMotion) {
    return { nodes, frames: 0, reason: "reduced-motion" };
  }
  const maxFrames =
    options.maxFrames ?? KNOWLEDGE_GRAPH_SIMULATION_MAX_FRAMES;
  const maxDurationMs =
    options.maxDurationMs ?? KNOWLEDGE_GRAPH_SIMULATION_MAX_DURATION_MS;
  const deterministicFrameLimit = Math.min(
    maxFrames,
    Math.max(1, Math.floor(maxDurationMs / (1_000 / 60))),
  );
  const stableFrameTarget =
    options.stableFrames ?? KNOWLEDGE_GRAPH_SIMULATION_STABLE_FRAMES;
  const stableMovement =
    options.stableMovement ?? KNOWLEDGE_GRAPH_SIMULATION_STABLE_MOVEMENT;
  let stableFrameCount = 0;
  for (let frame = 1; frame <= deterministicFrameLimit; frame += 1) {
    const movement = stepKnowledgeGraphSimulation(nodes, links, options);
    stableFrameCount = movement <= stableMovement ? stableFrameCount + 1 : 0;
    if (stableFrameCount >= stableFrameTarget) {
      return { nodes, frames: frame, reason: "settled" };
    }
  }
  return { nodes, frames: deterministicFrameLimit, reason: "frame-limit" };
}
