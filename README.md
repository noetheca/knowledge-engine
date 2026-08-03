# @noetheca/knowledge-engine

Shared validation, manifest, and presentation primitives for noetheca knowledge
repositories.

This bootstrap release intentionally keeps the package small:

- load language-independent `concept.yaml` files;
- load one Markdown body per locale;
- validate stable IDs, references, prerequisite cycles, locale metadata, local
  links, and unsafe Markdown;
- emit a portable JSON manifest;
- provide shared Astro layout, article relation, and interactive graph
  components with domain-specific relationship vocabulary.

Astro is a peer dependency. Domain repositories own their content and thin
site configuration; this repository owns shared behavior.

`KnowledgeGraph.astro` supports both prerequisite maps and contextual maps.
Contextual consumers can pass directed `contextualRelations` to
`createKnowledgeGraphModel()`, `chronology` anchors for strict old-to-new
vertical ordering, `contextFacts` for domain-specific inspector metadata, and
`thumbnails` for an optional media view. Directed contextual relations affect
layout and render with arrowheads. Undirected `related` links are excluded from
the SVG hierarchy and appear in the selected node's related-knowledge list.
Setting `controls` enables the shared text/thumbnail toggle when thumbnails are
available. Layout is deterministic and build-time: prerequisite depth runs
from top to bottom, same-rank semantic groups receive wider boundaries, and
stable ordering reduces crossings. The browser runs adaptive continuous force
calculation in a dedicated Web Worker, transferring packed positions to the
semantic HTML/SVG view. A stable layout lowers its update frequency instead of
silently stopping; reduced-motion and the explicit pause control remain
respected. Prerequisite rank is a soft order force rather than a fixed Y
coordinate. Controls adjust that force, relationship attraction, local
repulsion, group cohesion, and group separation. Direct prerequisites attract
most strongly, followed by direct related knowledge and graph-distance-two and
-three neighbours. Fixed per-node caps keep dense stars bounded, while spatial
collision response keeps node rectangles from overlapping. Prerequisite lines
remain faintly visible and selection emphasizes the direct neighbourhood;
related knowledge remains available as readable lists rather than extra SVG
lines. The runtime decision is documented in
[`docs/decisions/0006-continuous-grouped-knowledge-map-physics.md`](docs/decisions/0006-continuous-grouped-knowledge-map-physics.md).

Filesystem paths are build-time source locations, not knowledge identities.
Consumers can use `createTranslationFileIndex()` to match framework content
entries to the stable ID read from `concept.yaml`.

## Requirements

- Node.js 24
- pnpm 11.9.0

## Development

```sh
pnpm install --frozen-lockfile
pnpm check
```

Build the CLI:

```sh
pnpm build
node dist/cli.js validate ../mathematics/concepts
node dist/cli.js manifest ../mathematics/concepts ../mathematics/public/manifest.json
```

## Content contract

See [`docs/content-contract.md`](docs/content-contract.md). The contract is
versioned and still considered a prototype.

## Licensing

This repository is licensed under [MPL 2.0](LICENSE). See
[`LICENSING.md`](LICENSING.md) for details.
