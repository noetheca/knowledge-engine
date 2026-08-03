# 0005: Deterministic hierarchical knowledge maps

- Status: Accepted for build-time layout; runtime physics and edge visibility superseded by 0006
- Date: 2026-08-02

## Context

Force-directed placement made dense maps expensive and visually unstable. It
also allowed the first view to obscure the meaning of `prerequisites`: required
knowledge did not consistently read from top to bottom. Drawing every
non-hierarchical `related` relation added another dense set of lines without
helping learners decide what to study first.

## Decision

The shared prerequisite map is laid out once at build time. A node's vertical
layer is its longest prerequisite depth, so every prerequisite is above its
dependent. Large layers wrap into bounded rows. Four deterministic barycentric
sweeps order adjacent layers to reduce crossings; stable IDs break ties.

Only directional prerequisite edges are included in the default SVG. They are
kept in the document for selection highlighting and client-side geometry, and
remain inputs to finite physics, but stay visually hidden while no node is
selected. Selecting a node reveals
only its direct prerequisite and dependent edges. This avoids presenting a
dense all-edges diagram before the learner has chosen a local context. The
inspector continues to list every direct prerequisite and dependent, including
relationships whose lines are currently hidden. The graph model also continues
to normalize `related` pairs, while the UI presents them as a selectable list
for the active node. Contextual maps use the same static layered algorithm with
chronology bands and explicit directed contextual relations.

The browser provides camera pan, wheel/pinch/keyboard zoom, fit, selection,
article reading, and a complete list view. It may additionally run a finite
force settlement whose initial coordinates and force rules are deterministic.
The settlement stops on convergence or a fixed frame/time limit, so a slower
device may stop on an earlier final frame. It does not auto-start when reduced
motion is requested.

Hierarchy constraints are enabled at full strength by default, fixing every
node to its prerequisite rank while allowing bounded horizontal settlement.
Users may weaken the hierarchy constraint or explicitly turn it off to explore
a free force layout. They may also adjust attraction and local repulsion; a
settings change reheats only the finite settlement. Reset restores the default
constraint, force strengths, and build-time coordinates.

Direct prerequisite attraction is strongest. Direct contextual and direct
related attraction are progressively weaker, followed by graph-distance-two
and -three proximity attraction. Pairs farther than three steps apart and
disconnected pairs receive no attraction, only local collision/repulsion.
Distance-two and -three candidates use deterministic per-source caps, preventing
a dense star from materializing an all-pairs runtime force.
Related edges remain outside the SVG and readable in the inspector/list,
but may contribute their weaker attraction to placement.
A spatially hashed collision projection runs for a fixed maximum number of
passes per frame in both constrained and free modes.

## Consequences

- The initial map is reproducible across builds, input order, devices, and
  animation preferences.
- Prerequisite order is visible without waiting for client JavaScript.
- The unselected map has no visible edge crossings. Selecting a node reveals
  only the direct prerequisite neighbourhood; the complete relationship data
  remains available in the inspector and accessible list.
- The default interactive settlement preserves the vertical prerequisite
  hierarchy; free placement requires an explicit user choice.
- Runtime work is bounded by convergence, frame, and time limits. Proximity
  attraction stops at graph distance three, and collision/repulsion uses a
  spatial hash instead of checking every node pair.
- Very broad layers may still require horizontal panning or a smaller fit
  scale; the list view remains the compact accessible alternative.
- Consumers needing a specialized graph may still read normalized related
  edges from the model and provide their own presentation; the shared map keeps
  their lines outside the main hierarchy.
