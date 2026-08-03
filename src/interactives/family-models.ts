export type FamilyOperation = "add" | "subtract" | "multiply";

/** Leaves a dedicated gutter for comparison values at the right edge of the SVG. */
export const MEASUREMENT_COMPARE_BAR_MAX_WIDTH = 360;

export function normalizeStepValue(
  value: number,
  minimum: number,
  maximum: number,
  step: number,
): number {
  const clamped = Math.max(minimum, Math.min(maximum, value));
  const normalized = minimum + Math.round((clamped - minimum) / step) * step;
  return Number(Math.max(minimum, Math.min(maximum, normalized)).toFixed(10));
}

export type PlaceOperationMode =
  | "place-value"
  | "regroup-add"
  | "regroup-subtract"
  | "large"
  | "decimal"
  | "multiply"
  | "divide";

export interface PlaceRegroupEvent {
  kind: "exchange-up" | "borrow-down";
  fromIndex: number;
  toIndex: number;
}

export interface PlacePartialProduct {
  placeIndex: number;
  groupValue: number;
  multiplier: number;
  product: number;
}

export interface PlaceOperationModel {
  result: number;
  quotient: number;
  remainder: number;
  regroupEvents: PlaceRegroupEvent[];
  partialProducts: PlacePartialProduct[];
}

function fiveDigits(value: number): number[] {
  return String(Math.max(0, Math.min(99_999, Math.floor(value))))
    .padStart(5, "0")
    .slice(-5)
    .split("")
    .map(Number);
}

export function placeOperationModel(
  mode: PlaceOperationMode,
  value: number,
  second: number,
): PlaceOperationModel {
  const left = Math.max(0, Math.floor(value));
  const right = Math.max(0, Math.floor(second));
  const divisor = Math.max(1, right);
  const regroupEvents: PlaceRegroupEvent[] = [];
  if (mode === "regroup-add") {
    const leftDigits = fiveDigits(left);
    const rightDigits = fiveDigits(right);
    let carry = 0;
    for (let index = 4; index >= 0; index -= 1) {
      const total = (leftDigits[index] ?? 0) + (rightDigits[index] ?? 0) + carry;
      if (total >= 10 && index > 0) {
        regroupEvents.push({ kind: "exchange-up", fromIndex: index, toIndex: index - 1 });
      }
      carry = total >= 10 ? 1 : 0;
    }
  } else if (mode === "regroup-subtract") {
    const working = fiveDigits(left);
    const rightDigits = fiveDigits(right);
    for (let index = 4; index >= 0; index -= 1) {
      if ((working[index] ?? 0) >= (rightDigits[index] ?? 0)) continue;
      let source = index - 1;
      while (source >= 0 && (working[source] ?? 0) === 0) source -= 1;
      if (source < 0) continue;
      working[source] = (working[source] ?? 0) - 1;
      for (let cursor = source + 1; cursor < index; cursor += 1) {
        working[cursor] = (working[cursor] ?? 0) + 9;
      }
      working[index] = (working[index] ?? 0) + 10;
      for (let cursor = source; cursor < index; cursor += 1) {
        regroupEvents.push({ kind: "borrow-down", fromIndex: cursor, toIndex: cursor + 1 });
      }
    }
  }
  const partialProducts: PlacePartialProduct[] = [];
  if (mode === "multiply") {
    for (let power = 0; power < 5; power += 1) {
      const unit = 10 ** power;
      const digit = Math.floor(left / unit) % 10;
      if (digit === 0) continue;
      const groupValue = digit * unit;
      partialProducts.push({
        placeIndex: 4 - power,
        groupValue,
        multiplier: right,
        product: groupValue * right,
      });
    }
  }
  const result = mode === "regroup-add"
    ? left + right
    : mode === "regroup-subtract"
      ? left - right
      : mode === "multiply"
        ? left * right
        : mode === "divide"
          ? Math.floor(left / divisor)
          : left;
  return {
    result,
    quotient: Math.floor(left / divisor),
    remainder: left % divisor,
    regroupEvents,
    partialProducts,
  };
}

export function balanceTilt(leftValue: number, rightValue: number): number {
  return Math.max(-8, Math.min(8, (rightValue - leftValue) * 1.5));
}

