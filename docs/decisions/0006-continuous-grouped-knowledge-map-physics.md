# 0006: Continuous grouped knowledge-map physics

- Status: Accepted
- Date: 2026-08-02
- Supersedes: the runtime-physics and edge-visibility decisions in 0005

## Context

The finite runtime settlement in ADR 0005 stopped after 90 frames, 1.1 seconds,
or a short stable interval. A full-strength hierarchy also projected every node
back onto a fixed Y row. At the same time, prerequisite edges were hidden until
a node was selected. On a dense map this looked like a stopped, unrelated cloud
instead of a live model of knowledge relationships.

Removing the safety limit on the main thread would make interaction less
responsive. Moving only force calculation to a GPU would still require reading
positions back to update semantic HTML nodes, so compute-shader overhead would
dominate at the current scale.

## Decision

The build-time layout remains deterministic and usable without JavaScript. It
now gives semantic groups more initial space and records each node's group and
prerequisite rank.

The browser runs an adaptive, continuous 2D simulation:

- a dedicated module Web Worker owns force calculation;
- compact positions and velocities return in a transferable `Float32Array`;
- the main thread owns semantic HTML nodes, SVG edges, selection, keyboard
  controls, and article navigation;
- active motion is sampled at up to 30 Hz and a stable layout at 12 Hz; stability
  lowers frequency but does not disable the simulator;
- only an explicit pause, reduced-motion preference, disconnected component, or
  browser background throttling suspends work;
- the visible status distinguishes running, stable, paused, and reduced-motion
  states and reports whether the Worker or main-thread fallback is active.

The hierarchy is a soft Y anchor plus a one-sided prerequisite-order force. It
never fixes Y coordinates or clamps a dragged node to its row. Nodes also
receive local repulsion, collision response, distance-weighted link attraction,
group cohesion, and group-centroid separation. `group` and `groupLabel` are
optional model metadata; a stable per-node fallback keeps other domains
compatible.

All prerequisite edges and arrowheads are faintly visible by default. Selecting
a node dims other edges and emphasizes its direct prerequisite neighbourhood.
Edge geometry is updated from a cached element set, and node motion uses CSS
`translate` rather than layout-driving `left` and `top` updates.

The Worker boundary is the future optimization boundary. A measured hot loop
may be replaced with a single-threaded WebAssembly backend without changing the
UI protocol. WASM threads are not adopted now because shared memory requires a
cross-origin-isolated deployment. WebGPU compute is deferred until positions
can stay on the GPU for rendering, such as a thousands-of-nodes or optional 3D
view. The accessible HTML list remains required in every rendering mode.

## Consequences

- Physics no longer ends because an arbitrary frame or wall-clock limit was
  reached.
- Nearby concepts remain legible while groups can move in both axes and repel
  other groups.
- Force work no longer blocks pointer, keyboard, reader, or toolbar handling on
  capable browsers; the main-thread path remains a compatibility fallback.
- Stable layouts use less work without presenting a misleading “stopped” state.
- Two-dimensional labels and prerequisite direction remain easier to read than
  in a 3D scene. A 3D experiment is justified only when scale or relationship
  crossings cannot be handled by the 2D grouped layout and a GPU renderer,
  camera, picking, and accessible alternative can be maintained together.

## References

- [MDN: Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)
- [MDN: Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)
- [MDN: WebAssembly](https://developer.mozilla.org/en-US/docs/WebAssembly)
- [MDN: SharedArrayBuffer security requirements](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)
- [WebGPU explainer](https://gpuweb.github.io/gpuweb/explainer/)
- [MDN: WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [MDN: Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [W3C WCAG 2.2.2: Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
- [MDN: `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)
