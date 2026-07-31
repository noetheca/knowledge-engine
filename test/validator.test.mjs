import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createManifest,
  createTranslationFileIndex,
  loadKnowledgeBase,
  normalizeTranslationFilePath,
} from "../dist/index.js";

async function fixture(concepts) {
  const root = await mkdtemp(join(tmpdir(), "noetheca-engine-"));
  for (const [directory, concept] of Object.entries(concepts)) {
    const target = join(root, directory);
    await mkdir(target, { recursive: true });
    await writeFile(
      join(target, "concept.yaml"),
      `${JSON.stringify(concept.metadata, null, 2)}\n`,
    );
    for (const [locale, translation] of Object.entries(concept.translations)) {
      await writeFile(
        join(target, `${locale}.md`),
        `---\n${JSON.stringify(translation.frontmatter, null, 2)}\n---\n${translation.body}\n`,
      );
    }
  }
  return root;
}

const ja = (title) => ({
  frontmatter: {
    locale: "ja",
    title,
    summary: `${title}の概要`,
    sources: [],
    status: "draft",
  },
  body: `# ${title}`,
});

test("loads valid concepts and creates a stable manifest", async () => {
  const root = await fixture({
    natural: {
      metadata: {
        schemaVersion: 1,
        id: "math/natural",
        prerequisites: [],
        related: ["math/integer"],
      },
      translations: { ja: ja("自然数") },
    },
    integer: {
      metadata: {
        schemaVersion: 1,
        id: "math/integer",
        prerequisites: ["math/natural"],
        related: [],
      },
      translations: { ja: ja("整数") },
    },
  });

  const knowledgeBase = await loadKnowledgeBase(root);
  assert.deepEqual(
    knowledgeBase.issues.filter(({ severity }) => severity === "error"),
    [],
  );
  assert.deepEqual(
    createManifest(knowledgeBase).concepts.map(({ id }) => id),
    ["math/integer", "math/natural"],
  );
});

test("keeps concept identity independent from its directory", async () => {
  const root = await fixture({
    "storage/by-author/alpha": {
      metadata: {
        schemaVersion: 1,
        id: "math/foundations/natural-numbers",
        prerequisites: [],
        related: [],
      },
      translations: { ja: ja("自然数") },
    },
  });

  const knowledgeBase = await loadKnowledgeBase(root);
  const [concept] = knowledgeBase.concepts;
  assert.equal(concept.metadata.id, "math/foundations/natural-numbers");
  assert.ok(concept.directory.endsWith(join("storage", "by-author", "alpha")));

  const index = createTranslationFileIndex(knowledgeBase);
  const translation = concept.translations.get("ja");
  assert.equal(
    index.get(normalizeTranslationFilePath(translation.filePath))?.concept
      .metadata.id,
    "math/foundations/natural-numbers",
  );
});

test("moving a concept directory does not change manifest semantics", async () => {
  const concept = {
    metadata: {
      schemaVersion: 1,
      id: "math/foundations/natural-numbers",
      prerequisites: [],
      related: [],
    },
    translations: { ja: ja("自然数") },
  };
  const first = await loadKnowledgeBase(
    await fixture({ "layout-a/topic": concept }),
  );
  const second = await loadKnowledgeBase(
    await fixture({ "layout-b/archive/x": concept }),
  );

  assert.deepEqual(
    createManifest(first).concepts,
    createManifest(second).concepts,
  );
});

test("detects duplicate IDs and missing references", async () => {
  const root = await fixture({
    first: {
      metadata: {
        schemaVersion: 1,
        id: "math/same",
        prerequisites: ["math/missing"],
        related: [],
      },
      translations: { ja: ja("一つ目") },
    },
    second: {
      metadata: {
        schemaVersion: 1,
        id: "math/same",
        prerequisites: [],
        related: [],
      },
      translations: { ja: ja("二つ目") },
    },
  });

  const knowledgeBase = await loadKnowledgeBase(root);
  const codes = knowledgeBase.issues.map(({ code }) => code);
  assert.ok(codes.includes("duplicate-id"));
  assert.ok(codes.includes("missing-reference"));
});

test("detects prerequisite cycles", async () => {
  const root = await fixture({
    a: {
      metadata: {
        schemaVersion: 1,
        id: "math/a",
        prerequisites: ["math/b"],
        related: [],
      },
      translations: { ja: ja("A") },
    },
    b: {
      metadata: {
        schemaVersion: 1,
        id: "math/b",
        prerequisites: ["math/a"],
        related: [],
      },
      translations: { ja: ja("B") },
    },
  });

  const knowledgeBase = await loadKnowledgeBase(root);
  assert.ok(
    knowledgeBase.issues.some(({ code }) => code === "prerequisite-cycle"),
  );
});

test("rejects locale mismatches and unsafe Markdown", async () => {
  const root = await fixture({
    unsafe: {
      metadata: {
        schemaVersion: 1,
        id: "math/unsafe",
        prerequisites: [],
        related: [],
      },
      translations: {
        ja: {
          frontmatter: {
            locale: "en",
            title: "Unsafe",
            summary: "Unsafe content",
            sources: [],
            status: "draft",
          },
          body: "<script>alert(1)</script>",
        },
      },
    },
  });

  const knowledgeBase = await loadKnowledgeBase(root);
  const codes = knowledgeBase.issues.map(({ code }) => code);
  assert.ok(codes.includes("locale-mismatch"));
  assert.ok(codes.includes("missing-translation"));
});
