import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  canAnimateContextualSimulation,
  clampFitScale,
  clampInteractiveScale,
  measureGraphContentBounds,
} from "../dist/client/knowledge-graph-runtime.js";

test("checks contextual animation eligibility independently", () => {
  const base = {
    connected: true,
    hidden: false,
    reducedMotion: false,
    view: "map",
  };

  assert.equal(canAnimateContextualSimulation(base), true);
  assert.equal(
    canAnimateContextualSimulation({ ...base, hidden: true }),
    false,
  );
  assert.equal(
    canAnimateContextualSimulation({ ...base, reducedMotion: true }),
    false,
  );
  assert.equal(
    canAnimateContextualSimulation({ ...base, view: "list" }),
    false,
  );
});

test("fit can show a large graph below the interactive zoom floor", () => {
  assert.equal(clampFitScale(0.12), 0.12);
  assert.equal(clampFitScale(0.01), 0.08);
  assert.equal(clampInteractiveScale(0.11, 0.12), 0.12);
  assert.equal(clampInteractiveScale(0.2, 0.12), 0.2);
  assert.equal(clampInteractiveScale(0.1), 0.25);
});

test("fit bounds follow the current nodes instead of the server envelope", () => {
  assert.deepEqual(
    measureGraphContentBounds([
      { x: 400, y: 200, width: 200, height: 100 },
      { x: 800, y: 700, width: 200, height: 100 },
    ]),
    { left: 352, top: 152, right: 1048, bottom: 848 },
  );
  assert.equal(measureGraphContentBounds([]), undefined);
});

test("client restores a running simulation after BFCache navigation", async () => {
  const source = await readFile(
    new URL("../src/client/knowledge-graph.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /window\.addEventListener\("pageshow"/);
  assert.match(source, /clampFitScale/);
  assert.match(source, /clampInteractiveScale/);
});
