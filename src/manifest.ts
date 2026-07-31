import type { KnowledgeBase, KnowledgeManifest } from "./types.js";

export function createManifest(knowledgeBase: KnowledgeBase): KnowledgeManifest {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    concepts: knowledgeBase.concepts
      .map((concept) => ({
        id: concept.metadata.id,
        prerequisites: [...concept.metadata.prerequisites],
        related: [...concept.metadata.related],
        locales: [...concept.translations.values()]
          .map(({ metadata }) => ({
            locale: metadata.locale,
            title: metadata.title,
            summary: metadata.summary,
            status: metadata.status,
          }))
          .sort((left, right) => left.locale.localeCompare(right.locale)),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}
