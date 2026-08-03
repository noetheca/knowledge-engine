const CAMERA_TRANSITION_DURATION_MS = 300;
const GRID_BASE_SPACING = 24;
const GRID_TARGET_SCREEN_SPACING = 24;
const SIMULATION_ACTIVE_INTERVAL_MS = 1_000 / 30;
const SIMULATION_STABLE_INTERVAL_MS = 1_000 / 12;
const SIMULATION_STABLE_FRAME_TARGET = 12;
const SIMULATION_STABLE_MOVEMENT = 0.045;
const POSITION_RENDER_EPSILON = 0.12;
const MAX_EDGE_CANVAS_PIXELS = 8_000_000;

import { getUiStrings } from "../i18n/ui.js";
import {
  createKnowledgeGraphSimulationLinks,
  stepKnowledgeGraphSimulation,
  type KnowledgeGraphSimulationDirectKind,
  type KnowledgeGraphSimulationDirectLink,
  type KnowledgeGraphSimulationNode,
} from "../graph/simulation.js";
import {
  KNOWLEDGE_GRAPH_POSITION_STRIDE,
  type KnowledgeGraphWorkerOptions,
  type KnowledgeGraphWorkerRequest,
  type KnowledgeGraphWorkerResponse,
} from "./knowledge-graph-simulation-protocol.js";
import {
  clampFitScale,
  clampInteractiveScale,
  measureGraphContentBounds,
  MIN_INTERACTIVE_SCALE,
} from "./knowledge-graph-runtime.js";

interface Transform {
  x: number;
  y: number;
  scale: number;
}

interface PointerPosition {
  x: number;
  y: number;
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

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
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
  const edgeCanvas =
    root.querySelector<HTMLCanvasElement>("[data-knowledge-edge-canvas]");
  const inspector = root.querySelector<HTMLElement>("[data-graph-inspector]");
  const fitButton = root.querySelector<HTMLButtonElement>("[data-graph-fit]");
  const viewButton =
    root.querySelector<HTMLButtonElement>("[data-graph-view-toggle]");
  const shell = root.querySelector<HTMLElement>(".kg-shell");
  const toolbar = root.querySelector<HTMLElement>(".kg-toolbar");
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
  const simulationToggle =
    root.querySelector<HTMLButtonElement>("[data-graph-simulation-toggle]");
  const simulationStatus =
    root.querySelector<HTMLElement>("[data-graph-simulation-status]");
  const settings =
    root.querySelector<HTMLDetailsElement>("[data-graph-settings]");
  const settingsSummary = settings?.querySelector<HTMLElement>("summary");
  const settingsPanel =
    settings?.querySelector<HTMLElement>("[data-graph-settings-panel]");
  const hierarchyEnabledControl =
    root.querySelector<HTMLInputElement>("[data-hierarchy-enabled]");
  const hierarchyControl =
    root.querySelector<HTMLInputElement>("[data-hierarchy-control]");
  const hierarchyOutput =
    root.querySelector<HTMLOutputElement>("[data-hierarchy-output]");
  const attractionControl =
    root.querySelector<HTMLInputElement>("[data-attraction-control]");
  const attractionOutput =
    root.querySelector<HTMLOutputElement>("[data-attraction-output]");
  const repulsionControl =
    root.querySelector<HTMLInputElement>("[data-repulsion-control]");
  const repulsionOutput =
    root.querySelector<HTMLOutputElement>("[data-repulsion-output]");
  const groupStrengthControl =
    root.querySelector<HTMLInputElement>("[data-group-strength-control]");
  const groupStrengthOutput =
    root.querySelector<HTMLOutputElement>("[data-group-strength-output]");
  const groupSeparationControl =
    root.querySelector<HTMLInputElement>("[data-group-separation-control]");
  const groupSeparationOutput =
    root.querySelector<HTMLOutputElement>("[data-group-separation-output]");
  const simulationEngineOutput =
    root.querySelector<HTMLOutputElement>("[data-simulation-engine-output]");
  const simulationReset =
    root.querySelector<HTMLButtonElement>("[data-simulation-reset]");
  const debugHud = root.querySelector<HTMLElement>("[data-graph-debug-hud]");
  const debugFields = {
    fps: root.querySelector<HTMLElement>("[data-debug-fps]"),
    frameP95: root.querySelector<HTMLElement>("[data-debug-frame-p95]"),
    physicsHz: root.querySelector<HTMLElement>("[data-debug-physics-hz]"),
    renderHz: root.querySelector<HTMLElement>("[data-debug-render-hz]"),
    computeMs: root.querySelector<HTMLElement>("[data-debug-compute-ms]"),
    roundTripMs: root.querySelector<HTMLElement>("[data-debug-round-trip-ms]"),
    applyMs: root.querySelector<HTMLElement>("[data-debug-apply-ms]"),
    nodesMs: root.querySelector<HTMLElement>("[data-debug-nodes-ms]"),
    edgesMs: root.querySelector<HTMLElement>("[data-debug-edges-ms]"),
    renderMs: root.querySelector<HTMLElement>("[data-debug-render-ms]"),
    movement: root.querySelector<HTMLElement>("[data-debug-movement]"),
    longFrames: root.querySelector<HTMLElement>("[data-debug-long-frames]"),
    graphSize: root.querySelector<HTMLElement>("[data-debug-graph-size]"),
    overlaps: root.querySelector<HTMLElement>("[data-debug-overlaps]"),
    spread: root.querySelector<HTMLElement>("[data-debug-spread]"),
    groupSpread: root.querySelector<HTMLElement>("[data-debug-group-spread]"),
    state: root.querySelector<HTMLElement>("[data-debug-state]"),
    engine: root.querySelector<HTMLElement>("[data-debug-engine]"),
  };
  const debugEnabled = root.dataset.debug === "true" && Boolean(debugHud);

