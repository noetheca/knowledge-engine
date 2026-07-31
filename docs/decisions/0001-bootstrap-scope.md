# ADR 0001: bootstrap as one small engine package

- Status: accepted for the prototype
- Date: 2026-07-31

## Decision

Start with one package containing validation, manifest generation, and minimal
Astro presentation primitives. Do not split core, CLI, and Astro integration
into separately versioned packages yet.

Use TypeScript for executable engine code. Keep rendered content in plain
Markdown and prohibit MDX in the initial milestone.

## Why

The first goal is an end-to-end slice with one domain. Multiple packages would
introduce publication, versioning, and cross-repository dependency decisions
before the schema and user experience have been validated.

## Deferred

- npm publication and package naming stability;
- final public URL format;
- full-text search;
- interactive graph library;
- code and content licenses.
