import {
  defineMdastPlugin,
  markdownToMdast,
  type MdastNode,
  type MdastPluginDefinition,
  type MdastVisitorContext,
} from "satteri";
import {
  ARTICLE_MATH_MAX_EXPRESSIONS,
  ARTICLE_MATH_MAX_TOTAL_LENGTH,
  articleMathProfileFor,
  renderArticleMath,
  validateArticleMath,
} from "./math-renderer.js";
import { segmentKanjiRuby, type KanjiRubySegment } from "./kanji-ruby.js";
import {
  createRectangleAreaGridDimensions,
  createRectangleAreaGridGeometry,
  RECTANGLE_AREA_GRID_MAX,
  RECTANGLE_AREA_GRID_MIN,
  rectangleAreaGridCssLength,
  rectangleAreaUnit,
} from "./rectangle-area-grid.js";
import {
  familyAllowedAttributes,
  isFamilyInteractiveKind,
  parseFamilyInteractiveConfig,
  type FamilyInteractiveConfig,
  type FamilyInteractiveKind,
} from "../interactives/family-contracts.js";
import { renderFamilyInteractive } from "./family-interactives.js";

export const ARTICLE_MARKDOWN_FEATURES = Object.freeze({ directive: true, math: true });

export interface ArticleDirectiveIssue {
  code:
    | "directive-limit"
    | "empty-directive-body"
    | "invalid-directive-attribute"
    | "invalid-directive-nesting"
    | "invalid-math"
    | "malformed-directive"
    | "math-limit"
    | "missing-directive-attribute"
    | "unknown-directive"
    | "unknown-directive-attribute"
    | "unknown-interactive-kind"
    | "unsafe-markdown-raw-html"
    | "wrong-directive-form";
  message: string;
  line?: number;
  column?: number;
}

type DirectiveNode = Extract<
  MdastNode,
  { type: "containerDirective" | "leafDirective" | "textDirective" }
>;

type NormalizedInteractiveDirective =
  | {
      kind: "interactive";
      interactiveKind: "rectangle-area-grid";
      caption: string;
      captionReading?: string;
      rows: number;
      columns: number;
      unit: "mm" | "cm" | "m";
    }
  | {
      kind: "interactive";
      interactiveKind: FamilyInteractiveKind;
      caption: string;
      captionReading?: string;
      familyConfig: FamilyInteractiveConfig;
    };

type NormalizedDirective =
  | { kind: "ruby"; base: string; reading: string; strong: boolean }
  | {
      kind: "callout";
      variant: "note" | "tip" | "warning" | "important";
      title?: string;
      titleReading?: string;
    }
  | { kind: "details"; summary: string; summaryReading?: string; open: boolean }
  | NormalizedInteractiveDirective;

interface Inspection {
  issues: ArticleDirectiveIssue[];
  normalized?: NormalizedDirective;
}

const DIRECTIVE_FORMS = {
  ruby: "textDirective",
  callout: "containerDirective",
  details: "containerDirective",
  interactive: "leafDirective",
} as const;

const CALLOUT_TYPES = ["note", "tip", "warning", "important"] as const;
const GRID_UNITS = ["mm", "cm", "m"] as const;
const MAX_DIRECTIVES = 256;
const MAX_INTERACTIVES = 8;
const RESERVED_DIRECTIVE_PATTERN = /:{1,4}(?:ruby|callout|details|interactive)\b/gu;
const DIRECTIVE_COUNT_DATA_KEY = "noethecaArticleDirectiveCounts";
const MATH_COUNT_DATA_KEY = "noethecaArticleMathCounts";
const SOURCE_LINES_DATA_KEY = "noethecaArticleSourceLines";

function isDirectiveNode(node: MdastNode): node is DirectiveNode {
  return (
    node.type === "containerDirective" ||
    node.type === "leafDirective" ||
    node.type === "textDirective"
  );
}

function position(node: DirectiveNode): Pick<ArticleDirectiveIssue, "line" | "column"> {
  return {
    line: node.position?.start.line,
    column: node.position?.start.column,
  };
}

function directiveIssue(
  node: DirectiveNode,
  code: ArticleDirectiveIssue["code"],
  message: string,
): ArticleDirectiveIssue {
  return { code, message, ...position(node) };
}

function textContent(node: MdastNode): string {
  if ("value" in node && typeof node.value === "string") {
    return node.value;
  }
  if ("children" in node && Array.isArray(node.children)) {
    return node.children.map((child) => textContent(child as MdastNode)).join("");
  }
  return "";
}

function plainTextLabel(node: DirectiveNode): string | undefined {
  if (
    node.children.length !== 1 ||
    node.children[0]?.type !== "text" ||
    typeof node.children[0].value !== "string"
  ) {
    return undefined;
  }
  return node.children[0].value;
}

function attributes(node: DirectiveNode): Record<string, string | null | undefined> {
  return node.attributes ?? {};
}

function validateAttributeNames(
  node: DirectiveNode,
  allowed: readonly string[],
  issues: ArticleDirectiveIssue[],
): void {
  for (const name of Object.keys(attributes(node))) {
    if (!allowed.includes(name)) {
      issues.push(
        directiveIssue(
          node,
          "unknown-directive-attribute",
          `Directive "${node.name}" does not allow attribute "${name}".`,
        ),
      );
    }
  }
}

