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
Source entries are either an `http`/`https` URL string or a mapping with a
non-empty `title`, an `http`/`https` `url`, and an optional text `note`.

`readingLevel` is optional locale-specific guidance, not a prerequisite or an
age restriction. `curriculum` is a lowercase machine ID such as
`jp-mext-2017`; `grade` is an integer from 1 through 12 and means the minimum
school grade for which the wording is prepared. Curriculum IDs may use `.`,
`_`, `/`, or `-` between lowercase alphanumeric segments.

```yaml
readingLevel:
  curriculum: jp-mext-2017
  grade: 4
```

Plain Markdown plus the registered article directives below is supported. MDX,
content-authored raw HTML, inline event handlers, `javascript:` URLs, and
`data:` URLs are rejected. Relative links and image references must resolve
locally.

Standalone SVG assets are code-like authored resources even when Markdown
loads them as images. They must be self-contained and static. Do not include
`script`, `foreignObject`, `iframe`, event-handler attributes, external URLs,
`data:` URLs, external stylesheets, or animation. Include an SVG `title` and
`desc`, and provide meaningful Markdown alt text at each use. Until automated
SVG inspection is part of content validation, repository review must verify
these requirements before publication.

## Article math

Inline mathematics uses single dollar delimiters. Display mathematics uses
double dollar delimiters on their own lines.

```markdown
The area is $3 \times 4 = 12\,\mathrm{cm}^2$.

$$
A = h \times w
$$
```

The engine parses the TeX source and renders it at build time through the
asynchronous `ArticleMathRenderer` contract. The default backend is KaTeX
0.18.1 with locally bundled CSS and fonts, producing HTML plus MathML. Ordinary
article mathematics therefore requires no browser-side JavaScript. Registered
interactives may lazily load the same renderer for values that change after
input.

Content stores TeX, never renderer-generated HTML or renderer CSS classes. The
portable authoring subset covers ordinary arithmetic, algebra, geometry,
statistics, physics, and computer-science notation. The chemistry profile adds
the official `mhchem` commands `\ce` and `\pu`. Authors must not define macros,
load packages, inject HTML or links, include images, or manage TeX equation
labels and references. Expressions that are invalid, unsupported, too long,
or use a forbidden command stop the build.

The initial limits are 2,048 characters per expression, 200 expressions, and
20,000 TeX characters per translation. KaTeX runs with strict errors,
`trust: false`, bounded expansion and sizing, and a fresh macro table for each
expression. The low-level `renderArticleMath()` API enforces the per-expression
contract; the registered Markdown processor owns and enforces the
translation-wide expression and character budgets. Article consumers must use
that processor instead of calling the low-level API in an unbounded loop. A
later backend such as MathJax can implement the same adapter without changing
article source. The renderer decision and migration triggers are recorded in
[`0004-build-time-article-math.md`](./decisions/0004-build-time-article-math.md).

### Reading level and Japanese ruby

For `jp-mext-2017`, authors use the current Japanese Ministry of Education,
Culture, Sports, Science and Technology (MEXT) grade allocation as the baseline:

- kanji assigned after the target grade, or absent from the elementary-school
  allocation, receive ruby on every occurrence by default;
- kanji assigned to the target grade receive ruby on their first occurrence;
- kanji assigned before the target grade do not receive automatic ruby by
  default; and
- both words in a paired expression receive ruby when annotating only one
  would make the pair harder to read, such as `縦（たて）・横（よこ）`.

This policy does not force ruby on every kanji. Authors may add more ruby when
a technical term, the point within a school year, or accessibility needs make
the reading uncertain. Ruby remains explicit content through the registered
`ruby` directive; it is not generated from an unsupervised reading guess.

