import {
  createRectangleAreaGridCellLabels,
  createRectangleAreaGridDimensions,
  createRectangleAreaGridGeometry,
  RECTANGLE_AREA_GRID_MAX,
  RECTANGLE_AREA_GRID_MIN,
  rectangleAreaGridCssLength,
  rectangleAreaUnit,
} from "../markdown/rectangle-area-grid.js";
import { renderClientMath } from "./math-renderer.js";
import { initializeFamilyInteractives } from "./family-interactives.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function clampGridValue(value: number): number {
  return Math.min(
    RECTANGLE_AREA_GRID_MAX,
    Math.max(RECTANGLE_AREA_GRID_MIN, Math.round(value)),
  );
}

function svgElement<K extends keyof SVGElementTagNameMap>(
  name: K,
  attributes: Record<string, string> = {},
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NAMESPACE, name);
  for (const [attribute, value] of Object.entries(attributes)) {
    element.setAttribute(attribute, value);
  }
  return element;
}

function copyFor(
  locale: string,
  rows: number,
  columns: number,
  unit: string,
  showNumbers: boolean,
): {
  rows: string;
  columns: string;
  description: string;
  unitCell: string;
  dimensionDescription: string;
  numberStatus: string;
} {
  const area = rows * columns;
  const areaUnit = rectangleAreaUnit(unit);
  if (locale === "en") {
    return {
      rows: "Height",
      columns: "Width",
      description: `${rows} ${unit} high, ${columns} ${unit} wide, area ${area} ${areaUnit}.`,
      unitCell: `Each cell is 1 ${unit} high and 1 ${unit} wide, with area 1 ${areaUnit}.`,
      dimensionDescription: `The top and left brackets show the whole rectangle. The brackets beside the bottom-right cell show that each side of one cell is 1 ${unit}.${showNumbers ? ` The cells are numbered from 1 to ${area}.` : ""}`,
      numberStatus: showNumbers
        ? `Displayed the numbers 1 through ${area} in ${area} cells.`
        : "Cell numbers are hidden.",
    };
  }
  return {
    rows: "縦（たて）",
    columns: "横（よこ）",
    description: `縦 ${rows} ${unit}、横 ${columns} ${unit}、面積 ${area} ${areaUnit}の長方形。`,
    unitCell: `1マスは、縦 1 ${unit}、横 1 ${unit}、面積 1 ${areaUnit}です。`,
    dimensionDescription: `上と左の括弧は長方形全体の長さを表し、右下の1マスに付いた括弧は1辺が1 ${unit}であることを表します。${showNumbers ? ` 1から${area}までの番号を表示しています。` : ""}`,
    numberStatus: showNumbers
      ? `${area}個のマスに、1から${area}まで番号を表示しました。`
      : "マスの番号を非表示にしました。",
  };
}

function dimensionLabel(
  kind: "columns" | "rows" | "unit-column" | "unit-row",
  copy: ReturnType<typeof copyFor>,
  rows: number,
  columns: number,
  unit: string,
): string {
  if (kind === "columns") {
    return `${copy.columns} ${columns} ${unit}`;
  }
  if (kind === "rows") {
    return `${copy.rows} ${rows} ${unit}`;
  }
  return `1 ${unit}`;
}