function requiredAttribute(
  node: DirectiveNode,
  name: string,
  issues: ArticleDirectiveIssue[],
): string | undefined {
  const value = attributes(node)[name];
  if (typeof value !== "string" || value.length === 0) {
    issues.push(
      directiveIssue(
        node,
        "missing-directive-attribute",
        `Directive "${node.name}" requires attribute "${name}".`,
      ),
    );
    return undefined;
  }
  return value;
}

function optionalAttribute(
  node: DirectiveNode,
  name: string,
  issues: ArticleDirectiveIssue[],
): string | undefined {
  const value = attributes(node)[name];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.length === 0) {
    issues.push(
      directiveIssue(
        node,
        "invalid-directive-attribute",
        `Attribute "${name}" on directive "${node.name}" must be a non-empty string.`,
      ),
    );
    return undefined;
  }
  return value;
}

function validateSafeText(
  node: DirectiveNode,
  value: string | undefined,
  name: string,
  maximumLength: number,
  issues: ArticleDirectiveIssue[],
): value is string {
  if (value === undefined) {
    return false;
  }
  if (
    value.trim() !== value ||
    value.length > maximumLength ||
    /[<>\u0000-\u001f\u007f]/u.test(value)
  ) {
    issues.push(
      directiveIssue(
        node,
        "invalid-directive-attribute",
        `${name} on directive "${node.name}" contains disallowed characters or is too long.`,
      ),
    );
    return false;
  }
  return true;
}

function validateRubyReading(
  node: DirectiveNode,
  base: string | undefined,
  reading: string | undefined,
  name: string,
  issues: ArticleDirectiveIssue[],
): boolean {
  if (base === undefined || reading === undefined) {
    return false;
  }
  if (segmentKanjiRuby(base, reading) === undefined) {
    issues.push(
      directiveIssue(
        node,
        "invalid-directive-attribute",
        `${name} on directive "${node.name}" must give readings for Kanji while preserving kana, katakana, punctuation, numbers, and Latin text exactly.`,
      ),
    );
    return false;
  }
  return true;
}

