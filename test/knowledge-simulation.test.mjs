import assert from "node:assert/strict";
import test from "node:test";
import {
  createKnowledgeGraphModel,
  createKnowledgeGraphSimulationLinks,
  layoutKnowledgeGraph,
  settleKnowledgeGraphSimulation,
  stepKnowledgeGraphSimulation,
} from "../dist/index.js";

const concept = (id, overrides = {}) => ({
  id,
  title: id,
  summary: id,
  status: "draft",
  href: `/${id}`,
  prerequisites: [],
  related: [],
  ...overrides,
});

const simulationNode = (
  id,
  x,
  y,
  anchorX = x,
  anchorY = y,
  overrides = {},
) => ({
  id,
  x,
  y,
  width: 100,
  height: 60,
  anchorX,
  anchorY,
  bandMinimumY: anchorY - 20,
  bandMaximumY: anchorY + 20,
  velocityX: 0,
  velocityY: 0,
  ...overrides,
});

const assertNoOverlaps = (nodes) => {
  for (const [index, node] of nodes.entries()) {
    for (const other of nodes.slice(index + 1)) {
      const overlaps =
        node.x < other.x + other.width &&
        node.x + node.width > other.x &&
        node.y < other.y + other.height &&
        node.y + node.height > other.y;
      assert.equal(overlaps, false, `${node.id} overlaps ${other.id}`);
    }
  }
};

const radialSpread = (nodes) => {
  const centers = nodes.map((node) => ({
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  }));
  const centerX =
    centers.reduce((sum, point) => sum + point.x, 0) / centers.length;
  const centerY =
    centers.reduce((sum, point) => sum + point.y, 0) / centers.length;
  return Math.sqrt(
    centers.reduce(
      (sum, point) =>
        sum + (point.x - centerX) ** 2 + (point.y - centerY) ** 2,
      0,
    ) / centers.length,
  );
};

const meanGroupSpread = (nodes) => {
  const groups = Map.groupBy(nodes, (node) => node.groupId ?? node.id);
  const spreads = [...groups.values()]
    .filter((members) => members.length > 1)
    .map(radialSpread);
  return spreads.reduce((sum, spread) => sum + spread, 0) / spreads.length;
};

test("weights direct prerequisites, related knowledge, and graph distance", () => {
  const links = createKnowledgeGraphSimulationLinks(
    ["a", "b", "c", "d", "isolated"],
    [
      { source: "a", target: "b", kind: "prerequisite" },
      { source: "b", target: "c", kind: "related" },
      { source: "c", target: "d", kind: "related" },
    ],
  );
  const find = (left, right) => links.find(
    ({ source, target }) =>
      (source === left && target === right) ||
      (source === right && target === left),
  );

  assert.ok(find("a", "b").strength > find("b", "c").strength);
  assert.ok(find("b", "c").strength > find("a", "c").strength);
  assert.ok(find("a", "c").strength > find("a", "d").strength);
  assert.equal(find("a", "c").distance, 2);
  assert.equal(find("a", "d").distance, 3);
  assert.equal(find("a", "isolated"), undefined);
});

test("keeps every prerequisite strictly downward in default hierarchy mode", () => {
  const graph = createKnowledgeGraphModel([
    concept("root"),
    concept("branch", { prerequisites: ["root"] }),
    concept("leaf", { prerequisites: ["branch"] }),
  ]);
  const layout = layoutKnowledgeGraph(graph);
  const direct = graph.edges.map(({ source, target, kind }) => ({
    source,
    target,
    kind,
  }));
  const links = createKnowledgeGraphSimulationLinks(
    layout.nodes.map(({ id }) => id),
    direct,
  );
  const nodes = layout.nodes.map((node) => ({
    ...node,
    anchorX: node.x,
    anchorY: node.y,
    bandMinimumY: node.y,
    bandMaximumY: node.y,
    velocityX: 0,
    velocityY: 0,
  }));
  const settled = settleKnowledgeGraphSimulation(nodes, links, {
    maximumX: layout.width,
    maximumY: layout.height,
    hierarchyStrength: 1,
  });
  const positions = new Map(settled.nodes.map((node) => [node.id, node]));

  for (const edge of graph.edges.filter(({ kind }) => kind === "prerequisite")) {
    assert.ok(positions.get(edge.source).y < positions.get(edge.target).y);
  }
  assert.ok(settled.frames > 0 && settled.frames <= 90);
});

