import {
  MEASUREMENT_TOOL_OPTIONS,
  UNIT_RELATIONS,
  capacityTransferModel,
  classificationCriteriaModel,
  dataCategoryValues,
  equationBalanceModel,
  fractionOperationModel,
  initialDiceFrequencies,
  kilometreComparisonModel,
  measurementToolChoiceModel,
  twoWayTableModel,
  unitRelationIndex,
  type FamilyOperation,
} from "./family-models.js";

export const FAMILY_INTERACTIVE_MODES = {
  "counter-mat": [
    "count",
    "label",
    "compare",
    "compose",
    "decompose",
    "add",
    "subtract",
    "inverse",
    "group",
    "share",
    "remainder",
    "multiply",
  ],
  "place-value-board": [
    "place-value",
    "regroup-add",
    "regroup-subtract",
    "large",
    "decimal",
    "multiply",
    "divide",
  ],
  "number-line": [
    "order",
    "zero",
    "jump-add",
    "jump-subtract",
    "fraction",
    "decimal",
    "distance",
    "elapsed",
    "estimate",
  ],
  "fraction-model": ["unit", "count", "compare", "add-subtract", "decimal"],
  "equation-balance": ["equality", "unknown", "properties"],
  "geometry-lab": [
    "point-line",
    "segment",
    "recognize",
    "compose",
    "elements",
    "position",
    "triangle",
    "quadrilateral",
    "rectangle",
    "square",
    "right-angle",
    "congruence",
    "isosceles",
    "circle",
    "sphere",
    "solid",
    "tiling",
    "euclidean",
  ],
  "measurement-lab": [
    "compare",
    "conservation",
    "nonstandard",
    "standard",
    "length",
    "metric-length",
    "area",
    "capacity",
    "metric-capacity",
    "mass",
    "clock",
    "duration",
    "elapsed",
    "seconds",
    "kilometres",
    "unit-relations",
    "choose-tool",
  ],
  "data-lab": [
    "classify",
    "criteria",
    "frequency",
    "pictograph",
    "table",
    "bar",
    "two-way",
    "evidence",
    "dice-frequency",
  ],
  "soroban-board": ["number", "calculate"],
} as const;

export type FamilyInteractiveKind = keyof typeof FAMILY_INTERACTIVE_MODES;

export const FAMILY_INTERACTIVE_KINDS = Object.freeze(
  Object.keys(FAMILY_INTERACTIVE_MODES) as FamilyInteractiveKind[],
);

export const FAMILY_UNITS = [
  "none",
  "mm",
  "cm",
  "m",
  "km",
  "mL",
  "dL",
  "L",
  "g",
  "kg",
  "t",
  "second",
  "minute",
  "hour",
  "day",
] as const;

export type FamilyUnit = (typeof FAMILY_UNITS)[number];

export interface FamilyInteractiveConfig {
  interactiveKind: FamilyInteractiveKind;
  mode: string;
  value: number;
  second: number;
  min: number;
  max: number;
  step: number;
  groups: number;
  parts: number;
  selected: number;
  secondParts: number;
  categories: number;
  third?: number;
  fourth?: number;
  fifth?: number;
  sixth?: number;
  unit: FamilyUnit;
  operation: FamilyOperation;
}

export interface FamilyInteractiveParseIssue {
  attribute?: string;
  message: string;
}

export interface FamilyInteractiveParseResult {
  config?: FamilyInteractiveConfig;
  issues: FamilyInteractiveParseIssue[];
}

const FAMILY_ALLOWED_ATTRIBUTES: Record<
  FamilyInteractiveKind,
  readonly string[]
> = {
  "counter-mat": ["kind", "mode", "value", "second", "max", "groups", "selected", "captionReading"],
  "place-value-board": ["kind", "mode", "value", "second", "max", "operation", "captionReading"],
  "number-line": ["kind", "mode", "min", "max", "value", "second", "step", "captionReading"],
  "fraction-model": [
    "kind",
    "mode",
    "parts",
    "selected",
    "second",
    "secondParts",
    "operation",
    "captionReading",
  ],
  "equation-balance": ["kind", "mode", "value", "second", "selected", "max", "operation", "captionReading"],
  "geometry-lab": ["kind", "mode", "value", "captionReading"],
  "measurement-lab": [
    "kind",
    "mode",
    "value",
    "second",
    "max",
    "step",
    "selected",
    "unit",
    "captionReading",
  ],
  "data-lab": [
    "kind",
    "mode",
    "value",
    "second",
    "max",
    "categories",
    "selected",
    "third",
    "fourth",
    "fifth",
    "sixth",
    "captionReading",
  ],
  "soroban-board": ["kind", "mode", "value", "second", "max", "captionReading"],
};

const DEFAULTS: Record<FamilyInteractiveKind, Omit<FamilyInteractiveConfig, "interactiveKind" | "mode" | "operation">> = {
  "counter-mat": {
    value: 5,
    second: 3,
    min: 0,
    max: 20,
    step: 1,
    groups: 2,
    parts: 4,
    selected: 1,
    secondParts: 4,
    categories: 3,
    unit: "none",
  },
  "place-value-board": {
    value: 34,
    second: 8,
    min: 0,
    max: 99_999,
    step: 1,
    groups: 2,
    parts: 4,
    selected: 1,
    secondParts: 4,
    categories: 3,
    unit: "none",
  },
  "number-line": {
    value: 3,
    second: 7,
    min: 0,
    max: 10,
    step: 1,
    groups: 2,
    parts: 4,
    selected: 1,
    secondParts: 4,
    categories: 3,
    unit: "none",
  },
  "fraction-model": {
    value: 1,
    second: 2,
    min: 0,
    max: 1,
    step: 1,
    groups: 2,
    parts: 4,
    selected: 1,
    secondParts: 4,
    categories: 3,
    unit: "none",
  },
  "equation-balance": {
    value: 5,
    second: 5,
    min: 0,
    max: 20,
    step: 1,
    groups: 2,
    parts: 4,
    selected: 1,
    secondParts: 4,
    categories: 3,
    unit: "none",
  },
  "geometry-lab": {
    value: 0,
    second: 0,
    min: 0,
    max: 360,
    step: 15,
    groups: 2,
    parts: 4,
    selected: 1,
    secondParts: 4,
    categories: 3,
    unit: "none",
  },
  "measurement-lab": {
    value: 3,
    second: 5,
    min: 0,
    max: 10,
    step: 1,
    groups: 2,
    parts: 4,
    selected: 1,
    secondParts: 4,
    categories: 3,
    unit: "cm",
  },
  "data-lab": {
    value: 6,
    second: 4,
    min: 0,
    max: 10,
    step: 1,
    groups: 2,
    parts: 4,
    selected: 1,
    secondParts: 4,
    categories: 2,
    unit: "none",
  },
  "soroban-board": {
    value: 123,
    second: 5,
    min: 0,
    max: 99999,
    step: 1,
    groups: 2,
    parts: 4,
    selected: 1,
    secondParts: 4,
    categories: 3,
    unit: "none",
  },
};

interface GeometryControlSpec {
  maximum: number;
  step: number;
  labelJa: string;
  labelEn: string;
}

const GEOMETRY_CONTROL_SPECS: Readonly<Record<string, GeometryControlSpec>> = {
  "point-line": { maximum: 10, step: 1, labelJa: "AとBのあいだ", labelEn: "Distance from A to B" },
  segment: { maximum: 10, step: 1, labelJa: "Bのいち", labelEn: "Position of B" },
  recognize: { maximum: 360, step: 15, labelJa: "ずけいのむき", labelEn: "Shape direction" },
  compose: { maximum: 100, step: 5, labelJa: "あわせたわりあい", labelEn: "Assembly progress" },
  elements: { maximum: 1, step: 1, labelJa: "えらぶ", labelEn: "Select" },
  position: { maximum: 4, step: 1, labelJa: "ばしょ", labelEn: "Position" },
  triangle: { maximum: 60, step: 5, labelJa: "ちょうてんのいち", labelEn: "Vertex position" },
  quadrilateral: { maximum: 60, step: 5, labelJa: "ちょうてんのいち", labelEn: "Vertex position" },
  rectangle: { maximum: 100, step: 5, labelJa: "よこのながさのへんか", labelEn: "Width change" },
  square: { maximum: 100, step: 5, labelJa: "1ぺんのながさのへんか", labelEn: "Side-length change" },
  "right-angle": { maximum: 60, step: 5, labelJa: "たてのながさのへんか", labelEn: "Height change" },
  congruence: { maximum: 100, step: 5, labelJa: "かさねたわりあい", labelEn: "Overlap progress" },
  isosceles: { maximum: 60, step: 5, labelJa: "ちょうてんのたかさ", labelEn: "Vertex height" },
  circle: { maximum: 10, step: 1, labelJa: "はんけい", labelEn: "Radius" },
  sphere: { maximum: 10, step: 1, labelJa: "ちゅうしんからのきょり", labelEn: "Distance from centre" },
  solid: { maximum: 60, step: 5, labelJa: "みるむき", labelEn: "Projection angle" },
  tiling: { maximum: 100, step: 5, labelJa: "しきつめたわりあい", labelEn: "Tiling progress" },
  euclidean: { maximum: 5, step: 1, labelJa: "へいこうせんのあいだ", labelEn: "Distance between parallels" },
};