function inspectDirective(
  node: DirectiveNode,
  parent: MdastNode | undefined,
): Inspection {
  const issues: ArticleDirectiveIssue[] = [];
  const expectedForm = DIRECTIVE_FORMS[node.name as keyof typeof DIRECTIVE_FORMS];
  if (!expectedForm) {
    issues.push(
      directiveIssue(node, "unknown-directive", `Unknown directive "${node.name}".`),
    );
    return { issues };
  }
  if (node.type !== expectedForm) {
    issues.push(
      directiveIssue(
        node,
        "wrong-directive-form",
        `Directive "${node.name}" must use ${expectedForm}.`,
      ),
    );
    return { issues };
  }

  if (node.name === "ruby") {
    validateAttributeNames(node, ["reading", "strong"], issues);
    const reading = requiredAttribute(node, "reading", issues);
    const strong = optionalAttribute(node, "strong", issues);
    const base = plainTextLabel(node);
    if (!base || base.length > 32 || /[\r\n<>]/u.test(base)) {
      issues.push(
        directiveIssue(
          node,
          "empty-directive-body",
          "Ruby text must contain one plain-text label of 1 to 32 characters.",
        ),
      );
    }
    const readingIsValid = validateSafeText(node, reading, "reading", 64, issues);
    const readingIsAligned =
      base !== undefined &&
      readingIsValid &&
      validateRubyReading(node, base, reading, "reading", issues);
    const strongIsValid =
      strong === undefined || strong === "true" || strong === "false";
    if (!strongIsValid) {
      issues.push(
        directiveIssue(
          node,
          "invalid-directive-attribute",
          "Ruby strong must be exactly true or false.",
        ),
      );
    }
    return base && readingIsAligned && strongIsValid
      ? {
          issues,
          normalized: {
            kind: "ruby",
            base,
            reading,
            strong: strong === "true",
          },
        }
      : { issues };
  }

  if (node.name === "callout") {
    validateAttributeNames(node, ["type", "title", "titleReading"], issues);
    const variant = requiredAttribute(node, "type", issues);
    const title = optionalAttribute(node, "title", issues);
    const titleReading = optionalAttribute(node, "titleReading", issues);
    const parentIsAllowed =
      parent?.type === "root" ||
      (parent?.type === "containerDirective" && parent.name === "details");
    if (!parentIsAllowed) {
      issues.push(
        directiveIssue(
          node,
          "invalid-directive-nesting",
          "Callout directives may appear only at article level or directly inside details.",
        ),
      );
    }
    if (textContent(node).trim().length === 0) {
      issues.push(
        directiveIssue(node, "empty-directive-body", "Callout body must not be empty."),
      );
    }
    const titleIsValid =
      title === undefined || validateSafeText(node, title, "title", 80, issues);
    const titleReadingIsValid =
      titleReading === undefined ||
      validateSafeText(node, titleReading, "titleReading", 120, issues);
    if (title === undefined && titleReading !== undefined) {
      issues.push(
        directiveIssue(
          node,
          "invalid-directive-attribute",
          "Callout titleReading requires an explicit title.",
        ),
      );
    }
    const titleReadingIsAligned =
      titleReading === undefined ||
      (title !== undefined &&
        titleIsValid &&
        titleReadingIsValid &&
        validateRubyReading(node, title, titleReading, "titleReading", issues));
    if (!CALLOUT_TYPES.includes(variant as (typeof CALLOUT_TYPES)[number])) {
      if (variant !== undefined) {
        issues.push(
          directiveIssue(
            node,
            "invalid-directive-attribute",
            `Callout type must be one of: ${CALLOUT_TYPES.join(", ")}.`,
          ),
        );
      }
      return { issues };
    }
    return parentIsAllowed &&
      titleIsValid &&
      titleReadingIsValid &&
      titleReadingIsAligned &&
      textContent(node).trim().length > 0
      ? {
          issues,
          normalized: {
            kind: "callout",
            variant: variant as (typeof CALLOUT_TYPES)[number],
            ...(title === undefined ? {} : { title }),
            ...(titleReading === undefined ? {} : { titleReading }),
          },
        }
      : { issues };
  }

  if (node.name === "details") {
    validateAttributeNames(node, ["summary", "summaryReading", "open"], issues);
    const summary = requiredAttribute(node, "summary", issues);
    const summaryReading = optionalAttribute(node, "summaryReading", issues);
    const open = optionalAttribute(node, "open", issues);
    const summaryIsValid = validateSafeText(node, summary, "summary", 120, issues);
    const summaryReadingIsValid =
      summaryReading === undefined ||
      validateSafeText(node, summaryReading, "summaryReading", 160, issues);
    const summaryReadingIsAligned =
      summaryReading === undefined ||
      (summaryIsValid &&
        summaryReadingIsValid &&
        validateRubyReading(node, summary, summaryReading, "summaryReading", issues));
    const openIsValid = open === undefined || open === "true" || open === "false";
    if (!openIsValid) {
      issues.push(
        directiveIssue(
          node,
          "invalid-directive-attribute",
          "Details open must be exactly true or false.",
        ),
      );
    }
    if (parent?.type !== "root") {
      issues.push(
        directiveIssue(
          node,
          "invalid-directive-nesting",
          "Details directives may appear only at article level.",
        ),
      );
    }
    if (textContent(node).trim().length === 0) {
      issues.push(
        directiveIssue(node, "empty-directive-body", "Details body must not be empty."),
      );
    }
    return summaryIsValid &&
      summaryReadingIsValid &&
      summaryReadingIsAligned &&
      openIsValid &&
      parent?.type === "root" &&
      textContent(node).trim()
      ? {
          issues,
          normalized: {
            kind: "details",
            summary,
            ...(summaryReading === undefined ? {} : { summaryReading }),
            open: open === "true",
          },
        }
      : { issues };
  }

  const interactiveKind = requiredAttribute(node, "kind", issues);
  const captionReading = optionalAttribute(node, "captionReading", issues);
  const caption = plainTextLabel(node);
  if (!caption || !validateSafeText(node, caption, "interactive label", 120, issues)) {
    issues.push(
      directiveIssue(
        node,
        "empty-directive-body",
        "Interactive directives require one plain-text label of 1 to 120 characters.",
      ),
    );
  }
  if (parent?.type !== "root") {
    issues.push(
      directiveIssue(
        node,
        "invalid-directive-nesting",
        "Interactive directives may appear only at article level.",
      ),
      );
  }
  const captionReadingIsValid =
    captionReading === undefined ||
    validateSafeText(node, captionReading, "captionReading", 180, issues);
  const captionReadingIsAligned =
    captionReading === undefined ||
    (caption !== undefined &&
      captionReadingIsValid &&
      validateRubyReading(node, caption, captionReading, "captionReading", issues));

  if (interactiveKind === "rectangle-area-grid") {
    validateAttributeNames(
      node,
      ["kind", "rows", "columns", "unit", "captionReading"],
      issues,
    );
    const rawRows = requiredAttribute(node, "rows", issues);
    const rawColumns = requiredAttribute(node, "columns", issues);
    const unit = requiredAttribute(node, "unit", issues);
    const integerPattern = /^(?:[1-9]|1[0-2])$/u;
    if (!rawRows || !integerPattern.test(rawRows)) {
      issues.push(
        directiveIssue(
          node,
          "invalid-directive-attribute",
          `Interactive rows must be an integer from ${RECTANGLE_AREA_GRID_MIN} to ${RECTANGLE_AREA_GRID_MAX}.`,
        ),
      );
    }
    if (!rawColumns || !integerPattern.test(rawColumns)) {
      issues.push(
        directiveIssue(
          node,
          "invalid-directive-attribute",
          `Interactive columns must be an integer from ${RECTANGLE_AREA_GRID_MIN} to ${RECTANGLE_AREA_GRID_MAX}.`,
        ),
      );
    }
    if (!GRID_UNITS.includes(unit as (typeof GRID_UNITS)[number])) {
      if (unit !== undefined) {
        issues.push(
          directiveIssue(
            node,
            "invalid-directive-attribute",
            `Interactive unit must be one of: ${GRID_UNITS.join(", ")}.`,
          ),
        );
      }
    }

    return caption &&
      captionReadingIsValid &&
      captionReadingIsAligned &&
      parent?.type === "root" &&
      rawRows !== undefined &&
      integerPattern.test(rawRows) &&
      rawColumns !== undefined &&
      integerPattern.test(rawColumns) &&
      GRID_UNITS.includes(unit as (typeof GRID_UNITS)[number])
      ? {
          issues,
          normalized: {
            kind: "interactive",
            interactiveKind,
            caption,
            ...(captionReading === undefined ? {} : { captionReading }),
            rows: Number(rawRows),
            columns: Number(rawColumns),
            unit: unit as (typeof GRID_UNITS)[number],
          },
        }
      : { issues };
  }

  if (interactiveKind !== undefined && isFamilyInteractiveKind(interactiveKind)) {
    const allowed = familyAllowedAttributes(interactiveKind);
    validateAttributeNames(node, allowed, issues);
    const familyAttributes = Object.fromEntries(
      Object.entries(attributes(node)).filter(([name]) => allowed.includes(name)),
    );
    const parsed = parseFamilyInteractiveConfig(interactiveKind, familyAttributes);
    for (const issue of parsed.issues) {
      issues.push(
        directiveIssue(node, "invalid-directive-attribute", issue.message),
      );
    }
    return caption &&
      captionReadingIsValid &&
      captionReadingIsAligned &&
      parent?.type === "root" &&
      parsed.config !== undefined &&
      issues.length === 0
      ? {
          issues,
          normalized: {
            kind: "interactive",
            interactiveKind,
            caption,
            ...(captionReading === undefined ? {} : { captionReading }),
            familyConfig: parsed.config,
          },
        }
      : { issues };
  }

  if (interactiveKind !== undefined) {
    issues.push(
      directiveIssue(
        node,
        "unknown-interactive-kind",
        `Unknown interactive kind "${interactiveKind}".`,
      ),
    );
  }
  return { issues };
}

