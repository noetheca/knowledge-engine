import { access, readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { parse } from "yaml";
import { validateArticleDirectives } from "./markdown/directives.js";
import { isAllowedSourceUrl } from "./urls.js";
import {
  CONTENT_SCHEMA_VERSION,
  CONTENT_STATUSES,
  READING_LEVEL_CURRICULUM_PATTERN,
  READING_LEVEL_GRADE_MAX,
  READING_LEVEL_GRADE_MIN,
  type Concept,
  type ConceptMetadata,
  type ConceptTranslation,
  type KnowledgeBase,
  type ReadingLevel,
  type TranslationMetadata,
  type ValidationIssue,
} from "./types.js";

const CONCEPT_FILE = "concept.yaml";
const ID_PATTERN = /^[a-z0-9]+(?:[/-][a-z0-9]+)*$/;
const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2}|\d{3})?$/;
const MARKDOWN_LINK_PATTERN =
  /!?\[[^\]]*]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
const UNSAFE_MARKDOWN_PATTERNS = [
  { code: "javascript-url", pattern: /\bjavascript\s*:/i },
  { code: "inline-event-handler", pattern: /\bon[a-z]+\s*=/i },
];

function issue(
  code: string,
  message: string,
  file?: string,
  severity: ValidationIssue["severity"] = "error",
): ValidationIssue {
  return { severity, code, message, file };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return undefined;
  }
  return value;
}

function isReadingLevel(value: unknown): value is ReadingLevel {
  return (
    isRecord(value) &&
    typeof value.curriculum === "string" &&
    READING_LEVEL_CURRICULUM_PATTERN.test(value.curriculum) &&
    typeof value.grade === "number" &&
    Number.isInteger(value.grade) &&
    value.grade >= READING_LEVEL_GRADE_MIN &&
    value.grade <= READING_LEVEL_GRADE_MAX
  );
}

function parseConceptMetadata(
  raw: unknown,
  file: string,
  issues: ValidationIssue[],
): ConceptMetadata | undefined {
  if (!isRecord(raw)) {
    issues.push(issue("invalid-concept", "Concept metadata must be a mapping.", file));
    return undefined;
  }

  const prerequisites = stringArray(raw.prerequisites);
  const related = stringArray(raw.related);

  if (raw.schemaVersion !== CONTENT_SCHEMA_VERSION) {
    issues.push(
      issue(
        "schema-version",
        `schemaVersion must be ${CONTENT_SCHEMA_VERSION}.`,
        file,
      ),
    );
  }
  if (typeof raw.id !== "string" || !ID_PATTERN.test(raw.id)) {
    issues.push(
      issue(
        "invalid-id",
        "id must use lowercase letters, numbers, hyphens, and slash-separated segments.",
        file,
      ),
    );
  }
  if (!prerequisites) {
    issues.push(
      issue("invalid-prerequisites", "prerequisites must be an array of IDs.", file),
    );
  }
  if (!related) {
    issues.push(issue("invalid-related", "related must be an array of IDs.", file));
  }

  if (
    raw.schemaVersion !== CONTENT_SCHEMA_VERSION ||
    typeof raw.id !== "string" ||
    !ID_PATTERN.test(raw.id) ||
    !prerequisites ||
    !related
  ) {
    return undefined;
  }

  if (new Set(prerequisites).size !== prerequisites.length) {
    issues.push(issue("duplicate-prerequisite", "prerequisites contains duplicates.", file));
  }
  if (new Set(related).size !== related.length) {
    issues.push(issue("duplicate-related", "related contains duplicates.", file));
  }
  if (prerequisites.includes(raw.id) || related.includes(raw.id)) {
    issues.push(issue("self-reference", "A concept cannot reference itself.", file));
  }

  return {
    schemaVersion: raw.schemaVersion,
    id: raw.id,
    prerequisites,
    related,
  };
}

function splitFrontmatter(
  text: string,
  file: string,
  issues: ValidationIssue[],
): { frontmatter: unknown; body: string } | undefined {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(text);
  if (!match) {
    issues.push(
      issue("missing-frontmatter", "Markdown must begin with YAML frontmatter.", file),
    );
    return undefined;
  }

  try {
    return { frontmatter: parse(match[1] ?? ""), body: match[2] ?? "" };
  } catch (error) {
    issues.push(
      issue(
        "invalid-frontmatter",
        `Unable to parse frontmatter: ${error instanceof Error ? error.message : String(error)}`,
        file,
      ),
    );
    return undefined;
  }
}