function geometryControlSpec(mode: string | null | undefined): GeometryControlSpec {
  return GEOMETRY_CONTROL_SPECS[mode ?? ""] ?? {
    maximum: 100,
    step: 5,
    labelJa: "かたちのかえかた",
    labelEn: "Shape change",
  };
}

const NUMERIC_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/u;

function parseNumber(
  attributes: Readonly<Record<string, string | null | undefined>>,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
  issues: FamilyInteractiveParseIssue[],
  integer = true,
): number {
  const raw = attributes[name];
  if (raw === undefined) {
    return fallback;
  }
  if (
    typeof raw !== "string" ||
    !NUMERIC_PATTERN.test(raw) ||
    !Number.isFinite(Number(raw)) ||
    Number(raw) < minimum ||
    Number(raw) > maximum ||
    (integer && !Number.isInteger(Number(raw)))
  ) {
    issues.push({
      attribute: name,
      message: `${name} must be ${integer ? "an integer" : "a number"} from ${minimum} to ${maximum}.`,
    });
    return fallback;
  }
  return Number(raw);
}

export function isFamilyInteractiveKind(value: string): value is FamilyInteractiveKind {
  return Object.hasOwn(FAMILY_INTERACTIVE_MODES, value);
}

export function familyAllowedAttributes(kind: FamilyInteractiveKind): readonly string[] {
  return FAMILY_ALLOWED_ATTRIBUTES[kind];
}