export interface KilometreComparisonModel {
  kilometresInMetres: number;
  metres: number;
  relation: "<" | "=" | ">";
  kilometreWidth: number;
  metreWidth: number;
}

export function kilometreComparisonModel(
  kilometres: number,
  metres: number,
): KilometreComparisonModel {
  const kilometresInMetres = Math.max(0, kilometres) * 1_000;
  const safeMetres = Math.max(0, metres);
  const scale = Math.max(1_000, kilometresInMetres, safeMetres);
  return {
    kilometresInMetres,
    metres: safeMetres,
    relation: kilometresInMetres === safeMetres ? "=" : kilometresInMetres < safeMetres ? "<" : ">",
    kilometreWidth: 400 * (kilometresInMetres / scale),
    metreWidth: 400 * (safeMetres / scale),
  };
}

export interface DivisionModel {
  divisor: number;
  quotient: number;
  remainder: number;
  zoneCount: number;
  tokensPerZone: number;
}

export function divisionModel(
  mode: "group" | "share" | "remainder",
  value: number,
  rawDivisor: number,
): DivisionModel {
  const dividend = Math.max(0, Math.floor(value));
  const divisor = Math.max(1, Math.floor(rawDivisor));
  const quotient = Math.floor(dividend / divisor);
  return {
    divisor,
    quotient,
    remainder: dividend % divisor,
    zoneCount: mode === "share" ? divisor : quotient,
    tokensPerZone: mode === "share" ? quotient : divisor,
  };
}

export interface ConservationFill {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
}

export function conservationFillModel(
  value: number,
  maximum: number,
): { left: ConservationFill; right: ConservationFill } {
  const ratio = Math.max(0, Math.min(1, value / Math.max(1, maximum)));
  const leftHeight = 150 * ratio;
  const rightHeight = 100 * ratio;
  return {
    left: {
      x: 100,
      y: 220 - leftHeight,
      width: 120,
      height: leftHeight,
      area: 120 * leftHeight,
    },
    right: {
      x: 320,
      y: 220 - rightHeight,
      width: 180,
      height: rightHeight,
      area: 180 * rightHeight,
    },
  };
}

export interface CapacityTransferModel {
  total: number;
  transferred: number;
  remaining: number;
  vesselCapacity: number;
  contained: number;
  overflow: number;
}

export function capacityTransferModel(
  total: number,
  transferred: number,
  maximum: number,
): CapacityTransferModel {
  const safeMaximum = Math.max(0, maximum);
  const safeTotal = Math.max(0, Math.min(safeMaximum, total));
  const safeTransferred = Math.max(0, Math.min(safeTotal, transferred));
  const vesselCapacity = safeMaximum * 0.6;
  const contained = Math.min(safeTransferred, vesselCapacity);
  const overflow = safeTransferred - contained;
  return {
    total: safeTotal,
    transferred: safeTransferred,
    remaining: safeTotal - safeTransferred,
    vesselCapacity,
    contained,
    overflow,
  };
}

export interface FractionOperationModel {
  denominator: number;
  numerator: number;
  wholeBars: number;
  finalBarParts: number;
}

export function fractionOperationModel(
  parts: number,
  selected: number,
  secondParts: number,
  second: number,
  operation: FamilyOperation,
): FractionOperationModel | undefined {
  if (parts !== secondParts || (operation !== "add" && operation !== "subtract")) {
    return undefined;
  }
  const numerator = operation === "add"
    ? selected + second
    : Math.max(0, selected - second);
  return {
    denominator: parts,
    numerator,
    wholeBars: Math.floor(numerator / parts),
    finalBarParts: numerator % parts,
  };
}

export interface EquationBalanceModel {
  leftLabel: string;
  rightLabel: string;
  leftValue: number;
  rightValue: number;
}

