# AGENTS.md

Read the organization project brief before implementation:
`https://github.com/noetheca/.github/blob/main/docs/PROJECT_BRIEF.md`.

## Repository responsibilities

- Own shared content parsing, validation, manifest generation, UI primitives,
  and static-build conventions.
- Do not add domain knowledge content here.
- Keep the engine usable by multiple domain repositories.

## Constraints

- Prefer static generation, minimal client JavaScript, and small dependencies.
- Never execute code from content files.
- Reject or sanitize raw HTML; MDX is out of scope for the initial milestone.
- Keep knowledge IDs and relationships independent from locale, title, path,
  and URL.
- Do not finalize schema, URL, UI, or license choices without an explicit
  decision record.
- Add tests for behavior changes and update the content contract.
- Pin production dependencies and GitHub Actions.
