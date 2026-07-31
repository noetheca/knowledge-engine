import { normalize, resolve } from "node:path";
import type {
  Concept,
  ConceptTranslation,
  KnowledgeBase,
} from "./types.js";

export interface TranslationFileRecord {
  concept: Concept;
  translation: ConceptTranslation;
}

export function normalizeTranslationFilePath(filePath: string): string {
  const absolutePath = normalize(resolve(filePath));
  return process.platform === "win32" ? absolutePath.toLowerCase() : absolutePath;
}

export function createTranslationFileIndex(
  knowledgeBase: KnowledgeBase,
): Map<string, TranslationFileRecord> {
  const index = new Map<string, TranslationFileRecord>();

  for (const concept of knowledgeBase.concepts) {
    for (const translation of concept.translations.values()) {
      const key = normalizeTranslationFilePath(translation.filePath);
      const existing = index.get(key);
      if (existing) {
        throw new Error(
          `Multiple translations resolve to "${translation.filePath}": ` +
            `"${existing.concept.metadata.id}" and "${concept.metadata.id}".`,
        );
      }
      index.set(key, { concept, translation });
    }
  }

  return index;
}
