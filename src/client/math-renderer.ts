type KatexModule = typeof import("katex");

let katexModule: Promise<KatexModule> | undefined;

function loadKatex(): Promise<KatexModule> {
  katexModule ??= import("katex");
  return katexModule;
}

export async function renderClientMath(
  element: HTMLElement,
  tex: string,
  displayMode = false,
  isCurrent: () => boolean = () => true,
): Promise<void> {
  const { default: katex } = await loadKatex();
  if (!isCurrent()) {
    return;
  }
  const trustedCommands: string[] = [];
  katex.render(tex, element, {
    displayMode,
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
  if (trustedCommands.length > 0) {
    element.replaceChildren();
    throw new Error("Generated interactive math used a disallowed command.");
  }
}