export function parseFamilyInteractiveConfig(
  kind: FamilyInteractiveKind,
  attributes: Readonly<Record<string, string | null | undefined>>,
): FamilyInteractiveParseResult {
  const issues: FamilyInteractiveParseIssue[] = [];
  const allowed = FAMILY_ALLOWED_ATTRIBUTES[kind];
  for (const name of Object.keys(attributes)) {
    if (!allowed.includes(name)) {
      issues.push({
        attribute: name,
        message: `${kind} does not allow attribute ${name}.`,
      });
    }
  }

  const rawMode = attributes.mode;
  const modes = FAMILY_INTERACTIVE_MODES[kind] as readonly string[];
  if (typeof rawMode !== "string" || !modes.includes(rawMode)) {
    issues.push({
      attribute: "mode",
      message: `${kind} mode must be one of: ${modes.join(", ")}.`,
    });
  }
  const rawOperation = attributes.operation;
  const operation: FamilyOperation = rawOperation === undefined
    ? "add"
    : rawOperation === "add" || rawOperation === "subtract" || rawOperation === "multiply"
      ? rawOperation
      : "add";
  if (
    rawOperation !== undefined &&
    rawOperation !== "add" &&
    rawOperation !== "subtract" &&
    rawOperation !== "multiply"
  ) {
    issues.push({
      attribute: "operation",
      message: "operation must be one of: add, subtract, multiply.",
    });
  }
  const defaults = DEFAULTS[kind];
  const valueMaximum = kind === "soroban-board" ? 99_999 : kind === "place-value-board" ? 99_999 : 10_000;
  const min = parseNumber(attributes, "min", defaults.min, 0, 9_999, issues, false);
  const max = parseNumber(attributes, "max", defaults.max, 1, valueMaximum, issues, false);
  const value = parseNumber(attributes, "value", defaults.value, 0, valueMaximum, issues, false);
  const secondFallback = kind === "measurement-lab" && rawMode === "capacity"
    ? Math.min(defaults.second, value)
    : defaults.second;
  const second = parseNumber(attributes, "second", secondFallback, 0, valueMaximum, issues, false);
  const step = parseNumber(
    attributes,
    "step",
    kind === "place-value-board" && rawMode === "decimal" ? 0.1 : defaults.step,
    0.1,
    1_000,
    issues,
    false,
  );
  const groups = parseNumber(attributes, "groups", defaults.groups, 1, 12, issues);
  const parts = parseNumber(attributes, "parts", defaults.parts, 2, 12, issues);
  const selectedFallback = kind === "equation-balance" && rawMode === "properties"
    ? 0
    : kind === "equation-balance" && rawMode === "unknown"
      ? Math.max(0, second - value)
      : kind === "measurement-lab" && rawMode === "compare"
        ? 0
        : defaults.selected;
  const selectedMaximum = kind === "equation-balance" && rawMode === "unknown"
    ? valueMaximum
    : 12;
  const selected = parseNumber(attributes, "selected", selectedFallback, 0, selectedMaximum, issues);
  const secondParts = parseNumber(attributes, "secondParts", defaults.secondParts, 2, 12, issues);
  const categoryDefault = kind === "data-lab" && rawMode === "two-way"
    ? 4
    : kind === "data-lab" && rawMode === "dice-frequency"
      ? 6
      : defaults.categories;
  const categories = parseNumber(attributes, "categories", categoryDefault, 2, 6, issues);
  const third = parseNumber(attributes, "third", 0, 0, 40, issues);
  const fourth = parseNumber(attributes, "fourth", 0, 0, 40, issues);
  const fifth = parseNumber(attributes, "fifth", 0, 0, 40, issues);
  const sixth = parseNumber(attributes, "sixth", 0, 0, 40, issues);
  const rawUnit = attributes.unit;
  const measurementDefaultUnit: FamilyUnit =
    rawMode === "seconds"
      ? "second"
      : rawMode === "clock" || rawMode === "duration"
        ? "minute"
        : rawMode === "elapsed"
          ? "hour"
          : rawMode === "capacity" || rawMode === "metric-capacity"
            ? "mL"
            : rawMode === "mass"
              ? "g"
              : rawMode === "kilometres"
                ? "km"
                : ["area", "conservation", "choose-tool", "unit-relations"].includes(rawMode ?? "")
                  ? "none"
                  : "cm";
  const unit =
    rawUnit === undefined
      ? kind === "measurement-lab"
        ? measurementDefaultUnit
        : defaults.unit
      : FAMILY_UNITS.includes(rawUnit as FamilyUnit)
        ? (rawUnit as FamilyUnit)
        : defaults.unit;
  if (rawUnit !== undefined && !FAMILY_UNITS.includes(rawUnit as FamilyUnit)) {
    issues.push({
      attribute: "unit",
      message: `unit must be one of: ${FAMILY_UNITS.join(", ")}.`,
    });
  }

  if (max <= min) {
    issues.push({ message: "max must be greater than min." });
  }
  if (kind === "number-line" && (value < min || value > max || second < min || second > max)) {
    issues.push({ message: "number-line values must be between min and max." });
  }
  if (
    kind === "number-line" &&
    [value, second].some((candidate) => {
      const offset = (candidate - min) / step;
      return Math.abs(offset - Math.round(offset)) > 1e-9;
    })
  ) {
    issues.push({ message: "number-line values must lie on the declared min/step grid." });
  }
  if (kind === "number-line" && rawMode === "zero" && (min !== 0 || value !== 0 || second !== 0)) {
    issues.push({ message: "number-line zero is a fixed diagram and requires min=0, value=0, and second=0." });
  }
  if (
    ["counter-mat", "place-value-board", "equation-balance", "measurement-lab", "data-lab", "soroban-board"].includes(kind) &&
    (value > max || second > max)
  ) {
    issues.push({ message: `${kind} values must not exceed max.` });
  }
  if (kind === "fraction-model" && selected > parts) {
    issues.push({ message: "fraction-model selected must not exceed parts." });
  }
  if (kind === "fraction-model" && second > secondParts) {
    issues.push({ message: "fraction-model second must not exceed secondParts." });
  }
  if (kind === "fraction-model" && rawMode === "unit" && selected !== 1) {
    issues.push({ message: "fraction-model unit requires exactly one selected part." });
  }
  if (
    kind === "fraction-model" &&
    rawMode === "decimal" &&
    (parts !== 10 || selected !== 1 || secondParts !== 10 || second !== 1)
  ) {
    issues.push({ message: "fraction-model decimal represents the fixed equivalence 1/10 = 0.1." });
  }
  if (kind === "fraction-model" && rawMode === "add-subtract" && secondParts !== parts) {
    issues.push({ message: "fraction-model add-subtract requires equal denominators." });
  }
  if (kind === "fraction-model" && rawMode === "add-subtract" && operation === "multiply") {
    issues.push({ message: "fraction-model add-subtract operation must be add or subtract." });
  }
  if (kind === "fraction-model" && rawMode !== "add-subtract" && rawOperation !== undefined) {
    issues.push({ message: "fraction-model operation is allowed only for add-subtract." });
  }
  if (
    kind === "fraction-model" &&
    rawMode === "add-subtract" &&
    operation === "subtract" &&
    second > selected
  ) {
    issues.push({ message: "fraction-model subtraction requires second not to exceed selected." });
  }
  if (kind === "equation-balance" && operation === "subtract") {
    issues.push({ message: "equation-balance operation must be add or multiply." });
  }
  if (kind === "equation-balance" && rawMode !== "properties" && rawOperation !== undefined) {
    issues.push({ message: "equation-balance operation is allowed only for properties." });
  }
  if (kind === "equation-balance" && rawMode === "unknown" && second < value) {
    issues.push({ message: "equation-balance unknown requires second not to be less than value." });
  }
  if (kind === "equation-balance" && rawMode === "unknown" && selected > max) {
    issues.push({ message: "equation-balance unknown trial must not exceed max." });
  }
  if (
    kind === "equation-balance" &&
    rawMode === "properties" &&
    selected > (operation === "multiply" ? 2 : 1)
  ) {
    issues.push({ message: "equation-balance properties selected is outside the available property choices." });
  }
  if (kind === "counter-mat" && rawMode === "label" && selected > 1) {
    issues.push({ message: "counter-mat label selected must be 0 or 1." });
  }
  if (kind === "counter-mat" && (value > 40 || second > 40 || max > 40)) {
    issues.push({ message: "counter-mat values and max may not exceed 40; use place-value-board for larger numbers." });
  }
  if (kind === "counter-mat" && rawMode === "multiply" && (value > 10 || second > 10)) {
    issues.push({ message: "counter-mat multiply values may not exceed 10." });
  }
  if (
    kind === "counter-mat" &&
    ["decompose", "subtract"].includes(rawMode ?? "") &&
    second > value
  ) {
    issues.push({ message: "counter-mat natural-number subtraction requires second not to exceed value." });
  }
  if (
    kind === "counter-mat" &&
    ["compose", "add", "inverse"].includes(rawMode ?? "") &&
    value + second > 40
  ) {
    issues.push({ message: "counter-mat combined values may not exceed 40." });
  }
  if (
    kind === "measurement-lab" &&
    ["area", "nonstandard", "standard"].includes(rawMode ?? "") &&
    max > 20
  ) {
    issues.push({ message: `measurement-lab ${rawMode ?? "mode"} max may not exceed its 20-item drawing.` });
  }
  if (kind === "measurement-lab" && rawMode === "standard" && (value < 1 || second < 1)) {
    issues.push({ message: "measurement-lab standard requires at least one unit in each row." });
  }
  if (
    kind === "measurement-lab" &&
    ["area", "nonstandard", "standard"].includes(rawMode ?? "") &&
    (!Number.isInteger(value) || !Number.isInteger(second) || !Number.isInteger(max) || step !== 1)
  ) {
    issues.push({ message: `measurement-lab ${rawMode ?? "mode"} uses whole items and requires integer values and max with step=1.` });
  }
  if (kind === "measurement-lab" && rawMode === "choose-tool" && value > 2) {
    issues.push({ message: "measurement-lab choose-tool object must be between 0 and 2." });
  }
  if (kind === "measurement-lab" && rawMode === "choose-tool" && second > 8) {
    issues.push({ message: "measurement-lab choose-tool selection must be between 0 and 8." });
  }
  if (kind === "measurement-lab" && rawMode === "capacity" && second > value) {
    issues.push({ message: "measurement-lab capacity transfer must not exceed the total amount." });
  }
  if (kind === "measurement-lab" && rawMode === "compare" && selected > 1) {
    issues.push({ message: "measurement-lab compare selected must be 0 or 1." });
  }
  if (
    kind === "place-value-board" &&
    rawMode === "decimal" &&
    (!Number.isInteger(value * 10) || !Number.isInteger(second * 10))
  ) {
    issues.push({ message: "place-value-board decimal supports tenths only." });
  }
  if (
    kind === "place-value-board" &&
    rawMode !== "decimal" &&
    (!Number.isInteger(value) || !Number.isInteger(second) || !Number.isInteger(max))
  ) {
    issues.push({ message: "place-value-board non-decimal values and max must be integers." });
  }
  if (kind === "place-value-board" && rawMode === "regroup-subtract" && second > value) {
    issues.push({ message: "place-value-board natural-number subtraction requires second not to exceed value." });
  }
  if (kind === "place-value-board" && rawMode === "regroup-add" && value + second > 99_999) {
    issues.push({ message: "place-value-board addition result may not exceed the five-digit board." });
  }
  if (kind === "place-value-board" && rawMode === "multiply" && value * second > 99_999) {
    issues.push({ message: "place-value-board multiplication result may not exceed the five-digit board." });
  }
  if (kind === "place-value-board" && rawMode === "divide" && second < 1) {
    issues.push({ message: "place-value-board division requires a divisor of at least 1." });
  }
  if (kind === "place-value-board" && rawMode === "decimal" && operation === "multiply") {
    issues.push({ message: "place-value-board decimal operation must be add or subtract." });
  }
  if (kind === "place-value-board" && rawMode !== "decimal" && rawOperation !== undefined) {
    issues.push({ message: "place-value-board operation is allowed only for decimal." });
  }
  if (kind === "place-value-board" && rawMode === "decimal" && operation === "subtract" && second > value) {
    issues.push({ message: "place-value-board decimal subtraction requires second not to exceed value." });
  }
  if (kind === "place-value-board" && rawMode === "decimal" && operation === "add" && value + second > 99_999.9) {
    issues.push({ message: "place-value-board decimal addition result may not exceed the six-place board." });
  }
  if (
    kind === "soroban-board" &&
    (!Number.isInteger(value) || !Number.isInteger(second) || !Number.isInteger(max))
  ) {
    issues.push({ message: "soroban-board values and max must be integers." });
  }
  if (kind === "geometry-lab") {
    const geometryMaximum = geometryControlSpec(rawMode).maximum;
    if (value > geometryMaximum) {
      issues.push({ message: `geometry-lab ${rawMode ?? "mode"} value may not exceed ${geometryMaximum}.` });
    }
  }
  if (kind === "data-lab" && (value > 40 || second > 40 || max > 40)) {
    issues.push({ message: "data-lab values and max may not exceed 40." });
  }
  if (kind === "data-lab" && !["dice-frequency", "two-way", "criteria"].includes(rawMode ?? "")) {
    const extraNames = ["third", "fourth", "fifth", "sixth"] as const;
    const extraValues = [third, fourth, fifth, sixth];
    for (let index = 0; index < categories - 2; index += 1) {
      const name = extraNames[index];
      const candidate = extraValues[index] ?? 0;
      if (name && attributes[name] === undefined) {
        issues.push({ attribute: name, message: `data-lab categories=${categories} requires ${name}.` });
      }
      if (!Number.isInteger(candidate) || candidate > max) {
        issues.push({ attribute: name, message: `data-lab ${name ?? "extra category"} must be an integer not exceeding max.` });
      }
    }
  }
  if (
    kind === "data-lab" &&
    ["classify", "criteria", "pictograph"].includes(rawMode ?? "") &&
    max > 20
  ) {
    issues.push({ message: `data-lab ${rawMode ?? "mode"} max may not exceed its 20-item-per-category drawing.` });
  }
  if (kind === "data-lab" && ["criteria", "evidence"].includes(rawMode ?? "") && selected > 1) {
    issues.push({ message: `data-lab ${rawMode ?? "mode"} selected must be 0 or 1.` });
  }
  if (kind === "data-lab" && rawMode === "criteria" && categories !== 2) {
    issues.push({ message: "data-lab criteria uses exactly two bins for each selected criterion." });
  }
  if (kind === "data-lab" && rawMode === "two-way" && categories !== 4) {
    issues.push({ message: "data-lab two-way requires categories=4." });
  }
  if (
    (kind === "counter-mat" || kind === "data-lab") &&
    (!Number.isInteger(value) || !Number.isInteger(second) || !Number.isInteger(max))
  ) {
    issues.push({ message: `${kind} object counts and max must be integers.` });
  }
  if (kind === "measurement-lab" && step > max) {
    issues.push({ message: "measurement-lab step must not exceed max." });
  }
  if (kind === "measurement-lab" && rawMode === "clock" && (value > 23 || second > 59)) {
    issues.push({ message: "measurement-lab clock requires hours 0-23 and minutes 0-59." });
  }
  if (kind === "measurement-lab" && rawMode === "duration" && second > 59) {
    issues.push({ message: "measurement-lab duration minutes must be 0-59." });
  }
  if (kind === "measurement-lab" && rawMode === "duration" && value > 24) {
    issues.push({ message: "measurement-lab duration hours must be 0-24." });
  }
  if (kind === "measurement-lab" && rawMode === "elapsed" && (value > 24 || second > 24)) {
    issues.push({ message: "measurement-lab elapsed clock values must be 0-24." });
  }
  if (kind === "measurement-lab" && rawMode === "seconds" && value > 60) {
    issues.push({ message: "measurement-lab seconds value must be 0-60." });
  }
  if (kind === "measurement-lab" && rawMode === "unit-relations" && value > UNIT_RELATIONS.length - 1) {
    issues.push({ message: "measurement-lab unit-relations value must select a registered relation." });
  }
  if (kind === "measurement-lab" && rawMode === "kilometres" && value > 10) {
    issues.push({ message: "measurement-lab kilometres value may not exceed 10." });
  }
  if (
    kind === "measurement-lab" &&
    ["clock", "duration", "elapsed", "seconds", "unit-relations", "kilometres"].includes(rawMode ?? "") &&
    (!Number.isInteger(value) || !Number.isInteger(second))
  ) {
    issues.push({ message: `measurement-lab ${rawMode ?? "mode"} values must be integers.` });
  }
  if (
    kind === "data-lab" &&
    rawMode === "dice-frequency" &&
    (value < 1 || value > 6 || second < 1 || second > 6 || categories !== 6)
  ) {
    issues.push({ message: "data-lab dice-frequency requires faces 1-6 and categories=6." });
  }

  return issues.length > 0 || typeof rawMode !== "string" || !modes.includes(rawMode)
    ? { issues }
    : {
        issues,
        config: {
          interactiveKind: kind,
          mode: rawMode,
          value,
          second,
          min,
          max,
          step,
          groups,
          parts,
          selected,
          secondParts,
          categories,
          third,
          fourth,
          fifth,
          sixth,
          unit,
          operation,
        },
      };
}