export async function validateArticleDirectives(
  markdown: string,
): Promise<ArticleDirectiveIssue[]> {
  const tree = markdownToMdast(markdown, { features: ARTICLE_MARKDOWN_FEATURES });
  const issues: ArticleDirectiveIssue[] = [];
  const markdownLines = markdown.split(/\r?\n/u);
  const parsedDirectiveOffsets = new Set<number>();
  const literalRanges: Array<{ start: number; end: number }> = [];
  let directiveCount = 0;
  let interactiveCount = 0;
  let mathCount = 0;
  let totalMathLength = 0;
  const mathNodes: Array<Extract<MdastNode, { type: "math" | "inlineMath" }>> = [];

  function walk(node: MdastNode, parent?: MdastNode): void {
    if (node.type === "html") {
      issues.push({
        code: "unsafe-markdown-raw-html",
        message: "Markdown contains disallowed raw HTML.",
        line: node.position?.start.line,
        column: node.position?.start.column,
      });
    }
    if (node.type === "math" || node.type === "inlineMath") {
      mathCount += 1;
      totalMathLength += node.value.length;
      mathNodes.push(node);
    }
    if (isDirectiveNode(node)) {
      directiveCount += 1;
      if (node.position?.start.offset !== undefined) {
        parsedDirectiveOffsets.add(node.position.start.offset);
      }
      if (node.name === "interactive") {
        interactiveCount += 1;
      }
      issues.push(...inspectDirective(node, parent).issues);
      if (
        node.type === "containerDirective" &&
        node.position?.end.line !== undefined &&
        markdownLines[node.position.end.line - 1]?.trim() !== ":::"
      ) {
        issues.push(
          directiveIssue(
            node,
            "malformed-directive",
            `Container directive "${node.name}" must end with a closing ::: line.`,
          ),
        );
      }
    }
    if (
      (node.type === "code" || node.type === "inlineCode") &&
      node.position?.start.offset !== undefined &&
      node.position.end.offset !== undefined
    ) {
      literalRanges.push({
        start: node.position.start.offset,
        end: node.position.end.offset,
      });
    }
    if ("children" in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child as MdastNode, node);
      }
    }
  }

  walk(tree);
  if (mathCount > ARTICLE_MATH_MAX_EXPRESSIONS) {
    issues.push({
      code: "math-limit",
      message: `An article may contain at most ${ARTICLE_MATH_MAX_EXPRESSIONS} math expressions.`,
    });
  }
  if (totalMathLength > ARTICLE_MATH_MAX_TOTAL_LENGTH) {
    issues.push({
      code: "math-limit",
      message: `Math expressions may contain at most ${ARTICLE_MATH_MAX_TOTAL_LENGTH} characters in total.`,
    });
  }
  for (const node of mathNodes.slice(0, ARTICLE_MATH_MAX_EXPRESSIONS)) {
    const diagnostics = await validateArticleMath({
      tex: node.value,
      display: node.type === "math",
      profile: articleMathProfileFor(node.value),
    });
    for (const diagnostic of diagnostics) {
      issues.push({
        code: diagnostic.code === "math-too-long" ? "math-limit" : "invalid-math",
        message: diagnostic.message,
        line: node.position?.start.line,
        column: node.position?.start.column,
      });
    }
  }
  for (const match of markdown.matchAll(RESERVED_DIRECTIVE_PATTERN)) {
    const offset = match.index;
    const isLiteral = literalRanges.some(
      (range) => offset >= range.start && offset < range.end,
    );
    if (!isLiteral && !parsedDirectiveOffsets.has(offset)) {
      const before = markdown.slice(0, offset);
      const line = before.split(/\r?\n/u).length;
      const lastNewline = Math.max(before.lastIndexOf("\n"), before.lastIndexOf("\r"));
      issues.push({
        code: "malformed-directive",
        message: `Reserved directive syntax near "${match[0]}" is malformed. Put literal examples in code formatting.`,
        line,
        column: offset - lastNewline,
      });
    }
  }
  if (directiveCount > MAX_DIRECTIVES) {
    issues.push({
      code: "directive-limit",
      message: `An article may contain at most ${MAX_DIRECTIVES} directives.`,
    });
  }
  if (interactiveCount > MAX_INTERACTIVES) {
    issues.push({
      code: "directive-limit",
      message: `An article may contain at most ${MAX_INTERACTIVES} interactive directives.`,
    });
  }
  return issues;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function kanjiRubySegmentsOrThrow(
  base: string,
  reading: string,
): readonly KanjiRubySegment[] {
  const segments = segmentKanjiRuby(base, reading);
  if (!segments) {
    throw new Error("Invalid or ambiguous Kanji ruby reading.");
  }
  return segments;
}