export function equationBalanceModel(
  mode: "equality" | "unknown" | "properties",
  operation: FamilyOperation,
  value: number,
  second: number,
  selected = 0,
): EquationBalanceModel {
  if (mode === "properties") {
    const property = Math.max(0, Math.min(operation === "multiply" ? 2 : 1, Math.floor(selected)));
    const third = 2;
    if (property === 1) {
      const symbol = operation === "multiply" ? "×" : "+";
      const total = operation === "multiply"
        ? value * second * third
        : value + second + third;
      return {
        leftLabel: `(${value} ${symbol} ${second}) ${symbol} ${third}`,
        rightLabel: `${value} ${symbol} (${second} ${symbol} ${third})`,
        leftValue: total,
        rightValue: total,
      };
    }
    if (property === 2) {
      const total = value * (second + third);
      return {
        leftLabel: `${value} × (${second} + ${third})`,
        rightLabel: `${value} × ${second} + ${value} × ${third}`,
        leftValue: total,
        rightValue: total,
      };
    }
    const symbol = operation === "multiply" ? "×" : "+";
    const total = operation === "multiply" ? value * second : value + second;
    return {
      leftLabel: `${value} ${symbol} ${second}`,
      rightLabel: `${second} ${symbol} ${value}`,
      leftValue: total,
      rightValue: total,
    };
  }
  if (mode === "unknown") {
    return {
      leftLabel: `${selected} + ${value}`,
      rightLabel: String(second),
      leftValue: selected + value,
      rightValue: second,
    };
  }
  return {
    leftLabel: String(value),
    rightLabel: String(second),
    leftValue: value,
    rightValue: second,
  };
}

export const UNIT_RELATIONS = [
  { text: "1 m = 1000 mm", tex: "1\\,\\mathrm{m}=1000\\,\\mathrm{mm}" },
  { text: "1 km = 1000 m", tex: "1\\,\\mathrm{km}=1000\\,\\mathrm{m}" },
  { text: "1 L = 1000 mL", tex: "1\\,\\mathrm{L}=1000\\,\\mathrm{mL}" },
  { text: "1 kg = 1000 g", tex: "1\\,\\mathrm{kg}=1000\\,\\mathrm{g}" },
] as const;

export function unitRelationIndex(value: number): number {
  return ((Math.floor(value) % UNIT_RELATIONS.length) + UNIT_RELATIONS.length) % UNIT_RELATIONS.length;
}

export function dataCategoryValues(
  value: number,
  second: number,
  categories: number,
  additional: readonly number[] = [],
): number[] {
  const length = Math.max(2, Math.min(6, Math.floor(categories)));
  return Array.from(
    { length },
    (_, index) => index === 0 ? value : index === 1 ? second : additional[index - 2] ?? 0,
  );
}

export interface TwoWayTableModel {
  cells: readonly [number, number, number, number];
  rowTotals: readonly [number, number];
  columnTotals: readonly [number, number];
  grandTotal: number;
}

export function twoWayTableModel(value: number, second: number): TwoWayTableModel {
  const firstTotal = Math.max(0, Math.floor(value));
  const secondTotal = Math.max(0, Math.floor(second));
  const firstLeft = Math.ceil((firstTotal * 2) / 3);
  const secondLeft = Math.floor(secondTotal / 3);
  const cells = [
    firstLeft,
    firstTotal - firstLeft,
    secondLeft,
    secondTotal - secondLeft,
  ] as const;
  return {
    cells,
    rowTotals: [firstTotal, secondTotal],
    columnTotals: [cells[0] + cells[2], cells[1] + cells[3]],
    grandTotal: firstTotal + secondTotal,
  };
}

export interface CriteriaCard {
  id: number;
  shape: "round" | "square";
  tone: "accent" | "outline";
}

export interface ClassificationCriteriaModel {
  criterion: "shape" | "tone";
  criterionLabel: string;
  binLabels: readonly [string, string];
  bins: readonly [CriteriaCard[], CriteriaCard[]];
}