export function familyInteractiveDataset(
  config: FamilyInteractiveConfig,
): Readonly<Record<string, string>> {
  return {
    mode: config.mode,
    value: String(config.value),
    second: String(config.second),
    min: String(config.min),
    max: String(config.max),
    step: String(config.step),
    groups: String(config.groups),
    parts: String(config.parts),
    selected: String(config.selected),
    secondParts: String(config.secondParts),
    categories: String(config.categories),
    unit: config.unit,
    ...(config.interactiveKind === "data-lab"
      ? {
          third: String(config.third ?? 0),
          fourth: String(config.fourth ?? 0),
          fifth: String(config.fifth ?? 0),
          sixth: String(config.sixth ?? 0),
        }
      : {}),
    ...((config.interactiveKind === "fraction-model" && config.mode === "add-subtract") ||
    (config.interactiveKind === "place-value-board" && config.mode === "decimal") ||
    (config.interactiveKind === "equation-balance" && config.mode === "properties")
      ? { operation: config.operation }
      : {}),
  };
}

export function parseFamilyInteractiveDataset(
  kind: FamilyInteractiveKind,
  dataset: Readonly<Record<string, string | undefined>>,
): FamilyInteractiveConfig | undefined {
  const authorAttributes: Record<string, string | undefined> = { mode: dataset.mode };
  for (const name of familyAllowedAttributes(kind)) {
    if (name === "kind" || name === "captionReading" || name === "mode") {
      continue;
    }
    authorAttributes[name] = dataset[name];
  }
  const parsed = parseFamilyInteractiveConfig(kind, authorAttributes);
  if (!parsed.config) {
    return undefined;
  }
  const expected = familyInteractiveDataset(parsed.config);
  return Object.entries(expected).every(([name, value]) => dataset[name] === value)
    ? parsed.config
    : undefined;
}

export type FamilyStateKey = "value" | "second" | "selected" | "groups";

export interface FamilyControlDefinition {
  key: FamilyStateKey;
  minimum: number;
  maximum: number;
  step: number;
  labelJa: string;
  labelEn: string;
  inputType: "range" | "number";
  valueLabelsJa?: readonly string[];
  valueLabelsEn?: readonly string[];
}

export interface FamilyControlState {
  value: number;
  second: number;
  selected: number;
  groups: number;
  operation: FamilyOperation;
}

export function familyControlDefinitionValueText(
  definition: FamilyControlDefinition,
  value: number,
  locale: "ja" | "en" = "ja",
): string {
  const labels = locale === "ja" ? definition.valueLabelsJa : definition.valueLabelsEn;
  const index = Math.floor(value);
  return labels?.[index] ?? conciseNumber(value);
}

export function familyLiveControlBounds(
  config: FamilyInteractiveConfig,
  state: FamilyControlState,
  definition: FamilyControlDefinition,
): { minimum: number; maximum: number } {
  let minimum = definition.minimum;
  let maximum = definition.maximum;
  const naturalSubtraction =
    (config.interactiveKind === "counter-mat" && ["decompose", "subtract"].includes(config.mode)) ||
    (config.interactiveKind === "place-value-board" && config.mode === "regroup-subtract") ||
    (config.interactiveKind === "measurement-lab" && config.mode === "capacity");
  if (naturalSubtraction) {
    if (definition.key === "value") minimum = state.second;
    if (definition.key === "second") maximum = state.value;
  }
  if (
    config.interactiveKind === "counter-mat" &&
    ["compose", "add", "inverse"].includes(config.mode)
  ) {
    if (definition.key === "value") maximum = Math.min(maximum, 40 - state.second);
    if (definition.key === "second") maximum = Math.min(maximum, 40 - state.value);
  }
  if (config.interactiveKind === "place-value-board" && config.mode === "regroup-add") {
    if (definition.key === "value") maximum = Math.min(maximum, 99_999 - state.second);
    if (definition.key === "second") maximum = Math.min(maximum, 99_999 - state.value);
  }
  if (config.interactiveKind === "place-value-board" && config.mode === "multiply") {
    if (definition.key === "value" && state.second > 0) {
      maximum = Math.min(maximum, Math.floor(99_999 / state.second));
    }
    if (definition.key === "second" && state.value > 0) {
      maximum = Math.min(maximum, Math.floor(99_999 / state.value));
    }
  }
  if (config.interactiveKind === "place-value-board" && config.mode === "decimal") {
    if (state.operation === "subtract") {
      if (definition.key === "value") minimum = state.second;
      if (definition.key === "second") maximum = state.value;
    } else {
      if (definition.key === "value") maximum = Math.min(maximum, 99_999.9 - state.second);
      if (definition.key === "second") maximum = Math.min(maximum, 99_999.9 - state.value);
    }
  }
  if (config.interactiveKind === "equation-balance" && config.mode === "unknown") {
    if (definition.key === "value") maximum = state.second;
    if (definition.key === "second") minimum = state.value;
  }
  if (
    config.interactiveKind === "equation-balance" &&
    config.mode === "properties" &&
    definition.key === "selected"
  ) {
    maximum = state.operation === "multiply" ? 2 : 1;
  }
  if (
    config.interactiveKind === "fraction-model" &&
    config.mode === "add-subtract" &&
    state.operation === "subtract"
  ) {
    if (definition.key === "selected") minimum = state.second;
    if (definition.key === "second") maximum = state.selected;
  }
  return { minimum, maximum };
}