function renderKanjiRubyHtml(base: string, reading: string): string {
  return kanjiRubySegmentsOrThrow(base, reading)
    .map((segment) =>
      segment.reading === undefined
        ? escapeHtml(segment.text)
        : `<ruby>${escapeHtml(segment.text)}<rp>（</rp><rt>${escapeHtml(segment.reading)}</rt><rp>）</rp></ruby>`,
    )
    .join("");
}

function kanjiRubyMdastChildren(base: string, reading: string): MdastNode[] {
  return kanjiRubySegmentsOrThrow(base, reading).map((segment) =>
    segment.reading === undefined
      ? { type: "text", value: segment.text }
      : {
          type: "emphasis",
          data: { hName: "ruby" },
          children: [
            { type: "text", value: segment.text },
            { type: "html", value: "<rp>（</rp>" },
            { type: "html", value: `<rt>${escapeHtml(segment.reading)}</rt>` },
            { type: "html", value: "<rp>）</rp>" },
          ],
        },
  ) as MdastNode[];
}

function localeFromContext(context: MdastVisitorContext): "ja" | "en" {
  const data = context.data as {
    astro?: { frontmatter?: { locale?: unknown } };
  };
  return data.astro?.frontmatter?.locale === "en" ? "en" : "ja";
}

function consumeMathBudget(
  node: Extract<MdastNode, { type: "math" | "inlineMath" }>,
  context: MdastVisitorContext,
): void {
  const data = context.data as Record<string, unknown>;
  const existing = data[MATH_COUNT_DATA_KEY];
  const counts =
    typeof existing === "object" &&
    existing !== null &&
    "expressions" in existing &&
    typeof existing.expressions === "number" &&
    "characters" in existing &&
    typeof existing.characters === "number"
      ? (existing as { expressions: number; characters: number })
      : { expressions: 0, characters: 0 };
  if (existing !== counts) {
    data[MATH_COUNT_DATA_KEY] = counts;
  }
  counts.expressions += 1;
  counts.characters += node.value.length;
  if (
    counts.expressions > ARTICLE_MATH_MAX_EXPRESSIONS ||
    counts.characters > ARTICLE_MATH_MAX_TOTAL_LENGTH
  ) {
    throw new Error(
      `Invalid article math at line ${node.position?.start.line ?? "?"}: article math limit exceeded.`,
    );
  }
}

function numberValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/u, "");
}

function renderGridLines(rows: number, columns: number): string {
  const geometry = createRectangleAreaGridGeometry(rows, columns);
  const background = `<rect x="${numberValue(geometry.x)}" y="${numberValue(geometry.y)}" width="${numberValue(geometry.width)}" height="${numberValue(geometry.height)}" />`;
  const vertical = Array.from({ length: columns + 1 }, (_, index) => {
    const x = geometry.x + index * geometry.cellSize;
    return `<line x1="${numberValue(x)}" y1="${numberValue(geometry.y)}" x2="${numberValue(x)}" y2="${numberValue(geometry.y + geometry.height)}" />`;
  });
  const horizontal = Array.from({ length: rows + 1 }, (_, index) => {
    const y = geometry.y + index * geometry.cellSize;
    return `<line x1="${numberValue(geometry.x)}" y1="${numberValue(y)}" x2="${numberValue(geometry.x + geometry.width)}" y2="${numberValue(y)}" />`;
  });
  return [background, ...vertical, ...horizontal].join("");
}

function renderGridDimensions(
  rows: number,
  columns: number,
  unit: string,
  locale: "ja" | "en",
): string {
  const labels =
    locale === "en"
      ? {
          columns: `Width ${columns} ${unit}`,
          rows: `Height ${rows} ${unit}`,
          "unit-column": `1 ${unit}`,
          "unit-row": `1 ${unit}`,
        }
      : {
          columns: `横（よこ） ${columns} ${unit}`,
          rows: `縦（たて） ${rows} ${unit}`,
          "unit-column": `1 ${unit}`,
          "unit-row": `1 ${unit}`,
        };
  return createRectangleAreaGridDimensions(rows, columns)
    .map((dimension) => {
      const transform =
        dimension.rotate === undefined
          ? ""
          : ` transform="rotate(${dimension.rotate} ${numberValue(dimension.labelX)} ${numberValue(dimension.labelY)})"`;
      const modifier = dimension.kind.startsWith("unit-") ? "unit" : "overall";
      return `<path class="ke-interactive__dimension-bracket" data-grid-dimension="${dimension.kind}" d="${dimension.path}" /><text class="ke-interactive__dimension-label ke-interactive__dimension-label--${modifier}" x="${numberValue(dimension.labelX)}" y="${numberValue(dimension.labelY)}" text-anchor="middle" dominant-baseline="middle"${transform}>${escapeHtml(labels[dimension.kind])}</text>`;
    })
    .join("");
}

