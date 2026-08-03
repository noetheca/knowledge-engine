export const RECTANGLE_AREA_GRID_MIN = 1;
export const RECTANGLE_AREA_GRID_MAX = 12;
export const RECTANGLE_AREA_GRID_CELL_SIZE = 48;

export interface RectangleAreaGridGeometry {
  canvasWidth: number;
  canvasHeight: number;
  width: number;
  height: number;
  x: number;
  y: number;
  cellSize: number;
}

export type RectangleAreaGridDimensionKind =
  | "columns"
  | "rows"
  | "unit-column"
  | "unit-row";

export interface RectangleAreaGridDimension {
  kind: RectangleAreaGridDimensionKind;
  path: string;
  labelX: number;
  labelY: number;
  rotate?: number;
}

export interface RectangleAreaGridCellLabel {
  index: number;
  x: number;
  y: number;
  fontSize: number;
}

function svgNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/u, "");
}

function horizontalBracketPath(
  left: number,
  right: number,
  baseline: number,
  bracket: number,
): string {
  return `M ${svgNumber(left)} ${svgNumber(baseline)} V ${svgNumber(bracket)} H ${svgNumber(right)} V ${svgNumber(baseline)}`;
}

function verticalBracketPath(
  top: number,
  bottom: number,
  baseline: number,
  bracket: number,
): string {
  return `M ${svgNumber(baseline)} ${svgNumber(top)} H ${svgNumber(bracket)} V ${svgNumber(bottom)} H ${svgNumber(baseline)}`;
}

export function createRectangleAreaGridGeometry(
  rows: number,
  columns: number,
): RectangleAreaGridGeometry {
  const cellSize = RECTANGLE_AREA_GRID_CELL_SIZE;
  const width = cellSize * columns;
  const height = cellSize * rows;
  const x = 72;
  const y = 54;

  return {
    canvasWidth: x + width + 64,
    canvasHeight: y + height + 56,
    width,
    height,
    x,
    y,
    cellSize,
  };
}

export function rectangleAreaGridCssLength(coordinateLength: number): string {
  const centimeters = coordinateLength / RECTANGLE_AREA_GRID_CELL_SIZE;
  return `${centimeters.toFixed(6).replace(/\.?0+$/u, "")}cm`;
}

export function createRectangleAreaGridDimensions(
  rows: number,
  columns: number,
): RectangleAreaGridDimension[] {
  const geometry = createRectangleAreaGridGeometry(rows, columns);
  const right = geometry.x + geometry.width;
  const bottom = geometry.y + geometry.height;

  return [
    {
      kind: "columns",
      path: horizontalBracketPath(geometry.x, right, geometry.y - 5, geometry.y - 13),
      labelX: geometry.x + geometry.width / 2,
      labelY: geometry.y - 28,
    },
    {
      kind: "rows",
      path: verticalBracketPath(geometry.y, bottom, geometry.x - 5, geometry.x - 13),
      labelX: geometry.x - 29,
      labelY: geometry.y + geometry.height / 2,
      rotate: -90,
    },
    {
      kind: "unit-column",
      path: horizontalBracketPath(
        right - geometry.cellSize,
        right,
        bottom + 5,
        bottom + 13,
      ),
      labelX: right - geometry.cellSize / 2,
      labelY: bottom + 30,
    },
    {
      kind: "unit-row",
      path: verticalBracketPath(
        bottom - geometry.cellSize,
        bottom,
        right + 5,
        right + 13,
      ),
      labelX: right + 29,
      labelY: bottom - geometry.cellSize / 2,
      rotate: -90,
    },
  ];
}

export function createRectangleAreaGridCellLabels(
  rows: number,
  columns: number,
): RectangleAreaGridCellLabel[] {
  const geometry = createRectangleAreaGridGeometry(rows, columns);
  const fontSize = Math.max(8, Math.min(14, geometry.cellSize * 0.34));
  return Array.from({ length: rows * columns }, (_, offset) => {
    const row = Math.floor(offset / columns);
    const column = offset % columns;
    return {
      index: offset + 1,
      x: geometry.x + (column + 0.5) * geometry.cellSize,
      y: geometry.y + (row + 0.5) * geometry.cellSize,
      fontSize,
    };
  });
}

export function rectangleAreaUnit(unit: string): string {
  return `${unit}²`;
}