test("the offline settlement helper is deterministic and finitely bounded", () => {
  const nodes = [
    simulationNode("a", 20, 20),
    simulationNode("b", 60, 20),
    simulationNode("c", 100, 140),
  ];
  const links = createKnowledgeGraphSimulationLinks(
    nodes.map(({ id }) => id),
    [
      { source: "a", target: "c", kind: "prerequisite" },
      { source: "b", target: "c", kind: "prerequisite" },
    ],
  );
  const options = {
    maximumX: 700,
    maximumY: 500,
    hierarchyStrength: 1,
  };
  const first = settleKnowledgeGraphSimulation(nodes, links, options);
  const second = settleKnowledgeGraphSimulation(nodes.toReversed(), links, options);

  assert.deepEqual(
    first.nodes.toSorted((left, right) => left.id.localeCompare(right.id)),
    second.nodes.toSorted((left, right) => left.id.localeCompare(right.id)),
  );
  assert.ok(["settled", "frame-limit"].includes(first.reason));
  assert.ok(first.frames <= 90);
});

test("does not auto-settle when reduced motion is requested", () => {
  const nodes = [simulationNode("a", 20, 20), simulationNode("b", 40, 20)];
  const result = settleKnowledgeGraphSimulation(nodes, [], {
    maximumX: 500,
    maximumY: 300,
    reducedMotion: true,
  });

  assert.equal(result.frames, 0);
  assert.equal(result.reason, "reduced-motion");
  assert.deepEqual(result.nodes, nodes);
});

test("uses the hierarchy as a soft force and permits Y motion at full strength", () => {
  const constrained = [
    simulationNode("a", 120, 30),
    simulationNode("b", 120, 330),
  ];
  const free = constrained.map((node) => ({ ...node }));
  const links = createKnowledgeGraphSimulationLinks(
    ["a", "b"],
    [{ source: "a", target: "b", kind: "prerequisite" }],
  );
  stepKnowledgeGraphSimulation(constrained, links, {
    maximumX: 600,
    maximumY: 500,
    hierarchyStrength: 1,
  });
  stepKnowledgeGraphSimulation(free, links, {
    maximumX: 600,
    maximumY: 500,
    hierarchyStrength: 0,
  });

  assert.ok(constrained.some(({ y, anchorY }) => y !== anchorY));
  assert.ok(free.some(({ y, anchorY }) => y !== anchorY));
});

test("preserves each group's rest shape while separating group centroids", () => {
  const seed = [
    simulationNode("a-1", 260, 180, 260, 180, { groupId: "a", rank: 0 }),
    simulationNode("a-2", 500, 180, 500, 180, { groupId: "a", rank: 0 }),
    simulationNode("b-1", 430, 360, 430, 360, { groupId: "b", rank: 1 }),
    simulationNode("b-2", 670, 360, 670, 360, { groupId: "b", rank: 1 }),
  ];
  const disabled = seed.map((node) => ({ ...node }));
  const grouped = seed.map((node) => ({ ...node }));
  const options = {
    minimumX: 10,
    minimumY: 10,
    maximumX: 1_200,
    maximumY: 800,
    hierarchyStrength: 0,
    attractionStrength: 0,
    repulsionStrength: 0,
  };
  for (let step = 0; step < 500; step += 1) {
    stepKnowledgeGraphSimulation(disabled, [], {
      ...options,
      groupStrength: 0,
      groupSeparationStrength: 0,
    });
    stepKnowledgeGraphSimulation(grouped, [], {
      ...options,
      groupStrength: 1.5,
      groupSeparationStrength: 2,
    });
  }
  const center = (nodes, groupId) => {
    const members = nodes.filter((node) => node.groupId === groupId);
    return {
      x: members.reduce((sum, node) => sum + node.x, 0) / members.length,
      y: members.reduce((sum, node) => sum + node.y, 0) / members.length,
    };
  };
  const groupDistance = (nodes) => {
    const a = center(nodes, "a");
    const b = center(nodes, "b");
    return Math.hypot(b.x - a.x, b.y - a.y);
  };
  const memberDistance = (nodes, left, right) => {
    const first = nodes.find(({ id }) => id === left);
    const second = nodes.find(({ id }) => id === right);
    return Math.hypot(second.x - first.x, second.y - first.y);
  };

  assert.ok(groupDistance(grouped) > groupDistance(disabled));
  assert.ok(
    Math.abs(
      memberDistance(grouped, "a-1", "a-2") -
        memberDistance(seed, "a-1", "a-2"),
    ) < 12,
  );
  assertNoOverlaps(grouped);
});

