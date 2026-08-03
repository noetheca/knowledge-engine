# ADR 0002: registered directives for article components

- Status: accepted for the prototype
- Date: 2026-08-01

## Decision

Keep locale article bodies in Markdown and add a small allowlisted directive
layer for `ruby`, `callout`, `details`, and registered `interactive` kinds.
Astro uses its Sätteri processor with directive parsing enabled. The CLI
validator and Astro renderer share the same registry and validation rules.

Article content cannot provide executable code, imports, component paths, raw
HTML, event handlers, style or class attributes, arbitrary ARIA attributes, or
unbounded configuration. Unknown or malformed input stops validation and the
build. Renderer-generated markup is assembled only from validated values and
HTML-escaped authored text.

Interactive components render a useful static representation during the build.
Engine-owned JavaScript adds controls after page load. `rectangle-area-grid`
remains the fixed-scale compatibility kind. Elementary diagrams use registered
families for counters, place value, number lines, fractions, equations,
geometry, measurement, data, and soroban. Every family exposes finite modes,
bounded numeric values, allowlisted units, and only the finite operation enums
needed by fraction and equation modes rather than a content-authored
scene description.

Pin `@astrojs/markdown-satteri` and `satteri` while both APIs are pre-1.0, and
exercise the full parser-to-Astro path in integration tests when upgrading.

## Why

Markdown remains easy to edit and review, while the allowlist provides the
semantics needed for notes, proof disclosure, ruby, and interactive figures.
MDX or content-authored Astro components would turn an article contribution
into executable build input and mix domain content with presentation code.
Raw HTML would require a broader sanitizer contract and would not provide a
stable component registry.

## Consequences

- The engine owns directive parsing, validation, rendering, styles, and client
  enhancement; domain repositories own only directive usage and content data.
- Adding a directive or an interactive kind is a schema change requiring an
  ADR, validation tests, static fallback, accessibility review, and an Astro
  integration test.
- New article use cases extend an existing family with an engine-owned mode
  when its semantics fit. They do not add arbitrary JSON, coordinates, SVG
  paths, formula strings, CSS, or import targets to article content.
- The client revalidates normalized `data-*` values and fails closed to the
  static figure. Native controls are required; pointer manipulation is only a
  supplement.
- Shared pure semantic models keep division grouping, fraction operations,
  equality properties, conservation quantities, categories, dice frequencies,
  and unit selection consistent between SSR and client enhancement.
- Literal examples of reserved directive syntax must be placed in inline code
  or fenced code blocks.
- The initial registry is intentionally small; math typesetting and additional
  diagram families remain separate future decisions.