async function renderRectangleAreaGrid(
  directive: Extract<
    NormalizedInteractiveDirective,
    { interactiveKind: "rectangle-area-grid" }
  >,
  locale: "ja" | "en",
  instanceKey: string,
): Promise<string> {
  const { rows, columns, unit, caption, captionReading } = directive;
  const area = rows * columns;
  const areaUnit = rectangleAreaUnit(unit);
  const rowsId = `ke-grid-${instanceKey}-rows`;
  const columnsId = `ke-grid-${instanceKey}-columns`;
  const unitId = `ke-grid-${instanceKey}-unit`;
  const titleId = `ke-grid-${instanceKey}-title`;
  const descriptionId = `ke-grid-${instanceKey}-description`;
  const numberToggleId = `ke-grid-${instanceKey}-numbers`;
  const numberHelpId = `ke-grid-${instanceKey}-numbers-help`;
  const scaleNoteId = `ke-grid-${instanceKey}-scale-note`;
  const geometry = createRectangleAreaGridGeometry(rows, columns);
  const unitMath = await renderArticleMath({
    tex: `1\\,\\mathrm{${unit}} \\times 1\\,\\mathrm{${unit}} = 1\\,\\mathrm{${unit}}^2`,
    display: true,
    profile: "core",
    locale,
  });
  const calculationMath = await renderArticleMath({
    tex: `${rows} \\times ${columns} = ${area}`,
    display: false,
    profile: "core",
    locale,
  });
  const areaMath = await renderArticleMath({
    tex: `${area}\\,\\mathrm{${unit}}^2`,
    display: false,
    profile: "core",
    locale,
  });
  const labels =
    locale === "en"
      ? {
          rows: "Height",
          columns: "Width",
          rowsHtml: "Height",
          columnsHtml: "Width",
          reset: "Reset",
          numberToggle: "Show a number in every cell",
          numberHelp: "Numbers run from 1 at the top left to the total number of cells.",
          unitCell: `Each cell: 1 ${unit} high × 1 ${unit} wide (area 1 ${areaUnit})`,
          description: `${rows} ${unit} high, ${columns} ${unit} wide, area ${area} ${areaUnit}.`,
          dimensionDescription: `The top and left brackets show the whole rectangle. The brackets beside the bottom-right cell show that each side of one cell is 1 ${unit}.`,
          formula: `<span data-grid-calculation>${calculationMath.markup}</span>; the area is <span data-grid-area>${areaMath.markup}</span>.`,
          unitLead: "Each cell",
          scaleNote:
            "Every cell keeps the same visual size when the row or column count changes. Scroll the diagram when it is larger than its frame. It uses 1 CSS cm per cell side; device resolution and zoom mean this is not guaranteed to be one physical centimetre.",
          viewportLabel: "Fixed-scale rectangle grid; scroll horizontally or vertically when needed",
        }
      : {
          rows: "縦",
          columns: "横",
          rowsHtml: renderKanjiRubyHtml("縦", "たて"),
          columnsHtml: renderKanjiRubyHtml("横", "よこ"),
          reset: renderKanjiRubyHtml("初期値に戻す", "しょきちにもどす"),
          numberToggle: renderKanjiRubyHtml(
            "各マスに番号を表示",
            "かくマスにばんごうをひょうじ",
          ),
          numberHelp: "左上から右へ順に、1からマスの総数まで表示します。",
          unitCell: `1マス：縦 1 ${unit} × 横 1 ${unit}（面積 1 ${areaUnit}）`,
          description: `縦 ${rows} ${unit}、横 ${columns} ${unit}、面積 ${area} ${areaUnit}の長方形。`,
          dimensionDescription: `上と左の括弧は長方形全体の長さを表し、右下の1マスに付いた括弧は1辺が1 ${unit}であることを表します。`,
          formula: `<span data-grid-calculation>${calculationMath.markup}</span> より、${renderKanjiRubyHtml("面積", "めんせき")}は <span data-grid-area>${areaMath.markup}</span>です。`,
          unitLead: "1マス",
          scaleNote: `1マスの大きさは、${renderKanjiRubyHtml("縦", "たて")}や${renderKanjiRubyHtml("横", "よこ")}の数を変えても変わりません。図が大きいときは、上下左右に動かして見られます。<small>画面では 1 CSS cm で${renderKanjiRubyHtml("表示", "ひょうじ")}します。機器や${renderKanjiRubyHtml("拡大率", "かくだいりつ")}によって、実物の 1 cm とは同じにならないことがあります。</small>`,
          viewportLabel: "大きさを固定した長方形の図。必要なときは上下左右にスクロールできます",
        };

  return `<figure class="ke-interactive" data-noetheca-interactive="rectangle-area-grid" data-initial-rows="${rows}" data-initial-columns="${columns}" data-unit="${unit}" data-locale="${locale}">
<figcaption>${
    captionReading === undefined
      ? escapeHtml(caption)
      : renderKanjiRubyHtml(caption, captionReading)
  }</figcaption>
<div class="ke-interactive__controls" data-interactive-controls hidden>
<div class="ke-interactive__control"><div class="ke-interactive__control-heading"><label for="${rowsId}">${labels.rowsHtml}</label><output for="${rowsId}" data-grid-output="rows">${rows} ${unit}</output></div><input id="${rowsId}" type="range" min="${RECTANGLE_AREA_GRID_MIN}" max="${RECTANGLE_AREA_GRID_MAX}" value="${rows}" step="1" aria-valuetext="${rows} ${unit}" aria-describedby="${unitId}" data-grid-input="rows"></div>
<div class="ke-interactive__control"><div class="ke-interactive__control-heading"><label for="${columnsId}">${labels.columnsHtml}</label><output for="${columnsId}" data-grid-output="columns">${columns} ${unit}</output></div><input id="${columnsId}" type="range" min="${RECTANGLE_AREA_GRID_MIN}" max="${RECTANGLE_AREA_GRID_MAX}" value="${columns}" step="1" aria-valuetext="${columns} ${unit}" aria-describedby="${unitId}" data-grid-input="columns"></div>
<button type="button" data-grid-reset>${labels.reset}</button>
<div class="ke-interactive__number-toggle"><input id="${numberToggleId}" type="checkbox" aria-describedby="${numberHelpId}" data-grid-number-toggle><label for="${numberToggleId}">${labels.numberToggle}</label><span id="${numberHelpId}" class="visually-hidden">${labels.numberHelp}</span></div>
</div>
<div id="${unitId}" class="ke-interactive__unit" data-grid-unit><span>${labels.unitLead}</span><div data-grid-unit-math>${unitMath.markup}</div></div>
<p id="${scaleNoteId}" class="ke-interactive__scale-note">${labels.scaleNote}</p>
<div class="ke-interactive__viewport" data-grid-viewport role="region" tabindex="0" aria-label="${escapeHtml(labels.viewportLabel)}" aria-describedby="${scaleNoteId}"><div class="ke-interactive__stage">
<svg class="ke-interactive__svg" data-grid-svg viewBox="0 0 ${numberValue(geometry.canvasWidth)} ${numberValue(geometry.canvasHeight)}" width="${rectangleAreaGridCssLength(geometry.canvasWidth)}" height="${rectangleAreaGridCssLength(geometry.canvasHeight)}" role="img" aria-labelledby="${titleId} ${descriptionId}">
<title id="${titleId}">${escapeHtml(labels.description)}</title><desc id="${descriptionId}">${escapeHtml(`${labels.unitCell} ${labels.dimensionDescription}`)}</desc>
<g class="ke-interactive__grid" data-grid-lines>${renderGridLines(rows, columns)}</g>
<g class="ke-interactive__dimensions" data-grid-dimensions aria-hidden="true">${renderGridDimensions(rows, columns, unit, locale)}</g>
<g class="ke-interactive__cell-numbers" data-grid-cell-numbers aria-hidden="true"></g>
</svg></div></div>
<p class="ke-interactive__result" data-grid-result aria-live="polite">${labels.formula}</p>
<p class="visually-hidden" data-grid-number-status aria-live="polite"></p>
</figure>`;
}

