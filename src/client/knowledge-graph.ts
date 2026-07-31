const MIN_SCALE = 0.25;
const MAX_SCALE = 2.4;

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
  restX: number;
  restY: number;
}

interface SafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function initializeKnowledgeGraph(root: HTMLElement): void {
  if (root.dataset.enhanced === "true") {
    return;
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

  if (
    !viewport ||
    !world ||
    !inspector ||
    !fitButton ||
    !viewButton ||
    !shell ||
    !reader ||
    !readerPanel ||
    !readerContent
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
  for (const node of nodeElements) {
    const nodeId = node.dataset.knowledgeNode;
    if (!nodeId) {
      continue;
    }
    nodePositions.set(nodeId, {
      x: Number.parseFloat(node.style.left),
      y: Number.parseFloat(node.style.top),
      width: Number.parseFloat(node.style.width),
      height: Number.parseFloat(node.style.height),
      velocityX: 0,
      velocityY: 0,
    });
  }
  const nodeElementsById = new Map(
    nodeElements.flatMap((node) => {
      const nodeId = node.dataset.knowledgeNode;
      return nodeId ? [[nodeId, node] as const] : [];
    }),
  );
  const connections: GraphConnection[] = [];
  for (const edge of root.querySelectorAll<SVGPathElement>(
    "[data-knowledge-edge]",
  )) {
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
      restX: target.x - source.x,
      restY: target.y - source.y,
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
  let readerRequest: AbortController | undefined;
  let readerTrigger: HTMLElement | undefined;

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
      const start = connectionPoint(source, target, 4);
      const end = connectionPoint(target, source, 14);
      edge.setAttribute(
        "d",
        `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
      );
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

  const runSimulation = (): void => {
    simulationFrame = 0;
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
    if (anchorId) {
      simulationAnchorId = anchorId;
    }
    if (!simulationFrame) {
      simulationTicks = 0;
      simulationFrame = requestAnimationFrame(runSimulation);
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

  const closeReader = (): void => {
    readerRequest?.abort();
    readerRequest = undefined;
    reader.setAttribute("aria-hidden", "true");
    readerPanel.setAttribute("aria-busy", "false");
    shell.inert = false;
    delete root.dataset.readerOpen;
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
    readerTrigger = trigger;
    root.dataset.readerOpen = "";
    reader.setAttribute("aria-hidden", "false");
    readerPanel.setAttribute("aria-busy", "true");
    shell.inert = true;
    showReaderMessage("記事を読み込んでいます…", "kg-reader-loading");
    readerPanel.scrollTop = 0;
    readerPanel
      .querySelector<HTMLButtonElement>("[data-close-reader]")
      ?.focus({ preventScroll: true });

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
        "記事を読み込めませんでした。",
        "kg-reader-error",
      );
      const directLink = document.createElement("a");
      directLink.href = href;
      directLink.textContent = "通常のページで開く";
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

  const centerSelection = (node: HTMLButtonElement): void => {
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
    for (const edge of root.querySelectorAll<SVGPathElement>(
      "[data-knowledge-edge]",
    )) {
      edge.classList.remove("is-connected", "is-incoming");
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
    for (const edge of root.querySelectorAll<SVGPathElement>(
      "[data-knowledge-edge]",
    )) {
      edge.classList.toggle(
        "is-connected",
        edge.dataset.edgeSource === nodeId || edge.dataset.edgeTarget === nodeId,
      );
      edge.classList.toggle(
        "is-incoming",
        edge.dataset.edgeTarget === nodeId,
      );
    }

    inspector.replaceChildren(template.content.cloneNode(true));
    inspector.setAttribute("aria-hidden", "false");
    root.dataset.selectedNode = nodeId;
    requestAnimationFrame(() => {
      centerSelection(selectedNode);
      inspector.focus({ preventScroll: true });
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
  viewButton.addEventListener("click", () => {
    const showList = root.dataset.view !== "list";
    clearSelection();
    root.dataset.view = showList ? "list" : "map";
    viewButton.setAttribute("aria-pressed", String(showList));
    viewButton.textContent = showList ? "マップ" : "一覧";
    if (!showList) {
      requestAnimationFrame(fit);
    }
  });

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
