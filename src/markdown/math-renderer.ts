import katex from "katex";
import "katex/contrib/mhchem";

export type ArticleMathProfile = "core" | "chemistry";

export interface ArticleMathRequest {
  tex: string;
  display: boolean;
  profile: ArticleMathProfile;
  locale?: string;
}

export interface ArticleMathDiagnostic {
  code: "empty-math" | "forbidden-command" | "invalid-tex" | "math-too-long";
  message: string;
}

export interface ArticleMathResult {
  markup: string;
  kind: "html+mathml";
  assets: readonly { kind: "style"; id: "katex-css" }[];
}

export interface ArticleMathRenderer {
  readonly id: string;
  supports(profile: ArticleMathProfile): boolean;
  validate(request: ArticleMathRequest): Promise<readonly ArticleMathDiagnostic[]>;
  render(request: ArticleMathRequest): Promise<ArticleMathResult>;
}

export const ARTICLE_MATH_MAX_EXPRESSION_LENGTH = 2_048;
export const ARTICLE_MATH_MAX_EXPRESSIONS = 200;
export const ARTICLE_MATH_MAX_TOTAL_LENGTH = 20_000;

const FORBIDDEN_COMMAND = /\\(?:csname|def|edef|eqref|futurelet|gdef|global|href|htmlClass|htmlData|htmlId|htmlStyle|includegraphics|label|let|newcommand|providecommand|ref|renewcommand|require|tag|url|xdef)\b/u;
const CHEMISTRY_COMMAND = /\\(?:ce|pu)\b/u;

export class ArticleMathRenderError extends Error {
  constructor() {
    super("The article contains an invalid or disallowed math expression.");
    this.name = "ArticleMathRenderError";
  }
}

function renderWithKatex(request: ArticleMathRequest): string {
  const trustedCommands: string[] = [];
  let markup: string;
  try {
    markup = katex.renderToString(request.tex, {
      displayMode: request.display,
      output: "htmlAndMathml",
      throwOnError: true,
      strict: "error",
      trust(context) {
        trustedCommands.push(context.command);
        return false;
      },
      maxSize: 20,
      maxExpand: 1_000,
      globalGroup: false,
      macros: {},
    });
  } catch {
    throw new ArticleMathRenderError();
  }
  if (trustedCommands.length > 0) {
    throw new ArticleMathRenderError();
  }
  return markup;
}

function basicDiagnostics(request: ArticleMathRequest): ArticleMathDiagnostic[] {
  const diagnostics: ArticleMathDiagnostic[] = [];
  if (request.tex.trim().length === 0) {
    diagnostics.push({ code: "empty-math", message: "Math expressions must not be empty." });
  }
  if (request.tex.length > ARTICLE_MATH_MAX_EXPRESSION_LENGTH) {
    diagnostics.push({
      code: "math-too-long",
      message: `A math expression may contain at most ${ARTICLE_MATH_MAX_EXPRESSION_LENGTH} characters.`,
    });
  }
  if (FORBIDDEN_COMMAND.test(request.tex)) {
    diagnostics.push({
      code: "forbidden-command",
      message: "Math expressions may not define macros, load packages, create links, inject HTML, or manage equation references.",
    });
  }
  if (request.profile === "core" && CHEMISTRY_COMMAND.test(request.tex)) {
    diagnostics.push({
      code: "forbidden-command",
      message: "Chemical equation commands require the chemistry math profile.",
    });
  }
  return diagnostics;
}

export const defaultArticleMathRenderer: ArticleMathRenderer = {
  id: `katex-${katex.version}`,
  supports(profile) {
    return profile === "core" || profile === "chemistry";
  },
  async validate(request) {
    const diagnostics = basicDiagnostics(request);
    if (diagnostics.length > 0) {
      return diagnostics;
    }
    try {
      renderWithKatex(request);
      return [];
    } catch {
      return [{ code: "invalid-tex", message: "The math expression is invalid or unsupported." }];
    }
  },
  async render(request) {
    if (basicDiagnostics(request).length > 0) {
      throw new ArticleMathRenderError();
    }
    const rendered = renderWithKatex(request);
    return {
      markup: request.display
        ? `<div class="ke-math ke-math--display">${rendered}</div>`
        : `<span class="ke-math ke-math--inline">${rendered}</span>`,
      kind: "html+mathml",
      assets: [{ kind: "style", id: "katex-css" }],
    };
  },
};

export function articleMathProfileFor(tex: string): ArticleMathProfile {
  return CHEMISTRY_COMMAND.test(tex) ? "chemistry" : "core";
}

export function validateArticleMath(
  request: ArticleMathRequest,
  renderer: ArticleMathRenderer = defaultArticleMathRenderer,
): Promise<readonly ArticleMathDiagnostic[]> {
  return renderer.validate(request);
}

export function renderArticleMath(
  request: ArticleMathRequest,
  renderer: ArticleMathRenderer = defaultArticleMathRenderer,
): Promise<ArticleMathResult> {
  return renderer.render(request);
}
