# Content contract

> Status: prototype, schema version 1.

Each concept directory contains language-independent metadata and one or more
locale-specific Markdown files.

```text
concepts/<directory>/
├─ concept.yaml
├─ ja.md
├─ en.md
└─ assets/
```

The directory is organizational only and does not need to resemble the concept
ID. Moving or renaming a concept directory must not change its ID,
relationships, or manifest semantics. Consumers match discovered translation
files to `concept.yaml`; they must never derive an ID by trimming a path,
filename, locale, title, or public URL.

## `concept.yaml`

```yaml
schemaVersion: 1
id: math/foundations/natural-numbers
prerequisites: []
related:
  - math/foundations/integers
```

- `id` uses lowercase slash-separated segments.
- `prerequisites` is a directed edge from this concept to required knowledge.
- `related` is non-hierarchical.
- all referenced IDs must exist in the validated content root;
- prerequisite cycles are rejected.

## Locale Markdown

The filename is a BCP 47-style locale such as `ja.md` or `en.md`.

```markdown
---
locale: ja
title: 自然数
summary: 個数や順序を表す数の基礎。
sources: []
status: draft
---

# 自然数
```

Required fields are `locale`, `title`, `summary`, `sources`, and `status`.
Initial status values are `draft`, `review`, and `published`.

Plain Markdown is supported. MDX, raw HTML, inline event handlers,
`javascript:` URLs, and `data:` URLs are rejected in the initial milestone.
Relative links and image references must resolve locally.

## Manifest

The generated JSON manifest contains stable IDs, relationships, and available
locale metadata. It intentionally does not finalize public URLs. A consuming
site may derive a prototype URL from its own `site` and `base` configuration.

## Knowledge graph view model

Domain sites build the shared graph view from the validated concepts and the
locale translations they already use for page generation. They pass stable
IDs, localized titles and summaries, statuses, relationships, and fully
base-aware concept URLs to `createKnowledgeGraphModel`.

The view model does not derive or join public URLs. A stored prerequisite from
concept A to concept B means “A requires B”; the rendered directional edge is
therefore B → A. Related links are omitted from the view model when the same
pair already has a prerequisite edge, so the stronger relationship is not
drawn or announced twice.

The interactive map is an enhancement. Consumers must render the shared list
view from the same model so every concept and concept URL remains available
without graph interaction or client JavaScript.