test("preserves global and group radii through long-running simulation", () => {
  const nodes = Array.from({ length: 24 }, (_, index) => {
    const groupIndex = Math.floor(index / 6);
    const localIndex = index % 6;
    const groupColumn = groupIndex % 2;
    const groupRow = Math.floor(groupIndex / 2);
    const x = 180 + groupColumn * 920 + (localIndex % 3) * 180;
    const y = 160 + groupRow * 680 + Math.floor(localIndex / 3) * 150;
    return simulationNode(`n-${index}`, x, y, x, y, {
      groupId: `group-${groupIndex}`,
      rank: groupRow * 2 + Math.floor(localIndex / 3),
    });
  });
  const direct = nodes.slice(1).map((node, index) => ({
    source: nodes[index].id,
    target: node.id,
    kind: "prerequisite",
  }));
  const anchors = new Map(
    nodes.map((node) => [node.id, { x: node.anchorX, y: node.anchorY }]),
  );
  const links = createKnowledgeGraphSimulationLinks(
    nodes.map(({ id }) => id),
    direct,
    anchors,
  );
  const initialGlobalSpread = radialSpread(nodes);
  const initialGroupSpread = meanGroupSpread(nodes);

  for (let frame = 0; frame < 2_000; frame += 1) {
    stepKnowledgeGraphSimulation(nodes, links, {
      minimumX: 20,
      minimumY: 20,
      maximumX: 2_000,
      maximumY: 1_650,
      hierarchyStrength: 0.55,
      attractionStrength: 1,
      repulsionStrength: 1,
      groupStrength: 1,
      groupSeparationStrength: 1.25,
    });
  }

  assert.ok(radialSpread(nodes) >= initialGlobalSpread * 0.85);
  assert.ok(meanGroupSpread(nodes) >= initialGroupSpread * 0.85);
  assert.ok(meanGroupSpread(nodes) <= initialGroupSpread * 1.2);
  assertNoOverlaps(nodes);
});

test("softened inverse-square repulsion is stronger at short range", () => {
  const near = [
    simulationNode("near-a", 100, 160),
    simulationNode("near-b", 220, 160),
  ];
  const far = [
    simulationNode("far-a", 100, 160),
    simulationNode("far-b", 500, 160),
  ];
  const separation = (nodes) =>
    Math.abs(nodes[1].x - nodes[0].x);
  const nearBefore = separation(near);
  const farBefore = separation(far);
  const options = {
    minimumX: 10,
    minimumY: 10,
    maximumX: 1_200,
    maximumY: 700,
    hierarchyStrength: 0,
    attractionStrength: 0,
    repulsionStrength: 1,
    groupStrength: 0,
    groupSeparationStrength: 0,
  };

  stepKnowledgeGraphSimulation(near, [], options);
  stepKnowledgeGraphSimulation(far, [], options);

  const nearIncrease = separation(near) - nearBefore;
  const farIncrease = separation(far) - farBefore;
  assert.ok(nearIncrease > farIncrease + 0.05);
  assert.ok(farIncrease < 0.001);
});

test("proximity attraction captures near knowledge but ignores remote nodes", () => {
  const link = {
    source: "a",
    target: "b",
    kind: "proximity",
    distance: 2,
    strength: 0.18,
    desiredDistance: 410,
  };
  const near = [
    simulationNode("a", 100, 160),
    simulationNode("b", 600, 160),
  ];
  const far = [
    simulationNode("a", 100, 160),
    simulationNode("b", 1_100, 160),
  ];
  const separation = (nodes) =>
    Math.abs(nodes[1].x - nodes[0].x);
  const nearBefore = separation(near);
  const farBefore = separation(far);
  const options = {
    minimumX: 10,
    minimumY: 10,
    maximumX: 2_200,
    maximumY: 700,
    hierarchyStrength: 0,
    attractionStrength: 1,
    repulsionStrength: 0,
    groupStrength: 0,
    groupSeparationStrength: 0,
  };

  stepKnowledgeGraphSimulation(near, [link], options);
  stepKnowledgeGraphSimulation(far, [link], options);

  assert.ok(separation(near) < nearBefore);
  assert.ok(Math.abs(separation(far) - farBefore) < 0.001);
});

test("remains finite and bounded for ten thousand deterministic steps", () => {
  const nodes = [
    simulationNode("root", 120, 80, 120, 80, { groupId: "one", rank: 0 }),
    simulationNode("child", 180, 260, 180, 260, { groupId: "one", rank: 1 }),
    simulationNode("aside", 500, 180, 500, 180, { groupId: "two", rank: 1 }),
  ];
  const links = createKnowledgeGraphSimulationLinks(
    nodes.map(({ id }) => id),
    [{ source: "root", target: "child", kind: "prerequisite" }],
  );
  const result = settleKnowledgeGraphSimulation(nodes, links, {
    minimumX: 10,
    minimumY: 10,
    maximumX: 900,
    maximumY: 700,
    maxFrames: 10_000,
    maxDurationMs: 1_000_000_000,
    stableFrames: 10_001,
  });

  assert.equal(result.frames, 10_000);
  assert.equal(result.reason, "frame-limit");
  assert.ok(
    result.nodes.every((node) =>
      [node.x, node.y, node.velocityX, node.velocityY].every(Number.isFinite),
    ),
  );
  assertNoOverlaps(result.nodes);
});