async function renderGrid(
  root: HTMLElement,
  rows: number,
  columns: number,
  unit: string,
  locale: string,
  showNumbers: boolean,
  isCurrent: () => boolean,
): Promise<void> {
  const svg = root.querySelector<SVGSVGElement>("[data-grid-svg]");
  const rowsOutput = root.querySelector<HTMLOutputElement>(
    '[data-grid-output="rows"]',
  );
  const columnsOutput = root.querySelector<HTMLOutputElement>(
    '[data-grid-output="columns"]',
  );
  const rowsInput = root.querySelector<HTMLInputElement>('[data-grid-input="rows"]');
  const columnsInput = root.querySelector<HTMLInputElement>(
    '[data-grid-input="columns"]',
  );
  const calculation = root.querySelector<HTMLElement>(
    "[data-grid-calculation] .ke-math",
  );
  const areaResult = root.querySelector<HTMLElement>("[data-grid-area] .ke-math");
  if (
    !svg ||
    !rowsOutput ||
    !columnsOutput ||
    !rowsInput ||
    !columnsInput ||
    !calculation ||
    !areaResult
  ) {
    return;
  }

  const copy = copyFor(locale, rows, columns, unit, showNumbers);
  const geometry = createRectangleAreaGridGeometry(rows, columns);
  svg.setAttribute(
    "viewBox",
    `0 0 ${geometry.canvasWidth} ${geometry.canvasHeight}`,
  );
  svg.setAttribute("width", rectangleAreaGridCssLength(geometry.canvasWidth));
  svg.setAttribute("height", rectangleAreaGridCssLength(geometry.canvasHeight));
  const labelledBy = (svg.getAttribute("aria-labelledby") ?? "").split(/\s+/u);
  const title = svgElement("title", { ...(labelledBy[0] ? { id: labelledBy[0] } : {}) });
  title.textContent = copy.description;
  const description = svgElement("desc", {
    ...(labelledBy[1] ? { id: labelledBy[1] } : {}),
  });
  description.textContent = `${copy.unitCell} ${copy.dimensionDescription}`;
  const lines = svgElement("g", { class: "ke-interactive__grid", "data-grid-lines": "" });
  lines.append(
    svgElement("rect", {
      x: String(geometry.x),
      y: String(geometry.y),
      width: String(geometry.width),
      height: String(geometry.height),
    }),
  );
  for (let index = 0; index <= columns; index += 1) {
    const x = geometry.x + index * geometry.cellSize;
    lines.append(
      svgElement("line", {
        x1: String(x),
        y1: String(geometry.y),
        x2: String(x),
        y2: String(geometry.y + geometry.height),
      }),
    );
  }
  for (let index = 0; index <= rows; index += 1) {
    const y = geometry.y + index * geometry.cellSize;
    lines.append(
      svgElement("line", {
        x1: String(geometry.x),
        y1: String(y),
        x2: String(geometry.x + geometry.width),
        y2: String(y),
      }),
    );
  }

  const dimensions = svgElement("g", {
    class: "ke-interactive__dimensions",
    "data-grid-dimensions": "",
    "aria-hidden": "true",
  });
  for (const dimension of createRectangleAreaGridDimensions(rows, columns)) {
    dimensions.append(
      svgElement("path", {
        class: "ke-interactive__dimension-bracket",
        "data-grid-dimension": dimension.kind,
        d: dimension.path,
      }),
    );
    const label = svgElement("text", {
      class: `ke-interactive__dimension-label ke-interactive__dimension-label--${dimension.kind.startsWith("unit-") ? "unit" : "overall"}`,
      x: String(dimension.labelX),
      y: String(dimension.labelY),
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      ...(dimension.rotate === undefined
        ? {}
        : {
            transform: `rotate(${dimension.rotate} ${dimension.labelX} ${dimension.labelY})`,
          }),
    });
    label.textContent = dimensionLabel(
      dimension.kind,
      copy,
      rows,
      columns,
      unit,
    );
    dimensions.append(label);
  }

  const cellNumbers = svgElement("g", {
    class: "ke-interactive__cell-numbers",
    "data-grid-cell-numbers": "",
    "aria-hidden": "true",
  });
  if (showNumbers) {
    for (const cell of createRectangleAreaGridCellLabels(rows, columns)) {
      const label = svgElement("text", {
        x: String(cell.x),
        y: String(cell.y),
        "font-size": String(cell.fontSize),
        "text-anchor": "middle",
        "dominant-baseline": "middle",
      });
      label.textContent = String(cell.index);
      cellNumbers.append(label);
    }
  }

  svg.replaceChildren(title, description, lines, dimensions, cellNumbers);
  rowsOutput.textContent = `${rows} ${unit}`;
  columnsOutput.textContent = `${columns} ${unit}`;
  rowsInput.setAttribute("aria-valuetext", `${rows} ${unit}`);
  columnsInput.setAttribute("aria-valuetext", `${columns} ${unit}`);

  await Promise.all([
    renderClientMath(
      calculation,
      `${rows} \\times ${columns} = ${rows * columns}`,
      false,
      isCurrent,
    ),
    renderClientMath(
      areaResult,
      `${rows * columns}\\,\\mathrm{${unit}}^2`,
      false,
      isCurrent,
    ),
  ]);
}

function initializeRectangleAreaGrid(root: HTMLElement): void {
  if (root.dataset.enhanced === "true") {
    return;
  }
  const initialRows = clampGridValue(Number(root.dataset.initialRows));
  const initialColumns = clampGridValue(Number(root.dataset.initialColumns));
  const unit = root.dataset.unit ?? "cm";
  const locale = root.dataset.locale ?? document.documentElement.lang;
  const rowsInput = root.querySelector<HTMLInputElement>('[data-grid-input="rows"]');
  const columnsInput = root.querySelector<HTMLInputElement>(
    '[data-grid-input="columns"]',
  );
  const numberToggle = root.querySelector<HTMLInputElement>("[data-grid-number-toggle]");
  const numberStatus = root.querySelector<HTMLElement>("[data-grid-number-status]");
  const controls = root.querySelector<HTMLElement>("[data-interactive-controls]");
  const reset = root.querySelector<HTMLButtonElement>("[data-grid-reset]");
  if (
    !rowsInput ||
    !columnsInput ||
    !numberToggle ||
    !numberStatus ||
    !controls ||
    !reset
  ) {
    return;
  }

  // Browsers may restore range and checkbox state across reloads. Keep the
  // article's declared initial diagram deterministic, then render from the
  // same values so the controls, SVG, and formula cannot disagree.
  rowsInput.value = String(initialRows);
  columnsInput.value = String(initialColumns);
  numberToggle.checked = false;

  let updateVersion = 0;
  function update(): void {
    const version = ++updateVersion;
    void renderGrid(
      root,
      clampGridValue(Number(rowsInput?.value)),
      clampGridValue(Number(columnsInput?.value)),
      unit,
      locale,
      numberToggle?.checked ?? false,
      () => version === updateVersion,
    );
  }

  rowsInput.addEventListener("input", update);
  columnsInput.addEventListener("input", update);
  numberToggle.addEventListener("change", () => {
    const rows = clampGridValue(Number(rowsInput.value));
    const columns = clampGridValue(Number(columnsInput.value));
    numberStatus.textContent = copyFor(
      locale,
      rows,
      columns,
      unit,
      numberToggle.checked,
    ).numberStatus;
    update();
  });
  reset.addEventListener("click", () => {
    const wasShowingNumbers = numberToggle.checked;
    rowsInput.value = String(initialRows);
    columnsInput.value = String(initialColumns);
    numberToggle.checked = false;
    if (wasShowingNumbers) {
      numberStatus.textContent = copyFor(
        locale,
        initialRows,
        initialColumns,
        unit,
        false,
      ).numberStatus;
    }
    update();
  });

  root.dataset.enhanced = "true";
  controls.hidden = false;
  update();
}

export function initArticleDirectives(scope: ParentNode = document): void {
  for (const root of scope.querySelectorAll<HTMLElement>(
    '[data-noetheca-interactive="rectangle-area-grid"]',
  )) {
    initializeRectangleAreaGrid(root);
  }
  initializeFamilyInteractives(scope);
}
