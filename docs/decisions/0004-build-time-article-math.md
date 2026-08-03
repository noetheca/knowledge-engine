# ADR 0004: Build-time article math through a replaceable renderer

- Status: accepted for the prototype
- Date: 2026-08-01

## Context

NOETHECA needs readable formulae now and expects articles in mathematics,
physics, chemistry, and computer science later. Article files must remain easy
to edit and review, while untrusted content must not execute code or inject
HTML. The generated site is static, so ordinary formulae should not require a
large client runtime.

The main candidates were:

- **KaTeX**: fast server-side rendering, HTML plus MathML output, and an
  official `mhchem` extension;
- **MathJax**: broader TeX-package and accessibility capabilities, including
  optional explorer and assistive extensions, at greater runtime and
  integration cost; and
- **Temml**: compact native-MathML output, but with more dependence on browser
  MathML typography and compatibility.

## Decision

1. Articles store a deliberately portable TeX subset using `$...$` and
   standalone `$$` blocks.
2. The engine owns an asynchronous `ArticleMathRenderer` interface. Content
   never refers to a backend, its HTML, or its CSS classes.
3. KaTeX 0.18.1 is the default backend. Rendering happens at build time and
   emits HTML plus MathML. CSS and fonts are bundled locally.
4. The `core` profile covers ordinary mathematical notation. The `chemistry`
   profile adds only the official `mhchem` commands `\ce` and `\pu` and is
   selected when they occur.
5. Interactive components may lazily import the browser renderer only for
   trusted formulae assembled by a registered engine component. Article text
   never supplies client code.

## Security and resource limits

KaTeX is configured with strict errors, `trust: false`, bounded expansion and
size, no global grouping, and a fresh macro map per expression. The validator
also rejects package loading, macro definition, links, HTML, images, and TeX
equation labels or references. It limits expression length, expression count,
and total TeX length. Invalid or unsupported TeX is a build error rather than
partially trusted fallback markup.

## Portability and migration

Authors should prefer standard TeX notation such as `\frac`, `\sqrt`,
`\mathrm`, `\mathbf`, `\mathbb`, matrices, aligned equations, and ordinary
operators. Physics units use explicit roman text; chemical formulae and units
may use `\ce` and `\pu`. Renderer-specific HTML, custom macros, package
commands, and backend-specific equation numbering are outside the contract.

MathJax should be evaluated as an additional backend when real content needs
one or more of the following:

- TeX extensions that cannot be expressed clearly in the portable subset;
- high-quality automatic line breaking for long display equations;
- richer semantic speech, Braille, or expression exploration; or
- a domain requirement that cannot be met by KaTeX plus `mhchem`.

Temml may be tested as an experimental backend after cross-browser visual and
accessibility checks. Because the adapter is asynchronous and articles retain
their TeX source, changing the backend does not require a content migration as
long as the portable subset is preserved.

## Consequences

- Normal pages receive static, indexable mathematics without client-side
  rendering work.
- Mathematics, common physics notation, chemistry via `mhchem`, and
  computer-science notation share one authoring form.
- The supported TeX surface is intentionally smaller than any backend's full
  command set.
- Adding a backend requires conformance tests for markup, security limits,
  accessibility, and existing article snapshots.

## References

- [KaTeX API](https://katex.org/docs/api)
- [KaTeX options](https://katex.org/docs/options)
- [KaTeX security](https://katex.org/docs/security)
- [KaTeX supported functions and extensions](https://katex.org/docs/supported)
- [MathJax TeX extensions](https://docs.mathjax.org/en/latest/input/tex/extensions/index.html)
- [MathJax accessibility components](https://docs.mathjax.org/en/latest/web/components/accessibility.html)
- [Temml administration and browser notes](https://temml.org/docs/en/administration)