Primary references are MEXT's
[Elementary School Curriculum Guidelines (2017 notification)](https://www.mext.go.jp/content/20230120-mxt_kyoiku02-100002604_01.pdf),
including the grade-by-grade kanji table and the guidance on presenting
later-grade kanji, and the
[Textbook Authorization Standards for Compulsory Education Schools](https://www.mext.go.jp/a_menu/shotou/kyoukasho/kentei/1343945.htm),
which require readings at least on first use in the applicable textbook scope.

## Article directives

Directives are declarative content. They never contain JavaScript, imports,
component paths, arbitrary HTML attributes, or arbitrary JSON. Unknown names,
attributes, values, nesting, malformed syntax, and unclosed containers are
validation errors.

```markdown
:ruby[面積]{reading="めんせき" strong="true"}

:::callout{type="note" title="単位" titleReading="たんい"}
1マスの面積は1 cm²です。
:::

:::details{summary="証明の詳細" summaryReading="しょうめいのしょうさい"}
折りたたむ詳細を書く。
:::

::interactive[縦と横を変えて確かめる]{kind="rectangle-area-grid" rows="3" columns="4" unit="cm" captionReading="たてとよこをかえてたしかめる"}

::interactive[おはじきを合わせる]{kind="counter-mat" mode="add" value="5" second="3" max="20" captionReading="おはじきをあわせる"}
```

| Directive | Form | Contract |
| --- | --- | --- |
| `ruby` | text | Plain label plus required `reading`; base 1–32 characters, reading 1–64 characters; optional `strong="true"` or `strong="false"`. |
| `callout` | container | Required `type`: `note`, `tip`, `warning`, or `important`; optional `title` and matching `titleReading`. |
| `details` | container | Required `summary`; optional `summaryReading` and `open="true"` or `open="false"`. |
| `interactive` | leaf | Registered `kind` and mode only. The plain caption is required and `captionReading` is optional. Every kind has a finite attribute allowlist and bounded numeric values. |

`callout` may occur at article level or directly inside `details`. `details`
and `interactive` occur only at article level. Interactive kinds are resolved
through a fixed engine registry; content never controls an import target.

The registered elementary families are shown below. Mode names are exact and
are part of the content contract.

| Kind | Modes |
| --- | --- |
| `counter-mat` | `count`, `label`, `compare`, `compose`, `decompose`, `add`, `subtract`, `inverse`, `group`, `share`, `remainder`, `multiply` |
| `place-value-board` | `place-value`, `regroup-add`, `regroup-subtract`, `large`, `decimal`, `multiply`, `divide` |
| `number-line` | `order`, `zero`, `jump-add`, `jump-subtract`, `fraction`, `decimal`, `distance`, `elapsed`, `estimate` |
| `fraction-model` | `unit`, `count`, `compare`, `add-subtract`, `decimal` |
| `equation-balance` | `equality`, `unknown`, `properties` |
| `geometry-lab` | `point-line`, `segment`, `recognize`, `compose`, `elements`, `position`, `triangle`, `quadrilateral`, `rectangle`, `square`, `right-angle`, `congruence`, `isosceles`, `circle`, `sphere`, `solid`, `tiling`, `euclidean` |
| `measurement-lab` | `compare`, `conservation`, `nonstandard`, `standard`, `length`, `metric-length`, `area`, `capacity`, `metric-capacity`, `mass`, `clock`, `duration`, `elapsed`, `seconds`, `kilometres`, `unit-relations`, `choose-tool` |
| `data-lab` | `classify`, `criteria`, `frequency`, `pictograph`, `table`, `bar`, `two-way`, `evidence`, `dice-frequency` |
| `soroban-board` | `number`, `calculate` |

Family attributes are semantic initial values, not presentation instructions.
Depending on the kind they may include bounded `value`, `second`, `min`,
`max`, `step`, `groups`, `parts`, `selected`, `secondParts`, `categories`, or
an allowlisted `unit`. `data-lab` additionally accepts `third`, `fourth`,
`fifth`, and `sixth` as the independent initial counts for categories C–F.
When `categories` is greater than two, every corresponding extra count is
required; the engine never invents a count from an average or difference.
`fraction-model/add-subtract` and `place-value-board/decimal` additionally
accept `operation="add"|"subtract"`, and `equation-balance/properties` accepts
`operation="add"|"multiply"`; omitted operations default to `add`.
`counter-mat/label` uses `selected=0|1` to hide or show ordinal labels without
changing the count. `equation-balance/unknown` uses `selected` as the trial
value, while `equation-balance/properties` uses it to choose the property. An
attribute that is not allowed by the selected family
is an error. Content cannot provide coordinates, SVG paths, colors, CSS,
formula strings, labels, event handlers, component names, scene JSON, or data
URLs. Larger counts must use a place-value representation instead of creating
unbounded object nodes.

Ruby is applied only to consecutive Kanji runs. Hiragana, katakana,
punctuation, numbers, and Latin text remain ordinary text even when included in
the directive label. In the usual form, those non-Kanji characters must occur
verbatim in `reading`, for example
`:ruby[掛け算]{reading="かけざん"}`. If repeated kana make that alignment
ambiguous, `reading` contains one `|`-separated reading per Kanji run; the
non-Kanji text is then supplied by the base label. The same rule applies to
`summaryReading` and `captionReading`.

When a ruby-annotated term is itself the important term being defined, authors
set `strong="true"` on the `ruby` directive. They do not wrap directive syntax
in Markdown `**` delimiters; Markdown emphasis delimiters cannot safely span a
directive boundary. Ordinary text without a directive continues to use normal
Markdown `**strong emphasis**`.

The renderer emits meaningful static HTML and SVG first. Client JavaScript may
enhance a registered interactive, but the initial diagram, dimensions, unit
cell, formula, and answer remain readable without JavaScript. A translation may
contain at most 256 directives and eight interactives in the prototype. The
higher article limit leaves room for explicit, grade-aware ruby without
relaxing the much smaller interactive-component limit.

All families share one engine-owned client entry point. It revalidates the
normalized `data-*` contract before revealing controls; missing or modified
data leaves the useful static representation in place. Controls use native
inputs and buttons, reset deterministically, and update DOM/SVG only after an
operation. Direct manipulation may be added as a convenience but cannot be the
only way to operate a figure. Generated arithmetic results use the shared math
renderer and retain a plain accessible label; non-formula statuses remain
plain text. Engine-generated Japanese in elementary-family controls, visible
labels, results, and live statuses uses the same Kanji-only ruby rule as article
copy: each registered Kanji run receives a reading, while hiragana and katakana
remain ordinary text. The engine rejects an unregistered generated Kanji run;
SVG-only labels that cannot contain HTML ruby use kana-safe wording. Authored
captions and prose keep the normal explicit, grade-aware ruby contract.

Every exposed control changes either the visible model or its stated result.
Grouping and sharing are distinct: `group`/`remainder` make as many equal-size
groups as possible, while `share` distributes across the requested number of
groups; leftovers stay in a separate remainder tray. Same-denominator fraction
addition/subtraction exposes an operation button and a result bar. Decimal
place-value mode shows both operands, their operation, and their result.
Equation unknowns level the balance only for a correct trial; properties show
concrete swapped, regrouped, and distributive expressions. The `seconds`
mode has a seconds hand rather than reusing hour/minute hands. `unit-relations`
uses a four-choice selector and the shared article math renderer. Data modes
render the declared number of categories (an additional category may have zero
frequency only when its explicit attribute is `0`), while `dice-frequency` keeps a cumulative six-face frequency
table and resets it deterministically. One press rolls two dice and therefore
adds two recorded face outcomes; UI copy must not describe that outcome count
as the number of trials.

Fixed definitions do not expose misleading controls: `number-line/zero`,
`fraction-model/unit`, and `fraction-model/decimal` are static diagrams with no
reset button. They keep the same figure-card vocabulary as interactive
diagrams, but identify their visual as a labelled `group`, omit keyboard focus,
and carry `data-ke-family-static="true"`; they must not be announced as an
interactive region. Their authored values must match the represented
definition. Buttons embedded inside an interactive drawing are rendered
`hidden` and `disabled` in the build-time fallback. The client reveals them
only after their state handlers have initialized successfully, so a failed or
absent script never leaves a visible inert control.
`measurement-lab/choose-tool` uses `value=0..2` for the registered object and
`second=0..8` for the registered tool/unit pair. The discrete `area`,
`nonstandard`, and `standard` modes require integer values and `max` with
`step=1`; `standard` requires both counts to be at least one and renders both
partitions at the same total length. Clock and elapsed-time diagrams retain
24-hour values as visible text even though their hands use a 12-hour face.

`measurement-lab/compare` accepts `selected=0..1`: `0` aligns the two
quantities at a common endpoint for direct comparison, and `1` copies a
quantity onto a tape for indirect comparison. Both scenes use the same values
and relation. In `measurement-lab/capacity`, `value` is the conserved total and
`second` is the amount poured from A toward B, so `second` may not exceed
`value`. B holds 60 percent of `max`; any additional transferred amount is
shown as a spill, and the displayed remainder, contained amount, spill, and
equation must still sum to the total. `metric-capacity` remains the independent
two-amount unit-comparison mode.

Concrete objects are engine-generated HTML and inline SVG primitives, not
external images. Count and data boards cap visible items, dice begin in a
deterministic authored state and roll only after the explicit button is
pressed, and no family autoplays or runs a persistent animation loop.
Scrollable family figures are keyboard-focusable labelled regions. Their
current result participates in the region description, while native table
markup remains outside any `role="img"` so row and cell semantics are
preserved. Measurement conservation uses different container proportions but
equal represented fill area for the same amount.

`rectangle-area-grid` uses a fixed visual scale: one cell side is one CSS `cm`
and never shrinks to fit additional rows or columns. Its viewport scrolls in
both directions when necessary. A CSS `cm` is based on the CSS reference pixel
on screens and is not a guarantee of one physical centimetre; exact physical
measurement would require device-specific calibration.

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
therefore B → A. Related links are non-directional in the presentation model:
if either concept declares the other, both concept inspectors expose the pair.
The model retains one normalized related edge for consumers that need it, but
the shared map layout does not render related edges. Related links are omitted
when the same pair already has a prerequisite edge, so the stronger
relationship is not announced twice.

The default map computes prerequisite depth at build time and places lower
depths above higher depths. Large layers wrap into compact rows, and stable
barycentric sweeps order neighbouring layers to reduce crossings. Titles,
locale order, pointer movement, and frame timing do not change the result.
Related knowledge appears as a selectable list in the chosen node's inspector
and article navigation instead of adding lines to the hierarchy.

A domain may provide optional `group` and localized `groupLabel` metadata for a
node. The build-time layout keeps same-rank groups contiguous and inserts extra
space at group boundaries. Consumers without semantic groups retain stable
fallback grouping and do not need to change their content schema.

`KnowledgeGraph` defaults to prerequisite-oriented navigation. A domain whose
content is contextual rather than curricular may set
`relationshipMode="contextual"` and provide localized `labels`. This changes
the visible vocabulary and reader navigation without reinterpreting a generic
`related` link as a verified historical influence or contemporaneous relation.
More specific claims belong in a domain-owned, sourced relation model rather
than in UI labels alone.

The browser enhancement pans, zooms, fits, selects, and switches to the list.
It runs continuous adaptive force calculation in a dedicated Web Worker and
transfers packed positions to the main thread. A stable layout uses a lower
update frequency but does not silently stop. The main-thread engine is retained
only as a compatibility fallback. Reduced-motion clients start with a static
view; the explicit resume button can still enable motion on request.

Prerequisite rank is a soft order force rather than a fixed Y coordinate. Node
repulsion, collision response, group cohesion, group separation, and weighted
relationship springs may therefore move nodes in both axes. Direct
prerequisite, direct contextual, and direct related pairs have descending
attraction strengths. Graph-distance-two and -three pairs receive progressively
weaker attraction; more distant or disconnected pairs receive none.
Distance-two and -three pairs use a deterministic per-node cap to keep dense
stars bounded. Prerequisite lines remain faintly visible; selecting a node
emphasizes its direct relationships. Related edges remain available through the
inspector/list without being added to the main hierarchy SVG.

Arrow keys pan the focused viewport, `+` and `-` zoom, and `Home` fits the
hierarchy. Touch users can pan and pinch-zoom. Consumers must render the shared
list view from the same model so every concept and concept URL remains available
without graph interaction or client JavaScript. Build-time placement is recorded
in [`0005-deterministic-knowledge-map.md`](./decisions/0005-deterministic-knowledge-map.md);
the continuous Worker and grouped-force design is recorded in
[`0006-continuous-grouped-knowledge-map-physics.md`](./decisions/0006-continuous-grouped-knowledge-map-physics.md).
