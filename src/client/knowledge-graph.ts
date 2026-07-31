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

  if (!viewport || !world || !inspector || !fitButton || !viewButton) {
    return;
  }

  const graphWidth = Number(world.dataset.graphWidth);
  const graphHeight = Number(world.dataset.graphHeight);
  if (!Number.isFinite(graphWidth) || !Number.isFinite(graphHeight)) {
    return;
  }

  const transform: Transform = { x: 0, y: 0, scale: 1 };
  const pointers = new Map<number, PointerPosition>();
  let panAnchor: PointerPosition | undefined;
  let pinchDistance = 0;
  let pinchScale = 1;
  let pinchWorldPoint: PointerPosition | undefined;

  const renderTransform = (): void => {
    world.style.transform =
      `translate(${transform.x}px, ${transform.y}px) ` +
      `scale(${transform.scale})`;
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
    const horizontalInset = bounds.width < 640 ? 24 : 48;
    const topInset = bounds.width < 640 ? 148 : 128;
    const bottomInset = bounds.width < 640 ? 32 : 48;
    const availableHeight = Math.max(
      1,
      bounds.height - topInset - bottomInset,
    );
    transform.scale = clamp(
      Math.min(
        (bounds.width - horizontalInset) / graphWidth,
        availableHeight / graphHeight,
        1.25,
      ),
      MIN_SCALE,
      MAX_SCALE,
    );
    transform.x = (bounds.width - graphWidth * transform.scale) / 2;
    transform.y =
      topInset + (availableHeight - graphHeight * transform.scale) / 2;
    renderTransform();
  };

  const clearSelection = (): void => {
    for (const node of root.querySelectorAll<HTMLButtonElement>(
      "[data-knowledge-node]",
    )) {
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
    delete root.dataset.selectedNode;
  };

  const selectNode = (nodeId: string): void => {
    const template = root.querySelector<HTMLTemplateElement>(
      `template[data-knowledge-detail="${CSS.escape(nodeId)}"]`,
    );
    if (!template) {
      return;
    }

    for (const node of root.querySelectorAll<HTMLButtonElement>(
      "[data-knowledge-node]",
    )) {
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
    inspector.focus({ preventScroll: true });
  };

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.closest("[data-close-inspector]")) {
      clearSelection();
      return;
    }
    const node = target.closest<HTMLElement>("[data-knowledge-node]");
    const relation = target.closest<HTMLElement>("[data-select-node]");
    const nodeId =
      node?.dataset.knowledgeNode ?? relation?.dataset.selectNode ?? "";
    if (nodeId) {
      selectNode(nodeId);
    }
  });
  root.addEventListener("keydown", (event) => {
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
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("[data-knowledge-node]")
    ) {
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

  const releasePointer = (event: PointerEvent): void => {
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
  viewport.addEventListener("pointercancel", releasePointer);

  const observer = new ResizeObserver(() => {
    if (root.dataset.view !== "list") {
      fit();
    }
  });
  observer.observe(viewport);

  root.dataset.enhanced = "true";
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
