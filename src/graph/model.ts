import type { ContentStatus } from "../types.js";

export interface KnowledgeGraphNodeInput {
  id: string;
  title: string;
  summary: string;
  status: ContentStatus;
  href: string;
  prerequisites: string[];
  related: string[];
}

export interface KnowledgeGraphNode extends KnowledgeGraphNodeInput {
  dependents: string[];
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  kind: "prerequisite";
}

export interface KnowledgeGraphModel {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function pairKey(left: string, right: string): string {
  return [left, right].sort().join("\u0000");
}

export function createKnowledgeGraphModel(
  inputs: KnowledgeGraphNodeInput[],
): KnowledgeGraphModel {
  const ids = new Set<string>();
  for (const node of inputs) {
    if (ids.has(node.id)) {
      throw new Error(`Duplicate knowledge graph node ID: "${node.id}".`);
    }
    ids.add(node.id);
  }

  const prerequisitePairs = new Set<string>();
  for (const node of inputs) {
    for (const prerequisite of unique(node.prerequisites)) {
      if (!ids.has(prerequisite)) {
        throw new Error(
          `Knowledge graph node "${node.id}" references missing prerequisite ` +
            `"${prerequisite}".`,
        );
      }
      prerequisitePairs.add(pairKey(node.id, prerequisite));
    }
  }

  const dependentIds = new Map<string, string[]>(
    inputs.map(({ id }) => [id, []]),
  );
  const edges: KnowledgeGraphEdge[] = [];

  const nodes: KnowledgeGraphNode[] = inputs.map((input) => {
    const prerequisites = unique(input.prerequisites);
    for (const prerequisite of prerequisites) {
      dependentIds.get(prerequisite)?.push(input.id);
      edges.push({
        id:
          `prerequisite:${encodeURIComponent(prerequisite)}:` +
          encodeURIComponent(input.id),
        source: prerequisite,
        target: input.id,
        kind: "prerequisite",
      });
    }

    return {
      ...input,
      prerequisites,
      related: unique(input.related).filter((related) => {
        if (!ids.has(related) || related === input.id) {
          return false;
        }
        return !prerequisitePairs.has(pairKey(input.id, related));
      }),
      dependents: [] as string[],
    };
  });

  const order = new Map(nodes.map(({ id }, index) => [id, index]));
  for (const node of nodes) {
    node.dependents = (dependentIds.get(node.id) ?? []).sort(
      (left, right) =>
        (order.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(right) ?? Number.MAX_SAFE_INTEGER),
    );
  }

  return { nodes, edges };
}