function normalizedOrThrow(
  node: DirectiveNode,
  context: MdastVisitorContext,
): NormalizedDirective {
  const data = context.data as Record<string, unknown>;
  const existingCounts = data[DIRECTIVE_COUNT_DATA_KEY];
  const counts =
    typeof existingCounts === "object" &&
    existingCounts !== null &&
    "directives" in existingCounts &&
    typeof existingCounts.directives === "number" &&
    "interactives" in existingCounts &&
    typeof existingCounts.interactives === "number"
      ? existingCounts
      : { directives: 0, interactives: 0 };
  const typedCounts = counts as { directives: number; interactives: number };
  if (counts !== existingCounts) {
    data[DIRECTIVE_COUNT_DATA_KEY] = typedCounts;
  }
  typedCounts.directives += 1;
  if (node.name === "interactive") {
    typedCounts.interactives += 1;
  }
  if (
    typedCounts.directives > MAX_DIRECTIVES ||
    typedCounts.interactives > MAX_INTERACTIVES
  ) {
    throw new Error(
      `Invalid article directive at line ${node.position?.start.line ?? "?"}: directive limit exceeded.`,
    );
  }

  const existingLines = data[SOURCE_LINES_DATA_KEY];
  const sourceLines = Array.isArray(existingLines)
    ? (existingLines as string[])
    : context.source.split(/\r?\n/u);
  if (sourceLines !== existingLines) {
    data[SOURCE_LINES_DATA_KEY] = sourceLines;
  }

  if (
    node.type === "containerDirective" &&
    node.position?.end.line !== undefined &&
    sourceLines[node.position.end.line - 1]?.trim() !== ":::"
  ) {
    throw new Error(
      `Invalid article directive at line ${node.position.start.line}: container directive "${node.name}" is not closed.`,
    );
  }
  const inspected = inspectDirective(node, context.parent(node));
  if (!inspected.normalized || inspected.issues.length > 0) {
    const detail = inspected.issues.map(({ message }) => message).join(" ");
    throw new Error(`Invalid article directive at line ${node.position?.start.line ?? "?"}: ${detail}`);
  }
  return inspected.normalized;
}

