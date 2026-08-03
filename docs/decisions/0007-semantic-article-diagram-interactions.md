# ADR 0007: semantic interactions for article diagrams

- Status: accepted
- Date: 2026-08-03

## Context

ADR 0002 adopted allowlisted Markdown directives, bounded interactive
families, useful build-time figures, and native controls. The initial family
implementations proved the delivery and security model, but an interactive can
still be technically operable while failing to demonstrate the article's
learning objective. Examples include rotating two congruent figures together,
showing a permanently balanced unknown equation, or exposing independent water
levels where the caption promises pouring.

Elementary diagrams also need consistent direct manipulation, touch target
sizes, dimensions, units, fixed-scale scrolling, ruby, and rendered
mathematics. Adding author-supplied scene JSON or executable components would
weaken the security and review properties already accepted in ADR 0002.

## Existing decisions retained

The following parts of ADR 0002 remain accepted:

- articles use the registered `interactive` directive and finite kinds;
- article data cannot contain code, component paths, coordinates, SVG paths,
  styles, or event handlers;
- the engine owns validation, SSR fallback, controls, client enhancement, and
  accessibility;
- native controls are required, and direct pointer manipulation supplements
  rather than replaces them; and
- a new kind or directive remains a schema change requiring a separate
  accepted decision and integration tests.

## Decision

1. Extend an existing family with an enumerated mode when the visual vocabulary
   and bounded state fit that family. Do not create a new directive for each
   article.
2. Give each registered mode an engine-owned semantic interaction contract:
   its named state, bounds, native controls, optional actions, visible result,
   and optional direct-manipulation mapping.
3. Route range, button, keyboard, pointer, and touch changes through the same
   normalized state update. The concrete drawing, visible values, formulae,
   units, and live status must derive from that state.
4. Use controls named for the mathematical meaning, such as “cross-section
   position” or “number in the box”, rather than generic storage names. Pointer
   targets should be at least 44 by 44 CSS pixels even when the visible handle
   is smaller.
5. Preserve scale when displayed size carries meaning. Such figures scroll
   instead of fitting their cells or units to the viewport. Abstract figures
   may scale responsively when no visual length is used as evidence.
6. Keep the build-time state complete: caption, initial drawing, dimensions,
   units, and initial result remain understandable without JavaScript.
7. Let domain repositories maintain a small concept-to-expected-mode audit for
   known semantic risks. Expectations for modes not yet implemented are
   advisory warnings. They become required only when the mode contract and
   renderer are accepted and available.

Provisional mode names recorded by an advisory audit are design candidates,
not additions to the content schema. Their final spelling and attributes must
be accepted together with implementation, validation, fallback, and tests.

## Why this decision

A bounded semantic contract keeps article review at the level of learning
intent while retaining the security boundary of registered engine code. Shared
state prevents a slider, diagram, formula, and assistive output from describing
different values. Native controls preserve keyboard and non-pointer access;
direct manipulation gives elementary readers the concrete action promised by
the caption.

The advisory-to-required transition allows content audits to record known
mismatches without breaking CI before the corresponding engine mode exists.

## Acceptance evidence

The shared rectangle-area example and the elementary family implementations
demonstrate the following:

- every exposed control changes the drawing or its mathematical result;
- pointer, touch, and keyboard paths reach the same tested state;
- operation targets meet the 44 CSS pixel hit-area rule;
- SSR output communicates the initial state without client code;
- mathematical results continue to use the article math renderer after input;
- Japanese UI follows the article ruby policy;
- fixed-scale examples scroll without resizing their semantic unit; and
- the domain audit can distinguish required failures from unimplemented-mode
  warnings.

## Consequences

- Mode implementations need pure semantic models or equivalent shared state
  tests in addition to visual rendering code.
- A figure that merely moves is not sufficient; article caption, control, state
  change, and result must express the same relationship.
- Static diagrams remain appropriate for fixed proof configurations and
  supplementary illustrations, but not as substitutes for a variable relation
  that the reader is expected to test.
- No new authoring directive is introduced by this decision.
