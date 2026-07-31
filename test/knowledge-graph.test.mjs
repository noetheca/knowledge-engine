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

const distanceToSegment = (point, start, end) => {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  const projection = lengthSquared > 0
    ? Math.max(
        0,
        Math.min(
          1,
          ((point.x - start.x) * segmentX +
            (point.y - start.y) * segmentY) /
            lengthSquared,
        ),
      )
    : 0;
  return Math.hypot(
    point.x - (start.x + segmentX * projection),
    point.y - (start.y + segmentY * projection),
  );
};

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

test("does not use selection-only related edges as contextual forces", () => {
  const inputs = [
    node("left", { related: ["right"] }),
    node("right"),
  ];
  const withRelated = layoutKnowledgeGraph(createKnowledgeGraphModel(inputs), {
    strategy: "contextual",
  });
  const withoutRelated = layoutKnowledgeGraph(
    createKnowledgeGraphModel(inputs.map((entry) => ({ ...entry, related: [] }))),
    { strategy: "contextual" },
  );

  assert.deepEqual(withRelated.nodes, withoutRelated.nodes);
  assert.equal(withRelated.edges.length, 1);
  assert.equal(withoutRelated.edges.length, 0);
});

test("places a directed contextual target below its source", () => {
  const graph = createKnowledgeGraphModel(
    [node("source"), node("target")],
    { contextualRelations: [{ source: "source", target: "target" }] },
  );
  const layout = layoutKnowledgeGraph(graph, { strategy: "contextual" });
  const positions = new Map(layout.nodes.map((entry) => [entry.id, entry]));

  assert.ok((positions.get("source")?.y ?? 0) < (positions.get("target")?.y ?? 0));
});

test("places a same-period contextual target below its source", () => {
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
});

test("spreads a dense same-period cohort across several rows", () => {
  const concepts = Array.from({ length: 10 }, (_, index) =>
    node(`same-period-${String(index).padStart(2, "0")}`),
  );
  const graph = createKnowledgeGraphModel(concepts);
  const layout = layoutKnowledgeGraph(graph, {
    strategy: "contextual",
    chronology: Object.fromEntries(concepts.map(({ id }) => [id, 2010])),
  });
  const rows = new Set(layout.nodes.map(({ y }) => Math.round(y)));

  assert.ok(rows.size >= 3);
  for (let index = 0; index < layout.nodes.length; index += 1) {
    const first = layout.nodes[index];
    if (!first) {
      continue;
    }
    for (let comparisonIndex = index + 1; comparisonIndex < layout.nodes.length; comparisonIndex += 1) {
      const second = layout.nodes[comparisonIndex];
      if (!second) {
        continue;
      }
      const overlapsX = first.x < second.x + second.width && first.x + first.width > second.x;
      const overlapsY = first.y < second.y + second.height && first.y + first.height > second.y;
      assert.equal(overlapsX && overlapsY, false);
    }
  }
});

test("keeps unrelated nodes clear of directional edge segments", () => {
  const concepts = [
    node("source"),
    ...Array.from({ length: 7 }, (_, index) => node(`unrelated-${index}`)),
    node("target"),
  ];
  const graph = createKnowledgeGraphModel(concepts, {
    contextualRelations: [{ source: "source", target: "target" }],
  });
  const layout = layoutKnowledgeGraph(graph, {
    strategy: "contextual",
    chronology: {
      source: 1900,
      ...Object.fromEntries(
        concepts
          .filter(({ id }) => id.startsWith("unrelated-"))
          .map(({ id }) => [id, 1950]),
      ),
      target: 2000,
    },
  });
  const positions = new Map(layout.nodes.map((entry) => [entry.id, entry]));
  const source = positions.get("source");
  const target = positions.get("target");
  assert.ok(source && target);
  const sourceCenter = {
    x: source.x + source.width / 2,
    y: source.y + source.height / 2,
  };
  const targetCenter = {
    x: target.x + target.width / 2,
    y: target.y + target.height / 2,
  };

  for (const concept of concepts.filter(({ id }) => id.startsWith("unrelated-"))) {
    const position = positions.get(concept.id);
    assert.ok(position);
    const clearance = Math.hypot(position.width, position.height) / 2;
    assert.ok(
      distanceToSegment(
        {
          x: position.x + position.width / 2,
          y: position.y + position.height / 2,
        },
        sourceCenter,
        targetCenter,
      ) >= clearance,
    );
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