export function createArticleDirectivePlugin(): MdastPluginDefinition {
  function rejectUnsafeUrl(
    url: string,
    line: number | undefined,
    kind: string,
  ): void {
    if (/^\s*(?:javascript|data):/iu.test(url)) {
      throw new Error(
        `Invalid article Markdown at line ${line ?? "?"}: ${kind} uses a disallowed URL scheme.`,
      );
    }
  }

  return defineMdastPlugin({
    name: "noetheca-article-directives",
    html(node) {
      throw new Error(
        `Invalid article Markdown at line ${node.position?.start.line ?? "?"}: raw HTML is not allowed.`,
      );
    },
    link(node) {
      rejectUnsafeUrl(node.url, node.position?.start.line, "link");
    },
    image(node) {
      rejectUnsafeUrl(node.url, node.position?.start.line, "image");
    },
    definition(node) {
      rejectUnsafeUrl(node.url, node.position?.start.line, "definition");
    },
    async math(node, context) {
      consumeMathBudget(node, context);
      try {
        const result = await renderArticleMath({
          tex: node.value,
          display: true,
          profile: articleMathProfileFor(node.value),
          locale: localeFromContext(context),
        });
        context.replaceNode(node, { type: "html", value: result.markup });
      } catch {
        throw new Error(
          `Invalid article math at line ${node.position?.start.line ?? "?"}.`,
        );
      }
    },
    async inlineMath(node, context) {
      consumeMathBudget(node, context);
      try {
        const result = await renderArticleMath({
          tex: node.value,
          display: false,
          profile: articleMathProfileFor(node.value),
          locale: localeFromContext(context),
        });
        context.replaceNode(node, { type: "html", value: result.markup });
      } catch {
        throw new Error(
          `Invalid article math at line ${node.position?.start.line ?? "?"}.`,
        );
      }
    },
    textDirective(node, context) {
      const directive = normalizedOrThrow(node, context);
      if (directive.kind !== "ruby") {
        throw new Error(`Unexpected text directive "${node.name}".`);
      }
      context.setProperty(node, "data", {
        hName: directive.strong ? "strong" : "span",
      });
      context.setProperty(
        node,
        "children",
        kanjiRubyMdastChildren(directive.base, directive.reading),
      );
    },
    containerDirective(node, context) {
      const directive = normalizedOrThrow(node, context);
      if (directive.kind === "callout") {
        const locale = localeFromContext(context);
        const defaultLabels =
          locale === "en"
            ? { note: "Note", tip: "Tip", warning: "Caution", important: "Important" }
            : { note: "補足", tip: "ヒント", warning: "注意", important: "重要" };
        const defaultReadings =
          locale === "en"
            ? undefined
            : { note: "ほそく", tip: undefined, warning: "ちゅうい", important: "じゅうよう" };
        const icons = { note: "i", tip: "◆", warning: "!", important: "!!" };
        const title = directive.title ?? defaultLabels[directive.variant];
        const titleReading =
          directive.titleReading ??
          (directive.title === undefined
            ? defaultReadings?.[directive.variant]
            : undefined);
        context.setProperty(node, "data", {
          hName: "aside",
          hProperties: {
            className: ["ke-callout", `ke-callout--${directive.variant}`],
            role: "note",
            "aria-label": title,
          },
        });
        context.prependChild(node, {
          type: "html",
          value: `<p class="ke-callout__title"><span aria-hidden="true">${icons[directive.variant]}</span>${
            titleReading === undefined
              ? escapeHtml(title)
              : renderKanjiRubyHtml(title, titleReading)
          }</p>`,
        });
        return;
      }
      if (directive.kind === "details") {
        context.setProperty(node, "data", {
          hName: "details",
          hProperties: {
            className: ["ke-details"],
            ...(directive.open ? { open: true } : {}),
          },
        });
        context.prependChild(node, {
          type: "html",
          value: `<summary>${
            directive.summaryReading === undefined
              ? escapeHtml(directive.summary)
              : renderKanjiRubyHtml(directive.summary, directive.summaryReading)
          }</summary>`,
        });
        return;
      }
      throw new Error(`Unexpected container directive "${node.name}".`);
    },
    async leafDirective(node, context) {
      const directive = normalizedOrThrow(node, context);
      if (directive.kind !== "interactive") {
        throw new Error(`Unexpected leaf directive "${node.name}".`);
      }
      const instanceKey = `${node.position?.start.line ?? 0}-${node.position?.start.column ?? 0}`;
      const locale = localeFromContext(context);
      if (directive.interactiveKind !== "rectangle-area-grid") {
        context.replaceNode(node, {
          type: "html",
          value: await renderFamilyInteractive(directive.familyConfig, {
            captionHtml:
              directive.captionReading === undefined
                ? escapeHtml(directive.caption)
                : renderKanjiRubyHtml(directive.caption, directive.captionReading),
            instanceKey,
            locale,
          }),
        });
        return;
      }
      context.replaceNode(node, {
        type: "html",
        value: await renderRectangleAreaGrid(
          directive,
          locale,
          instanceKey,
        ),
      });
    },
  });
}