function parseTranslationMetadata(
  raw: unknown,
  expectedLocale: string,
  file: string,
  issues: ValidationIssue[],
): TranslationMetadata | undefined {
  if (!isRecord(raw)) {
    issues.push(issue("invalid-translation", "Frontmatter must be a mapping.", file));
    return undefined;
  }

  const sourcesAreValid =
    Array.isArray(raw.sources) &&
    raw.sources.every((source) => {
      if (typeof source === "string") {
        return isAllowedSourceUrl(source);
      }
      return (
        isRecord(source) &&
        typeof source.title === "string" &&
        source.title.trim().length > 0 &&
        typeof source.url === "string" &&
        isAllowedSourceUrl(source.url) &&
        (source.note === undefined || typeof source.note === "string")
      );
    });
  const readingLevelIsValid =
    raw.readingLevel === undefined || isReadingLevel(raw.readingLevel);

  const valid =
    typeof raw.locale === "string" &&
    typeof raw.title === "string" &&
    raw.title.trim().length > 0 &&
    typeof raw.summary === "string" &&
    raw.summary.trim().length > 0 &&
    sourcesAreValid &&
    readingLevelIsValid &&
    typeof raw.status === "string" &&
    CONTENT_STATUSES.includes(raw.status as (typeof CONTENT_STATUSES)[number]);

  if (raw.locale !== expectedLocale) {
    issues.push(
      issue(
        "locale-mismatch",
        `Frontmatter locale must match filename locale "${expectedLocale}".`,
        file,
      ),
    );
  }
  if (typeof raw.title !== "string" || raw.title.trim().length === 0) {
    issues.push(issue("missing-title", "title must be a non-empty string.", file));
  }
  if (typeof raw.summary !== "string" || raw.summary.trim().length === 0) {
    issues.push(issue("missing-summary", "summary must be a non-empty string.", file));
  }
  if (!sourcesAreValid) {
    issues.push(
      issue(
        "invalid-sources",
        "sources must be an array of http(s) URLs or titled http(s) URL mappings.",
        file,
      ),
    );
  }
  if (!readingLevelIsValid) {
    issues.push(
      issue(
        "invalid-reading-level",
        `readingLevel must contain a curriculum ID and an integer grade from ${READING_LEVEL_GRADE_MIN} to ${READING_LEVEL_GRADE_MAX}.`,
        file,
      ),
    );
  }
  if (
    typeof raw.status !== "string" ||
    !CONTENT_STATUSES.includes(raw.status as (typeof CONTENT_STATUSES)[number])
  ) {
    issues.push(
      issue(
        "invalid-status",
        `status must be one of: ${CONTENT_STATUSES.join(", ")}.`,
        file,
      ),
    );
  }

  if (!valid || raw.locale !== expectedLocale) {
    return undefined;
  }

  return {
    locale: raw.locale as string,
    title: raw.title as string,
    summary: raw.summary as string,
    sources: raw.sources as unknown[],
    status: raw.status as TranslationMetadata["status"],
    ...(isReadingLevel(raw.readingLevel)
      ? { readingLevel: raw.readingLevel }
      : {}),
  };
}

async function findConceptFiles(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") {
      continue;
    }
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await findConceptFiles(path)));
    } else if (entry.name === CONCEPT_FILE) {
      found.push(path);
    }
  }
  return found;
}