export function familyControlDefinitions(
  config: FamilyInteractiveConfig,
): readonly FamilyControlDefinition[] {
  if (config.interactiveKind === "fraction-model") {
    if (["unit", "decimal"].includes(config.mode)) {
      return [];
    }
    const controls: FamilyControlDefinition[] = [
      {
        key: "selected",
        minimum: config.mode === "add-subtract" && config.operation === "subtract" ? config.second : 0,
        maximum: config.parts,
        step: 1,
        labelJa: "いくつぶん",
        labelEn: "Selected parts",
        inputType: "range",
      },
    ];
    if (["compare", "add-subtract"].includes(config.mode)) {
      controls.push({
        key: "second",
        minimum: 0,
        maximum: config.mode === "add-subtract" && config.operation === "subtract"
          ? config.selected
          : config.secondParts,
        step: 1,
        labelJa: "くらべるかず",
        labelEn: "Comparison parts",
        inputType: "range",
      });
    }
    return controls;
  }
  if (config.interactiveKind === "geometry-lab") {
    const specialized = geometryControlSpec(config.mode);
    return [
      {
        key: "value",
        minimum: 0,
        maximum: specialized.maximum,
        step: specialized.step,
        labelJa: specialized.labelJa,
        labelEn: specialized.labelEn,
        inputType: "range",
      },
    ];
  }
  const maximum =
    config.interactiveKind === "counter-mat" && config.mode === "multiply"
      ? Math.min(10, config.max)
      : config.max;
  const minimum =
    config.interactiveKind === "number-line" ? config.min : 0;
  const inputType =
    config.interactiveKind === "place-value-board" ||
    config.interactiveKind === "soroban-board"
      ? "number"
      : "range";
  const semanticLabels = (() => {
    switch (config.interactiveKind) {
      case "counter-mat":
        return { primaryJa: "Aのおはじき", secondaryJa: "Bのおはじき", primaryEn: "A counters", secondaryEn: "B counters" };
      case "place-value-board":
        return { primaryJa: "ひとつめのかず", secondaryJa: "ふたつめのかず", primaryEn: "First number", secondaryEn: "Second number" };
      case "number-line":
        return { primaryJa: "ひとつめのいち", secondaryJa: "ふたつめのいち", primaryEn: "First position", secondaryEn: "Second position" };
      case "equation-balance":
        return { primaryJa: "ひだりのかず", secondaryJa: "みぎのかず", primaryEn: "Left value", secondaryEn: "Right value" };
      case "measurement-lab":
        return { primaryJa: "りょう", secondaryJa: "くらべるりょう", primaryEn: "Amount", secondaryEn: "Comparison" };
      case "data-lab":
        return { primaryJa: "Aのこすう", secondaryJa: "Bのこすう", primaryEn: "A count", secondaryEn: "B count" };
      case "soroban-board":
        return { primaryJa: "うえのかず", secondaryJa: "したのかず", primaryEn: "Upper number", secondaryEn: "Lower number" };
    }
  })();
  const primary: FamilyControlDefinition = {
    key: "value",
    minimum,
    maximum,
    step: config.step,
    labelJa: semanticLabels.primaryJa,
    labelEn: semanticLabels.primaryEn,
    inputType,
  };
  const secondary: FamilyControlDefinition = {
    key: "second",
    minimum,
    maximum,
    step: config.step,
    labelJa: semanticLabels.secondaryJa,
    labelEn: semanticLabels.secondaryEn,
    inputType,
  };
  if (config.interactiveKind === "number-line" && config.mode === "zero") {
    return [];
  }
  if (config.interactiveKind === "counter-mat") {
    if (config.mode === "count") {
      return [{ ...primary, labelJa: "おはじきのかず", labelEn: "Number of counters" }];
    }
    if (config.mode === "label") {
      return [
        primary,
        {
          key: "selected",
          minimum: 0,
          maximum: 1,
          step: 1,
          labelJa: "ばんごう",
          labelEn: "Number labels",
          inputType: "range",
          valueLabelsJa: ["かくす", "みせる"],
          valueLabelsEn: ["hidden", "shown"],
        },
      ];
    }
    if (["group", "share", "remainder"].includes(config.mode)) {
      return [
        { ...primary, labelJa: "ぜんぶのおはじき", labelEn: "All counters" },
        {
          key: "groups",
          minimum: 1,
          maximum: 12,
          step: 1,
          labelJa: config.mode === "share" ? "わける先の数" : "1組の数",
          labelEn: config.mode === "share" ? "Number of groups" : "Group size",
          inputType: "range",
        },
      ];
    }
    if (["decompose", "subtract"].includes(config.mode)) {
      return [
        { ...primary, minimum: config.second, labelJa: "はじめのおはじき", labelEn: "Starting counters" },
        { ...secondary, maximum: config.value, labelJa: "とるおはじき", labelEn: "Counters removed" },
      ];
    }
  }
  if (config.interactiveKind === "place-value-board") {
    if (config.mode === "decimal") {
      return [
        { ...primary, labelJa: "ひとつめのしょうすう", labelEn: "First decimal" },
        { ...secondary, labelJa: "ふたつめのしょうすう", labelEn: "Second decimal" },
      ];
    }
    if (config.mode === "regroup-subtract") {
      return [
        { ...primary, minimum: config.second },
        { ...secondary, maximum: config.value },
      ];
    }
    if (config.mode === "divide") {
      return [primary, { ...secondary, minimum: 1 }];
    }
    return ["regroup-add", "regroup-subtract", "decimal", "multiply", "divide"].includes(config.mode)
      ? [primary, secondary]
      : [primary];
  }
  if (config.interactiveKind === "data-lab" && config.mode === "dice-frequency") {
    return [];
  }
  if (
    config.interactiveKind === "data-lab" &&
    ["criteria", "evidence"].includes(config.mode)
  ) {
    return [
      primary,
      secondary,
      {
        key: "selected",
        minimum: 0,
        maximum: 1,
        step: 1,
        labelJa: config.mode === "criteria" ? "分ける見方" : "見る資料",
        labelEn: config.mode === "criteria" ? "Criterion" : "Evidence view",
        inputType: "range",
        valueLabelsJa: config.mode === "criteria" ? ["かたち", "色"] : ["棒グラフ", "表"],
        valueLabelsEn: config.mode === "criteria" ? ["shape", "colour"] : ["bar chart", "table"],
      },
    ];
  }
  if (config.interactiveKind === "equation-balance" && config.mode === "properties") {
    return [
      primary,
      secondary,
      {
        key: "selected",
        minimum: 0,
        maximum: 2,
        step: 1,
        labelJa: "きまり",
        labelEn: "Property",
        inputType: "range",
        valueLabelsJa: ["いれかえる", "まとめかた", "わけてかける"],
        valueLabelsEn: ["swap", "regroup", "distribute"],
      },
    ];
  }
  if (config.interactiveKind === "equation-balance" && config.mode === "unknown") {
    return [
      { ...primary, maximum: config.second, labelJa: "わかっている数", labelEn: "Known addend" },
      { ...secondary, minimum: config.value, labelJa: "ぜんぶの数", labelEn: "Total" },
      {
        key: "selected",
        minimum: 0,
        maximum: config.max,
        step: 1,
        labelJa: "□にいれるかず",
        labelEn: "Trial value for □",
        inputType: "range",
      },
    ];
  }
  if (config.interactiveKind === "measurement-lab" && config.mode === "elapsed") {
    return [
      { ...primary, labelJa: "はじめ", labelEn: "Start" },
      { ...secondary, labelJa: "おわり", labelEn: "End" },
    ];
  }
  if (
    config.interactiveKind === "measurement-lab" &&
    ["clock", "duration"].includes(config.mode)
  ) {
    return [
      {
        ...primary,
        maximum: config.mode === "clock" ? 23 : 24,
        step: 1,
        labelJa: "じ",
        labelEn: "Hour",
      },
      {
        ...secondary,
        maximum: Number((Math.floor((59 + Number.EPSILON) / secondary.step) * secondary.step).toFixed(10)),
        labelJa: "ふん",
        labelEn: "Minutes",
      },
    ];
  }
  if (config.interactiveKind === "measurement-lab" && config.mode === "seconds") {
    return [{ ...primary, maximum: 60, step: 1, labelJa: "びょう", labelEn: "Seconds" }];
  }
  if (config.interactiveKind === "measurement-lab" && config.mode === "unit-relations") {
    return [
      {
        ...primary,
        minimum: 0,
        maximum: UNIT_RELATIONS.length - 1,
        step: 1,
        labelJa: "たんいの組",
        labelEn: "Unit relation",
        valueLabelsJa: UNIT_RELATIONS.map(({ text }) => text),
        valueLabelsEn: UNIT_RELATIONS.map(({ text }) => text),
      },
    ];
  }
  if (config.interactiveKind === "measurement-lab" && config.mode === "kilometres") {
    return [
      {
        ...primary,
        maximum: Math.min(10, config.max),
        step: 1,
        labelJa: "キロメートル",
        labelEn: "Kilometres",
      },
      {
        ...secondary,
        labelJa: "メートル",
        labelEn: "Metres",
      },
    ];
  }
  if (
    config.interactiveKind === "measurement-lab" &&
    config.mode === "choose-tool"
  ) {
    return [
      {
        ...primary,
        maximum: 2,
        step: 1,
        labelJa: "はかるもの",
        labelEn: "Object",
        valueLabelsJa: ["えんぴつ", "コップの水", "かばん"],
        valueLabelsEn: ["pencil", "water in a cup", "school bag"],
      },
      {
        ...secondary,
        maximum: 8,
        step: 1,
        labelJa: "どうぐとたんい",
        labelEn: "Tool and unit",
        valueLabelsJa: MEASUREMENT_TOOL_OPTIONS.map(({ toolJa, unit }) => `${toolJa}・${unit}`),
        valueLabelsEn: MEASUREMENT_TOOL_OPTIONS.map(({ toolEn, unit }) => `${toolEn} · ${unit}`),
      },
    ];
  }
  if (config.interactiveKind === "measurement-lab" && config.mode === "conservation") {
    return [primary];
  }
  if (config.interactiveKind === "measurement-lab" && config.mode === "capacity") {
    return [
      { ...primary, minimum: config.second, labelJa: "ぜんぶのりょう", labelEn: "Total amount" },
      { ...secondary, maximum: config.value, labelJa: "Bへうつすりょう", labelEn: "Amount poured into B" },
    ];
  }
  if (config.interactiveKind === "measurement-lab" && config.mode === "compare") {
    return [
      { ...primary, labelJa: "Aのながさ", labelEn: "Length A" },
      { ...secondary, labelJa: "Bのながさ", labelEn: "Length B" },
      {
        key: "selected",
        minimum: 0,
        maximum: 1,
        step: 1,
        labelJa: "くらべかた",
        labelEn: "Comparison method",
        inputType: "range",
        valueLabelsJa: ["ちょくせつならべる", "テープにうつす"],
        valueLabelsEn: ["direct comparison", "copy onto tape"],
      },
    ];
  }
  if (config.interactiveKind === "measurement-lab" && config.mode === "standard") {
    return [
      { ...primary, minimum: 1, labelJa: "Aの単位の数", labelEn: "A unit count" },
      { ...secondary, minimum: 1, labelJa: "Bの単位の数", labelEn: "B unit count" },
    ];
  }
  if (config.interactiveKind === "soroban-board" && config.mode === "number") {
    return [{ ...primary, labelJa: "そろばんのかず", labelEn: "Number on the soroban" }];
  }
  return [primary, secondary];
}

function conciseNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}

export function familyControlValueText(
  config: FamilyInteractiveConfig,
  value: number,
  locale: "ja" | "en" = "ja",
): string {
  if (config.interactiveKind !== "geometry-lab") return conciseNumber(value);
  const amount = conciseNumber(value);
  switch (config.mode) {
    case "elements": {
      const labels = locale === "ja" ? ["へん", "ちょうてん"] : ["edges", "vertices"];
      return labels[Math.floor(value) % labels.length] ?? labels[0] ?? amount;
    }
    case "position": {
      const labels = locale === "ja"
        ? ["うえ", "みぎ", "した", "ひだり", "おなじばしょ"]
        : ["above", "right", "below", "left", "same place"];
      return labels[Math.floor(value) % labels.length] ?? labels[0] ?? amount;
    }
    case "circle":
    case "sphere":
      return `${amount} cm`;
    case "point-line":
      return locale === "ja" ? `${conciseNumber(10 + value)} めもり` : `${conciseNumber(10 + value)} grid units`;
    case "segment":
      return value === 0
        ? locale === "ja" ? "ちゅうおう" : "midpoint"
        : locale === "ja" ? `Cへちかづく ${amount}だんかいめ` : `Step ${amount} from the midpoint toward C`;
    case "compose":
    case "congruence":
    case "tiling":
      return `${amount}%`;
    case "rectangle":
    case "square":
    case "right-angle":
      return `${amount}%`;
    case "euclidean":
      return locale === "ja" ? `${conciseNumber(3 + value)} めもり` : `${conciseNumber(3 + value)} grid units`;
    case "recognize":
    case "solid":
      return `${amount}°`;
    default:
      return `${amount}%`;
  }
}

export function diceFrequencyResultText(
  value: number,
  second: number,
  frequencies: readonly number[],
  locale: "ja" | "en" = "ja",
): string {
  const counts = Array.from(
    { length: 6 },
    (_, index) => `${index + 1}: ${conciseNumber(Math.max(0, Math.floor(frequencies[index] ?? 0)))}`,
  ).join(locale === "ja" ? "、" : ", ");
  const recorded = frequencies.reduce((sum, count) => sum + Math.max(0, Math.floor(count)), 0);
  return locale === "ja"
    ? `いまのめは ${conciseNumber(value)} と ${conciseNumber(second)}。きろくしため ${recorded}こ（${counts}）`
    : `Current faces: ${conciseNumber(value)} and ${conciseNumber(second)}. ${recorded} recorded faces (${counts})`;
}

