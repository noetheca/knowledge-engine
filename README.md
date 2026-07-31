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
Contextual consumers can pass `chronology` anchors for a weak old-to-new
vertical ordering, `contextFacts` for domain-specific inspector metadata, and
`thumbnails` for an optional media view. Setting `controls` enables the shared
text/thumbnail toggle plus node-size and repulsion controls. The browser layer
keeps contextual graphs simulated while visible and preserves the server-side
settled layout as their stable starting point.

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
