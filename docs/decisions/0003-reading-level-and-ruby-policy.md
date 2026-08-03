# ADR 0003: locale reading level and curriculum-based ruby

- Status: accepted for the prototype
- Date: 2026-08-01

## Decision

Allow locale Markdown frontmatter to declare an optional reading level:

```yaml
readingLevel:
  curriculum: jp-mext-2017
  grade: 4
```

`curriculum` is a lowercase machine ID and `grade` is an integer from 1
through 12. The value describes the minimum school grade for which that
translation's wording is prepared. It is neither an age restriction nor a
knowledge-graph prerequisite.

For `jp-mext-2017`, use MEXT's grade-by-grade kanji allocation as the baseline.
Kanji assigned after the target grade, or absent from the elementary-school
allocation, receive ruby on every occurrence by default. Kanji assigned to the
target grade receive ruby on first occurrence. Earlier-grade kanji do not
receive ruby by default. Paired terms such as `縦・横` receive ruby together
when annotating only one side would make the relation harder to read.

Ruby remains explicitly authored with the registered `ruby` directive. The
prototype does not guess readings or require ruby on every kanji.

The renderer places ruby only over consecutive Kanji runs. Okurigana,
hiragana, katakana, punctuation, numbers, and Latin text stay outside the
`ruby` element. Authors normally provide the full reading while preserving
those non-Kanji characters verbatim. If that correspondence is ambiguous, they
provide `|`-separated readings for the Kanji runs instead of asking the engine
to guess a boundary.

## Why

Reading difficulty is locale- and curriculum-specific, so it does not belong
in language-independent `concept.yaml`. A structured value lets validation,
authoring guidance, and page presentation use the same declared baseline
without turning an article into an age-segregated resource.

MEXT assigns kanji by school grade but does not define the point within a grade
when each character has been learned. First-use ruby for the target grade and
broader author discretion account for that uncertainty.

## Consequences

- CLI and domain content schemas reject malformed curriculum IDs, fractional
  grades, and grades outside 1 through 12.
- Domain pages may present a small localized reading-level label. Unknown
  curriculum IDs use a generic label rather than an inferred school-system
  name.
- Authors must check headings, directive labels, diagrams, controls, and source
  presentation as well as prose when applying the ruby policy.
- Automated kanji-allocation linting and inclusion of reading level in the
  public manifest remain deferred.

## References

- [MEXT Elementary School Curriculum Guidelines (2017 notification)](https://www.mext.go.jp/content/20230120-mxt_kyoiku02-100002604_01.pdf)
- [MEXT Textbook Authorization Standards for Compulsory Education Schools](https://www.mext.go.jp/a_menu/shotou/kyoukasho/kentei/1343945.htm)
