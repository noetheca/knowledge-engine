export const MIN_INTERACTIVE_SCALE = 0.25;
export const MIN_FIT_SCALE = 0.08;
export const MAX_GRAPH_SCALE = 2.4;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function clampInteractiveScale(
  requestedScale: number,
  minimumScale = MIN_INTERACTIVE_SCALE,
): number {
  return clamp(requestedScale, minimumScale, MAX_GRAPH_SCALE);
}

export function clampFitScale(requestedScale: number): number {
  return clamp(requestedScale, MIN_FIT_SCALE, MAX_GRAPH_SCALE);
}

export interface GraphNodeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GraphContentBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function measureGraphContentBounds(
  positions: readonly GraphNodeBounds[],
  padding = 48,
): GraphContentBounds | undefined {
  if (positions.length === 0) {
    return undefined;
  }
  return {
    left: Math.min(...positions.map((position) => position.x - padding)),
    top: Math.min(...positions.map((position) => position.y - padding)),
    right: Math.max(
      ...positions.map(
        (position) => position.x + position.width + padding,
      ),
    ),
    bottom: Math.max(
      ...positions.map(
        (position) => position.y + position.height + padding,
      ),
    ),
  };
}

export interface ContextualSimulationConditions {
  connected: boolean;
  hidden: boolean;
  reducedMotion: boolean;
  view: "list" | "map";
}

export function canAnimateContextualSimulation({
  connected,
  hidden,
  reducedMotion,
  view,
}: ContextualSimulationConditions): boolean {
  return connected && !hidden && !reducedMotion && view === "map";
}
