import {
  stepKnowledgeGraphSimulation,
  type KnowledgeGraphSimulationLink,
  type KnowledgeGraphSimulationNode,
} from "../graph/simulation.js";
import {
  KNOWLEDGE_GRAPH_POSITION_STRIDE,
  type KnowledgeGraphWorkerOptions,
  type KnowledgeGraphWorkerRequest,
  type KnowledgeGraphWorkerResponse,
} from "./knowledge-graph-simulation-protocol.js";

interface WorkerScope {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<KnowledgeGraphWorkerRequest>) => void,
  ): void;
  postMessage(message: KnowledgeGraphWorkerResponse, transfer?: Transferable[]): void;
  close(): void;
}

const scope = globalThis as unknown as WorkerScope;
let generation = 0;
let nodes: KnowledgeGraphSimulationNode[] = [];
let links: KnowledgeGraphSimulationLink[] = [];
let options: KnowledgeGraphWorkerOptions | undefined;
let pinnedId: string | undefined;

function post(message: KnowledgeGraphWorkerResponse, transfer?: Transferable[]): void {
  scope.postMessage(message, transfer);
}

function packedPositions(): Float32Array {
  const values = new Float32Array(
    nodes.length * KNOWLEDGE_GRAPH_POSITION_STRIDE,
  );
  for (const [index, node] of nodes.entries()) {
    const offset = index * KNOWLEDGE_GRAPH_POSITION_STRIDE;
    values[offset] = node.x;
    values[offset + 1] = node.y;
    values[offset + 2] = node.velocityX;
    values[offset + 3] = node.velocityY;
  }
  return values;
}

function resetNodes(): void {
  for (const node of nodes) {
    node.x = node.anchorX;
    node.y = node.anchorY;
    node.velocityX = 0;
    node.velocityY = 0;
  }
  pinnedId = undefined;
}

scope.addEventListener("message", (event) => {
  const request = event.data;
  try {
    if (request.type === "dispose") {
      scope.close();
      return;
    }
    generation = request.generation;
    if (request.type === "initialize") {
      nodes = request.nodes;
      links = request.links;
      options = request.options;
      post({ type: "ready", generation });
      return;
    }
    if (request.type === "configure") {
      options = request.options;
      return;
    }
    if (request.type === "reset") {
      options = request.options;
      resetNodes();
      return;
    }
    if (request.type === "set-node") {
      const node = nodes.find(({ id }) => id === request.id);
      if (node) {
        node.x = request.x;
        node.y = request.y;
        node.velocityX = 0;
        node.velocityY = 0;
      }
      pinnedId = request.pinned ? request.id : undefined;
      return;
    }
    if (!options || nodes.length === 0) {
      throw new Error("Knowledge graph worker was stepped before initialization.");
    }
    const startedAt = performance.now();
    const movement = stepKnowledgeGraphSimulation(nodes, links, {
      ...options,
      pinnedId: request.pinnedId ?? pinnedId,
    });
    const positions = packedPositions();
    const positionBuffer = positions.buffer as ArrayBuffer;
    post(
      {
        type: "frame",
        generation,
        positions: positionBuffer,
        movement,
        computeMilliseconds: performance.now() - startedAt,
      },
      [positionBuffer],
    );
  } catch (error) {
    post({
      type: "error",
      generation,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
