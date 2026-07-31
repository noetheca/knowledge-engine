#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createManifest } from "./manifest.js";
import { loadKnowledgeBase } from "./load.js";
import type { ValidationIssue } from "./types.js";

function usage(): never {
  console.error(`Usage:
  noetheca-knowledge validate <content-root>
  noetheca-knowledge manifest <content-root> <output-file>`);
  process.exit(2);
}

function printIssue(issue: ValidationIssue): void {
  const location = issue.file ? `${issue.file}: ` : "";
  const stream = issue.severity === "error" ? console.error : console.warn;
  stream(`${issue.severity.toUpperCase()} [${issue.code}] ${location}${issue.message}`);
}

async function main(): Promise<void> {
  const [, , command, rootArgument, outputArgument] = process.argv;
  if (!command || !rootArgument) {
    usage();
  }

  const knowledgeBase = await loadKnowledgeBase(resolve(rootArgument));
  for (const validationIssue of knowledgeBase.issues) {
    printIssue(validationIssue);
  }

  const errorCount = knowledgeBase.issues.filter(
    ({ severity }) => severity === "error",
  ).length;
  if (errorCount > 0) {
    console.error(
      `Validation failed with ${errorCount} error(s) across ${knowledgeBase.concepts.length} concept(s).`,
    );
    process.exitCode = 1;
    return;
  }

  if (command === "validate") {
    console.log(`Validated ${knowledgeBase.concepts.length} concept(s).`);
    return;
  }

  if (command === "manifest") {
    if (!outputArgument) {
      usage();
    }
    const output = resolve(outputArgument);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(
      output,
      `${JSON.stringify(createManifest(knowledgeBase), null, 2)}\n`,
      "utf8",
    );
    console.log(`Wrote manifest for ${knowledgeBase.concepts.length} concept(s) to ${output}.`);
    return;
  }

  usage();
}

await main();