export function familyResultText(
  config: FamilyInteractiveConfig,
  value = config.value,
  second = config.second,
  selected = config.selected,
  locale: "ja" | "en" = "ja",
  groups = config.groups,
  operation = config.operation,
): string {
  const a = conciseNumber(value);
  const b = conciseNumber(second);
  if (config.interactiveKind === "counter-mat") {
    if (config.mode === "count") {
      return locale === "ja" ? `${a} こ` : `${a} objects`;
    }
    if (config.mode === "label") {
      return locale === "ja"
        ? `${a}こ。ばんごうは${selected % 2 === 0 ? "かくしています" : `1から${a}まで`}（こすうは${a}こ）`
        : `${a} objects. Number labels are ${selected % 2 === 0 ? "hidden" : `1 through ${a}`}; the count remains ${a}.`;
    }
    if (config.mode === "compare") {
      const relation = value === second ? "=" : value < second ? "<" : ">";
      const extra = conciseNumber(Math.abs(value - second));
      return locale === "ja"
        ? `${a} ${relation} ${b}（あまり ${extra}こ）`
        : `${a} ${relation} ${b} (${extra} unmatched)`;
    }
    if (config.mode === "inverse") {
      const total = conciseNumber(value + second);
      return `${a} + ${b} = ${total}, ${total} − ${b} = ${a}`;
    }
    if (["compose", "add"].includes(config.mode)) {
      return `${a} + ${b} = ${conciseNumber(value + second)}`;
    }
    if (["decompose", "subtract"].includes(config.mode)) {
      return `${a} − ${b} = ${conciseNumber(value - second)}`;
    }
    if (config.mode === "multiply") {
      return `${a} × ${b} = ${conciseNumber(value * second)}`;
    }
    if (["group", "share", "remainder"].includes(config.mode)) {
      const divisor = Math.max(1, groups);
      const quotient = Math.floor(value / divisor);
      const remainder = value % divisor;
      return locale === "ja"
        ? `${a} ÷ ${divisor} = ${quotient} あまり ${conciseNumber(remainder)}`
        : `${a} ÷ ${divisor} = ${quotient} remainder ${conciseNumber(remainder)}`;
    }
    return locale === "ja" ? `${a} と ${b}` : `${a} and ${b}`;
  }
  if (config.interactiveKind === "fraction-model") {
    const first = `${selected}/${config.parts}`;
    const comparison = `${conciseNumber(second)}/${config.secondParts}`;
    if (config.mode === "unit" || config.mode === "count") {
      return first;
    }
    if (config.mode === "compare") {
      const left = selected / config.parts;
      const right = second / config.secondParts;
      return `${first} ${left === right ? "=" : left < right ? "<" : ">"} ${comparison}`;
    }
    if (config.mode === "decimal") {
      return `${first} = ${conciseNumber(selected / config.parts)}`;
    }
    const model = fractionOperationModel(
      config.parts,
      selected,
      config.secondParts,
      second,
      operation,
    );
    const symbol = operation === "subtract" ? "−" : "+";
    return model
      ? `${first} ${symbol} ${comparison} = ${model.numerator}/${model.denominator}`
        : locale === "ja" ? "同じ分母をえらんでください。" : "Choose equal denominators.";
  }
  if (config.interactiveKind === "equation-balance") {
    const model = equationBalanceModel(
      config.mode as "equality" | "unknown" | "properties",
      operation,
      value,
      second,
      selected,
    );
    if (config.mode === "properties") {
      return `${model.leftLabel} = ${model.rightLabel}`;
    }
    if (config.mode === "unknown") {
      const relation = selected + value === second ? "=" : selected + value < second ? "<" : ">";
      return locale === "ja"
        ? `${conciseNumber(selected)} + ${a} ${relation} ${b}。${relation === "=" ? "せいかいです" : "□をかえてみよう"}`
        : `${conciseNumber(selected)} + ${a} ${relation} ${b}. ${relation === "=" ? "Correct." : "Try another value for □."}`;
    }
    const relation = value === second ? "=" : value < second ? "<" : ">";
    return `${a} ${relation} ${b}`;
  }
  if (config.interactiveKind === "geometry-lab") {
    switch (config.mode) {
      case "point-line":
        return locale === "ja"
          ? `AとBは ${conciseNumber(10 + value)} めもりはなれ、2てんを1ぽんのちょくせんがとおります。`
          : `A and B are ${conciseNumber(10 + value)} grid units apart, and one line passes through both points.`;
      case "segment":
        return locale === "ja"
          ? `BはAとCのあいだにあり、${value === 0 ? "ちゅうおう" : `ちゅうおうからCへ ${a}だんかい すすんだいち`}です。`
          : `B lies between A and C, ${value === 0 ? "at the midpoint" : `at step ${a} from the midpoint toward C`}.`;
      case "recognize":
        return locale === "ja"
          ? `ずけいを ${a}° まわしても、へんやかくのとくちょうはかわりません。`
          : `After a ${a}° turn, the shapes keep the same sides and angles.`;
      case "compose":
        return locale === "ja"
          ? value >= 100 ? "2つのさんかくけいがぴったりあい、しかくけいができました。" : `2つのさんかくけいを ${a}% あわせました。`
          : value >= 100 ? "The two triangles fit together to make a quadrilateral." : `The two triangles are ${a}% assembled.`;
      case "elements": {
        const labelsJa = ["へん", "ちょうてん"];
        const labelsEn = ["edges", "vertices"];
        const index = Math.floor(value) % 2;
        return locale === "ja" ? `えらんだもの: ${labelsJa[index]}` : `Selected: ${labelsEn[index]}`;
      }
      case "position": {
        const labelsJa = ["基準の上", "基準の右", "基準の下", "基準の左", "基準と同じ位置"];
        const labelsEn = ["above the reference", "right of the reference", "below the reference", "left of the reference", "at the reference"];
        const index = Math.floor(value) % labelsJa.length;
        return locale === "ja"
          ? labelsJa[index] ?? "基準の上"
          : labelsEn[index] ?? "above the reference";
      }
      case "triangle":
        return locale === "ja" ? `ちょうてんを ${a}% うごかしても、へんは3ぼん、ちょうてんは3こです。` : `At ${a}% vertex movement, the shape still has three sides and three vertices.`;
      case "quadrilateral":
        return locale === "ja" ? `ちょうてんを ${a}% うごかしても、へんは4ほん、ちょうてんは4こです。` : `At ${a}% vertex movement, the shape still has four sides and four vertices.`;
      case "rectangle":
        return locale === "ja" ? `はじめよりよこを ${a}% ながくしても、4つのかくはいつもちょっかくです。` : `With the width ${a}% longer than at the start, all four angles remain right angles.`;
      case "square":
        return locale === "ja" ? `はじめより1ぺんを ${a}% ながくしても、4ほんのへんはいつもおなじながさです。` : `With each side ${a}% longer than at the start, all four sides remain equal.`;
      case "right-angle":
        return locale === "ja" ? `はじめよりたてを ${a}% ながくしても、しるしをつけたかくはいつも90°です。` : `With the height ${a}% longer than at the start, the marked angle remains 90°.`;
      case "congruence":
        return locale === "ja"
          ? value >= 100 ? "2つのずけいは、うごかすとぴったりかさなります。" : `うごかすずけいを ${a}% かさねました。`
          : value >= 100 ? "The two shapes coincide exactly after moving one of them." : `The moving shape is ${a}% overlapped.`;
      case "isosceles":
        return locale === "ja" ? `ちょうてんのたかさを ${a}% かえても、しるしのある2ほんのへんはおなじながさです。` : `At ${a}% height change, the two marked sides remain equal.`;
      case "circle":
        return locale === "ja" ? `はんけい ${a} cm、ちょっけい ${conciseNumber(value * 2)} cm` : `Radius ${a} cm; diameter ${conciseNumber(value * 2)} cm`;
      case "sphere": {
        const crossSectionRadius = Math.sqrt(Math.max(0, 100 - value * value));
        return locale === "ja"
          ? `ちゅうしんから ${a} cm、きりくちのはんけい ${conciseNumber(crossSectionRadius)} cm`
          : `${a} cm from the centre; cross-section radius ${conciseNumber(crossSectionRadius)} cm`;
      }
      case "solid":
        return locale === "ja" ? `みるむき ${a}°。はこのめん、へん、ちょうてんをべつべつにたしかめられます。` : `Projection angle ${a}°. Faces, edges, and vertices remain distinguishable.`;
      case "tiling":
        return locale === "ja"
          ? value >= 100 ? "すきまもかさなりもなく、しきつめられました。" : `しきつめは ${a}% で、まだすきまがあります。`
          : value >= 100 ? "The region is tiled without gaps or overlaps." : `The tiling is ${a}% complete and still has gaps.`;
      case "euclidean":
        return locale === "ja" ? `へいこうせんのあいだは ${conciseNumber(3 + value)} めもりで、どこでもおなじです。` : `The parallel lines stay ${conciseNumber(3 + value)} grid units apart everywhere.`;
      default:
        return locale === "ja" ? `かたちのかえかた ${a}%` : `Shape change ${a}%`;
    }
  }
  if (config.interactiveKind === "measurement-lab") {
    if (config.mode === "clock") {
      return `${a}:${String(Math.floor(second) % 60).padStart(2, "0")}`;
    }
    if (config.mode === "seconds") {
      const minutes = Math.floor(value / 60);
      const seconds = value % 60;
      return locale === "ja"
        ? `${a} びょう = ${minutes} ふん ${conciseNumber(seconds)} びょう`
        : `${a} seconds = ${minutes} minutes ${conciseNumber(seconds)} seconds`;
    }
    if (config.mode === "duration") {
      return locale === "ja" ? `${a} じかん ${b} ふん` : `${a} hours ${b} minutes`;
    }
    if (config.mode === "elapsed") {
      const elapsed = ((second - value) % 24 + 24) % 24;
      return locale === "ja"
        ? `${a}じ → ${b}じ、${conciseNumber(elapsed)} じかん`
        : `${a}:00 → ${b}:00, ${conciseNumber(elapsed)} hours`;
    }
    if (config.mode === "conservation") {
      return locale === "ja" ? `どちらも ${a}（おなじりょう）` : `Both show ${a} (the same amount)`;
    }
    if (config.mode === "area") {
      return locale === "ja" ? `A: ${a} マス、B: ${b} マス` : `A: ${a} tiles, B: ${b} tiles`;
    }
    if (config.mode === "nonstandard") {
      return locale === "ja" ? `A: ${a} こ、B: ${b} こ` : `A: ${a} units, B: ${b} units`;
    }
    if (config.mode === "standard") {
      return locale === "ja" ? `同じ長さ：Aの単位 ${a}こ、Bの単位 ${b}こ` : `Same length: ${a} A-units, ${b} B-units`;
    }
    if (config.mode === "choose-tool") {
      const model = measurementToolChoiceModel(value, second);
      return locale === "ja"
        ? `${model.objectLabelJa}：${model.selectedToolJa} と ${model.selectedUnit}（${model.isCorrect ? "合っています" : "もう一度考えよう"}）`
        : `${model.objectLabelEn}: ${model.selectedToolEn} and ${model.selectedUnit} (${model.isCorrect ? "a good match" : "try again"})`;
    }
    if (config.mode === "unit-relations") {
      return UNIT_RELATIONS[unitRelationIndex(value)]?.text ?? UNIT_RELATIONS[0].text;
    }
    if (config.mode === "kilometres") {
      const model = kilometreComparisonModel(value, second);
      return `${a} km ${model.relation} ${b} m`;
    }
    if (config.mode === "metric-length") {
      return locale === "ja"
        ? `A: ${a} ${config.unit}、B: ${b} ${config.unit}。10 mm = 1 cm、100 cm = 1 m`
        : `A: ${a} ${config.unit}, B: ${b} ${config.unit}. 10 mm = 1 cm; 100 cm = 1 m`;
    }
    if (config.mode === "metric-capacity") {
      return locale === "ja"
        ? `A: ${a} ${config.unit}、B: ${b} ${config.unit}。100 mL = 1 dL、10 dL = 1 L`
        : `A: ${a} ${config.unit}, B: ${b} ${config.unit}. 100 mL = 1 dL; 10 dL = 1 L`;
    }
    if (config.mode === "capacity") {
      const model = capacityTransferModel(value, second, config.max);
      const unit = config.unit === "none" ? "" : ` ${config.unit}`;
      const remaining = conciseNumber(model.remaining);
      const contained = conciseNumber(model.contained);
      const overflow = conciseNumber(model.overflow);
      const total = conciseNumber(model.total);
      return locale === "ja"
        ? `ぜんぶ ${total}${unit}。Bへ ${conciseNumber(model.transferred)}${unit} うつすと、A ${remaining}${unit}、B ${contained}${unit}、こぼれ ${overflow}${unit}。${remaining} + ${contained} + ${overflow} = ${total}${unit}`
        : `Total ${total}${unit}. Pour ${conciseNumber(model.transferred)}${unit} into B: A ${remaining}${unit}, B ${contained}${unit}, spill ${overflow}${unit}. ${remaining} + ${contained} + ${overflow} = ${total}${unit}`;
    }
    if (config.mode === "compare") {
      const relation = value === second ? "=" : value < second ? "<" : ">";
      const unit = config.unit === "none" ? "" : ` ${config.unit}`;
      const method = selected % 2 === 0
        ? locale === "ja" ? "ちょくせつならべる" : "Direct comparison"
        : locale === "ja" ? "テープにうつす" : "Copy onto tape";
      return `${method}：A ${a}${unit} ${relation} B ${b}${unit}`;
    }
    const unit = config.unit === "none" ? "" : ` ${config.unit}`;
    return locale === "ja" ? `${a}${unit} と ${b}${unit}` : `${a}${unit} and ${b}${unit}`;
  }
  if (config.interactiveKind === "number-line") {
    if (config.mode === "zero") return locale === "ja" ? "0 は数直線のはじまり" : "0 is the start of this number line";
    if (config.mode === "order") {
      return `${a} ${value === second ? "=" : value < second ? "<" : ">"} ${b}`;
    }
    return `${a} → ${b}`;
  }
  if (config.interactiveKind === "data-lab") {
    if (config.mode === "dice-frequency") {
      return diceFrequencyResultText(value, second, initialDiceFrequencies(value, second), locale);
    }
    if (config.mode === "criteria") {
      const model = classificationCriteriaModel(value, second, selected);
      return locale === "ja"
        ? `${model.criterionLabel}：${model.binLabels[0]} ${model.bins[0].length}まい、${model.binLabels[1]} ${model.bins[1].length}まい`
        : `${model.criterion}: ${model.bins[0].length} and ${model.bins[1].length} cards`;
    }
    if (config.mode === "evidence") {
      const view = selected % 2 === 0
        ? locale === "ja" ? "棒グラフ" : "bar chart"
        : locale === "ja" ? "表" : "table";
      const values = dataCategoryValues(value, second, config.categories, [
        config.third ?? 0,
        config.fourth ?? 0,
        config.fifth ?? 0,
        config.sixth ?? 0,
      ]);
      const summary = values.map((count, index) => `${String.fromCharCode(65 + index)} ${conciseNumber(count)}`).join(locale === "ja" ? "、" : ", ");
      return locale === "ja" ? `${view}で確認：${summary}` : `Check the ${view}: ${summary}`;
    }
    if (config.mode === "two-way") {
      const model = twoWayTableModel(value, second);
      return locale === "ja"
        ? `● ${model.rowTotals[0]}まい、■ ${model.rowTotals[1]}まい、ぜんぶ ${model.grandTotal}まい`
        : `Round ${model.rowTotals[0]}, square ${model.rowTotals[1]}, total ${model.grandTotal}`;
    }
    const values = dataCategoryValues(value, second, config.categories, [
      config.third ?? 0,
      config.fourth ?? 0,
      config.fifth ?? 0,
      config.sixth ?? 0,
    ]);
    return values.map((count, index) => `${String.fromCharCode(65 + index)}: ${conciseNumber(count)}`).join(locale === "ja" ? "、" : ", ");
  }
  if (config.interactiveKind === "place-value-board") {
    if (config.mode === "regroup-add") {
      return `${a} + ${b} = ${conciseNumber(value + second)}`;
    }
    if (config.mode === "regroup-subtract") {
      return `${a} − ${b} = ${conciseNumber(value - second)}`;
    }
    if (config.mode === "multiply") {
      return `${a} × ${b} = ${conciseNumber(value * second)}`;
    }
    if (config.mode === "divide") {
      const divisor = Math.max(1, Math.floor(second));
      const quotient = Math.floor(value / divisor);
      const remainder = value % divisor;
      return locale === "ja"
        ? `${a} ÷ ${conciseNumber(divisor)} = ${conciseNumber(quotient)} あまり ${conciseNumber(remainder)}`
        : `${a} ÷ ${conciseNumber(divisor)} = ${conciseNumber(quotient)} remainder ${conciseNumber(remainder)}`;
    }
    if (config.mode === "decimal") {
      const result = operation === "subtract" ? value - second : value + second;
      return `${a} ${operation === "subtract" ? "−" : "+"} ${b} = ${conciseNumber(result)}`;
    }
    return locale === "ja" ? `かず ${a}` : `Number ${a}`;
  }
  if (config.mode === "calculate") {
    return `${a} + ${b} = ${conciseNumber(value + second)}`;
  }
  return locale === "ja" ? `そろばん ${a}` : `Abacus ${a}`;
}

