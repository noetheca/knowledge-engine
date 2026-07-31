const MIN_SCALE = 0.25;
const MAX_SCALE = 2.4;

import { getUiStrings } from "../i18n/ui.js";

interface Transform {
  x: number;
  y: number;
  scale: number;
}

interface PointerPosition {
  x: number;
  y: number;
}

interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityX: number;
  velocityY: number;
}

interface NodeDrag {
  pointerId: number;
  node: HTMLButtonElement;
  nodeId: string;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  moved: boolean;
}

interface GraphConnection {
  source: string;
  target: string;
  directional: boolean;
  restX: number;
  restY: number;
  restDistance: number;
}

interface SafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface ReaderRelation {
  id: string;
  title: string;
  href: string;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function initializeKnowledgeGraph(root: HTMLElement): void {
  if (root.dataset.enhanced === "true") {
    return;
  }
  const defaultUi = getUiStrings(
    root.dataset.locale ?? document.documentElement.lang,
  ).graph;
  let ui = defaultUi;
  if (root.dataset.ui) {
    try {
      const labels = JSON.parse(root.dataset.ui) as Partial<typeof defaultUi>;
      ui = {
        ...defaultUi,
        ...labels,
        status: {
          ...defaultUi.status,
          ...labels.status,
        },
      };
    } catch {
      // Keep the locale defaults when server-provided labels are malformed.
    }
  }

  const viewport = root.querySelector<HTMLElement>("[data-graph-viewport]");
  const world = root.querySelector<HTMLElement>("[data-graph-world]");
  const inspector = root.querySelector<HTMLElement>("[data-graph-inspector]");
  const fitButton = root.querySelector<HTMLButtonElement>("[data-graph-fit]");
  const viewButton =
    root.querySelector<HTMLButtonElement>("[data-graph-view-toggle]");
  const shell = root.querySelector<HTMLElement>(".kg-shell");
  const reader = root.querySelector<HTMLElement>("[data-knowledge-reader]");
  const readerPanel = root.querySelector<HTMLElement>("[data-reader-panel]");
  const readerContent =
    root.querySelector<HTMLElement>("[data-reader-content]");
  const readerNavigation =
    root.querySelector<HTMLElement>("[data-reader-navigation]");
  const readerFullPage =
    root.querySelector<HTMLAnchorElement>("[data-reader-full-page]");
  const thumbnailToggle =
    root.querySelector<HTMLButtonElement>("[data-graph-thumbnail-toggle]");
  const settings =
    root.querySelector<HTMLDetailsElement>("[data-graph-settings]");
  const settingsSummary = settings?.querySelector<HTMLElement>("summary");
  const nodeSizeControl =
    root.querySelector<HTMLInputElement>("[data-node-size-control]");
  const nodeSizeOutput =
    root.querySelector<HTMLOutputElement>("[data-node-size-output]");
  const repulsionControl =
    root.querySelector<HTMLInputElement>("[data-repulsion-control]");
  const repulsionOutput =
    root.querySelector<HTMLOutputElement>("[data-repulsion-output]");

  if (
    !viewport ||
    !world ||
    !inspector ||
    !fitButton ||
    !viewButton ||
    !shell ||
    !reader ||
    !readerPanel ||
    !readerContent ||
    !readerNavigation ||
    !readerFullPage
  ) {
    return;
  }

  const graphWidth = Number(world.dataset.graphWidth);
  const graphHeight = Number(world.dataset.graphHeight);
  if (!Number.isFinite(graphWidth) || !Number.isFinite(graphHeight)) {
    return;
  }

  const transform: Transform = { x: 0, y: 0, scale: 1 };
  const pointers = new Map<number, PointerPosition>();
  const nodeElements = [
    ...root.querySelectorAll<HTMLButtonElement>("[data-knowledge-node]"),
  ];
  const nodePositions = new Map<string, NodePosition>();
  const nodeBaseSizes = new Map<string, { width: number; height: number }>();
  const chronologyAnchorCentersY = new Map<string, number>();
  const chronologyAnchored = root.dataset.chronologyAxis === "y";
  for (const node of nodeElements) {
    const nodeId = node.dataset.knowledgeNode;
    if (!nodeId) {
      continue;
    }
    const initialY = Number.parseFloat(node.style.top);
    const initialWidth = Number.parseFloat(node.style.width);
    const initialHeight = Number.parseFloat(node.style.height);
    nodePositions.set(nodeId, {
      x: Number.parseFloat(node.style.left),
      y: initialY,
      width: initialWidth,
      height: initialHeight,
      velocityX: 0,
      velocityY: 0,
    });
    nodeBaseSizes.set(nodeId, {
      width: initialWidth,
      height: initialHeight,
    });
    chronologyAnchorCentersY.set(nodeId, initialY + initialHeight / 2);
  }
  const nodeElementsById = new Map(
    nodeElements.flatMap((node) => {
      const nodeId = node.dataset.knowledgeNode;
      return nodeId ? [[nodeId, node] as const] : [];
    }),
  );
  const edgeArrowsById = new Map(
    [...root.querySelectorAll<SVGPolygonElement>("[data-knowledge-arrow]")]
      .flatMap((arrow) => {
        const edgeId = arrow.dataset.knowledgeArrow;
        return edgeId ? [[edgeId, arrow] as const] : [];
      }),
  );
  const contextualRestDistance = (
    source: NodePosition,
    target: NodePosition,
  ): number =>
    clamp(
      Math.max(
        (source.width + target.width) / 2,
        (source.height + target.height) / 2,
      ) + 72,
      220,
      360,
    );
  const connections: GraphConnection[] = [];
  for (const edge of root.querySelectorAll<SVGPathElement>(
    "[data-knowledge-edge]",
  )) {
    if (edge.dataset.edgeKind === "related") {
      continue;
    }
    const sourceId = edge.dataset.edgeSource;
    const targetId = edge.dataset.edgeTarget;
    const source = sourceId ? nodePositions.get(sourceId) : undefined;
    const target = targetId ? nodePositions.get(targetId) : undefined;
    if (!sourceId || !targetId || !source || !target) {
      continue;
    }
    connections.push({
      source: sourceId,
      target: targetId,
      directional: edge.dataset.edgeKind === "contextual",
      restX: target.x - source.x,
      restY: target.y - source.y,
      restDistance: contextualRestDistance(source, target),
    });
  }

  let panAnchor: PointerPosition | undefined;
  let pinchDistance = 0;
  let pinchScale = 1;
  let pinchWorldPoint: PointerPosition | undefined;
  let nodeDrag: NodeDrag | undefined;
  let suppressNodeClickUntil = 0;
  let inspectorPositionFrame = 0;
  let simulationFrame = 0;
  let simulationTicks = 0;
  let simulationAnchorId: string | undefined;
  let contextualLayoutWarmed = false;
  let contextualUnrenderedMotion = 0;
  let contextualRepulsionMultiplier = 1;
  let readerRequest: AbortController | undefined;
  let readerTrigger: HTMLElement | undefined;
  const readerModalQuery = window.matchMedia("(max-width: 52rem)");
  const reducedMotionQuery = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  const contextualRelationships =
    root.dataset.relationshipMode === "contextual";
  const listFirst =
    root.dataset.initialView === "list" ||
    (root.dataset.initialView === "responsive" &&
      window.matchMedia("(max-width: 40rem)").matches &&
      nodeElements.length > 16);
  if (listFirst) {
    root.dataset.view = "list";
    viewButton.setAttribute("aria-pressed", "true");
    viewButton.textContent = ui.map;
  }

  const getSafeArea = (): SafeArea => {
    const bounds = viewport.getBoundingClientRect();
    return {
      top: bounds.width < 640 ? 148 : 128,
      right: bounds.width < 640 ? 12 : 24,
      bottom: bounds.width < 640 ? 24 : 36,
      left: bounds.width < 640 ? 12 : 24,
    };
  };

  const selectedNodeElement = (): HTMLButtonElement | undefined => {
    const nodeId = root.dataset.selectedNode;
    if (!nodeId) {
      return undefined;
    }
    return nodeElementsById.get(nodeId);
  };

  const positionInspector = (node: HTMLButtonElement): void => {
    if (inspector.getAttribute("aria-hidden") === "true") {
      return;
    }

    const viewportBounds = viewport.getBoundingClientRect();
    const nodeBounds = node.getBoundingClientRect();
    const inspectorBounds = inspector.getBoundingClientRect();
    const safe = getSafeArea();
    const gap = 20;
    const bubbleWidth = inspectorBounds.width;
    const bubbleHeight = inspectorBounds.height;
    const nodeLeft = nodeBounds.left - viewportBounds.left;
    const nodeTop = nodeBounds.top - viewportBounds.top;
    const nodeRight = nodeBounds.right - viewportBounds.left;
    const nodeBottom = nodeBounds.bottom - viewportBounds.top;
    const nodeCenterX = (nodeLeft + nodeRight) / 2;
    const nodeCenterY = (nodeTop + nodeBottom) / 2;
    const maximumLeft = Math.max(
      safe.left,
      viewportBounds.width - safe.right - bubbleWidth,
    );
    const maximumTop = Math.max(
      safe.top,
      viewportBounds.height - safe.bottom - bubbleHeight,
    );

    let placement: "right" | "left" | "bottom" | "top";
    let left: number;
    let top: number;
    let tailOffset: number;

    const canPlaceRight =
      nodeRight + gap + bubbleWidth <= viewportBounds.width - safe.right;
    const canPlaceLeft = nodeLeft - gap - bubbleWidth >= safe.left;
    const preferVertical = viewportBounds.width < 720;

    if (!preferVertical && (canPlaceRight || !canPlaceLeft)) {
      placement = "right";
      left = clamp(nodeRight + gap, safe.left, maximumLeft);
      top = clamp(nodeCenterY - bubbleHeight / 2, safe.top, maximumTop);
      tailOffset = clamp(nodeCenterY - top, 24, bubbleHeight - 24);
    } else if (!preferVertical && canPlaceLeft) {
      placement = "left";
      left = clamp(nodeLeft - gap - bubbleWidth, safe.left, maximumLeft);
      top = clamp(nodeCenterY - bubbleHeight / 2, safe.top, maximumTop);
      tailOffset = clamp(nodeCenterY - top, 24, bubbleHeight - 24);
    } else {
      const canPlaceBelow =
        nodeBottom + gap + bubbleHeight <= viewportBounds.height - safe.bottom;
      placement = canPlaceBelow ? "bottom" : "top";
      left = clamp(nodeCenterX - bubbleWidth / 2, safe.left, maximumLeft);
      top = canPlaceBelow
        ? clamp(nodeBottom + gap, safe.top, maximumTop)
        : clamp(nodeTop - gap - bubbleHeight, safe.top, maximumTop);
      tailOffset = clamp(nodeCenterX - left, 24, bubbleWidth - 24);
    }

    inspector.style.left = `${left}px`;
    inspector.style.top = `${top}px`;
    inspector.style.setProperty("--kg-tail-offset", `${tailOffset}px`);
    inspector.dataset.placement = placement;
  };

  const scheduleInspectorPosition = (): void => {
    if (inspectorPositionFrame) {
      cancelAnimationFrame(inspectorPositionFrame);
    }
    inspectorPositionFrame = requestAnimationFrame(() => {
      inspectorPositionFrame = 0;
      const node = selectedNodeElement();
      if (node) {
        positionInspector(node);
      }
    });
  };

  const renderTransform = (): void => {
    world.style.transform =
      `translate(${transform.x}px, ${transform.y}px) ` +
      `scale(${transform.scale})`;
    scheduleInspectorPosition();
  };

  const connectionPoint = (
    from: NodePosition,
    toward: NodePosition,
    gap: number,
  ): PointerPosition => {
    const fromCenterX = from.x + from.width / 2;
    const fromCenterY = from.y + from.height / 2;
    const towardCenterX = toward.x + toward.width / 2;
    const towardCenterY = toward.y + toward.height / 2;
    const dx = towardCenterX - fromCenterX;
    const dy = towardCenterY - fromCenterY;
    const distance = Math.hypot(dx, dy) || 1;
    const directionX = dx / distance;
    const directionY = dy / distance;
    const horizontalRadius =
      Math.abs(directionX) > 0
        ? from.width / 2 / Math.abs(directionX)
        : Number.POSITIVE_INFINITY;
    const verticalRadius =
      Math.abs(directionY) > 0
        ? from.height / 2 / Math.abs(directionY)
        : Number.POSITIVE_INFINITY;
    const radius = Math.min(horizontalRadius, verticalRadius);
    return {
      x: fromCenterX + directionX * (radius + gap),
      y: fromCenterY + directionY * (radius + gap),
    };
  };

  const updateEdges = (): void => {
    for (const edge of root.querySelectorAll<SVGPathElement>(
      "[data-knowledge-edge]",
    )) {
      const sourceId = edge.dataset.edgeSource;
      const targetId = edge.dataset.edgeTarget;
      const source = sourceId ? nodePositions.get(sourceId) : undefined;
      const target = targetId ? nodePositions.get(targetId) : undefined;
      if (!source || !target) {
        continue;
      }
      const prerequisite = edge.dataset.edgeKind !== "related";
      const start = connectionPoint(source, target, 4);
      const end = connectionPoint(target, source, prerequisite ? 14 : 4);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const distance = Math.hypot(dx, dy) || 1;
      const directionX = dx / distance;
      const directionY = dy / distance;
      const arrowLength = Math.min(18, distance * 0.4);
      const arrowHalfWidth = Math.min(10, distance * 0.2);
      const arrowBase = {
        x: end.x - directionX * arrowLength,
        y: end.y - directionY * arrowLength,
      };
      const edgeId = edge.dataset.knowledgeEdge;
      const arrow = edgeId ? edgeArrowsById.get(edgeId) : undefined;
      if (arrow) {
        edge.setAttribute(
          "d",
          `M ${start.x} ${start.y} L ${arrowBase.x} ${arrowBase.y}`,
        );
        const perpendicularX = -directionY;
        const perpendicularY = directionX;
        arrow.setAttribute(
          "points",
          [
            `${end.x},${end.y}`,
            `${arrowBase.x + perpendicularX * arrowHalfWidth},${arrowBase.y + perpendicularY * arrowHalfWidth}`,
            `${arrowBase.x - perpendicularX * arrowHalfWidth},${arrowBase.y - perpendicularY * arrowHalfWidth}`,
          ].join(" "),
        );
      } else {
        edge.setAttribute(
          "d",
          `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
        );
      }
    }
  };

  const renderNodePositions = (): void => {
    for (const [nodeId, position] of nodePositions) {
      const node = nodeElementsById.get(nodeId);
      if (!node) {
        continue;
      }
      node.style.left = `${position.x}px`;
      node.style.top = `${position.y}px`;
    }
    updateEdges();
    scheduleInspectorPosition();
  };

  const applyNodeScale = (scale: number): void => {
    for (const [nodeId, position] of nodePositions) {
      const baseSize = nodeBaseSizes.get(nodeId);
      const node = nodeElementsById.get(nodeId);
      if (!baseSize || !node) {
        continue;
      }
      const centerX = position.x + position.width / 2;
      const centerY = position.y + position.height / 2;
      position.width = baseSize.width * scale;
      position.height = baseSize.height * scale;
      position.x = centerX - position.width / 2;
      position.y = centerY - position.height / 2;
      position.velocityX = 0;
      position.velocityY = 0;
      node.style.width = `${position.width}px`;
      node.style.height = `${position.height}px`;
    }
    for (const connection of connections) {
      const source = nodePositions.get(connection.source);
      const target = nodePositions.get(connection.target);
      if (source && target) {
        connection.restDistance = contextualRestDistance(source, target);
      }
    }
    contextualUnrenderedMotion = 0;
    renderNodePositions();
    startSimulation();
  };

  const contextualSimulationCanRun = (): boolean =>
    contextualRelationships &&
    !document.hidden &&
    !reducedMotionQuery.matches &&
    root.dataset.view !== "list" &&
    root.isConnected;

  const stepContextualSimulation = (render = true): number => {
    const pinnedNodeId = nodeDrag?.nodeId;

    for (const connection of connections) {
      const source = nodePositions.get(connection.source);
      const target = nodePositions.get(connection.target);
      if (!source || !target) {
        continue;
      }
      const sourceCenterX = source.x + source.width / 2;
      const sourceCenterY = source.y + source.height / 2;
      const targetCenterX = target.x + target.width / 2;
      const targetCenterY = target.y + target.height / 2;
      const deltaX = targetCenterX - sourceCenterX;
      const deltaY = targetCenterY - sourceCenterY;
      const distance = Math.hypot(deltaX, deltaY) || 1;
      const extension = distance - connection.restDistance;
      const force = extension * 0.0042;
      const forceX = (deltaX / distance) * force;
      const forceY = (deltaY / distance) * force;
      if (connection.source !== pinnedNodeId) {
        source.velocityX += forceX;
        source.velocityY += forceY;
      }
      if (connection.target !== pinnedNodeId) {
        target.velocityX -= forceX;
        target.velocityY -= forceY;
      }
      if (connection.directional) {
        const verticalError =
          targetCenterY - sourceCenterY - connection.restDistance * 0.72;
        const verticalForce = verticalError * 0.0028;
        if (connection.source !== pinnedNodeId) {
          source.velocityY += verticalForce;
        }
        if (connection.target !== pinnedNodeId) {
          target.velocityY -= verticalForce;
        }
      }
    }

    // Keep unrelated nodes away from visible relationship segments. Directly
    // dragged nodes remain under the pointer and are corrected after release.
    for (const connection of connections) {
      const source = nodePositions.get(connection.source);
      const target = nodePositions.get(connection.target);
      if (!source || !target) {
        continue;
      }
      const sourceCenterX = source.x + source.width / 2;
      const sourceCenterY = source.y + source.height / 2;
      const targetCenterX = target.x + target.width / 2;
      const targetCenterY = target.y + target.height / 2;
      const segmentX = targetCenterX - sourceCenterX;
      const segmentY = targetCenterY - sourceCenterY;
      const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
      if (segmentLengthSquared < 0.001) {
        continue;
      }
      const segmentLength = Math.sqrt(segmentLengthSquared);
      for (const [nodeId, position] of nodePositions) {
        if (
          nodeId === connection.source ||
          nodeId === connection.target ||
          nodeId === pinnedNodeId
        ) {
          continue;
        }
        const centerX = position.x + position.width / 2;
        const centerY = position.y + position.height / 2;
        const projection = clamp(
          ((centerX - sourceCenterX) * segmentX +
            (centerY - sourceCenterY) * segmentY) /
            segmentLengthSquared,
          0,
          1,
        );
        const closestX = sourceCenterX + segmentX * projection;
        const closestY = sourceCenterY + segmentY * projection;
        let offsetX = centerX - closestX;
        let offsetY = centerY - closestY;
        let distance = Math.hypot(offsetX, offsetY);
        if (distance < 0.001) {
          const sign = nodeId < `${connection.source}\0${connection.target}`
            ? -1
            : 1;
          offsetX = (-segmentY / segmentLength) * sign;
          offsetY = (segmentX / segmentLength) * sign;
          distance = 1;
        }
        const clearance =
          Math.hypot(position.width, position.height) / 2 + 14;
        if (distance >= clearance) {
          continue;
        }
        const force = (clearance - distance) * 0.018;
        position.velocityX += (offsetX / distance) * force;
        position.velocityY += (offsetY / distance) * force;
      }
    }

    const entries = [...nodePositions.entries()];
    const repulsionRange = 620;
    for (let index = 0; index < entries.length; index += 1) {
      const firstEntry = entries[index];
      if (!firstEntry) {
        continue;
      }
      const [firstId, first] = firstEntry;
      for (
        let comparisonIndex = index + 1;
        comparisonIndex < entries.length;
        comparisonIndex += 1
      ) {
        const secondEntry = entries[comparisonIndex];
        if (!secondEntry) {
          continue;
        }
        const [secondId, second] = secondEntry;
        let deltaX =
          second.x + second.width / 2 - (first.x + first.width / 2);
        let deltaY =
          second.y + second.height / 2 - (first.y + first.height / 2);
        let distance = Math.hypot(deltaX, deltaY);
        if (distance < 0.001) {
          const angle = ((index * 37 + comparisonIndex * 61) % 360) *
            (Math.PI / 180);
          deltaX = Math.cos(angle);
          deltaY = Math.sin(angle);
          distance = 1;
        }

        if (distance < repulsionRange) {
          const repulsion =
            ((repulsionRange - distance) / repulsionRange) *
            0.32 *
            contextualRepulsionMultiplier;
          const forceX = (deltaX / distance) * repulsion;
          const forceY = (deltaY / distance) * repulsion;
          if (firstId !== pinnedNodeId) {
            first.velocityX -= forceX;
            first.velocityY -= forceY;
          }
          if (secondId !== pinnedNodeId) {
            second.velocityX += forceX;
            second.velocityY += forceY;
          }
        }

        const overlapX =
          (first.width + second.width) / 2 + 28 - Math.abs(deltaX);
        const overlapY =
          (first.height + second.height) / 2 + 28 - Math.abs(deltaY);
        if (overlapX <= 0 || overlapY <= 0) {
          continue;
        }
        if (overlapX < overlapY) {
          const force = Math.sign(deltaX || 1) * overlapX * 0.024;
          if (firstId !== pinnedNodeId) {
            first.velocityX -= force;
          }
          if (secondId !== pinnedNodeId) {
            second.velocityX += force;
          }
        } else {
          const force = Math.sign(deltaY || 1) * overlapY * 0.024;
          if (firstId !== pinnedNodeId) {
            first.velocityY -= force;
          }
          if (secondId !== pinnedNodeId) {
            second.velocityY += force;
          }
        }
      }
    }

    const graphCenterX = graphWidth / 2;
    const graphCenterY = graphHeight / 2;
    let maximumMovement = 0;
    for (const [nodeId, position] of nodePositions) {
      if (nodeId === pinnedNodeId) {
        position.velocityX = 0;
        position.velocityY = 0;
        continue;
      }
      const centerX = position.x + position.width / 2;
      const centerY = position.y + position.height / 2;
      position.velocityX += (graphCenterX - centerX) * 0.00055;
      position.velocityY += (graphCenterY - centerY) * 0.00055;
      if (chronologyAnchored) {
        const anchorCenterY = chronologyAnchorCentersY.get(nodeId);
        if (anchorCenterY !== undefined) {
          position.velocityY += (anchorCenterY - centerY) * 0.0032;
        }
      }
      position.velocityX = clamp(position.velocityX * 0.86, -12, 12);
      position.velocityY = clamp(position.velocityY * 0.86, -12, 12);
      position.x += position.velocityX;
      position.y += position.velocityY;
      maximumMovement = Math.max(
        maximumMovement,
        Math.hypot(position.velocityX, position.velocityY),
      );
    }

    if (render) {
      contextualUnrenderedMotion += maximumMovement;
      if (contextualUnrenderedMotion >= 0.08) {
        contextualUnrenderedMotion = 0;
        renderNodePositions();
      }
    }
    return maximumMovement;
  };

  const warmContextualLayout = (): void => {
    if (contextualLayoutWarmed) {
      return;
    }
    contextualLayoutWarmed = true;
    for (let tick = 0; tick < 180; tick += 1) {
      stepContextualSimulation(false);
    }
    contextualUnrenderedMotion = 0;
    renderNodePositions();
  };

  const runSimulation = (): void => {
    simulationFrame = 0;
    if (contextualRelationships) {
      if (!contextualSimulationCanRun()) {
        return;
      }
      stepContextualSimulation();
      simulationFrame = requestAnimationFrame(runSimulation);
      return;
    }
    simulationTicks += 1;
    const pinnedNodeId = nodeDrag?.nodeId ?? simulationAnchorId;

    for (const connection of connections) {
      const source = nodePositions.get(connection.source);
      const target = nodePositions.get(connection.target);
      if (!source || !target) {
        continue;
      }
      const errorX = target.x - source.x - connection.restX;
      const errorY = target.y - source.y - connection.restY;
      const forceX = errorX * 0.032;
      const forceY = errorY * 0.032;
      if (connection.source !== pinnedNodeId) {
        source.velocityX += forceX;
        source.velocityY += forceY;
      }
      if (connection.target !== pinnedNodeId) {
        target.velocityX -= forceX;
        target.velocityY -= forceY;
      }
    }

    const entries = [...nodePositions.entries()];
    for (let index = 0; index < entries.length; index += 1) {
      const firstEntry = entries[index];
      if (!firstEntry) {
        continue;
      }
      const [firstId, first] = firstEntry;
      for (
        let comparisonIndex = index + 1;
        comparisonIndex < entries.length;
        comparisonIndex += 1
      ) {
        const secondEntry = entries[comparisonIndex];
        if (!secondEntry) {
          continue;
        }
        const [secondId, second] = secondEntry;
        const deltaX =
          second.x + second.width / 2 - (first.x + first.width / 2);
        const deltaY =
          second.y + second.height / 2 - (first.y + first.height / 2);
        const overlapX =
          (first.width + second.width) / 2 + 24 - Math.abs(deltaX);
        const overlapY =
          (first.height + second.height) / 2 + 24 - Math.abs(deltaY);
        if (overlapX <= 0 || overlapY <= 0) {
          continue;
        }

        if (overlapX < overlapY) {
          const force = Math.sign(deltaX || 1) * overlapX * 0.045;
          if (firstId !== pinnedNodeId) {
            first.velocityX -= force;
          }
          if (secondId !== pinnedNodeId) {
            second.velocityX += force;
          }
        } else {
          const force = Math.sign(deltaY || 1) * overlapY * 0.045;
          if (firstId !== pinnedNodeId) {
            first.velocityY -= force;
          }
          if (secondId !== pinnedNodeId) {
            second.velocityY += force;
          }
        }
      }
    }

    let energy = 0;
    for (const [nodeId, position] of nodePositions) {
      if (nodeId === pinnedNodeId) {
        position.velocityX = 0;
        position.velocityY = 0;
        continue;
      }
      position.velocityX *= 0.78;
      position.velocityY *= 0.78;
      position.x += position.velocityX;
      position.y += position.velocityY;
      energy +=
        Math.abs(position.velocityX) + Math.abs(position.velocityY);
    }

    renderNodePositions();
    if (nodeDrag || (simulationTicks < 90 && energy > 0.02)) {
      simulationFrame = requestAnimationFrame(runSimulation);
    } else {
      simulationAnchorId = undefined;
      simulationTicks = 0;
    }
  };

  const startSimulation = (anchorId?: string): void => {
    if (anchorId && !contextualRelationships) {
      simulationAnchorId = anchorId;
    }
    if (contextualRelationships) {
      if (!contextualSimulationCanRun()) {
        return;
      }
      warmContextualLayout();
    }
    if (!simulationFrame) {
      simulationTicks = 0;
      simulationFrame = requestAnimationFrame(runSimulation);
    }
  };

  const syncContextualSimulation = (): void => {
    if (!contextualRelationships) {
      return;
    }
    simulationAnchorId = undefined;
    if (contextualSimulationCanRun()) {
      startSimulation();
      return;
    }
    if (simulationFrame) {
      cancelAnimationFrame(simulationFrame);
      simulationFrame = 0;
    }
  };

  const showReaderMessage = (
    message: string,
    className: string,
  ): HTMLParagraphElement => {
    const paragraph = document.createElement("p");
    paragraph.className = className;
    paragraph.textContent = message;
    readerContent.replaceChildren(paragraph);
    return paragraph;
  };

  const resolveReaderRelation = (
    nodeId: string,
  ): ReaderRelation | undefined => {
    const template = root.querySelector<HTMLTemplateElement>(
      `template[data-knowledge-detail="${CSS.escape(nodeId)}"]`,
    );
    const title = template?.content.querySelector("h2")?.textContent?.trim();
    const href =
      template?.content.querySelector<HTMLAnchorElement>(".kg-cta")?.href;
    if (!title || !href) {
      return undefined;
    }
    return { id: nodeId, title, href };
  };

  const relationIds = (
    nodeId: string,
    selector: string,
  ): string[] => {
    const template = root.querySelector<HTMLTemplateElement>(
      `template[data-knowledge-detail="${CSS.escape(nodeId)}"]`,
    );
    if (!template) {
      return [];
    }
    return [
      ...template.content.querySelectorAll<HTMLElement>(
        `${selector} [data-select-node]`,
      ),
    ].flatMap((relation) => {
      const relationId = relation.dataset.selectNode;
      return relationId ? [relationId] : [];
    });
  };

  const createReaderNavSection = (
    label: string,
    relations: ReaderRelation[],
    direction: "previous" | "next" | "related",
  ): HTMLElement => {
    const section = document.createElement("section");
    section.className = "kg-reader-nav-section";
    section.dataset.direction = direction;
    const heading = document.createElement("h2");
    heading.textContent = label;
    section.append(heading);

    if (relations.length === 0) {
      const empty = document.createElement("p");
      empty.className = "kg-reader-nav-empty";
      empty.textContent = ui.noKnowledge;
      section.append(empty);
      return section;
    }

    const links = document.createElement("div");
    links.className = "kg-reader-nav-links";
    links.dataset.branching = String(relations.length > 1);
    links.style.setProperty(
      "--kg-branch-count",
      String(relations.length),
    );
    for (const relation of relations) {
      const link = document.createElement("a");
      link.className = "kg-reader-nav-link";
      link.href = relation.href;
      link.dataset.readerNode = relation.id;
      link.textContent = relation.title;
      links.append(link);
    }
    section.append(links);
    return section;
  };

  const renderReaderNavigation = (nodeId: string): void => {
    const previous = relationIds(
      nodeId,
      "[data-knowledge-previous]",
    ).flatMap((relationId) => {
      const relation = resolveReaderRelation(relationId);
      return relation ? [relation] : [];
    });
    const next = relationIds(
      nodeId,
      "[data-knowledge-next]",
    ).flatMap((relationId) => {
      const relation = resolveReaderRelation(relationId);
      return relation ? [relation] : [];
    });
    const sections = [
      createReaderNavSection(ui.previous, previous, "previous"),
      createReaderNavSection(ui.next, next, "next"),
    ];
    if (contextualRelationships) {
      const related = relationIds(
        nodeId,
        "[data-knowledge-related]",
      ).flatMap((relationId) => {
        const relation = resolveReaderRelation(relationId);
        return relation ? [relation] : [];
      });
      if (related.length > 0) {
        sections.push(
          createReaderNavSection(ui.related, related, "related"),
        );
      }
    }
    readerNavigation.replaceChildren(...sections);
  };

  const syncReaderModality = (): void => {
    const readerIsOpen = root.dataset.readerOpen !== undefined;
    const readerIsModal = readerModalQuery.matches;
    shell.inert = readerIsOpen && readerIsModal;
    readerPanel.setAttribute("aria-modal", String(readerIsModal));
  };

  const closeReader = (): void => {
    readerRequest?.abort();
    readerRequest = undefined;
    reader.setAttribute("aria-hidden", "true");
    readerPanel.setAttribute("aria-busy", "false");
    delete root.dataset.readerOpen;
    syncReaderModality();
    readerTrigger?.focus({ preventScroll: true });
    readerTrigger = undefined;
  };

  const openReader = async (
    href: string,
    trigger: HTMLElement,
  ): Promise<void> => {
    readerRequest?.abort();
    const request = new AbortController();
    readerRequest = request;
    if (root.dataset.readerOpen === undefined) {
      readerTrigger = trigger;
    }
    root.dataset.readerOpen = "";
    readerFullPage.href = href;
    reader.setAttribute("aria-hidden", "false");
    readerPanel.setAttribute("aria-busy", "true");
    syncReaderModality();
    const selectedNode = selectedNodeElement();
    if (selectedNode && !readerModalQuery.matches) {
      requestAnimationFrame(() => centerNodeBesideReader(selectedNode));
    }
    showReaderMessage(ui.loadingArticle, "kg-reader-loading");
    const selectedNodeId = root.dataset.selectedNode;
    if (selectedNodeId) {
      renderReaderNavigation(selectedNodeId);
    } else {
      readerNavigation.replaceChildren();
    }
    readerPanel.scrollTop = 0;
    readerPanel.focus({ preventScroll: true });

    try {
      const response = await fetch(href, {
        headers: { Accept: "text/html" },
        signal: request.signal,
      });
      if (!response.ok) {
        throw new Error(`Article request failed with ${response.status}.`);
      }
      const source = await response.text();
      const documentFragment = new DOMParser().parseFromString(
        source,
        "text/html",
      );
      const article =
        documentFragment.querySelector<HTMLElement>("main#main > article");
      if (!article) {
        throw new Error("The article element was not found.");
      }

      const importedArticle = document.importNode(article, true);
      importedArticle.classList.add("kg-reader-article");
      for (const element of importedArticle.querySelectorAll<HTMLElement>(
        "[href], [src]",
      )) {
        for (const attribute of ["href", "src"] as const) {
          const value = element.getAttribute(attribute);
          if (!value || value.startsWith("#")) {
            continue;
          }
          element.setAttribute(attribute, new URL(value, response.url).href);
        }
      }
      readerContent.replaceChildren(importedArticle);
      readerPanel.setAttribute("aria-busy", "false");
    } catch (error) {
      if (request.signal.aborted) {
        return;
      }
      const errorMessage = showReaderMessage(
        ui.articleLoadFailed,
        "kg-reader-error",
      );
      const directLink = document.createElement("a");
      directLink.href = href;
      directLink.textContent = ui.openDirectly;
      errorMessage.append(document.createElement("br"), directLink);
      readerPanel.setAttribute("aria-busy", "false");
      console.error(error);
    } finally {
      if (readerRequest === request) {
        readerRequest = undefined;
      }
    }
  };

  const zoomAt = (
    nextScale: number,
    clientX: number,
    clientY: number,
  ): void => {
    const bounds = viewport.getBoundingClientRect();
    const pointX = clientX - bounds.left;
    const pointY = clientY - bounds.top;
    const worldX = (pointX - transform.x) / transform.scale;
    const worldY = (pointY - transform.y) / transform.scale;
    transform.scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    transform.x = pointX - worldX * transform.scale;
    transform.y = pointY - worldY * transform.scale;
    renderTransform();
  };

  const fit = (): void => {
    const bounds = viewport.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) {
      return;
    }
    const safe = getSafeArea();
    const contentLeft = Math.min(
      0,
      ...[...nodePositions.values()].map((position) => position.x - 48),
    );
    const contentTop = Math.min(
      0,
      ...[...nodePositions.values()].map((position) => position.y - 48),
    );
    const contentRight = Math.max(
      graphWidth,
      ...[...nodePositions.values()].map(
        (position) => position.x + position.width + 48,
      ),
    );
    const contentBottom = Math.max(
      graphHeight,
      ...[...nodePositions.values()].map(
        (position) => position.y + position.height + 48,
      ),
    );
    const contentWidth = contentRight - contentLeft;
    const contentHeight = contentBottom - contentTop;
    const availableWidth = Math.max(
      1,
      bounds.width - safe.left - safe.right,
    );
    const availableHeight = Math.max(
      1,
      bounds.height - safe.top - safe.bottom,
    );
    transform.scale = clamp(
      Math.min(
        availableWidth / contentWidth,
        availableHeight / contentHeight,
        1.25,
      ),
      MIN_SCALE,
      MAX_SCALE,
    );
    transform.x =
      safe.left +
      (availableWidth - contentWidth * transform.scale) / 2 -
      contentLeft * transform.scale;
    transform.y =
      safe.top +
      (availableHeight - contentHeight * transform.scale) / 2 -
      contentTop * transform.scale;
    renderTransform();
  };

  const centerNodeBesideReader = (
    node: HTMLButtonElement,
  ): void => {
    if (readerModalQuery.matches) {
      return;
    }
    const viewportBounds = viewport.getBoundingClientRect();
    const nodeBounds = node.getBoundingClientRect();
    const safe = getSafeArea();
    const panelWidth = readerPanel.offsetWidth;
    const availableRight = Math.max(
      safe.left + 1,
      viewportBounds.width - panelWidth,
    );
    const targetX =
      viewportBounds.left +
      safe.left +
      (availableRight - safe.left) / 2;
    const targetY =
      viewportBounds.top +
      safe.top +
      (viewportBounds.height - safe.top - safe.bottom) / 2;
    transform.x += targetX - (nodeBounds.left + nodeBounds.right) / 2;
    transform.y += targetY - (nodeBounds.top + nodeBounds.bottom) / 2;
    renderTransform();
  };

  const centerSelection = (node: HTMLButtonElement): void => {
    if (
      root.dataset.readerOpen !== undefined &&
      !readerModalQuery.matches
    ) {
      centerNodeBesideReader(node);
      return;
    }
    positionInspector(node);
    const viewportBounds = viewport.getBoundingClientRect();
    const nodeBounds = node.getBoundingClientRect();
    const inspectorBounds = inspector.getBoundingClientRect();
    const safe = getSafeArea();
    const unionLeft = Math.min(nodeBounds.left, inspectorBounds.left);
    const unionTop = Math.min(nodeBounds.top, inspectorBounds.top);
    const unionRight = Math.max(nodeBounds.right, inspectorBounds.right);
    const unionBottom = Math.max(nodeBounds.bottom, inspectorBounds.bottom);
    const targetX =
      viewportBounds.left +
      safe.left +
      (viewportBounds.width - safe.left - safe.right) / 2;
    const targetY =
      viewportBounds.top +
      safe.top +
      (viewportBounds.height - safe.top - safe.bottom) / 2;

    transform.x += targetX - (unionLeft + unionRight) / 2;
    transform.y += targetY - (unionTop + unionBottom) / 2;
    renderTransform();
    requestAnimationFrame(() => positionInspector(node));
  };

  const clearSelection = (): void => {
    for (const node of nodeElements) {
      node.setAttribute("aria-pressed", "false");
      node.removeAttribute("data-selected");
    }
    for (const edge of root.querySelectorAll<SVGElement>(
      "[data-knowledge-edge], [data-knowledge-arrow]",
    )) {
      edge.classList.remove("is-connected", "is-incoming");
      edge.removeAttribute("data-related-flow");
      edge.style.removeProperty("--kg-related-length");
    }
    inspector.setAttribute("aria-hidden", "true");
    inspector.replaceChildren();
    inspector.removeAttribute("data-placement");
    inspector.style.removeProperty("left");
    inspector.style.removeProperty("top");
    inspector.style.removeProperty("--kg-tail-offset");
    delete root.dataset.selectedNode;
  };

  const selectNode = (nodeId: string): void => {
    const template = root.querySelector<HTMLTemplateElement>(
      `template[data-knowledge-detail="${CSS.escape(nodeId)}"]`,
    );
    const selectedNode = nodeElementsById.get(nodeId);
    if (!template || !selectedNode) {
      return;
    }

    for (const node of nodeElements) {
      const selected = node.dataset.knowledgeNode === nodeId;
      node.setAttribute("aria-pressed", String(selected));
      node.toggleAttribute("data-selected", selected);
    }
    for (const edge of root.querySelectorAll<SVGElement>(
      "[data-knowledge-edge], [data-knowledge-arrow]",
    )) {
      const connected =
        edge.dataset.edgeSource === nodeId || edge.dataset.edgeTarget === nodeId;
      edge.classList.toggle("is-connected", connected);
      edge.classList.toggle(
        "is-incoming",
        edge.dataset.edgeTarget === nodeId,
      );
      edge.removeAttribute("data-related-flow");
      edge.style.removeProperty("--kg-related-length");
      if (
        connected &&
        edge instanceof SVGPathElement &&
        edge.dataset.edgeKind === "related"
      ) {
        edge.style.setProperty(
          "--kg-related-length",
          `${Math.max(1, edge.getTotalLength())}px`,
        );
        edge.dataset.relatedFlow =
          edge.dataset.edgeSource === nodeId ? "forward" : "reverse";
      }
    }

    inspector.replaceChildren(template.content.cloneNode(true));
    inspector.setAttribute("aria-hidden", "false");
    root.dataset.selectedNode = nodeId;
    if (root.dataset.readerOpen !== undefined) {
      const href = selectedNode.dataset.knowledgeHref;
      if (href) {
        const destination = new URL(href, window.location.href);
        if (destination.origin === window.location.origin) {
          void openReader(destination.href, selectedNode);
        }
      }
    }
    requestAnimationFrame(() => {
      centerSelection(selectedNode);
      if (root.dataset.readerOpen !== undefined) {
        readerPanel.focus({ preventScroll: true });
      } else {
        inspector.focus({ preventScroll: true });
      }
    });
  };

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.closest("[data-close-reader]")) {
      closeReader();
      return;
    }
    const articleLink = target.closest<HTMLAnchorElement>(".kg-cta");
    if (articleLink) {
      const destination = new URL(articleLink.href, window.location.href);
      if (destination.origin === window.location.origin) {
        event.preventDefault();
        void openReader(destination.href, articleLink);
      }
      return;
    }
    const readerLink =
      target.closest<HTMLAnchorElement>("[data-reader-node]");
    if (readerLink) {
      const nodeId = readerLink.dataset.readerNode;
      if (!nodeId) {
        return;
      }
      const destination = new URL(readerLink.href, window.location.href);
      if (destination.origin === window.location.origin) {
        event.preventDefault();
        selectNode(nodeId);
      }
      return;
    }
    if (target.closest("[data-close-inspector]")) {
      clearSelection();
      return;
    }
    const node = target.closest<HTMLElement>("[data-knowledge-node]");
    if (node && performance.now() < suppressNodeClickUntil) {
      return;
    }
    const relation = target.closest<HTMLElement>("[data-select-node]");
    const nodeId =
      node?.dataset.knowledgeNode ?? relation?.dataset.selectNode ?? "";
    if (nodeId) {
      selectNode(nodeId);
    }
  });

  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && root.dataset.readerOpen !== undefined) {
      closeReader();
      return;
    }
    if (event.key === "Escape" && root.dataset.selectedNode) {
      clearSelection();
    }
  });

  fitButton.addEventListener("click", fit);
  for (const image of root.querySelectorAll<HTMLImageElement>(
    ".kg-node__thumbnail",
  )) {
    image.addEventListener(
      "error",
      () => {
        image
          .closest<HTMLElement>("[data-knowledge-node]")
          ?.removeAttribute("data-has-thumbnail");
      },
      { once: true },
    );
  }
  thumbnailToggle?.addEventListener("click", () => {
    const showThumbnails =
      thumbnailToggle.getAttribute("aria-pressed") !== "true";
    if (showThumbnails) {
      for (const image of root.querySelectorAll<HTMLImageElement>(
        ".kg-node__thumbnail[data-thumbnail-src]",
      )) {
        const source = image.dataset.thumbnailSrc;
        if (source && !image.hasAttribute("src")) {
          image.src = source;
        }
      }
    }
    root.dataset.nodeDisplay = showThumbnails ? "thumbnail" : "text";
    thumbnailToggle.setAttribute(
      "aria-pressed",
      String(showThumbnails),
    );
    const label = showThumbnails ? ui.showText : ui.showThumbnails;
    thumbnailToggle.setAttribute("aria-label", label);
    thumbnailToggle.title = label;
  });
  settings?.addEventListener("toggle", () => {
    settingsSummary?.setAttribute("aria-expanded", String(settings.open));
  });
  settings?.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !settings.open) {
      return;
    }
    event.preventDefault();
    settings.open = false;
    settingsSummary?.focus({ preventScroll: true });
  });
  nodeSizeControl?.addEventListener("input", () => {
    const percentage = clamp(Number(nodeSizeControl.value), 70, 150);
    const label = `${Math.round(percentage)}%`;
    nodeSizeOutput && (nodeSizeOutput.value = label);
    nodeSizeControl.setAttribute("aria-valuetext", label);
    applyNodeScale(percentage / 100);
  });
  repulsionControl?.addEventListener("input", () => {
    const percentage = clamp(Number(repulsionControl.value), 25, 200);
    contextualRepulsionMultiplier = percentage / 100;
    const label = `${contextualRepulsionMultiplier.toFixed(2)}×`;
    repulsionOutput && (repulsionOutput.value = label);
    repulsionControl.setAttribute("aria-valuetext", label);
    startSimulation();
  });
  viewButton.addEventListener("click", () => {
    const showList = root.dataset.view !== "list";
    clearSelection();
    root.dataset.view = showList ? "list" : "map";
    viewButton.setAttribute("aria-pressed", String(showList));
    viewButton.textContent = showList ? ui.map : ui.list;
    syncContextualSimulation();
    if (!showList) {
      requestAnimationFrame(fit);
    }
  });

  document.addEventListener("visibilitychange", syncContextualSimulation);
  reducedMotionQuery.addEventListener("change", syncContextualSimulation);

  viewport.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0015);
      zoomAt(
        transform.scale * factor,
        event.clientX,
        event.clientY,
      );
    },
    { passive: false },
  );

  viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType === "mouse") {
      return;
    }
    const target = event.target;
    const node =
      target instanceof Element
        ? target.closest<HTMLButtonElement>("[data-knowledge-node]")
        : null;

    if (node) {
      const nodeId = node.dataset.knowledgeNode;
      const position = nodeId ? nodePositions.get(nodeId) : undefined;
      if (!nodeId || !position) {
        return;
      }
      event.preventDefault();
      viewport.setPointerCapture(event.pointerId);
      nodeDrag = {
        pointerId: event.pointerId,
        node,
        nodeId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: position.x,
        startY: position.y,
        moved: false,
      };
      position.velocityX = 0;
      position.velocityY = 0;
      node.setAttribute("data-dragging", "");
      return;
    }

    viewport.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      panAnchor = { x: event.clientX, y: event.clientY };
    } else if (pointers.size === 2) {
      const [first, second] = [...pointers.values()];
      if (!first || !second) {
        return;
      }
      pinchDistance = Math.hypot(second.x - first.x, second.y - first.y);
      pinchScale = transform.scale;
      const bounds = viewport.getBoundingClientRect();
      const midpoint = {
        x: (first.x + second.x) / 2 - bounds.left,
        y: (first.y + second.y) / 2 - bounds.top,
      };
      pinchWorldPoint = {
        x: (midpoint.x - transform.x) / transform.scale,
        y: (midpoint.y - transform.y) / transform.scale,
      };
    }
  });

  viewport.addEventListener("pointermove", (event) => {
    if (nodeDrag?.pointerId === event.pointerId) {
      const position = nodePositions.get(nodeDrag.nodeId);
      if (!position) {
        return;
      }
      const deltaX = (event.clientX - nodeDrag.startClientX) / transform.scale;
      const deltaY = (event.clientY - nodeDrag.startClientY) / transform.scale;
      if (Math.hypot(deltaX, deltaY) > 4 / transform.scale) {
        nodeDrag.moved = true;
      }
      position.x = nodeDrag.startX + deltaX;
      position.y = nodeDrag.startY + deltaY;
      renderNodePositions();
      if (nodeDrag.moved) {
        startSimulation(nodeDrag.nodeId);
      }
      return;
    }

    if (!pointers.has(event.pointerId)) {
      return;
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 1 && panAnchor) {
      transform.x += event.clientX - panAnchor.x;
      transform.y += event.clientY - panAnchor.y;
      panAnchor = { x: event.clientX, y: event.clientY };
      renderTransform();
      return;
    }

    if (pointers.size === 2 && pinchWorldPoint && pinchDistance > 0) {
      const [first, second] = [...pointers.values()];
      if (!first || !second) {
        return;
      }
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      const bounds = viewport.getBoundingClientRect();
      const midpoint = {
        x: (first.x + second.x) / 2 - bounds.left,
        y: (first.y + second.y) / 2 - bounds.top,
      };
      transform.scale = clamp(
        pinchScale * (distance / pinchDistance),
        MIN_SCALE,
        MAX_SCALE,
      );
      transform.x = midpoint.x - pinchWorldPoint.x * transform.scale;
      transform.y = midpoint.y - pinchWorldPoint.y * transform.scale;
      renderTransform();
    }
  });

  const releasePointer = (
    event: PointerEvent,
    cancelled = false,
  ): void => {
    if (nodeDrag?.pointerId === event.pointerId) {
      const finishedDrag = nodeDrag;
      finishedDrag.node.removeAttribute("data-dragging");
      suppressNodeClickUntil = performance.now() + 250;
      nodeDrag = undefined;
      if (!cancelled && !finishedDrag.moved) {
        simulationAnchorId = undefined;
        selectNode(finishedDrag.nodeId);
      } else if (!cancelled) {
        startSimulation(finishedDrag.nodeId);
      } else {
        simulationAnchorId = undefined;
      }
      return;
    }

    pointers.delete(event.pointerId);
    if (pointers.size === 1) {
      const remaining = [...pointers.values()][0];
      panAnchor = remaining ? { ...remaining } : undefined;
    } else {
      panAnchor = undefined;
    }
    if (pointers.size < 2) {
      pinchWorldPoint = undefined;
      pinchDistance = 0;
    }
  };

  viewport.addEventListener("pointerup", releasePointer);
  viewport.addEventListener("pointercancel", (event) => {
    releasePointer(event, true);
  });

  readerModalQuery.addEventListener("change", () => {
    syncReaderModality();
    const node = selectedNodeElement();
    if (
      node &&
      root.dataset.readerOpen !== undefined &&
      !readerModalQuery.matches
    ) {
      requestAnimationFrame(() => centerNodeBesideReader(node));
    }
  });
  syncReaderModality();

  const observer = new ResizeObserver(() => {
    if (root.dataset.view !== "list") {
      if (root.dataset.selectedNode) {
        scheduleInspectorPosition();
      } else {
        fit();
      }
    }
  });
  observer.observe(viewport);

  root.dataset.enhanced = "true";
  updateEdges();
  syncContextualSimulation();
  const fitAfterLayout = (): void => {
    requestAnimationFrame(() => requestAnimationFrame(fit));
  };
  window.addEventListener("load", fitAfterLayout, { once: true });
  document.fonts.ready.then(fitAfterLayout).catch(() => {
    // The initial double animation frame still provides a safe fallback.
  });
  fitAfterLayout();
}

export function initKnowledgeGraphs(): void {
  for (const root of document.querySelectorAll<HTMLElement>(
    "[data-knowledge-graph]",
  )) {
    initializeKnowledgeGraph(root);
  }
}
