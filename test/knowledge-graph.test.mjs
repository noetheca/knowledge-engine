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

test("creates one undirected edge for a related pair", () => {
  const graph = createKnowledgeGraphModel([
    node("left", { related: ["right"] }),
    node("right"),
  ]);

  assert.deepEqual(
    graph.edges.map(({ source, target, kind }) => [source, target, kind]),
    [["left", "right", "related"]],
  );
  assert.deepEqual(
    graph.nodes.map(({ related }) => related),
    [["right"], ["left"]],
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
  assert.match(layout.edges[0]?.path ?? "", /^M .+ L /);
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

test("wraps a large root layer into a compact grid", () => {
  const graph = createKnowledgeGraphModel(
    Array.from({ length: 49 }, (_, index) => node(`node-${index}`)),
  );
  const layout = layoutKnowledgeGraph(graph);
  const distinctRows = new Set(layout.nodes.map(({ y }) => y));

  assert.equal(distinctRows.size, 7);
  assert.equal(layout.width, 2032);
});

test("settles contextual graphs into a deterministic organic layout", () => {
  const concepts = Array.from({ length: 49 }, (_, index) =>
    node(`node-${String(index).padStart(2, "0")}`, {
      related:
        index < 44
          ? [
              `node-${String((index + 1) % 44).padStart(2, "0")}`,
              ...(index < 19
                ? [`node-${String((index + 7) % 44).padStart(2, "0")}`]
                : []),
            ]
          : index === 44
            ? ["node-45"]
          : [],
    }),
  );
  const graph = createKnowledgeGraphModel(concepts);
  const first = layoutKnowledgeGraph(graph, { strategy: "contextual" });
  const second = layoutKnowledgeGraph(graph, { strategy: "contextual" });
  const reversed = layoutKnowledgeGraph(
    createKnowledgeGraphModel(concepts.toReversed()),
    { strategy: "contextual" },
  );

  assert.deepEqual(first, second);
  assert.deepEqual(
    first.nodes
      .map(({ id, x, y }) => ({ id, x, y }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    reversed.nodes
      .map(({ id, x, y }) => ({ id, x, y }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  );
  assert.equal(first.nodes.length, 49);
  assert.equal(first.edges.length, 64);
  assert.ok(first.width > 0 && first.height > 0);

  const distinctX = new Set(first.nodes.map(({ x }) => x));
  const distinctY = new Set(first.nodes.map(({ y }) => y));
  assert.ok(distinctX.size > 20);
  assert.ok(distinctY.size > 20);

  for (let index = 0; index < first.nodes.length; index += 1) {
    const left = first.nodes[index];
    assert.ok(left);
    assert.ok(left.x >= 0 && left.y >= 0);
    assert.ok(left.x + left.width <= first.width);
    assert.ok(left.y + left.height <= first.height);
    for (
      let comparisonIndex = index + 1;
      comparisonIndex < first.nodes.length;
      comparisonIndex += 1
    ) {
      const right = first.nodes[comparisonIndex];
      assert.ok(right);
      const overlapX =
        Math.min(left.x + left.width, right.x + right.width) -
        Math.max(left.x, right.x);
      const overlapY =
        Math.min(left.y + left.height, right.y + right.height) -
        Math.max(left.y, right.y);
      assert.ok(overlapX <= 1 || overlapY <= 1);
    }
  }
});

test("keeps dated contextual nodes in strict old-to-new vertical bands", () => {
  const graph = createKnowledgeGraphModel([
    node("classical", { related: ["modern"] }),
    node("modern", { related: ["classical", "postmodern"] }),
    node("postmodern", { related: ["modern"] }),
    node("unranked", { related: ["modern"] }),
  ]);
  const options = {
    strategy: "contextual",
    chronology: {
      classical: 1750,
      modern: 1900,
      postmodern: 1970,
    },
  };
  const first = layoutKnowledgeGraph(graph, options);
  const second = layoutKnowledgeGraph(graph, options);
  const positions = new Map(first.nodes.map((item) => [item.id, item]));
  const classicalY = positions.get("classical")?.y ?? 0;
  const modernY = positions.get("modern")?.y ?? 0;
  const postmodernY = positions.get("postmodern")?.y ?? 0;
  const unrankedY = positions.get("unranked")?.y ?? 0;

  assert.deepEqual(first, second);
  assert.ok(classicalY < modernY);
  assert.ok(modernY < postmodernY);
  assert.ok(postmodernY < unrankedY);
});

test("does not invert chronology across a dense contextual graph", () => {
  const concepts = Array.from({ length: 43 }, (_, index) =>
    node(`dated-${String(index).padStart(2, "0")}`, {
      related:
        index + 1 < 43
          ? [`dated-${String(index + 1).padStart(2, "0")}`]
          : [],
    }),
  );
  const graph = createKnowledgeGraphModel(concepts);
  const chronology = Object.fromEntries(
    concepts.map(({ id }, index) => [id, 1950 + index]),
  );
  const layout = layoutKnowledgeGraph(graph, {
    strategy: "contextual",
    chronology,
  });
  const ordered = [...layout.nodes].sort(
    (left, right) => chronology[left.id] - chronology[right.id],
  );

  for (let index = 1; index < ordered.length; index += 1) {
    assert.ok(ordered[index - 1].y < ordered[index].y);
  }
});