export function familyResultTex(
  config: FamilyInteractiveConfig,
  value = config.value,
  second = config.second,
  selected = config.selected,
  groups = config.groups,
  operation = config.operation,
): string | undefined {
  const a = conciseNumber(value);
  const b = conciseNumber(second);
  if (config.interactiveKind === "counter-mat") {
    if (config.mode === "compare") {
      const relation = value === second ? "=" : value < second ? "<" : ">";
      return `${a} ${relation} ${b},\\quad |${a}-${b}|=${conciseNumber(Math.abs(value - second))}`;
    }
    if (config.mode === "inverse") {
      const total = conciseNumber(value + second);
      return `${a} + ${b} = ${total},\\quad ${total} - ${b} = ${a}`;
    }
    if (["compose", "add"].includes(config.mode)) {
      return `${a} + ${b} = ${conciseNumber(value + second)}`;
    }
    if (["decompose", "subtract"].includes(config.mode)) {
      return `${a} - ${b} = ${conciseNumber(value - second)}`;
    }
    if (config.mode === "multiply") {
      return `${a} \\times ${b} = ${conciseNumber(value * second)}`;
    }
    if (["group", "share", "remainder"].includes(config.mode)) {
      const divisor = Math.max(1, groups);
      return `${a} = ${divisor} \\times ${Math.floor(value / divisor)} + ${conciseNumber(value % divisor)}`;
    }
    return undefined;
  }
  if (config.interactiveKind === "fraction-model") {
    const first = `\\frac{${selected}}{${config.parts}}`;
    const comparison = `\\frac{${b}}{${config.secondParts}}`;
    if (["unit", "count"].includes(config.mode)) {
      return first;
    }
    if (config.mode === "compare") {
      const left = selected / config.parts;
      const right = second / config.secondParts;
      return `${first} ${left === right ? "=" : left < right ? "<" : ">"} ${comparison}`;
    }
    if (config.mode === "decimal") {
      return `${first} = ${conciseNumber(selected / config.parts)}`;
    }
    const model = fractionOperationModel(
      config.parts,
      selected,
      config.secondParts,
      second,
      operation,
    );
    return model
      ? `${first} ${operation === "subtract" ? "-" : "+"} ${comparison} = \\frac{${model.numerator}}{${model.denominator}}`
      : undefined;
  }
  if (config.interactiveKind === "equation-balance") {
    if (config.mode === "properties") {
      const model = equationBalanceModel("properties", operation, value, second, selected);
      const asTex = (label: string) => label.replaceAll("×", "\\times");
      return `${asTex(model.leftLabel)} = ${asTex(model.rightLabel)}`;
    }
    if (config.mode === "unknown") {
      const trial = conciseNumber(selected);
      const total = selected + value;
      const relation = total === second ? "=" : total < second ? "<" : ">";
      return `\\boxed{${trial}} + ${a} ${relation} ${b}`;
    }
    const relation = value === second ? "=" : value < second ? "<" : ">";
    return `${a} ${relation} ${b}`;
  }
  if (config.interactiveKind === "number-line") {
    if (config.mode === "zero") return "0";
    if (config.mode === "order") {
      return `${a} ${value === second ? "=" : value < second ? "<" : ">"} ${b}`;
    }
    return `${a} \\longrightarrow ${b}`;
  }
  if (config.interactiveKind === "place-value-board") {
    if (config.mode === "regroup-add") {
      return `${a} + ${b} = ${conciseNumber(value + second)}`;
    }
    if (config.mode === "regroup-subtract") {
      return `${a} - ${b} = ${conciseNumber(value - second)}`;
    }
    if (config.mode === "multiply") {
      return `${a} \\times ${b} = ${conciseNumber(value * second)}`;
    }
    if (config.mode === "divide") {
      const divisor = Math.max(1, Math.floor(second));
      const quotient = Math.floor(value / divisor);
      const remainder = value % divisor;
      return `${a} = ${conciseNumber(divisor)} \\times ${conciseNumber(quotient)} + ${conciseNumber(remainder)}`;
    }
    if (config.mode === "decimal") {
      const result = operation === "subtract" ? value - second : value + second;
      return `${a} ${operation === "subtract" ? "-" : "+"} ${b} = ${conciseNumber(result)}`;
    }
    return a;
  }
  if (config.interactiveKind === "measurement-lab") {
    if (config.mode === "unit-relations") {
      return UNIT_RELATIONS[unitRelationIndex(value)]?.tex ?? UNIT_RELATIONS[0].tex;
    }
    if (config.mode === "kilometres") {
      const relation = kilometreComparisonModel(value, second).relation;
      return `${a}\\,\\mathrm{km} ${relation} ${b}\\,\\mathrm{m}`;
    }
    if (config.mode === "area") {
      return `A=${a},\\quad B=${b}`;
    }
    if (config.mode === "metric-length") {
      const unit = config.unit === "none" ? "cm" : config.unit;
      return `A=${a}\\,\\mathrm{${unit}},\\quad B=${b}\\,\\mathrm{${unit}},\\quad 10\\,\\mathrm{mm}=1\\,\\mathrm{cm},\\quad 100\\,\\mathrm{cm}=1\\,\\mathrm{m}`;
    }
    if (config.mode === "metric-capacity") {
      const unit = config.unit === "none" ? "dL" : config.unit;
      return `A=${a}\\,\\mathrm{${unit}},\\quad B=${b}\\,\\mathrm{${unit}},\\quad 100\\,\\mathrm{mL}=1\\,\\mathrm{dL},\\quad 10\\,\\mathrm{dL}=1\\,\\mathrm{L}`;
    }
    if (config.mode === "capacity") {
      const model = capacityTransferModel(value, second, config.max);
      const unit = config.unit === "none" ? "" : `\\,\\mathrm{${config.unit}}`;
      return `${conciseNumber(model.contained)}+${conciseNumber(model.overflow)}=${conciseNumber(model.transferred)},\\quad ${conciseNumber(model.remaining)}+${conciseNumber(model.contained)}+${conciseNumber(model.overflow)}=${conciseNumber(model.total)}${unit}`;
    }
    if (config.mode === "compare") {
      const relation = value === second ? "=" : value < second ? "<" : ">";
      const unit = config.unit === "none" ? "" : `\\,\\mathrm{${config.unit}}`;
      return `A=${a}${unit} ${relation} B=${b}${unit}`;
    }
    if (
      config.unit !== "none" &&
      ["length", "metric-length", "metric-capacity", "mass", "kilometres"].includes(config.mode)
    ) {
      return `${a}\\,\\mathrm{${config.unit}} \\quad ${b}\\,\\mathrm{${config.unit}}`;
    }
    return undefined;
  }
  if (config.interactiveKind === "soroban-board" && config.mode === "calculate") {
    return `${a} + ${b} = ${conciseNumber(value + second)}`;
  }
  return undefined;
}