async function validateMarkdown(
  translation: ConceptTranslation,
  issues: ValidationIssue[],
): Promise<void> {
  for (const unsafe of UNSAFE_MARKDOWN_PATTERNS) {
    if (unsafe.pattern.test(translation.body)) {
      issues.push(
        issue(
          `unsafe-markdown-${unsafe.code}`,
          `Markdown contains disallowed ${unsafe.code.replaceAll("-", " ")}.`,
          translation.filePath,
        ),
      );
    }
  }

  for (const directive of await validateArticleDirectives(translation.body)) {
    const location =
      directive.line === undefined
        ? ""
        : ` at ${directive.line}:${directive.column ?? 1}`;
    issues.push(
      issue(
        directive.code.startsWith("unsafe-markdown-")
          ? directive.code
          : `article-directive-${directive.code}`,
        `${directive.message}${location}`,
        translation.filePath,
      ),
    );
  }

  for (const match of translation.body.matchAll(MARKDOWN_LINK_PATTERN)) {
    const rawTarget = match[1];
    if (!rawTarget) {
      continue;
    }
    const target = rawTarget.replace(/^<|>$/g, "");
    if (/^(?:https?:|mailto:|#)/i.test(target)) {
      continue;
    }
    if (/^(?:javascript:|data:)/i.test(target)) {
      issues.push(
        issue("unsafe-link", `Link target uses a disallowed scheme: ${target}`, translation.filePath),
      );
      continue;
    }

    const relativeTarget = decodeURIComponent(target.split(/[?#]/, 1)[0] ?? "");
    if (!relativeTarget) {
      continue;
    }
    try {
      await access(resolve(dirname(translation.filePath), relativeTarget));
    } catch {
      issues.push(
        issue("broken-local-link", `Local link target does not exist: ${target}`, translation.filePath),
      );
    }
  }
}

async function loadConcept(
  conceptFile: string,
  issues: ValidationIssue[],
): Promise<Concept | undefined> {
  let raw: unknown;
  try {
    raw = parse(await readFile(conceptFile, "utf8"));
  } catch (error) {
    issues.push(
      issue(
        "invalid-concept-yaml",
        `Unable to parse concept metadata: ${error instanceof Error ? error.message : String(error)}`,
        conceptFile,
      ),
    );
    return undefined;
  }

  const metadata = parseConceptMetadata(raw, conceptFile, issues);
  if (!metadata) {
    return undefined;
  }

  const directory = dirname(conceptFile);
  const translations = new Map<string, ConceptTranslation>();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile() || extname(entry.name).toLowerCase() !== ".md") {
      continue;
    }
    const locale = entry.name.slice(0, -3);
    const filePath = join(directory, entry.name);
    if (!LOCALE_PATTERN.test(locale)) {
      issues.push(
        issue("invalid-locale-filename", `Invalid locale filename: ${entry.name}`, filePath),
      );
      continue;
    }

    const parsed = splitFrontmatter(await readFile(filePath, "utf8"), filePath, issues);
    if (!parsed) {
      continue;
    }
    const translationMetadata = parseTranslationMetadata(
      parsed.frontmatter,
      locale,
      filePath,
      issues,
    );
    if (!translationMetadata) {
      continue;
    }

    const translation = {
      filePath,
      metadata: translationMetadata,
      body: parsed.body,
    };
    translations.set(locale, translation);
    await validateMarkdown(translation, issues);
  }

  if (translations.size === 0) {
    issues.push(
      issue("missing-translation", "A concept needs at least one valid locale Markdown file.", conceptFile),
    );
  }

  return { directory, metadata, translations };
}

function validateGraph(concepts: Concept[], issues: ValidationIssue[]): void {
  const byId = new Map<string, Concept>();
  for (const concept of concepts) {
    const existing = byId.get(concept.metadata.id);
    if (existing) {
      issues.push(
        issue(
          "duplicate-id",
          `Duplicate concept ID "${concept.metadata.id}".`,
          join(concept.directory, CONCEPT_FILE),
        ),
      );
    } else {
      byId.set(concept.metadata.id, concept);
    }
  }

  for (const concept of concepts) {
    for (const reference of [
      ...concept.metadata.prerequisites,
      ...concept.metadata.related,
    ]) {
      if (!byId.has(reference)) {
        issues.push(
          issue(
            "missing-reference",
            `Concept "${concept.metadata.id}" references missing ID "${reference}".`,
            join(concept.directory, CONCEPT_FILE),
          ),
        );
      }
    }
  }

  const state = new Map<string, "visiting" | "visited">();
  const stack: string[] = [];

  function visit(id: string): void {
    if (state.get(id) === "visited") {
      return;
    }
    if (state.get(id) === "visiting") {
      const start = stack.indexOf(id);
      const cycle = [...stack.slice(start), id];
      issues.push(
        issue(
          "prerequisite-cycle",
          `Prerequisite cycle detected: ${cycle.join(" -> ")}.`,
          byId.get(id) ? join(byId.get(id)!.directory, CONCEPT_FILE) : undefined,
        ),
      );
      return;
    }

    state.set(id, "visiting");
    stack.push(id);
    for (const prerequisite of byId.get(id)?.metadata.prerequisites ?? []) {
      if (byId.has(prerequisite)) {
        visit(prerequisite);
      }
    }
    stack.pop();
    state.set(id, "visited");
  }

  for (const id of byId.keys()) {
    visit(id);
  }
}

export async function loadKnowledgeBase(root: string): Promise<KnowledgeBase> {
  const absoluteRoot = resolve(root);
  const issues: ValidationIssue[] = [];
  const concepts: Concept[] = [];

  let conceptFiles: string[];
  try {
    conceptFiles = await findConceptFiles(absoluteRoot);
  } catch (error) {
    return {
      root: absoluteRoot,
      concepts,
      issues: [
        issue(
          "unreadable-root",
          `Unable to read content root: ${error instanceof Error ? error.message : String(error)}`,
          absoluteRoot,
        ),
      ],
    };
  }

  for (const conceptFile of conceptFiles.sort()) {
    const concept = await loadConcept(conceptFile, issues);
    if (concept) {
      concepts.push(concept);
    }
  }

  if (conceptFiles.length === 0) {
    issues.push(
      issue(
        "empty-content",
        `No ${CONCEPT_FILE} files were found.`,
        absoluteRoot,
        "warning",
      ),
    );
  }

  validateGraph(concepts, issues);
  return { root: absoluteRoot, concepts, issues };
}
