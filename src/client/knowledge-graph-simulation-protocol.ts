import type {
  KnowledgeGraphSimulationLink,
  KnowledgeGraphSimulationNode,
  KnowledgeGraphSimulationStepOptions,
} from "../graph/simulation.js";

export type KnowledgeGraphWorkerOptions = Omit<
  KnowledgeGraphSimulationStepOptions,
  "pinnedId"
>;

export type KnowledgeGraphWorkerRequest =
  | {
      type: "initialize";
      generation: number;
      nodes: KnowledgeGraphSimulationNode[];
      links: KnowledgeGraphSimulationLink[];
      options: KnowledgeGraphWorkerOptions;
    }
  | {
      type: "configure";
      generation: number;
      options: KnowledgeGraphWorkerOptions;
    }
  | {
      type: "step";
      generation: number;
      pinnedId?: string;
    }
  | {
      type: "set-node";
      generation: number;
      id: string;
      x: number;
      y: number;
      pinned: boolean;
    }
  | {
      type: "reset";
      generation: number;
      options: KnowledgeGraphWorkerOptions;
    }
  | { type: "dispose" };

export type KnowledgeGraphWorkerResponse =
  | { type: "ready"; generation: number }
  | {
      type: "frame";
      generation: number;
      positions: ArrayBuffer;
      movement: number;
      computeMilliseconds: number;
    }
  | { type: "error"; generation: number; message: string };

export const KNOWLEDGE_GRAPH_POSITION_STRIDE = 4;