test("bounds proximity links for a 96-node chain", () => {
  const ids = Array.from({ length: 96 }, (_, index) => `n-${index}`);
  const direct = ids.slice(1).map((id, index) => ({
    source: ids[index],
    target: id,
    kind: "prerequisite",
  }));
  const links = createKnowledgeGraphSimulationLinks(ids, direct);

  assert.ok(links.length < ids.length * 4);
  assert.ok(links.every(({ distance }) => distance <= 3));
});

test("caps distance-two attraction in a dense 96-node star", () => {
  const ids = Array.from({ length: 96 }, (_, index) => `n-${index}`);
  const direct = ids.slice(1).map((id) => ({
    source: ids[0],
    target: id,
    kind: "prerequisite",
  }));
  const links = createKnowledgeGraphSimulationLinks(ids, direct);
  const proximity = links.filter(({ kind }) => kind === "proximity");

  assert.ok(proximity.length <= ids.length * 4);
  assert.ok(links.length < ids.length * 6);
  assert.deepEqual(
    links,
    createKnowledgeGraphSimulationLinks(ids.toReversed(), direct.toReversed()),
  );
});

test("selects the nearest authored proximity candidates before hash order", () => {
  const ids = [
    "a-source",
    "b-bridge",
    "c-near-1",
    "d-near-2",
    "e-near-3",
    "f-near-4",
    "g-far-1",
    "h-far-2",
  ];
  const direct = [
    { source: "a-source", target: "b-bridge", kind: "prerequisite" },
    ...ids.slice(2).map((target) => ({
      source: "b-bridge",
      target,
      kind: "prerequisite",
    })),
  ];
  const anchors = new Map([
    ["a-source", { x: 0, y: 0 }],
    ["b-bridge", { x: 80, y: 0 }],
    ["c-near-1", { x: 120, y: 0 }],
    ["d-near-2", { x: 180, y: 0 }],
    ["e-near-3", { x: 240, y: 0 }],
    ["f-near-4", { x: 300, y: 0 }],
    ["g-far-1", { x: 1_200, y: 0 }],
    ["h-far-2", { x: 1_400, y: 0 }],
  ]);
  const links = createKnowledgeGraphSimulationLinks(ids, direct, anchors);
  const sourceProximity = links
    .filter(
      (link) =>
        link.source === "a-source" &&
        link.kind === "proximity" &&
        link.distance === 2,
    )
    .map(({ target }) => target)
    .toSorted();

  assert.deepEqual(
    sourceProximity,
    ["c-near-1", "d-near-2", "e-near-3", "f-near-4"],
  );
});

test("prevents a high-degree star from collapsing toward its hub", () => {
  const nodes = Array.from({ length: 49 }, (_, index) => {
    const column = index % 7;
    const row = Math.floor(index / 7);
    const x = 140 + column * 190;
    const y = 120 + row * 150;
    return simulationNode(`star-${index}`, x, y, x, y, {
      groupId: `node-${index}`,
      rank: row,
    });
  });
  const direct = nodes.slice(1).map(({ id }) => ({
    source: nodes[0].id,
    target: id,
    kind: "related",
  }));
  const anchors = new Map(
    nodes.map((node) => [node.id, { x: node.anchorX, y: node.anchorY }]),
  );
  const links = createKnowledgeGraphSimulationLinks(
    nodes.map(({ id }) => id),
    direct,
    anchors,
  );
  const initialSpread = radialSpread(nodes);

  for (let frame = 0; frame < 1_200; frame += 1) {
    stepKnowledgeGraphSimulation(nodes, links, {
      minimumX: 20,
      minimumY: 20,
      maximumX: 1_600,
      maximumY: 1_250,
      hierarchyStrength: 0.55,
      attractionStrength: 1,
      repulsionStrength: 1,
      groupStrength: 0,
      groupSeparationStrength: 0,
    });
  }

  assert.ok(radialSpread(nodes) >= initialSpread * 0.85);
  assertNoOverlaps(nodes);
});

test("keeps all 96 synthetic nodes non-overlapping across hierarchy modes", () => {
  const nodes = Array.from({ length: 96 }, (_, index) => {
    const column = index % 8;
    const row = Math.floor(index / 8);
    return simulationNode(
      `n-${index}`,
      20 + column * 130,
      20 + row * 100,
    );
  });
  const direct = nodes.slice(1).map(({ id }) => ({
    source: nodes[0].id,
    target: id,
    kind: "related",
  }));
  const links = createKnowledgeGraphSimulationLinks(
    nodes.map(({ id }) => id),
    direct,
  );
  for (const hierarchyStrength of [0, 0.5, 1]) {
    const result = settleKnowledgeGraphSimulation(nodes, links, {
      maximumX: 1_100,
      maximumY: 1_300,
      hierarchyStrength,
    });
    assertNoOverlaps(result.nodes);
  }
});
