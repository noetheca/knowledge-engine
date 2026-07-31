import assert from "node:assert/strict";
import test from "node:test";
import {
  createKnowledgeGraphModel,
  layoutKnowledgeGraph,
} from "../dist/index.js";

const node = (id, overrides = {}) => ({
  id,
  title: id,
  summary: `${id} summary`,
  status: "draft",
  href: `/ja/concepts/${id}/`,
  prerequisites: [],
  related: [],
  ...overrides,
});

test("creates prerequisite edges and reverse dependent relations", () => {
  const graph = createKnowledgeGraphModel([
    node("root"),
    node("left", { prerequisites: ["root"] }),
    node("right", { prerequisites: ["root"] }),
    node("leaf", { prerequisites: ["left", "right"] }),
  ]);

  assert.deepEqual(
    graph.edges.map(({ source, target }) => [source, target]),
    [
      ["root", "left"],
      ["root", "right"],
      ["left", "leaf"],
      ["right", "leaf"],
    ],
  );
  assert.deepEqual(
    graph.nodes.find(({ id }) => id === "root")?.dependents,
    ["left", "right"],
  );
  assert.ok(graph.edges.every(({ id }) => !id.includes("\u0000")));
});

test("suppresses related links when a prerequisite edge already connects a pair", () => {
  const graph = createKnowledgeGraphModel([
    node("root", { related: ["child"] }),
    node("child", {
      prerequisites: ["root"],
      related: ["root"],
    }),
  ]);

  assert.deepEqual(
    graph.nodes.map(({ related }) => related),
    [[], []],
  );
});

test("rejects duplicate nodes and missing prerequisites", () => {
  assert.throws(
    () => createKnowledgeGraphModel([node("same"), node("same")]),
    /Duplicate knowledge graph node ID/,
  );
  assert.throws(
    () =>
      createKnowledgeGraphModel([
        node("child", { prerequisites: ["missing"] }),
      ]),
    /references missing prerequisite/,
  );
});

test("lays out multiple roots above their dependent node", () => {
  const graph = createKnowledgeGraphModel([
    node("first"),
    node("second"),
    node("child", { prerequisites: ["first", "second"] }),
  ]);
  const layout = layoutKnowledgeGraph(graph);
  const positions = new Map(layout.nodes.map((item) => [item.id, item]));

  assert.equal(positions.get("first")?.y, positions.get("second")?.y);
  assert.ok(
    (positions.get("child")?.y ?? 0) > (positions.get("first")?.y ?? 0),
  );
  assert.equal(layout.edges.length, 2);
  assert.match(layout.edges[0]?.path ?? "", /^M .+ V .+ H .+ V /);
});

test("refuses to lay out a prerequisite cycle", () => {
  const graph = createKnowledgeGraphModel([
    node("a", { prerequisites: ["b"] }),
    node("b", { prerequisites: ["a"] }),
  ]);

  assert.throws(
    () => layoutKnowledgeGraph(graph),
    /Cannot lay out prerequisite cycle/,
  );
});