export function classificationCriteriaModel(
  roundCount: number,
  squareCount: number,
  selected: number,
): ClassificationCriteriaModel {
  const cards: CriteriaCard[] = [];
  const addCards = (count: number, shape: CriteriaCard["shape"]) => {
    for (let index = 0; index < Math.max(0, Math.floor(count)); index += 1) {
      const id = cards.length + 1;
      cards.push({ id, shape, tone: id % 2 === 1 ? "accent" : "outline" });
    }
  };
  addCards(roundCount, "round");
  addCards(squareCount, "square");
  const criterion = Math.floor(selected) % 2 === 0 ? "shape" : "tone";
  return criterion === "shape"
    ? {
        criterion,
        criterionLabel: "かたちで分ける",
        binLabels: ["まる", "しかく"],
        bins: [
          cards.filter(({ shape }) => shape === "round"),
          cards.filter(({ shape }) => shape === "square"),
        ],
      }
    : {
        criterion,
        criterionLabel: "色で分ける",
        binLabels: ["色つき", "白"],
        bins: [
          cards.filter(({ tone }) => tone === "accent"),
          cards.filter(({ tone }) => tone === "outline"),
        ],
      };
}

export const MEASUREMENT_TOOL_OPTIONS = [
  { toolIndex: 0, toolJa: "ものさし", toolEn: "ruler", unit: "mm" },
  { toolIndex: 0, toolJa: "ものさし", toolEn: "ruler", unit: "cm" },
  { toolIndex: 0, toolJa: "ものさし", toolEn: "ruler", unit: "m" },
  { toolIndex: 1, toolJa: "カップ", toolEn: "measuring cup", unit: "mL" },
  { toolIndex: 1, toolJa: "カップ", toolEn: "measuring cup", unit: "dL" },
  { toolIndex: 1, toolJa: "カップ", toolEn: "measuring cup", unit: "L" },
  { toolIndex: 2, toolJa: "はかり", toolEn: "scale", unit: "g" },
  { toolIndex: 2, toolJa: "はかり", toolEn: "scale", unit: "kg" },
  { toolIndex: 2, toolJa: "はかり", toolEn: "scale", unit: "t" },
] as const;

const MEASUREMENT_OBJECTS = [
  { labelJa: "えんぴつ", labelEn: "pencil", icon: "pencil", expectedIndex: 1 },
  { labelJa: "コップの水", labelEn: "water in a cup", icon: "water", expectedIndex: 4 },
  { labelJa: "かばん", labelEn: "school bag", icon: "bag", expectedIndex: 7 },
] as const;

export interface MeasurementToolChoiceModel {
  objectIndex: number;
  objectLabelJa: string;
  objectLabelEn: string;
  objectIcon: string;
  selectedIndex: number;
  selectedToolIndex: number;
  selectedToolJa: string;
  selectedToolEn: string;
  selectedUnit: string;
  isCorrect: boolean;
}

export function measurementToolChoiceModel(
  value: number,
  second: number,
): MeasurementToolChoiceModel {
  const objectIndex = ((Math.floor(value) % MEASUREMENT_OBJECTS.length) + MEASUREMENT_OBJECTS.length) % MEASUREMENT_OBJECTS.length;
  const selectedIndex = ((Math.floor(second) % MEASUREMENT_TOOL_OPTIONS.length) + MEASUREMENT_TOOL_OPTIONS.length) % MEASUREMENT_TOOL_OPTIONS.length;
  const object = MEASUREMENT_OBJECTS[objectIndex] ?? MEASUREMENT_OBJECTS[0];
  const option = MEASUREMENT_TOOL_OPTIONS[selectedIndex] ?? MEASUREMENT_TOOL_OPTIONS[0];
  return {
    objectIndex,
    objectLabelJa: object.labelJa,
    objectLabelEn: object.labelEn,
    objectIcon: object.icon,
    selectedIndex,
    selectedToolIndex: option.toolIndex,
    selectedToolJa: option.toolJa,
    selectedToolEn: option.toolEn,
    selectedUnit: option.unit,
    isCorrect: selectedIndex === object.expectedIndex,
  };
}

export function initialDiceFrequencies(value: number, second: number): number[] {
  return recordDiceFaces([0, 0, 0, 0, 0, 0], [value, second]);
}

export function recordDiceFaces(
  frequencies: readonly number[],
  faces: readonly number[],
): number[] {
  const counts = Array.from({ length: 6 }, (_, index) => Math.max(0, Math.floor(frequencies[index] ?? 0)));
  for (const face of faces) {
    const integer = Math.floor(face);
    if (integer >= 1 && integer <= 6) {
      counts[integer - 1] = (counts[integer - 1] ?? 0) + 1;
    }
  }
  return counts;
}
