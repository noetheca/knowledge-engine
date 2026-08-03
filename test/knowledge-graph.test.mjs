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

test("creates directed contextual relations and suppresses duplicate related pairs", () => {
  const graph = createKnowledgeGraphModel(
    [
      node("earlier", { related: ["later"] }),
      node("later"),
    ],
    {
      contextualRelations: [{ source: "earlier", target: "later" }],
    },
  );

  assert.deepEqual(
    graph.edges.map(({ source, target, kind }) => [source, target, kind]),
    [["earlier", "later", "contextual"]],
  );
  assert.deepEqual(
    graph.nodes.map(({ predecessors, successors, related }) => ({
      predecessors,
      successors,
      related,
    })),
    [
      { predecessors: [], successors: ["later"], related: [] },
      { predecessors: ["earlier"], successors: [], related: [] },
    ],
  );
});

test("rejects contextual relations with missing nodes", () => {
  assert.throws(
    () =>
      createKnowledgeGraphModel([node("known")], {
        contextualRelations: [{ source: "known", target: "missing" }],
      }),
    /references a missing node/,
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

test("lays out prerequisites in deterministic top-to-bottom layers", () => {
  const concepts = [
    node("first"),
    node("second"),
    node("child", { prerequisites: ["first", "second"] }),
    node("leaf", { prerequisites: ["child"] }),
  ];
  const first = layoutKnowledgeGraph(createKnowledgeGraphModel(concepts));
  const reversed = layoutKnowledgeGraph(
    createKnowledgeGraphModel(concepts.toReversed()),
  );
  const positions = new Map(first.nodes.map((item) => [item.id, item]));

  assert.equal(positions.get("first")?.y, positions.get("second")?.y);
  assert.ok(
    (positions.get("child")?.y ?? 0) > (positions.get("first")?.y ?? 0),
  );
  assert.ok(
    (positions.get("leaf")?.y ?? 0) > (positions.get("child")?.y ?? 0),
  );
  assert.equal(
    (positions.get("child")?.y ?? 0) - (positions.get("first")?.y ?? 0),
    288,
  );
  assert.deepEqual(
    first.nodes.map(({ id, rank }) => [id, rank]),
    [["first", 0], ["second", 0], ["child", 1], ["leaf", 2]],
  );
  assert.deepEqual(
    first.nodes
      .map(({ id, x, y }) => ({ id, x, y }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    reversed.nodes
      .map(({ id, x, y }) => ({ id, x, y }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  );
  assert.ok(first.edges.every(({ path }) => /^M .+ (?:C|L) /.test(path)));
  assert.ok(first.edges.every(({ arrowPoints }) => Boolean(arrowPoints)));
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

test("wraps a large layer into a compact non-overlapping grid", () => {
  const graph = createKnowledgeGraphModel(
    Array.from({ length: 49 }, (_, index) => node(`node-${index}`)),
  );
  const layout = layoutKnowledgeGraph(graph);
  const distinctRows = new Set(layout.nodes.map(({ y }) => y));

  assert.equal(distinctRows.size, 7);
  assert.equal(layout.width, 2920);
  for (let index = 0; index < layout.nodes.length; index += 1) {
    const first = layout.nodes[index];
    assert.ok(first);
    for (
      let comparisonIndex = index + 1;
      comparisonIndex < layout.nodes.length;
      comparisonIndex += 1
    ) {
      const second = layout.nodes[comparisonIndex];
      assert.ok(second);
      const overlapsX =
        first.x < second.x + second.width &&
        first.x + first.width > second.x;
      const overlapsY =
        first.y < second.y + second.height &&
        first.y + first.height > second.y;
      assert.equal(overlapsX && overlapsY, false);
    }
  }
});

test("keeps same-rank groups contiguous with wider group boundaries", () => {
  const graph = createKnowledgeGraphModel([
    node("a-1", { group: "red" }),
    node("a-2", { group: "blue" }),
    node("b-1", { group: "red" }),
    node("b-2", { group: "blue" }),
  ]);
  const layout = layoutKnowledgeGraph(graph, { maxColumns: 4 });
  const ordered = [...layout.nodes].sort((left, right) => left.x - right.x);

  assert.deepEqual(
    ordered.map(({ id, groupId, rank }) => [id, groupId, rank]),
    [
      ["a-1", "red", 0],
      ["b-1", "red", 0],
      ["a-2", "blue", 0],
      ["b-2", "blue", 0],
    ],
  );
  const gaps = ordered.slice(1).map(
    (entry, index) => entry.x - (ordered[index].x + ordered[index].width),
  );
  assert.deepEqual(gaps, [72, 220, 72]);
});

test("orders adjacent layers to reduce prerequisite crossings", () => {
  const graph = createKnowledgeGraphModel([
    node("a"),
    node("b"),
    node("left-child", { prerequisites: ["b"] }),
    node("right-child", { prerequisites: ["a"] }),
  ]);
  const layout = layoutKnowledgeGraph(graph, { maxColumns: 4 });
  const positions = new Map(layout.nodes.map((entry) => [entry.id, entry]));

  assert.equal(positions.get("a")?.x, positions.get("right-child")?.x);
  assert.equal(positions.get("b")?.x, positions.get("left-child")?.x);
});

test("keeps related knowledge in the model but out of the map edges", () => {
  const graph = createKnowledgeGraphModel([
    node("left", { related: ["right"] }),
    node("right"),
  ]);
  const layout = layoutKnowledgeGraph(graph);

  assert.deepEqual(graph.nodes.map(({ related }) => related), [
    ["right"],
    ["left"],
  ]);
  assert.deepEqual(layout.edges, []);
});

test("draws only prerequisite edges in the default map", () => {
  const graph = createKnowledgeGraphModel(
    [
      node("root", { related: ["aside"] }),
      node("child", { prerequisites: ["root"] }),
      node("aside"),
    ],
    { contextualRelations: [{ source: "aside", target: "child" }] },
  );
  const layout = layoutKnowledgeGraph(graph);

  assert.deepEqual(
    layout.edges.map(({ source, target, kind }) => [source, target, kind]),
    [["root", "child", "prerequisite"]],
  );
});

test("places contextual targets below their sources without force simulation", () => {
  const graph = createKnowledgeGraphModel(
    [node("source"), node("target")],
    { contextualRelations: [{ source: "source", target: "target" }] },
  );
  const layout = layoutKnowledgeGraph(graph, {
    strategy: "contextual",
    chronology: { source: 2000, target: 2000 },
  });
  const positions = new Map(layout.nodes.map((entry) => [entry.id, entry]));

  assert.ok((positions.get("source")?.y ?? 0) < (positions.get("target")?.y ?? 0));
  assert.deepEqual(
    layout.edges.map(({ kind }) => kind),
    ["contextual"],
  );
});

test("keeps dated contextual nodes in strict old-to-new vertical bands", () => {
  const concepts = [
    node("classical"),
    node("modern"),
    node("postmodern"),
    node("unranked"),
  ];
  const graph = createKnowledgeGraphModel(concepts);
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

  assert.deepEqual(first, second);
  assert.ok((positions.get("classical")?.y ?? 0) < (positions.get("modern")?.y ?? 0));
  assert.ok((positions.get("modern")?.y ?? 0) < (positions.get("postmodern")?.y ?? 0));
  assert.ok((positions.get("postmodern")?.y ?? 0) < (positions.get("unranked")?.y ?? 0));
});

test("spreads a dense same-period cohort across compact rows", () => {
  const concepts = Array.from({ length: 10 }, (_, index) =>
    node(`same-period-${String(index).padStart(2, "0")}`),
  );
  const graph = createKnowledgeGraphModel(concepts);
  const layout = layoutKnowledgeGraph(graph, {
    strategy: "contextual",
    chronology: Object.fromEntries(concepts.map(({ id }) => [id, 2010])),
  });
  const rows = new Set(layout.nodes.map(({ y }) => y));

  assert.equal(rows.size, 3);
  assert.equal(layout.edges.length, 0);
});
