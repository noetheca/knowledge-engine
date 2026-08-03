import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const clientSource = await readFile(
  new URL("../src/client/knowledge-graph.ts", import.meta.url),
  "utf8",
);
const componentSource = await readFile(
  new URL("../src/components/KnowledgeGraph.astro", import.meta.url),
  "utf8",
);
const graphStyles = await readFile(
  new URL("../src/styles/knowledge-graph.css", import.meta.url),
  "utf8",
);
const uiSource = await readFile(
  new URL("../src/i18n/ui.ts", import.meta.url),
  "utf8",
);
const workerSource = await readFile(
  new URL("../src/client/knowledge-graph-worker.ts", import.meta.url),
  "utf8",
);

test("runs continuous adaptive physics in a worker with explicit controls", () => {
  assert.match(clientSource, /requestAnimationFrame\(runSimulation\)/);
  assert.match(clientSource, /new Worker\(/);
  assert.match(clientSource, /SIMULATION_STABLE_INTERVAL_MS/);
  assert.doesNotMatch(clientSource, /SIMULATION_MAX_(?:FRAMES|DURATION)/);
  assert.match(workerSource, /stepKnowledgeGraphSimulation/);
  assert.match(workerSource, /Float32Array/);
  assert.match(workerSource, /positions\.buffer/);
  assert.match(clientSource, /reducedMotionQuery\.matches/);
  assert.match(clientSource, /toolbar\.getBoundingClientRect\(\)/);
  assert.match(componentSource, /data-graph-simulation-toggle/);
  assert.match(componentSource, /data-hierarchy-enabled/);
  assert.match(componentSource, /data-attraction-control/);
  assert.match(componentSource, /data-repulsion-control/);
  assert.match(componentSource, /data-group-strength-control/);
  assert.match(componentSource, /data-group-separation-control/);
  assert.match(componentSource, /data-simulation-engine-output/);
  assert.match(componentSource, /data-simulation-reset/);
});

test("renders the diagnostics HUD only when the explicit debug prop is enabled", () => {
  assert.match(componentSource, /debug\?: boolean/);
  assert.match(componentSource, /debug = false/);
  assert.match(
    componentSource,
    /data-debug=\{debug \? "true" : undefined\}/,
  );
  assert.match(
    componentSource,
    /debug && \(\s*<aside[^>]*data-graph-debug-hud[^>]*aria-hidden="true"/s,
  );

  for (const attribute of [
    "data-debug-fps",
    "data-debug-frame-p95",
    "data-debug-physics-hz",
    "data-debug-render-hz",
    "data-debug-compute-ms",
    "data-debug-round-trip-ms",
    "data-debug-apply-ms",
    "data-debug-nodes-ms",
    "data-debug-edges-ms",
    "data-debug-render-ms",
    "data-debug-movement",
    "data-debug-long-frames",
    "data-debug-graph-size",
    "data-debug-overlaps",
    "data-debug-spread",
    "data-debug-group-spread",
    "data-debug-state",
    "data-debug-engine",
  ]) {
    assert.match(componentSource, new RegExp(attribute));
  }

  assert.match(
    clientSource,
    /const debugEnabled = root\.dataset\.debug === "true" && Boolean\(debugHud\)/,
  );
});

test("samples rAF, physics, and render rates separately and flushes every 500 ms", () => {
  assert.match(clientSource, /if \(!force && elapsed < 500\) return/);
  assert.match(
    clientSource,
    /const fps = \(debugFrameCount \* 1_000\) \/ elapsed/,
  );
  assert.match(
    clientSource,
    /const physicsHz = \(debugPhysicsFrames \* 1_000\) \/ elapsed/,
  );
  assert.match(
    clientSource,
    /const renderHz = \(debugRenderFrames \* 1_000\) \/ elapsed/,
  );
  assert.match(
    clientSource,
    /sampleDebugAnimationFrame[\s\S]*?debugFrameCount\s*(?:\+=\s*1|\+\+)[\s\S]*?flushDebug\(timestamp\)/,
  );
  assert.match(
    clientSource,
    /debugPhysicsFrames\s*(?:\+=\s*1|\+\+)/,
  );
  assert.match(
    clientSource,
    /debugRenderFrames\s*(?:\+=\s*1|\+\+)/,
  );
  assert.match(
    clientSource,
    /const runSimulation = \(timestamp: number\): void => \{[\s\S]*?sampleDebugAnimationFrame\(timestamp\)/,
  );
  assert.match(clientSource, /setDebugField\(debugFields\.fps,/);
  assert.match(clientSource, /setDebugField\(debugFields\.physicsHz,/);
  assert.match(clientSource, /setDebugField\(debugFields\.renderHz,/);
  assert.match(clientSource, /root\.dataset\.debugSpread = spread\.toFixed\(3\)/);
  assert.match(
    clientSource,
    /root\.dataset\.debugGroupSpread = groupSpread\.toFixed\(3\)/,
  );
});

test("keeps keyboard navigation and the accessible list fallback", () => {
  assert.match(componentSource, /aria-keyshortcuts=/);
  assert.match(componentSource, /tabindex="0"/);
  assert.match(componentSource, /class="kg-list-view"/);
  assert.match(clientSource, /event\.key === "ArrowUp"/);
  assert.match(clientSource, /event\.key === "Home"/);
});

test("keeps graph settings reachable in short and narrow viewports", () => {
  assert.match(componentSource, /data-graph-settings-panel/);
  assert.match(clientSource, /root\.getBoundingClientRect\(\)/);
  assert.match(clientSource, /settingsPanel\.scrollHeight/);
  assert.match(clientSource, /settingsPanel\.style\.maxHeight/);
  assert.match(clientSource, /availableBelow >= availableAbove/);
  assert.match(graphStyles, /\.kg-settings__panel\s*\{[^}]*position: fixed;/s);
  assert.match(graphStyles, /\.kg-settings__panel\s*\{[^}]*overflow-y: auto;/s);
});

test("presents related knowledge in node details instead of the main SVG", () => {
  assert.match(componentSource, /data-knowledge-related/);
  assert.match(componentSource, /node\.related\.length/);
  assert.doesNotMatch(componentSource, /hasRelatedEdges/);
  assert.match(componentSource, /data-simulation-links=/);
});

test("keeps prerequisite lines visible and emphasizes a selected neighbourhood", () => {
  assert.match(
    graphStyles,
    /\.kg-edges path\[data-knowledge-edge\]\s*\{[^}]*opacity: 0\.36;/s,
  );
  assert.match(
    graphStyles,
    /\.kg-edge-arrow-marker__shape\s*\{[^}]*fill: var\(--text\);/s,
  );
  assert.match(
    graphStyles,
    /\.knowledge-graph\[data-selected-node\][^{}]*\.is-connected[^{}]*\{[^}]*opacity: 1;/s,
  );
  assert.match(clientSource, /edge\.classList\.toggle\("is-connected", connected\)/);
  assert.match(clientSource, /edge\.classList\.remove\("is-connected", "is-incoming"\)/);
  assert.match(
    uiSource,
    /細い線は前提関係です。ノードを選ぶと直接の関係を強調します/,
  );
  assert.match(componentSource, /data-knowledge-group=\{position\.groupId\}/);
  assert.match(componentSource, /data-knowledge-rank=\{position\.rank\}/);
  assert.match(clientSource, /node\.style\.translate/);
});

test("uses one isolated SVG marker per graph instead of per-edge polygons", () => {
  assert.match(
    componentSource,
    /const edgeArrowMarkerId = `kg-edge-arrow-\$\{crypto\.randomUUID\(\)\}`/,
  );
  assert.match(componentSource, /<marker\s+id=\{edgeArrowMarkerId\}/s);
  assert.match(
    componentSource,
    /marker-end=\{edge\.kind !== "related"[\s\S]*?`url\(#\$\{edgeArrowMarkerId\}\)`/,
  );
  assert.doesNotMatch(componentSource, /<polygon/);
  assert.doesNotMatch(componentSource, /data-knowledge-arrow/);
  assert.doesNotMatch(clientSource, /edgeArrowsById/);
  assert.doesNotMatch(clientSource, /setAttribute\(\s*"points"/);
  assert.match(clientSource, /edge\.setAttribute\("d"/);
});

test("progressively enhances the static SVG with a viewport-sized canvas", () => {
  assert.match(componentSource, /<canvas[\s\S]*?data-knowledge-edge-canvas/s);
  assert.match(componentSource, /<svg[\s\S]*?class="kg-edges"/s);
  assert.match(clientSource, /getContext\("2d", \{/);
  assert.match(clientSource, /window\.devicePixelRatio/);
  assert.match(clientSource, /MAX_EDGE_CANVAS_PIXELS/);
  assert.match(clientSource, /entry\.contentRect\.width/);
  assert.match(clientSource, /edgeCanvasSizeDirty/);
  assert.match(clientSource, /context\.setTransform\(pixelRatio/);
  assert.match(clientSource, /context\.translate\(transform\.x, transform\.y\)/);
  assert.match(clientSource, /context\.scale\(transform\.scale, transform\.scale\)/);
  assert.match(clientSource, /getPropertyValue\("--text"\)/);
  assert.match(clientSource, /requestAnimationFrame\(renderEdgeCanvasFrame\)/);
  assert.match(clientSource, /root\.dataset\.edgeRenderer = "canvas"/);
  assert.match(clientSource, /scheduleEdgeCanvasRender\(\);[\s\S]*?scheduleInspectorPosition\(\)/);
  assert.match(clientSource, /new MutationObserver\([\s\S]*?data-theme/);
  assert.match(clientSource, /window\.addEventListener\("beforeprint"/);
  assert.match(clientSource, /window\.addEventListener\("afterprint"/);
  assert.match(
    graphStyles,
    /\.kg-edge-canvas\s*\{[^}]*visibility: hidden;/s,
  );
  assert.match(
    graphStyles,
    /\[data-edge-renderer="canvas"\] \.kg-edge-canvas\s*\{[^}]*visibility: visible;/s,
  );
  assert.match(
    graphStyles,
    /\[data-edge-renderer="canvas"\] \.kg-edges\s*\{[^}]*visibility: hidden;/s,
  );
  assert.match(
    graphStyles,
    /@media print[\s\S]*?\[data-edge-renderer="canvas"\] \.kg-edges\s*\{[^}]*visibility: visible;/s,
  );
});