  if (
    !viewport ||
    !world ||
    !inspector ||
    !fitButton ||
    !viewButton ||
    !shell ||
    !toolbar ||
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
  let interactionMinimumScale = MIN_INTERACTIVE_SCALE;
  const pointers = new Map<number, PointerPosition>();
  const nodeElements = [
    ...root.querySelectorAll<HTMLButtonElement>("[data-knowledge-node]"),
  ];
  const nodePositions = new Map<string, KnowledgeGraphSimulationNode>();
  for (const node of nodeElements) {
    const nodeId = node.dataset.knowledgeNode;
    if (!nodeId) {
      continue;
    }
    const initialY = Number.parseFloat(node.style.top);
    const initialWidth = Number.parseFloat(node.style.width);
    const initialHeight = Number.parseFloat(node.style.height);
    const initialX = Number.parseFloat(node.style.left);
    nodePositions.set(nodeId, {
      id: nodeId,
      x: initialX,
      y: initialY,
      width: initialWidth,
      height: initialHeight,
      anchorX: initialX,
      anchorY: initialY,
      bandMinimumY: initialY,
      bandMaximumY: initialY,
      groupId: node.dataset.knowledgeGroup ?? nodeId.split("/").slice(0, 2).join("/"),
      rank: Number.parseInt(node.dataset.knowledgeRank ?? "0", 10) || 0,
      velocityX: 0,
      velocityY: 0,
    });
    // The authored layout is expressed with left/top for the static fallback.
    // Once enhanced, keep those properties fixed and move only with translate.
    node.style.left = "0px";
    node.style.top = "0px";
    node.style.translate = `${initialX}px ${initialY}px`;
  }
  const rowCenters = [
    ...new Set(
      [...nodePositions.values()].map(({ anchorY, height }) =>
        anchorY + height / 2,
      ),
    ),
  ].sort((left, right) => left - right);
  for (const position of nodePositions.values()) {
    const center = position.anchorY + position.height / 2;
    const rowIndex = rowCenters.indexOf(center);
    const previous = rowCenters[rowIndex - 1];
    const next = rowCenters[rowIndex + 1];
    position.bandMinimumY =
      previous === undefined
        ? 16
        : (previous + center) / 2 - position.height / 2 + 2;
    position.bandMaximumY =
      next === undefined
        ? Math.max(16, graphHeight - position.height - 16)
        : (center + next) / 2 - position.height / 2 - 2;
  }
  const nodeElementsById = new Map(
    nodeElements.flatMap((node) => {
      const nodeId = node.dataset.knowledgeNode;
      return nodeId ? [[nodeId, node] as const] : [];
    }),
  );
  const edgeElements = [
    ...root.querySelectorAll<SVGPathElement>("[data-knowledge-edge]"),
  ];
  const nodePositionOrder = [...nodePositions.keys()];
  const nodeRenderEntries = nodePositionOrder.flatMap((nodeId) => {
    const node = nodeElementsById.get(nodeId);
    const position = nodePositions.get(nodeId);
    return node && position
      ? [{ node, position, renderedX: position.x, renderedY: position.y }]
      : [];
  });
  const edgeRenderEntries = edgeElements.flatMap((edge) => {
    const sourceId = edge.dataset.edgeSource;
    const targetId = edge.dataset.edgeTarget;
    const source = sourceId ? nodePositions.get(sourceId) : undefined;
    const target = targetId ? nodePositions.get(targetId) : undefined;
    if (!source || !target) return [];
    return [{
      edge,
      sourceId: sourceId ?? source.id,
      targetId: targetId ?? target.id,
      kind: edge.dataset.edgeKind ?? "prerequisite",
      draft: edge.dataset.targetStatus === "draft",
      source,
      target,
      renderedSourceX: source.x,
      renderedSourceY: source.y,
      renderedTargetX: target.x,
      renderedTargetY: target.y,
    }];
  });
  const directKinds = new Set<KnowledgeGraphSimulationDirectKind>([
    "prerequisite",
    "contextual",
    "related",
  ]);
  let directLinks: KnowledgeGraphSimulationDirectLink[] = [];
  try {
    const parsed = JSON.parse(root.dataset.simulationLinks ?? "[]") as unknown;
    if (Array.isArray(parsed)) {
      directLinks = parsed.flatMap((entry) => {
        if (!entry || typeof entry !== "object") {
          return [];
        }
        const candidate = entry as Record<string, unknown>;
        return typeof candidate.source === "string" &&
          typeof candidate.target === "string" &&
          typeof candidate.kind === "string" &&
          directKinds.has(candidate.kind as KnowledgeGraphSimulationDirectKind)
          ? [{
              source: candidate.source,
              target: candidate.target,
              kind: candidate.kind as KnowledgeGraphSimulationDirectKind,
            }]
          : [];
      });
    }
  } catch {
    // A malformed optional enhancement payload leaves the static map intact.
  }
  const simulationLinks = createKnowledgeGraphSimulationLinks(
    [...nodePositions.keys()],
    directLinks,
    new Map(
      [...nodePositions].map(([id, node]) => [
        id,
        { x: node.anchorX, y: node.anchorY },
      ]),
    ),
  );
  let panAnchor: PointerPosition | undefined;
  let pinchDistance = 0;
  let pinchScale = 1;
  let pinchWorldPoint: PointerPosition | undefined;
  let nodeDrag: NodeDrag | undefined;
  let suppressNodeClickUntil = 0;
  let inspectorPositionFrame = 0;
  let settingsPositionFrame = 0;
  let cameraAnimationFrame = 0;
  let simulationFrame = 0;
  let simulationStableFrames = 0;
  let simulationLastStepAt = 0;
  let simulationPinnedId: string | undefined;
  let hierarchyEnabled = true;
  let hierarchyStrength = 0.55;
  let attractionStrength = 1;
  let repulsionStrength = 1;
  let groupStrength = 1;
  let groupSeparationStrength = 1.25;
  let simulationActive = false;
  let simulationStepPending = false;
  let simulationWorkerReady = false;
  let simulationGeneration = 1;
  let simulationWorker: Worker | undefined;
  let simulationEngine: "worker" | "main" = "main";
  let renderedSimulationEngine: "worker" | "main" | undefined;
  let currentSimulationUiState: SimulationUiState | undefined;
  let reducedMotionOverride = false;
  let readerRequest: AbortController | undefined;
  let readerTrigger: HTMLElement | undefined;
  const readerModalQuery = window.matchMedia("(max-width: 52rem)");
  const reducedMotionQuery = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  const debugSamples = {
    frame: [] as number[],
    compute: [] as number[],
    roundTrip: [] as number[],
    apply: [] as number[],
    nodes: [] as number[],
    edges: [] as number[],
    render: [] as number[],
  };
  let debugWindowStartedAt = performance.now();
  let debugPreviousFrameAt = 0;
  let debugStepSentAt = 0;
  let debugFrameCount = 0;
  let debugPhysicsFrames = 0;
  let debugRenderFrames = 0;
  let debugLongFrames = 0;
  let debugLastMovement = 0;
  let edgeCanvasContext: CanvasRenderingContext2D | undefined;
  let edgeCanvasFrame = 0;
  let edgeCanvasReady = false;
  let edgeCanvasFailed = false;
  let edgeCanvasColor = "";
  let edgeCanvasColorDirty = true;
  let edgeCanvasPendingNodeMilliseconds = 0;
  let edgeCanvasCssWidth = 0;
  let edgeCanvasCssHeight = 0;
  let edgeCanvasPixelRatio = 0;
  let edgeCanvasSizeDirty = true;
  let resumeCanvasAfterPrint = false;
  const forcedColorsQuery = window.matchMedia("(forced-colors: active)");
  interface DebugPoint {
    x: number;
    y: number;
  }
  const debugRmsRadius = (points: readonly DebugPoint[]): number => {
    if (points.length === 0) return 0;
    const centerX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
    const centerY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
    return Math.sqrt(
      points.reduce(
        (sum, point) =>
          sum + (point.x - centerX) ** 2 + (point.y - centerY) ** 2,
        0,
      ) / points.length,
    );
  };
  const debugNodeCenters = (initial: boolean): DebugPoint[] =>
    [...nodePositions.values()].map((node) => ({
      x: (initial ? node.anchorX : node.x) + node.width / 2,
      y: (initial ? node.anchorY : node.y) + node.height / 2,
    }));
  const debugGroupCenters = (initial: boolean): DebugPoint[] => {
    const groups = new Map<string, { x: number; y: number; count: number }>();
    for (const node of nodePositions.values()) {
      const groupId = node.groupId ?? node.id;
      const group = groups.get(groupId) ?? { x: 0, y: 0, count: 0 };
      group.x += (initial ? node.anchorX : node.x) + node.width / 2;
      group.y += (initial ? node.anchorY : node.y) + node.height / 2;
      group.count += 1;
      groups.set(groupId, group);
    }
    return [...groups.values()].map((group) => ({
      x: group.x / group.count,
      y: group.y / group.count,
    }));
  };
  const debugInitialNodeSpread = debugEnabled
    ? debugRmsRadius(debugNodeCenters(true))
    : 1;
  const debugInitialGroupSpread = debugEnabled
    ? debugRmsRadius(debugGroupCenters(true))
    : 1;
  const debugSpreadRatio = (current: number, initial: number): number =>
    initial > Number.EPSILON ? current / initial : 1;
  const pushDebugSample = (samples: number[], value: number): void => {
    if (!debugEnabled || !Number.isFinite(value)) return;
    if (samples.length >= 120) samples.shift();
    samples.push(value);
  };
  const debugPercentile = (samples: readonly number[], percentile: number): number => {
    if (samples.length === 0) return 0;
    const sorted = [...samples].sort((left, right) => left - right);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * percentile))] ?? 0;
  };
  const setDebugField = (field: HTMLElement | null, value: string): void => {
    if (field && field.textContent !== value) field.textContent = value;
  };
  const debugMetric = (samples: readonly number[]): string => {
    const latest = samples.at(-1) ?? 0;
    const p95 = debugPercentile(samples, 0.95);
    return `${latest.toFixed(2)} / ${p95.toFixed(2)} ms`;
  };
  const debugOverlapCount = (): number => {
    const nodes = [...nodePositions.values()];
    let overlaps = 0;
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      if (!node) continue;
      for (let otherIndex = index + 1; otherIndex < nodes.length; otherIndex += 1) {
        const other = nodes[otherIndex];
        if (
          other &&
          node.x < other.x + other.width &&
          node.x + node.width > other.x &&
          node.y < other.y + other.height &&
          node.y + node.height > other.y
        ) {
          overlaps += 1;
        }
      }
    }
    return overlaps;
  };
  const resetDebugWindow = (timestamp: number): void => {
    debugWindowStartedAt = timestamp;
    debugPreviousFrameAt = 0;
    debugFrameCount = 0;
    debugPhysicsFrames = 0;
    debugRenderFrames = 0;
    debugLongFrames = 0;
    debugSamples.frame.length = 0;
  };
  const flushDebug = (timestamp: number, force = false): void => {
    if (!debugEnabled) return;
    const elapsed = Math.max(1, timestamp - debugWindowStartedAt);
    if (!force && elapsed < 500) return;
    const fps = (debugFrameCount * 1_000) / elapsed;
    const physicsHz = (debugPhysicsFrames * 1_000) / elapsed;
    const renderHz = (debugRenderFrames * 1_000) / elapsed;
    const frameP95 = debugPercentile(debugSamples.frame, 0.95);
    const maximumFrame = Math.max(0, ...debugSamples.frame);
    const groupCount = new Set(
      [...nodePositions.values()].map((node) => node.groupId ?? node.id),
    ).size;
    const overlaps = debugOverlapCount();
    const spread = debugSpreadRatio(
      debugRmsRadius(debugNodeCenters(false)),
      debugInitialNodeSpread,
    );
    const groupSpread = debugSpreadRatio(
      debugRmsRadius(debugGroupCenters(false)),
      debugInitialGroupSpread,
    );
    setDebugField(debugFields.fps, `${fps.toFixed(1)} rAF`);
    setDebugField(debugFields.frameP95, `${frameP95.toFixed(1)} ms`);
    setDebugField(debugFields.physicsHz, `${physicsHz.toFixed(1)} Hz`);
    setDebugField(debugFields.renderHz, `${renderHz.toFixed(1)} Hz`);
    setDebugField(debugFields.computeMs, debugMetric(debugSamples.compute));
    setDebugField(debugFields.roundTripMs, debugMetric(debugSamples.roundTrip));
    setDebugField(debugFields.applyMs, debugMetric(debugSamples.apply));
    setDebugField(debugFields.nodesMs, debugMetric(debugSamples.nodes));
    setDebugField(debugFields.edgesMs, debugMetric(debugSamples.edges));
    setDebugField(debugFields.renderMs, debugMetric(debugSamples.render));
    setDebugField(debugFields.movement, `${debugLastMovement.toFixed(3)} px`);
    setDebugField(
      debugFields.longFrames,
      `${debugLongFrames} (>50 ms), max ${maximumFrame.toFixed(1)}`,
    );
    setDebugField(
      debugFields.graphSize,
      `${nodeElements.length}N ${edgeElements.length}E ${simulationLinks.length}L ${groupCount}G`,
    );
    setDebugField(debugFields.overlaps, String(overlaps));
    setDebugField(debugFields.spread, `${spread.toFixed(3)}×`);
    setDebugField(debugFields.groupSpread, `${groupSpread.toFixed(3)}×`);
    setDebugField(debugFields.state, root.dataset.simulationState ?? "initializing");
    setDebugField(
      debugFields.engine,
      `${simulationEngine}${simulationStepPending ? " (pending)" : ""}`,
    );
    root.dataset.debugFps = fps.toFixed(1);
    root.dataset.debugFrameP95Ms = frameP95.toFixed(2);
    root.dataset.debugPhysicsHz = physicsHz.toFixed(1);
    root.dataset.debugRenderHz = renderHz.toFixed(1);
    root.dataset.debugOverlaps = String(overlaps);
    root.dataset.debugSpread = spread.toFixed(3);
    root.dataset.debugGroupSpread = groupSpread.toFixed(3);
    resetDebugWindow(timestamp);
  };
  const sampleDebugAnimationFrame = (timestamp: number): void => {
    if (!debugEnabled) return;
    if (debugPreviousFrameAt > 0) {
      const duration = timestamp - debugPreviousFrameAt;
      pushDebugSample(debugSamples.frame, duration);
      if (duration > 50) debugLongFrames += 1;
    }
    debugPreviousFrameAt = timestamp;
    debugFrameCount += 1;
    flushDebug(timestamp);
  };
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
    const toolbarBounds = toolbar.getBoundingClientRect();
    const toolbarBottom = toolbarBounds.bottom - bounds.top + 12;
    return {
      top: clamp(toolbarBottom, 12, Math.max(12, bounds.height - 48)),
      right: bounds.width < 640 ? 12 : 24,
      bottom: bounds.width < 640 ? 24 : 36,
      left: bounds.width < 640 ? 12 : 24,
    };
  };

  const positionSettingsPanel = (): void => {
    if (!settings?.open || !settingsSummary || !settingsPanel) {
      return;
    }
    const rootBounds = root.getBoundingClientRect();
    const summaryBounds = settingsSummary.getBoundingClientRect();
    const margin = 12;
    const gap = 10;
    const minimumLeft = rootBounds.left + margin;
    const maximumRight = rootBounds.right - margin;
    const panelWidth = Math.min(
      320,
      Math.max(1, rootBounds.width - margin * 2),
    );
    const availableBelow = Math.max(
      1,
      rootBounds.bottom - margin - summaryBounds.bottom - gap,
    );
    const availableAbove = Math.max(
      1,
      summaryBounds.top - gap - rootBounds.top - margin,
    );
    const preferredVisibleHeight = Math.min(settingsPanel.scrollHeight, 320);
    const placeBelow =
      availableBelow >= preferredVisibleHeight ||
      availableBelow >= availableAbove;
    const maximumHeight = placeBelow ? availableBelow : availableAbove;
    const visibleHeight = Math.min(settingsPanel.scrollHeight, maximumHeight);
    const top = placeBelow
      ? summaryBounds.bottom + gap
      : Math.max(
          rootBounds.top + margin,
          summaryBounds.top - gap - visibleHeight,
        );
    const left = clamp(
      summaryBounds.right - panelWidth,
      minimumLeft,
      Math.max(minimumLeft, maximumRight - panelWidth),
    );
    settingsPanel.style.left = `${left}px`;
    settingsPanel.style.top = `${top}px`;
    settingsPanel.style.width = `${panelWidth}px`;
    settingsPanel.style.maxHeight = `${maximumHeight}px`;
    settingsPanel.dataset.placement = placeBelow ? "bottom" : "top";
  };

  const scheduleSettingsPanelPosition = (): void => {
    if (settingsPositionFrame) {
      cancelAnimationFrame(settingsPositionFrame);
    }
    settingsPositionFrame = requestAnimationFrame(() => {
      settingsPositionFrame = 0;
      positionSettingsPanel();
    });
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
    const gridLevel = Math.ceil(
      Math.log2(
        GRID_TARGET_SCREEN_SPACING /
          (GRID_BASE_SPACING * transform.scale),
      ),
    );
    const coarseGridSpacing =
      GRID_BASE_SPACING * 2 ** gridLevel * transform.scale;
    const fineGridSpacing = coarseGridSpacing / 2;
    const fineGridOpacity = clamp(
      (coarseGridSpacing - GRID_TARGET_SCREEN_SPACING) /
        GRID_TARGET_SCREEN_SPACING,
      0,
      1,
    );
    viewport.style.setProperty(
      "--kg-grid-coarse-spacing",
      `${coarseGridSpacing}px`,
    );
    viewport.style.setProperty(
      "--kg-grid-fine-spacing",
      `${fineGridSpacing}px`,
    );
    viewport.style.setProperty(
      "--kg-grid-coarse-offset-x",
      `${positiveModulo(transform.x, coarseGridSpacing)}px`,
    );
    viewport.style.setProperty(
      "--kg-grid-coarse-offset-y",
      `${positiveModulo(transform.y, coarseGridSpacing)}px`,
    );
    viewport.style.setProperty(
      "--kg-grid-fine-offset-x",
      `${positiveModulo(transform.x, fineGridSpacing)}px`,
    );
    viewport.style.setProperty(
      "--kg-grid-fine-offset-y",
      `${positiveModulo(transform.y, fineGridSpacing)}px`,
    );
    viewport.style.setProperty(
      "--kg-grid-fine-opacity",
      `${fineGridOpacity * 100}%`,
    );
    scheduleEdgeCanvasRender();
    scheduleInspectorPosition();
  };

  const cancelCameraAnimation = (): void => {
    if (cameraAnimationFrame) {
      cancelAnimationFrame(cameraAnimationFrame);
      cameraAnimationFrame = 0;
    }
    delete root.dataset.cameraMoving;
  };

  const moveCameraBy = (
    deltaX: number,
    deltaY: number,
    smooth = false,
  ): void => {
    cancelCameraAnimation();
    const startX = transform.x;
    const startY = transform.y;
    const targetX = startX + deltaX;
    const targetY = startY + deltaY;
    if (!smooth || reducedMotionQuery.matches) {
      transform.x = targetX;
      transform.y = targetY;
      renderTransform();
      return;
    }

    const startedAt = performance.now();
    root.dataset.cameraMoving = "";
    const step = (timestamp: number): void => {
      const progress = clamp(
        (timestamp - startedAt) / CAMERA_TRANSITION_DURATION_MS,
        0,
        1,
      );
      const eased =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      transform.x = startX + (targetX - startX) * eased;
      transform.y = startY + (targetY - startY) * eased;
      if (progress < 1) {
        // Register the next camera step before the Canvas redraw so both run
        // in that order in the next frame and the edge layer does not lag.
        cameraAnimationFrame = requestAnimationFrame(step);
        renderTransform();
        return;
      }
      renderTransform();
      cameraAnimationFrame = 0;
      delete root.dataset.cameraMoving;
    };
    cameraAnimationFrame = requestAnimationFrame(step);
  };

  const connectionPoint = (
    from: KnowledgeGraphSimulationNode,
    toward: KnowledgeGraphSimulationNode,
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

  const setEdgeCanvasViewportSize = (width: number, height: number): void => {
    const nextWidth = Math.max(0, Math.round(width));
    const nextHeight = Math.max(0, Math.round(height));
    if (
      nextWidth === edgeCanvasCssWidth &&
      nextHeight === edgeCanvasCssHeight
    ) {
      return;
    }
    edgeCanvasCssWidth = nextWidth;
    edgeCanvasCssHeight = nextHeight;
    edgeCanvasSizeDirty = true;
  };

  const drawEdgeCanvas = (): boolean => {
    if (!edgeCanvas || edgeCanvasFailed || forcedColorsQuery.matches) {
      return false;
    }
    const cssWidth = edgeCanvasCssWidth;
    const cssHeight = edgeCanvasCssHeight;
    if (cssWidth <= 0 || cssHeight <= 0) {
      return false;
    }
    const context = edgeCanvasContext ?? edgeCanvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });
    if (!context) {
      edgeCanvasFailed = true;
      return false;
    }
    edgeCanvasContext = context;
    const requestedPixelRatio = clamp(window.devicePixelRatio || 1, 1, 2);
    const areaLimitedPixelRatio = Math.sqrt(
      MAX_EDGE_CANVAS_PIXELS / Math.max(1, cssWidth * cssHeight),
    );
    const pixelRatio = Math.min(
      requestedPixelRatio,
      Math.max(0.5, areaLimitedPixelRatio),
    );
    const pixelWidth = Math.max(1, Math.round(cssWidth * pixelRatio));
    const pixelHeight = Math.max(1, Math.round(cssHeight * pixelRatio));
    if (
      edgeCanvasSizeDirty ||
      edgeCanvasPixelRatio !== pixelRatio ||
      edgeCanvas.width !== pixelWidth ||
      edgeCanvas.height !== pixelHeight
    ) {
      edgeCanvas.width = pixelWidth;
      edgeCanvas.height = pixelHeight;
      edgeCanvasPixelRatio = pixelRatio;
      edgeCanvasSizeDirty = false;
    }
    if (edgeCanvasColorDirty || !edgeCanvasColor) {
      edgeCanvasColor =
        getComputedStyle(root).getPropertyValue("--text").trim() || "#090909";
      edgeCanvasColorDirty = false;
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);
    context.save();
    context.translate(transform.x, transform.y);
    context.scale(transform.scale, transform.scale);
    context.strokeStyle = edgeCanvasColor;
    context.fillStyle = edgeCanvasColor;
    context.lineCap = "butt";
    context.lineJoin = "round";
    const selectedNodeId = root.dataset.selectedNode;
    const inverseScale = 1 / Math.max(transform.scale, Number.EPSILON);

    for (const entry of edgeRenderEntries) {
      const { source, target } = entry;
      const hasArrow = entry.kind !== "related";
      const connected = Boolean(
        selectedNodeId &&
          (entry.sourceId === selectedNodeId || entry.targetId === selectedNodeId),
      );
      context.globalAlpha = selectedNodeId ? (connected ? 1 : 0.07) : 0.36;
      const strokeWidth = connected && selectedNodeId
        ? entry.draft ? 2.25 : 3
        : entry.draft ? 1.35 : 1.5;
      context.lineWidth = strokeWidth * inverseScale;

      let arrowBaseX: number;
      let arrowBaseY: number;
      let directionX: number;
      let directionY: number;
      context.beginPath();
      if (target.y > source.y + source.height + 8) {
        const sourceCenterX = source.x + source.width / 2;
        const targetCenterX = target.x + target.width / 2;
        const startY = source.y + source.height + 4;
        arrowBaseX = targetCenterX;
        arrowBaseY = target.y - 5 - (hasArrow ? 13 : 0);
        const middleY = (startY + arrowBaseY) / 2;
        directionX = 0;
        directionY = 1;
        context.moveTo(sourceCenterX, startY);
        context.bezierCurveTo(
          sourceCenterX,
          middleY,
          targetCenterX,
          middleY,
          targetCenterX,
          arrowBaseY,
        );
      } else {
        const start = connectionPoint(source, target, 4);
        const tip = connectionPoint(target, source, 5);
        const dx = tip.x - start.x;
        const dy = tip.y - start.y;
        const distance = Math.hypot(dx, dy) || 1;
        directionX = dx / distance;
        directionY = dy / distance;
        arrowBaseX = tip.x - directionX * (hasArrow ? 13 : 0);
        arrowBaseY = tip.y - directionY * (hasArrow ? 13 : 0);
        context.moveTo(start.x, start.y);
        context.lineTo(arrowBaseX, arrowBaseY);
      }
      context.stroke();

      if (hasArrow) {
        const perpendicularX = -directionY * 8;
        const perpendicularY = directionX * 8;
        context.beginPath();
        context.moveTo(
          arrowBaseX + directionX * 13,
          arrowBaseY + directionY * 13,
        );
        context.lineTo(
          arrowBaseX + perpendicularX,
          arrowBaseY + perpendicularY,
        );
        context.lineTo(
          arrowBaseX - perpendicularX,
          arrowBaseY - perpendicularY,
        );
        context.closePath();
        context.fill();
      }
    }
    context.restore();
    context.globalAlpha = 1;
    if (!edgeCanvasReady) {
      edgeCanvasReady = true;
      root.dataset.edgeRenderer = "canvas";
    }
    return true;
  };

  const revealSvgEdgeFallback = (permanent = false): void => {
    edgeCanvasReady = false;
    edgeCanvasFailed ||= permanent;
    edgeCanvasPendingNodeMilliseconds = 0;
    delete root.dataset.edgeRenderer;
    updateEdges(true);
  };

  const renderEdgeCanvasFrame = (): void => {
    edgeCanvasFrame = 0;
    const startedAt = debugEnabled ? performance.now() : 0;
    try {
      if (!drawEdgeCanvas()) {
        if (edgeCanvasReady) revealSvgEdgeFallback();
        return;
      }
    } catch {
      revealSvgEdgeFallback(true);
      return;
    }
    if (debugEnabled) {
      const edgeMilliseconds = performance.now() - startedAt;
      pushDebugSample(debugSamples.edges, edgeMilliseconds);
      pushDebugSample(
        debugSamples.render,
        edgeCanvasPendingNodeMilliseconds + edgeMilliseconds,
      );
      edgeCanvasPendingNodeMilliseconds = 0;
      debugRenderFrames += 1;
    }
  };

  const scheduleEdgeCanvasRender = (): void => {
    if (
      !edgeCanvas ||
      edgeCanvasFailed ||
      forcedColorsQuery.matches ||
      edgeCanvasFrame
    ) {
      return;
    }
    edgeCanvasFrame = requestAnimationFrame(renderEdgeCanvasFrame);
  };

  const updateEdges = (force = false): number => {
    const startedAt = debugEnabled ? performance.now() : 0;
    let writes = 0;
    for (const entry of edgeRenderEntries) {
      const { edge, source, target } = entry;
      const moved =
        Math.abs(source.x - entry.renderedSourceX) >= POSITION_RENDER_EPSILON ||
        Math.abs(source.y - entry.renderedSourceY) >= POSITION_RENDER_EPSILON ||
        Math.abs(target.x - entry.renderedTargetX) >= POSITION_RENDER_EPSILON ||
        Math.abs(target.y - entry.renderedTargetY) >= POSITION_RENDER_EPSILON;
      if (!force && !moved) continue;
      entry.renderedSourceX = source.x;
      entry.renderedSourceY = source.y;
      entry.renderedTargetX = target.x;
      entry.renderedTargetY = target.y;
      if (edgeCanvasReady) {
        writes += 1;
        continue;
      }
      if (target.y > source.y + source.height + 8) {
        const sourceCenterX = source.x + source.width / 2;
        const targetCenterX = target.x + target.width / 2;
        const startY = source.y + source.height + 4;
        const arrowBaseY =
          target.y - 5 - (entry.kind !== "related" ? 13 : 0);
        const middleY = (startY + arrowBaseY) / 2;
        edge.setAttribute(
          "d",
          `M ${sourceCenterX} ${startY} ` +
            `C ${sourceCenterX} ${middleY} ${targetCenterX} ${middleY} ` +
            `${targetCenterX} ${arrowBaseY}`,
        );
        writes += 1;
        continue;
      }
      const start = connectionPoint(source, target, 4);
      const tip = connectionPoint(target, source, 5);
      const dx = tip.x - start.x;
      const dy = tip.y - start.y;
      const distance = Math.hypot(dx, dy) || 1;
      const directionX = dx / distance;
      const directionY = dy / distance;
      const arrowLength = entry.kind !== "related" ? 13 : 0;
      const base = {
        x: tip.x - directionX * arrowLength,
        y: tip.y - directionY * arrowLength,
      };
      edge.setAttribute("d", `M ${start.x} ${start.y} L ${base.x} ${base.y}`);
      writes += 1;
    }
    if (edgeCanvasReady) {
      if (writes > 0) scheduleEdgeCanvasRender();
    } else if (debugEnabled) {
      pushDebugSample(debugSamples.edges, performance.now() - startedAt);
    }
    return writes;
  };

  const renderNodePositions = (): void => {
    const renderStartedAt = debugEnabled ? performance.now() : 0;
    const nodesStartedAt = debugEnabled ? performance.now() : 0;
    const selectedNodeId = root.dataset.selectedNode;
    let selectedNodeMoved = false;
    let nodeWrites = 0;
    for (const entry of nodeRenderEntries) {
      const { node, position } = entry;
      if (
        Math.abs(position.x - entry.renderedX) < POSITION_RENDER_EPSILON &&
        Math.abs(position.y - entry.renderedY) < POSITION_RENDER_EPSILON
      ) {
        continue;
      }
      entry.renderedX = position.x;
      entry.renderedY = position.y;
      node.style.translate = `${position.x}px ${position.y}px`;
      nodeWrites += 1;
      selectedNodeMoved ||= node.dataset.knowledgeNode === selectedNodeId;
    }
    const nodeMilliseconds = debugEnabled
      ? performance.now() - nodesStartedAt
      : 0;
    if (debugEnabled) pushDebugSample(debugSamples.nodes, nodeMilliseconds);
    const changedEdges = updateEdges();
    if (selectedNodeMoved) {
      scheduleInspectorPosition();
    }
    if (debugEnabled && edgeCanvasReady) {
      if (changedEdges > 0) {
        edgeCanvasPendingNodeMilliseconds += nodeMilliseconds;
      } else if (nodeWrites > 0) {
        pushDebugSample(debugSamples.render, nodeMilliseconds);
        debugRenderFrames += 1;
      }
    } else if (debugEnabled) {
      pushDebugSample(debugSamples.render, performance.now() - renderStartedAt);
      debugRenderFrames += 1;
    }
  };

  type SimulationUiState = "running" | "stable" | "paused" | "reduced";
  const setSimulationUiState = (state: SimulationUiState): void => {
    if (currentSimulationUiState === state) return;
    currentSimulationUiState = state;
    const active = state === "running" || state === "stable";
    if (simulationToggle) {
      simulationToggle.setAttribute("aria-pressed", String(active));
      simulationToggle.textContent = active
        ? ui.simulationStop
        : ui.simulationRun;
    }
    if (simulationStatus) {
      simulationStatus.textContent =
        state === "running"
          ? ui.simulationRunning
          : state === "stable"
            ? ui.simulationSettled
            : state === "reduced"
              ? ui.simulationReducedMotion
              : ui.simulationStopped;
    }
    root.dataset.simulationState = state;
    setDebugField(debugFields.state, state);
  };

  const updateSimulationEngineLabel = (): void => {
    if (renderedSimulationEngine === simulationEngine) return;
    renderedSimulationEngine = simulationEngine;
    root.dataset.simulationEngine = simulationEngine;
    if (simulationEngineOutput) {
      simulationEngineOutput.value =
        simulationEngine === "worker"
          ? ui.simulationWorkerEngine
          : ui.simulationMainThreadEngine;
    }
    setDebugField(debugFields.engine, simulationEngine);
  };

  const simulationOptions = (): KnowledgeGraphWorkerOptions => ({
    minimumX: 16,
    minimumY: 16,
    maximumX: graphWidth - 16,
    maximumY: graphHeight - 16,
    hierarchyStrength: hierarchyEnabled ? hierarchyStrength : 0,
    attractionStrength,
    repulsionStrength,
    groupStrength,
    groupSeparationStrength,
  });

  const postWorker = (message: KnowledgeGraphWorkerRequest): void => {
    simulationWorker?.postMessage(message);
  };

  const pauseSimulation = (state: "paused" | "reduced"): void => {
    simulationActive = false;
    if (simulationFrame) {
      cancelAnimationFrame(simulationFrame);
      simulationFrame = 0;
    }
    simulationPinnedId = undefined;
    setSimulationUiState(state);
    flushDebug(performance.now(), true);
  };

  const noteSimulationMovement = (movement: number): void => {
    simulationStableFrames =
      movement <= SIMULATION_STABLE_MOVEMENT
        ? simulationStableFrames + 1
        : 0;
    if (!simulationActive) {
      return;
    }
    setSimulationUiState(
      simulationStableFrames >= SIMULATION_STABLE_FRAME_TARGET
        ? "stable"
        : "running",
    );
  };

  const applyPackedWorkerPositions = (buffer: ArrayBuffer): boolean => {
    const values = new Float32Array(buffer);
    if (
      values.length !==
      nodePositionOrder.length * KNOWLEDGE_GRAPH_POSITION_STRIDE
    ) {
      return false;
    }
    for (const [index, nodeId] of nodePositionOrder.entries()) {
      const node = nodePositions.get(nodeId);
      if (!node) continue;
      const offset = index * KNOWLEDGE_GRAPH_POSITION_STRIDE;
      if (nodeDrag?.nodeId === nodeId) {
        continue;
      }
      node.x = values[offset] ?? node.x;
      node.y = values[offset + 1] ?? node.y;
      node.velocityX = values[offset + 2] ?? node.velocityX;
      node.velocityY = values[offset + 3] ?? node.velocityY;
    }
    return true;
  };

  const useMainThreadSimulation = (): void => {
    simulationWorker?.terminate();
    simulationWorker = undefined;
    simulationWorkerReady = false;
    simulationStepPending = false;
    simulationEngine = "main";
    updateSimulationEngineLabel();
  };

  const initializeSimulationWorker = (): void => {
    try {
      const worker = new Worker(
        new URL("./knowledge-graph-worker.ts", import.meta.url),
        { type: "module", name: "noetheca-knowledge-physics" },
      );
      simulationWorker = worker;
      worker.addEventListener(
        "message",
        (event: MessageEvent<KnowledgeGraphWorkerResponse>) => {
          const message = event.data;
          if (message.type === "error") {
            useMainThreadSimulation();
            return;
          }
          if (message.type === "ready") {
            if (message.generation !== simulationGeneration) return;
            simulationWorkerReady = true;
            simulationEngine = "worker";
            updateSimulationEngineLabel();
            return;
          }
          simulationStepPending = false;
          if (message.generation !== simulationGeneration) return;
          if (debugEnabled) {
            const receivedAt = performance.now();
            debugPhysicsFrames += 1;
            pushDebugSample(debugSamples.compute, message.computeMilliseconds);
            if (debugStepSentAt > 0) {
              pushDebugSample(
                debugSamples.roundTrip,
                receivedAt - debugStepSentAt,
              );
              debugStepSentAt = 0;
            }
          }
          const applyStartedAt = debugEnabled ? performance.now() : 0;
          if (!applyPackedWorkerPositions(message.positions)) {
            useMainThreadSimulation();
            return;
          }
          if (debugEnabled) {
            pushDebugSample(
              debugSamples.apply,
              performance.now() - applyStartedAt,
            );
            debugLastMovement = message.movement;
          }
          noteSimulationMovement(message.movement);
          if (
            root.dataset.view !== "list" &&
            root.dataset.simulationState !== "reduced"
          ) {
            renderNodePositions();
          }
        },
      );
      worker.addEventListener("error", useMainThreadSimulation);
      postWorker({
        type: "initialize",
        generation: simulationGeneration,
        nodes: [...nodePositions.values()].map((node) => ({ ...node })),
        links: simulationLinks,
        options: simulationOptions(),
      });
    } catch {
      useMainThreadSimulation();
    }
  };

  const runSimulation = (timestamp: number): void => {
    simulationFrame = 0;
    sampleDebugAnimationFrame(timestamp);
    if (!simulationActive) {
      return;
    }
    if (!root.isConnected) {
      pauseSimulation("paused");
      simulationWorker?.terminate();
      return;
    }
    const interval =
      root.dataset.simulationState === "stable"
        ? SIMULATION_STABLE_INTERVAL_MS
        : SIMULATION_ACTIVE_INTERVAL_MS;
    if (
      !document.hidden &&
      timestamp - simulationLastStepAt >= interval &&
      !simulationStepPending
    ) {
      simulationLastStepAt = timestamp;
      const pinnedId = nodeDrag?.nodeId ?? simulationPinnedId;
      if (simulationWorker && simulationWorkerReady) {
        simulationStepPending = true;
        if (debugEnabled) debugStepSentAt = performance.now();
        postWorker({
          type: "step",
          generation: simulationGeneration,
          pinnedId,
        });
      } else if (!simulationWorker) {
        const startedAt = performance.now();
        const movement = stepKnowledgeGraphSimulation(
          [...nodePositions.values()],
          simulationLinks,
          { ...simulationOptions(), pinnedId },
        );
        if (debugEnabled) {
          debugPhysicsFrames += 1;
          pushDebugSample(debugSamples.compute, performance.now() - startedAt);
          debugLastMovement = movement;
        }
        noteSimulationMovement(movement);
        if (root.dataset.view !== "list") {
          renderNodePositions();
        }
      }
    }
    simulationFrame = requestAnimationFrame(runSimulation);
  };

  const startSimulation = (
    trigger: "auto" | "manual" | "settings" | "drag",
    pinnedId?: string,
  ): void => {
    if (trigger === "manual") {
      reducedMotionOverride = true;
    }
    if (
      trigger !== "manual" &&
      reducedMotionQuery.matches &&
      !reducedMotionOverride
    ) {
      pauseSimulation("reduced");
      return;
    }
    if (!root.isConnected) {
      return;
    }
    const wasActive = simulationActive;
    simulationStableFrames = 0;
    simulationPinnedId = pinnedId;
    simulationActive = true;
    if (!wasActive && debugEnabled) {
      resetDebugWindow(performance.now());
    }
    setSimulationUiState("running");
    if (!simulationFrame) {
      simulationFrame = requestAnimationFrame(runSimulation);
    }
  };

  const resetSimulationDefaults = (): void => {
    hierarchyEnabled = true;
    hierarchyStrength = 0.55;
    attractionStrength = 1;
    repulsionStrength = 1;
    groupStrength = 1;
    groupSeparationStrength = 1.25;
    if (hierarchyEnabledControl) {
      hierarchyEnabledControl.checked = true;
    }
    if (hierarchyControl) {
      hierarchyControl.value = "55";
      hierarchyControl.disabled = false;
      hierarchyControl.setAttribute("aria-valuetext", "55%");
    }
    if (attractionControl) {
      attractionControl.value = "100";
      attractionControl.setAttribute("aria-valuetext", "1.00×");
    }
    if (repulsionControl) {
      repulsionControl.value = "100";
      repulsionControl.setAttribute("aria-valuetext", "1.00×");
    }
    if (groupStrengthControl) {
      groupStrengthControl.value = "100";
      groupStrengthControl.setAttribute("aria-valuetext", "1.00×");
    }
    if (groupSeparationControl) {
      groupSeparationControl.value = "125";
      groupSeparationControl.setAttribute("aria-valuetext", "1.25×");
    }
    hierarchyOutput && (hierarchyOutput.value = "55%");
    attractionOutput && (attractionOutput.value = "1.00×");
    repulsionOutput && (repulsionOutput.value = "1.00×");
    groupStrengthOutput && (groupStrengthOutput.value = "1.00×");
    groupSeparationOutput && (groupSeparationOutput.value = "1.25×");
    for (const position of nodePositions.values()) {
      position.x = position.anchorX;
      position.y = position.anchorY;
      position.velocityX = 0;
      position.velocityY = 0;
    }
    renderNodePositions();
    simulationGeneration += 1;
    simulationStepPending = false;
    postWorker({
      type: "reset",
      generation: simulationGeneration,
      options: simulationOptions(),
    });
    startSimulation("settings");
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
    smoothCamera = false,
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
      requestAnimationFrame(() =>
        centerNodeBesideReader(selectedNode, smoothCamera),
      );
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
    cancelCameraAnimation();
    const bounds = viewport.getBoundingClientRect();
    const pointX = clientX - bounds.left;
    const pointY = clientY - bounds.top;
    const worldX = (pointX - transform.x) / transform.scale;
    const worldY = (pointY - transform.y) / transform.scale;
    transform.scale = clampInteractiveScale(
      nextScale,
      interactionMinimumScale,
    );
    transform.x = pointX - worldX * transform.scale;
    transform.y = pointY - worldY * transform.scale;
    renderTransform();
  };

  const fit = (): void => {
    cancelCameraAnimation();
    const bounds = viewport.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) {
      return;
    }
    const safe = getSafeArea();
    const contentBounds = measureGraphContentBounds([
      ...nodePositions.values(),
    ]);
    if (!contentBounds) {
      return;
    }
    const {
      left: contentLeft,
      top: contentTop,
      right: contentRight,
      bottom: contentBottom,
    } = contentBounds;
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
    transform.scale = clampFitScale(
      Math.min(
        availableWidth / contentWidth,
        availableHeight / contentHeight,
        1.25,
      ),
    );
    interactionMinimumScale = Math.min(
      MIN_INTERACTIVE_SCALE,
      transform.scale,
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
    smoothCamera = false,
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
    moveCameraBy(
      targetX - (nodeBounds.left + nodeBounds.right) / 2,
      targetY - (nodeBounds.top + nodeBounds.bottom) / 2,
      smoothCamera,
    );
  };

  const centerSelection = (
    node: HTMLButtonElement,
    smoothCamera = false,
  ): void => {
    if (
      root.dataset.readerOpen !== undefined &&
      !readerModalQuery.matches
    ) {
      centerNodeBesideReader(node, smoothCamera);
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

    moveCameraBy(
      targetX - (unionLeft + unionRight) / 2,
      targetY - (unionTop + unionBottom) / 2,
      smoothCamera,
    );
    requestAnimationFrame(() => positionInspector(node));
  };

  const clearSelection = (): void => {
    for (const node of nodeElements) {
      node.setAttribute("aria-pressed", "false");
      node.removeAttribute("data-selected");
    }
    for (const edge of edgeElements) {
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
    scheduleEdgeCanvasRender();
  };

  const selectNode = (nodeId: string, smoothCamera = false): void => {
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
    for (const edge of edgeElements) {
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
        !edgeCanvasReady &&
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
    scheduleEdgeCanvasRender();
    if (root.dataset.readerOpen !== undefined) {
      const href = selectedNode.dataset.knowledgeHref;
      if (href) {
        const destination = new URL(href, window.location.href);
        if (destination.origin === window.location.origin) {
          void openReader(destination.href, selectedNode, smoothCamera);
        }
      }
    }
    requestAnimationFrame(() => {
      if (root.dataset.readerOpen === undefined) {
        centerSelection(selectedNode, smoothCamera);
      }
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
        selectNode(nodeId, true);
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
      selectNode(nodeId, Boolean(relation && !node));
    }
  });

  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && root.dataset.readerOpen !== undefined) {
      closeReader();
      return;
    }
    if (event.key === "Escape" && root.dataset.selectedNode) {
      clearSelection();
      return;
    }
    if (event.target !== viewport || root.dataset.view === "list") {
      return;
    }
    const panDistance = event.shiftKey ? 120 : 48;
    if (event.key === "ArrowUp") {
      transform.y += panDistance;
    } else if (event.key === "ArrowDown") {
      transform.y -= panDistance;
    } else if (event.key === "ArrowLeft") {
      transform.x += panDistance;
    } else if (event.key === "ArrowRight") {
      transform.x -= panDistance;
    } else if (event.key === "+" || event.key === "=") {
      const bounds = viewport.getBoundingClientRect();
      zoomAt(transform.scale * 1.2, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
      event.preventDefault();
      return;
    } else if (event.key === "-" || event.key === "_") {
      const bounds = viewport.getBoundingClientRect();
      zoomAt(transform.scale / 1.2, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
      event.preventDefault();
      return;
    } else if (event.key === "Home") {
      fit();
      event.preventDefault();
      return;
    } else {
      return;
    }
    event.preventDefault();
    renderTransform();
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
  simulationToggle?.addEventListener("click", () => {
    if (simulationActive) {
      pauseSimulation("paused");
    } else {
      startSimulation("manual");
    }
  });
  settings?.addEventListener("toggle", () => {
    settingsSummary?.setAttribute("aria-expanded", String(settings.open));
    if (settings.open) {
      scheduleSettingsPanelPosition();
    }
  });
  settings?.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !settings.open) {
      return;
    }
    event.preventDefault();
    settings.open = false;
    settingsSummary?.focus({ preventScroll: true });
  });
  hierarchyEnabledControl?.addEventListener("change", () => {
    hierarchyEnabled = hierarchyEnabledControl.checked;
    if (hierarchyControl) {
      hierarchyControl.disabled = !hierarchyEnabled;
    }
    const label = hierarchyEnabled
      ? `${Math.round(hierarchyStrength * 100)}%`
      : "0%";
    hierarchyOutput && (hierarchyOutput.value = label);
    hierarchyEnabledControl.setAttribute(
      "aria-valuetext",
      hierarchyEnabled ? label : "0%",
    );
    postWorker({
      type: "configure",
      generation: simulationGeneration,
      options: simulationOptions(),
    });
    startSimulation("settings");
  });
  hierarchyControl?.addEventListener("input", () => {
    const percentage = clamp(Number(hierarchyControl.value), 0, 100);
    hierarchyStrength = percentage / 100;
    const label = `${Math.round(percentage)}%`;
    hierarchyOutput && (hierarchyOutput.value = label);
    hierarchyControl.setAttribute("aria-valuetext", label);
    postWorker({
      type: "configure",
      generation: simulationGeneration,
      options: simulationOptions(),
    });
    startSimulation("settings");
  });
  attractionControl?.addEventListener("input", () => {
    const percentage = clamp(Number(attractionControl.value), 40, 160);
    attractionStrength = percentage / 100;
    const label = `${attractionStrength.toFixed(2)}×`;
    attractionOutput && (attractionOutput.value = label);
    attractionControl.setAttribute("aria-valuetext", label);
    postWorker({
      type: "configure",
      generation: simulationGeneration,
      options: simulationOptions(),
    });
    startSimulation("settings");
  });
  repulsionControl?.addEventListener("input", () => {
    const percentage = clamp(Number(repulsionControl.value), 40, 180);
    repulsionStrength = percentage / 100;
    const label = `${repulsionStrength.toFixed(2)}×`;
    repulsionOutput && (repulsionOutput.value = label);
    repulsionControl.setAttribute("aria-valuetext", label);
    postWorker({
      type: "configure",
      generation: simulationGeneration,
      options: simulationOptions(),
    });
    startSimulation("settings");
  });
  groupStrengthControl?.addEventListener("input", () => {
    const percentage = clamp(Number(groupStrengthControl.value), 20, 180);
    groupStrength = percentage / 100;
    const label = `${groupStrength.toFixed(2)}×`;
    groupStrengthOutput && (groupStrengthOutput.value = label);
    groupStrengthControl.setAttribute("aria-valuetext", label);
    postWorker({
      type: "configure",
      generation: simulationGeneration,
      options: simulationOptions(),
    });
    startSimulation("settings");
  });
  groupSeparationControl?.addEventListener("input", () => {
    const percentage = clamp(Number(groupSeparationControl.value), 60, 200);
    groupSeparationStrength = percentage / 100;
    const label = `${groupSeparationStrength.toFixed(2)}×`;
    groupSeparationOutput && (groupSeparationOutput.value = label);
    groupSeparationControl.setAttribute("aria-valuetext", label);
    postWorker({
      type: "configure",
      generation: simulationGeneration,
      options: simulationOptions(),
    });
    startSimulation("settings");
  });
  simulationReset?.addEventListener("click", resetSimulationDefaults);
  viewButton.addEventListener("click", () => {
    const showList = root.dataset.view !== "list";
    clearSelection();
    root.dataset.view = showList ? "list" : "map";
    viewButton.setAttribute("aria-pressed", String(showList));
    viewButton.textContent = showList ? ui.map : ui.list;
    if (!showList) {
      renderNodePositions();
      requestAnimationFrame(fit);
    }
  });

  document.addEventListener("visibilitychange", () => {
    simulationLastStepAt = performance.now();
    if (!document.hidden) resetDebugWindow(simulationLastStepAt);
    if (!document.hidden && simulationActive && !simulationFrame) {
      simulationFrame = requestAnimationFrame(runSimulation);
    }
  });
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) {
      return;
    }
    if (simulationFrame) {
      cancelAnimationFrame(simulationFrame);
      simulationFrame = 0;
    }
    simulationLastStepAt = performance.now();
    resetDebugWindow(simulationLastStepAt);
    renderNodePositions();
    scheduleEdgeCanvasRender();
    if (!document.hidden && simulationActive) {
      simulationFrame = requestAnimationFrame(runSimulation);
    }
  });
  reducedMotionQuery.addEventListener("change", () => {
    if (reducedMotionQuery.matches) {
      reducedMotionOverride = false;
      pauseSimulation("reduced");
    } else {
      reducedMotionOverride = false;
      startSimulation("auto");
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
    cancelCameraAnimation();
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
      const firstMovement =
        !nodeDrag.moved && Math.hypot(deltaX, deltaY) > 4 / transform.scale;
      if (firstMovement) {
        nodeDrag.moved = true;
        startSimulation("drag", nodeDrag.nodeId);
      }
      if (!nodeDrag.moved) {
        return;
      }
      position.x = clamp(
        nodeDrag.startX + deltaX,
        16,
        graphWidth - position.width - 16,
      );
      position.y = clamp(
        nodeDrag.startY + deltaY,
        16,
        graphHeight - position.height - 16,
      );
      position.velocityX = 0;
      position.velocityY = 0;
      postWorker({
        type: "set-node",
        generation: simulationGeneration,
        id: nodeDrag.nodeId,
        x: position.x,
        y: position.y,
        pinned: true,
      });
      renderNodePositions();
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
      transform.scale = clampInteractiveScale(
        pinchScale * (distance / pinchDistance),
        interactionMinimumScale,
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
      simulationPinnedId = undefined;
      const position = nodePositions.get(finishedDrag.nodeId);
      if (position) {
        postWorker({
          type: "set-node",
          generation: simulationGeneration,
          id: finishedDrag.nodeId,
          x: position.x,
          y: position.y,
          pinned: false,
        });
      }
      if (!cancelled && !finishedDrag.moved) {
        selectNode(finishedDrag.nodeId);
      } else {
        startSimulation("drag");
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

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target === viewport) {
        setEdgeCanvasViewportSize(entry.contentRect.width, entry.contentRect.height);
      }
    }
    scheduleEdgeCanvasRender();
    if (settings?.open) {
      scheduleSettingsPanelPosition();
    }
    if (root.dataset.view !== "list") {
      if (root.dataset.selectedNode) {
        scheduleInspectorPosition();
      } else {
        fit();
      }
    }
  });
  observer.observe(viewport);
  observer.observe(toolbar);
  const themeObserver = new MutationObserver(() => {
    if (!root.isConnected) {
      themeObserver.disconnect();
      return;
    }
    edgeCanvasColorDirty = true;
    scheduleEdgeCanvasRender();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  forcedColorsQuery.addEventListener("change", () => {
    edgeCanvasColorDirty = true;
    if (forcedColorsQuery.matches) {
      if (edgeCanvasReady) revealSvgEdgeFallback();
    } else {
      scheduleEdgeCanvasRender();
    }
  });
  edgeCanvas?.addEventListener("contextlost", (event) => {
    event.preventDefault();
    revealSvgEdgeFallback();
  });
  edgeCanvas?.addEventListener("contextrestored", () => {
    edgeCanvasContext = undefined;
    edgeCanvasFailed = false;
    edgeCanvasColorDirty = true;
    scheduleEdgeCanvasRender();
  });
  window.addEventListener("beforeprint", () => {
    resumeCanvasAfterPrint = edgeCanvasReady;
    if (edgeCanvasReady) revealSvgEdgeFallback();
  });
  window.addEventListener("afterprint", () => {
    if (!resumeCanvasAfterPrint) return;
    resumeCanvasAfterPrint = false;
    scheduleEdgeCanvasRender();
  });
  window.visualViewport?.addEventListener(
    "resize",
    scheduleSettingsPanelPosition,
  );
  window.visualViewport?.addEventListener(
    "scroll",
    scheduleSettingsPanelPosition,
  );

  root.dataset.enhanced = "true";
  const initialViewportBounds = viewport.getBoundingClientRect();
  setEdgeCanvasViewportSize(
    initialViewportBounds.width,
    initialViewportBounds.height,
  );
  updateEdges(true);
  scheduleEdgeCanvasRender();
  updateSimulationEngineLabel();
  initializeSimulationWorker();
  setSimulationUiState(reducedMotionQuery.matches ? "reduced" : "paused");
  flushDebug(performance.now(), true);
  const fitAfterLayout = (): void => {
    requestAnimationFrame(() => requestAnimationFrame(fit));
  };
  window.addEventListener("load", fitAfterLayout, { once: true });
  document.fonts.ready.then(fitAfterLayout).catch(() => {
    // The initial double animation frame still provides a safe fallback.
  });
  fitAfterLayout();
  requestAnimationFrame(() => startSimulation("auto"));
}

export function initKnowledgeGraphs(): void {
  for (const root of document.querySelectorAll<HTMLElement>(
    "[data-knowledge-graph]",
  )) {
    initializeKnowledgeGraph(root);
  }
}
