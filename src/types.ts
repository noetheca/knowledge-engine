export const CONTENT_SCHEMA_VERSION = 1 as const;

export const CONTENT_STATUSES = [
  "draft",
  "review",
  "published",
] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const READING_LEVEL_CURRICULUM_PATTERN =
  /^[a-z0-9]+(?:[._/-][a-z0-9]+)*$/;
export const READING_LEVEL_GRADE_MIN = 1 as const;
export const READING_LEVEL_GRADE_MAX = 12 as const;

export interface ReadingLevel {
  curriculum: string;
  grade: number;
}

export interface KnowledgeLanguageOption {
  id: string;
  label: string;
  locale: string;
  href?: string;
}

export interface ConceptMetadata {
  schemaVersion: number;
  id: string;
  prerequisites: string[];
  related: string[];
}

export interface TranslationMetadata {
  locale: string;
  title: string;
  summary: string;
  sources: unknown[];
  status: ContentStatus;
  readingLevel?: ReadingLevel;
}

export interface ConceptTranslation {
  filePath: string;
  metadata: TranslationMetadata;
  body: string;
}

export interface Concept {
  directory: string;
  metadata: ConceptMetadata;
  translations: Map<string, ConceptTranslation>;
}

export type IssueSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
  file?: string;
}

export interface KnowledgeBase {
  root: string;
  concepts: Concept[];
  issues: ValidationIssue[];
}

export interface ManifestLocale {
  locale: string;
  title: string;
  summary: string;
  status: ContentStatus;
}

export interface ManifestConcept {
  id: string;
  prerequisites: string[];
  related: string[];
  locales: ManifestLocale[];
}

export interface KnowledgeManifest {
  schemaVersion: 1;
  generatedAt: string;
  concepts: ManifestConcept[];
}
