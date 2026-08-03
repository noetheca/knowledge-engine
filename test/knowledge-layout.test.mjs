import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutSource = await readFile(
  new URL("../src/components/KnowledgeLayout.astro", import.meta.url),
  "utf8",
);

test("links the shared brand to the organization portal", () => {
  assert.match(
    layoutSource,
    /class="brand" href="https:\/\/noetheca\.github\.io\/"/,
  );
});

test("links the domain context to the consuming site's Astro base path", () => {
  assert.ok(
    layoutSource.includes(
      "const domainHomeUrl = `${import.meta.env.BASE_URL.replace(/\\/$/, \"\")}/`;",
    ),
  );
  assert.match(
    layoutSource,
    /class="site-context" href=\{domainHomeUrl\}/,
  );
});
