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
  predecessors: string[];
  successors: string[];
}

export interface KnowledgeGraphContextRelationInput {
  source: string;
  target: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  kind: "prerequisite" | "contextual" | "related";
}

export interface KnowledgeGraphModel {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

export interface KnowledgeGraphModelOptions {
  contextualRelations?: KnowledgeGraphContextRelationInput[];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function pairKey(left: string, right: string): string {
  return [left, right].sort().join("\u0000");
}

export function createKnowledgeGraphModel(
  inputs: KnowledgeGraphNodeInput[],
  options: KnowledgeGraphModelOptions = {},
): KnowledgeGraphModel {
  const ids = new Set<string>();
  for (const node of inputs) {
    if (ids.has(node.id)) {
      throw new Error(`Duplicate knowledge graph node ID: "${node.id}".`);
    }
    ids.add(node.id);
  }

  const directionalPairs = new Set<string>();
  for (const node of inputs) {
    for (const prerequisite of unique(node.prerequisites)) {
      if (!ids.has(prerequisite)) {
        throw new Error(
          `Knowledge graph node "${node.id}" references missing prerequisite ` +
            `"${prerequisite}".`,
        );
      }
      directionalPairs.add(pairKey(node.id, prerequisite));
    }
  }

  const contextualRelations: KnowledgeGraphContextRelationInput[] = [];
  const contextualRelationIds = new Set<string>();
  for (const relation of options.contextualRelations ?? []) {
    if (!ids.has(relation.source) || !ids.has(relation.target)) {
      throw new Error(
        `Knowledge graph contextual relation "${relation.source}" -> ` +
          `"${relation.target}" references a missing node.`,
      );
    }
    if (relation.source === relation.target) {
      throw new Error(
        `Knowledge graph contextual relation cannot reference itself: ` +
          `"${relation.source}".`,
      );
    }
    const relationId = `${relation.source}\u0000${relation.target}`;
    const pair = pairKey(relation.source, relation.target);
    if (
      contextualRelationIds.has(relationId) ||
      directionalPairs.has(pair)
    ) {
      continue;
    }
    contextualRelationIds.add(relationId);
    directionalPairs.add(pair);
    contextualRelations.push(relation);
  }

  const dependentIds = new Map<string, string[]>(
    inputs.map(({ id }) => [id, []]),
  );
  const predecessorIds = new Map<string, string[]>(
    inputs.map(({ id }) => [id, []]),
  );
  const successorIds = new Map<string, string[]>(
    inputs.map(({ id }) => [id, []]),
  );
  const relatedIds = new Map<string, string[]>(
    inputs.map(({ id }) => [id, []]),
  );
  const addRelated = (source: string, target: string): void => {
    const entries = relatedIds.get(source);
    if (entries && !entries.includes(target)) {
      entries.push(target);
    }
  };
  for (const input of inputs) {
    for (const related of unique(input.related)) {
      if (
        !ids.has(related) ||
        related === input.id ||
        directionalPairs.has(pairKey(input.id, related))
      ) {
        continue;
      }
      addRelated(input.id, related);
      addRelated(related, input.id);
    }
  }
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
      related: relatedIds.get(input.id) ?? [],
      dependents: [] as string[],
      predecessors: [] as string[],
      successors: [] as string[],
    };
  });

  for (const relation of contextualRelations) {
    predecessorIds.get(relation.target)?.push(relation.source);
    successorIds.get(relation.source)?.push(relation.target);
    edges.push({
      id:
        `contextual:${encodeURIComponent(relation.source)}:` +
        encodeURIComponent(relation.target),
      source: relation.source,
      target: relation.target,
      kind: "contextual",
    });
  }

  const order = new Map(nodes.map(({ id }, index) => [id, index]));
  for (const node of nodes) {
    node.dependents = (dependentIds.get(node.id) ?? []).sort(
      (left, right) =>
        (order.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(right) ?? Number.MAX_SAFE_INTEGER),
    );
    node.predecessors = (predecessorIds.get(node.id) ?? []).sort(
      (left, right) =>
        (order.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(right) ?? Number.MAX_SAFE_INTEGER),
    );
    node.successors = (successorIds.get(node.id) ?? []).sort(
      (left, right) =>
        (order.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(right) ?? Number.MAX_SAFE_INTEGER),
    );
  }

  const relatedPairs = new Set<string>();
  for (const node of nodes) {
    for (const related of node.related) {
      const key = pairKey(node.id, related);
      if (relatedPairs.has(key)) {
        continue;
      }
      relatedPairs.add(key);
      const [source, target] = [node.id, related].sort();
      if (!source || !target) {
        continue;
      }
      edges.push({
        id:
          `related:${encodeURIComponent(source)}:` +
          encodeURIComponent(target),
        source,
        target,
        kind: "related",
      });
    }
  }

  return { nodes, edges };
}
