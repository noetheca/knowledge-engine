# @noetheca/knowledge-engine

Shared validation, manifest, and presentation primitives for noetheca knowledge
repositories.

This bootstrap release intentionally keeps the package small:

- load language-independent `concept.yaml` files;
- load one Markdown body per locale;
- validate stable IDs, references, prerequisite cycles, locale metadata, local
  links, and unsafe Markdown;
- emit a portable JSON manifest;
- provide minimal Astro layout and relation components.

Astro is a peer dependency. Domain repositories own their content and thin
site configuration; this repository owns shared behavior.

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

The code license has not yet been approved. No license file is included, and
external contributions are not currently accepted.
