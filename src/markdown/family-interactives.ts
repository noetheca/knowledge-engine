import {
  familyControlDefinitionValueText,
  familyControlDefinitions,
  familyControlValueText,
  familyLiveControlBounds,
  familyInteractiveDataset,
  familyResultTex,
  familyResultText,
  type FamilyInteractiveConfig,
} from "../interactives/family-contracts.js";
import {
  MEASUREMENT_COMPARE_BAR_MAX_WIDTH,
  UNIT_RELATIONS,
  MEASUREMENT_TOOL_OPTIONS,
  balanceTilt,
  capacityTransferModel,
  classificationCriteriaModel,
  conservationFillModel,
  dataCategoryValues,
  divisionModel,
  equationBalanceModel,
  fractionOperationModel,
  initialDiceFrequencies,
  kilometreComparisonModel,
  measurementToolChoiceModel,
  placeOperationModel,
  twoWayTableModel,
  unitRelationIndex,
  type FamilyOperation,
  type CriteriaCard,
  type PlaceOperationMode,
  type PlacePartialProduct,
  type PlaceRegroupEvent,
} from "../interactives/family-models.js";
import {
  familyUiReading,
  segmentFamilyUiText,
} from "../interactives/family-ui-ruby.js";
import { renderArticleMath } from "./math-renderer.js";

export interface FamilyInteractiveRenderContext {
  captionHtml: string;
  instanceKey: string;
  locale: "ja" | "en";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function familyUiMarkup(value: string): string {
  return segmentFamilyUiText(value)
    .map((segment) => segment.reading === undefined
      ? escapeHtml(segment.text)
      : `<ruby>${escapeHtml(segment.text)}<rp>（</rp><rt>${escapeHtml(segment.reading)}</rt><rp>）</rp></ruby>`)
    .join("");
}

function numberValue(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}

function dataAttributeName(name: string): string {
  return name.replace(/[A-Z]/gu, (character) => `-${character.toLowerCase()}`);
}

function counterTokens(count: number, className = ""): string {
  return Array.from(
    { length: Math.max(0, Math.min(40, Math.floor(count))) },
    (_, index) =>
      `<span class="ke-family__counter${className ? ` ${className}` : ""}" aria-hidden="true" data-counter-index="${index + 1}"></span>`,
  ).join("");
}

function numberedCounterTokens(count: number, showNumbers: boolean): string {
  return Array.from(
    { length: Math.max(0, Math.min(40, Math.floor(count))) },
    (_, index) => `<span class="ke-family__counter ke-family__counter--numbered" aria-hidden="true" data-counter-index="${index + 1}"><b data-counter-number${showNumbers ? "" : " hidden"}>${index + 1}</b></span>`,
  ).join("");
}

function compareCounterPairs(value: number, second: number): string {
  const pairs = Math.min(Math.floor(value), Math.floor(second));
  return Array.from({ length: pairs }, (_, index) => `<div class="ke-family__counter-pair" data-counter-pair="${index}"><span class="ke-family__counter" aria-hidden="true"></span><span class="ke-family__counter-pair-line" aria-hidden="true"></span><span class="ke-family__counter ke-family__counter--second" aria-hidden="true"></span></div>`).join("");
}

function renderCounterMat(config: FamilyInteractiveConfig): string {
  if (config.mode === "label") {
    return `<div class="ke-family__counter-label" data-counter-label><div class="ke-family__counter-zone" data-counter-label-zone>${numberedCounterTokens(config.value, config.selected % 2 === 1)}</div><p data-counter-label-note>${config.selected % 2 === 1 ? `1から${numberValue(config.value)}までのばんごう` : "ばんごうをかくしています"}</p></div>`;
  }
  if (config.mode === "compare") {
    const valueExtra = Math.max(0, Math.floor(config.value - config.second));
    const secondExtra = Math.max(0, Math.floor(config.second - config.value));
    return `<div class="ke-family__counter-compare" data-counter-compare><div class="ke-family__counter-pairs" data-counter-pairs>${compareCounterPairs(config.value, config.second)}</div><div class="ke-family__counter-extras"><div><strong data-counter-extra-label="value">Aのあまり ${valueExtra}こ</strong><div class="ke-family__counter-zone" data-counter-extra="value">${counterTokens(valueExtra)}</div></div><div><strong data-counter-extra-label="second">Bのあまり ${secondExtra}こ</strong><div class="ke-family__counter-zone" data-counter-extra="second">${counterTokens(secondExtra, "ke-family__counter--second")}</div></div></div></div>`;
  }
  if (config.mode === "multiply") {
    return `<div class="ke-family__counter-array" data-counter-array>${Array.from({ length: Math.floor(config.value) }, (_, row) => `<div data-counter-array-row="${row}">${counterTokens(config.second)}</div>`).join("")}</div>`;
  }
  if (["group", "share", "remainder"].includes(config.mode)) {
    const model = divisionModel(
      config.mode as "group" | "share" | "remainder",
      config.value,
      config.groups,
    );
    return `<div class="ke-family__counter-division"><div class="ke-family__counter-groups" data-counter-groups>${Array.from({ length: model.zoneCount }, (_, group) =>
      `<div class="ke-family__counter-zone" data-counter-group="${group}">${counterTokens(model.tokensPerZone)}</div>`,
    ).join("")}</div><div class="ke-family__counter-remainder" data-counter-remainder><strong>あまり</strong><div data-counter-remainder-tokens>${counterTokens(model.remainder, "ke-family__counter--second")}</div></div></div>`;
  }
  if (["decompose", "subtract"].includes(config.mode)) {
    const removed = Math.min(config.value, config.second);
    const remaining = config.value - removed;
    const ones = Math.floor(config.value) % 10;
    const crossesTen = config.value >= 10 && removed > ones;
    return `<div class="ke-family__counter-subtraction"><div class="ke-family__counter-subtraction-stage"><strong>はじめ ${numberValue(config.value)}こ</strong><div class="ke-family__counter-zone" data-counter-subtraction-source>${counterTokens(remaining)}${counterTokens(removed, "ke-family__counter--removed")}</div></div><span class="ke-family__tool-arrow" aria-hidden="true">→</span><div class="ke-family__counter-subtraction-stage"><strong>のこり ${numberValue(remaining)}こ</strong><div class="ke-family__counter-zone" data-counter-subtraction-remaining>${counterTokens(remaining)}</div></div></div><aside class="ke-family__counter-ten-decomposition" data-counter-ten-decomposition${crossesTen ? "" : " hidden"}><strong>${familyUiMarkup("10のまとまりを、1こずつに分ける")}</strong><div><span class="ke-family__ten-bundle">10</span><span aria-hidden="true">→</span><div data-counter-ten-pieces>${counterTokens(10, "ke-family__counter--place")}</div></div></aside>`;
  }
  if (config.mode === "inverse") {
    return `<div class="ke-family__counter-inverse"><div class="ke-family__counter-zone" data-counter-zone="value">${counterTokens(config.value)}</div><span aria-hidden="true">+</span><div class="ke-family__counter-zone ke-family__counter-zone--second" data-counter-zone="second">${counterTokens(config.second, "ke-family__counter--second")}</div><span aria-hidden="true">=</span><div class="ke-family__counter-zone" data-counter-zone="sum">${counterTokens(config.value + config.second)}</div></div>`;
  }
  if (config.mode === "count") {
    return `<div class="ke-family__counter-mat ke-family__counter-mat--single"><div class="ke-family__counter-zone" data-counter-zone="value">${counterTokens(config.value)}</div></div>`;
  }
  const needsForTen = Math.max(0, Math.min(config.second, 10 - config.value));
  const makesTen = ["compose", "add"].includes(config.mode) && config.value < 10 && config.value + config.second >= 10;
  const makeTen = ["compose", "add"].includes(config.mode)
    ? `<aside class="ke-family__counter-make-ten" data-counter-make-ten${makesTen ? "" : " hidden"}><strong>${familyUiMarkup("10のまとまりを作る")}</strong><div class="ke-family__counter-zone" data-counter-make-ten-group>${counterTokens(config.value)}${counterTokens(needsForTen, "ke-family__counter--second")}</div><div class="ke-family__counter-zone" data-counter-make-ten-rest>${counterTokens(config.second - needsForTen, "ke-family__counter--second")}</div></aside>`
    : "";
  return `<div class="ke-family__counter-mat">
<div class="ke-family__counter-zone" data-counter-zone="value">${counterTokens(config.value)}</div>
<div class="ke-family__counter-zone ke-family__counter-zone--second" data-counter-zone="second">${counterTokens(config.second, "ke-family__counter--second")}</div>
</div>${makeTen}`;
}

const PLACE_LABELS = ["まん", "せん", "ひゃく", "じゅう", "いち", "じゅうぶんのいち"] as const;
const SOROBAN_PLACE_LABELS_EN = ["ten-thousands", "thousands", "hundreds", "tens", "ones"] as const;

type PlaceBoardName = "value" | "second" | "result" | "quotient";

interface PlaceColumnHighlights {
  sources?: ReadonlySet<number>;
  targets?: ReadonlySet<number>;
}

function placeValueColumns(
  value: number,
  name: PlaceBoardName,
  decimal: boolean,
  highlights: PlaceColumnHighlights = {},
  startIndex = 0,
): string {
  const integerDigits = String(Math.max(0, Math.min(99_999, Math.floor(value))))
    .padStart(5, "0")
    .slice(-5)
    .split("");
  const digits = decimal
    ? [...integerDigits, String(Math.floor((value - Math.floor(value) + 0.000001) * 10))]
    : integerDigits;
  return digits
    .slice(startIndex)
    .map((digit, relativeIndex) => {
      const index = startIndex + relativeIndex;
      const count = Number(digit);
      const source = highlights.sources?.has(index) === true;
      const target = highlights.targets?.has(index) === true;
      const classes = `${source ? " is-regroup-source" : ""}${target ? " is-regroup-target" : ""}`;
      return `<div class="ke-family__place-column${classes}" data-place-column="${name}-${index}" data-place-index="${index}"><span>${PLACE_LABELS[index]}</span><div class="ke-family__place-tokens">${counterTokens(count, "ke-family__counter--place")}</div><strong data-place-digit>${digit}</strong></div>`;
    })
    .join("");
}

function placeRegroupItem(event: PlaceRegroupEvent): string {
  const exchangeUp = event.kind === "exchange-up";
  const sourceCount = exchangeUp ? 10 : 1;
  const targetCount = exchangeUp ? 1 : 10;
  return `<div class="ke-family__place-regroup-item" data-place-regroup-item>
<div class="ke-family__place-regroup-quantity"><span>${PLACE_LABELS[event.fromIndex]} ${sourceCount}こ</span><div class="ke-family__place-regroup-tokens">${counterTokens(sourceCount, "ke-family__counter--place")}</div></div>
<span class="ke-family__place-regroup-arrow" aria-hidden="true">→</span>
<div class="ke-family__place-regroup-quantity"><span>${PLACE_LABELS[event.toIndex]} ${targetCount}こ</span><div class="ke-family__place-regroup-tokens">${counterTokens(targetCount, "ke-family__counter--place")}</div></div>
</div>`;
}

function placeRegroupMarkup(events: readonly PlaceRegroupEvent[]): string {
  const exchangeUp = events[0]?.kind === "exchange-up";
  const title = exchangeUp ? "10こを、ひとつ上の位の1こにまとめる" : "ひとつ上の位の1こを、10こに分ける";
  return `<aside class="ke-family__place-regroup" data-place-regroup-panel${events.length === 0 ? " hidden" : ""}><strong data-place-regroup-title>${familyUiMarkup(title)}</strong><div class="ke-family__place-regroup-items" data-place-regroup-items>${events.map(placeRegroupItem).join("")}</div></aside>`;
}

function placePartialProductItem(partial: PlacePartialProduct): string {
  const visibleGroups = Math.min(12, partial.multiplier);
  const groups = Array.from(
    { length: visibleGroups },
    () => `<span>${numberValue(partial.groupValue)}</span>`,
  ).join("");
  const overflow = partial.multiplier > visibleGroups ? "<b aria-hidden=\"true\">…</b>" : "";
  return `<div class="ke-family__place-partial" data-place-partial="${partial.placeIndex}"><div class="ke-family__place-partial-groups" aria-hidden="true">${groups}${overflow}</div><strong>${familyUiMarkup(`${PLACE_LABELS[partial.placeIndex]}の位：${numberValue(partial.groupValue)} が ${numberValue(partial.multiplier)}こ → ${numberValue(partial.product)}`)}</strong></div>`;
}

function placePartialProductsMarkup(partials: readonly PlacePartialProduct[]): string {
  return `<section class="ke-family__place-partials" data-place-partials><strong>${familyUiMarkup("位ごとの、同じ数のまとまり")}</strong><div data-place-partial-items>${partials.map(placePartialProductItem).join("")}</div></section>`;
}

function placeDivisionGroupItems(divisor: number, quotient: number): string {
  const visibleGroups = Math.min(12, divisor);
  const groups = Array.from(
    { length: visibleGroups },
    (_, index) => `<div class="ke-family__place-division-group"><span>${index + 1}</span><strong>${numberValue(quotient)}こ</strong></div>`,
  ).join("");
  const overflow = divisor > visibleGroups
    ? `<span class="ke-family__place-division-overflow">…（ぜんぶで ${numberValue(divisor)}くみ）</span>`
    : "";
  return `${groups}${overflow}`;
}

function placeRemainderItems(remainder: number): string {
  const overflow = remainder > 40
    ? `<span class="ke-family__place-division-overflow" data-place-remainder-overflow>…（ぜんぶで ${numberValue(remainder)}こ）</span>`
    : "";
  return `${counterTokens(remainder, "ke-family__counter--second")}${overflow}`;
}

function renderPlaceValue(config: FamilyInteractiveConfig): string {
  const showSecond = ["regroup-add", "regroup-subtract", "decimal", "multiply", "divide"].includes(config.mode);
  const decimal = config.mode === "decimal";
  const model = placeOperationModel(config.mode as PlaceOperationMode, config.value, config.second);
  const decimalResult = Number((config.operation === "subtract"
    ? config.value - config.second
    : config.value + config.second).toFixed(10));
  const largestMagnitude = Math.max(
    0,
    config.max,
    config.value,
    config.second,
    Math.abs(decimal ? decimalResult : model.result),
    model.quotient,
  );
  const integerColumnCount = Math.max(
    1,
    Math.min(5, String(Math.floor(largestMagnitude)).length),
  );
  const startIndex = 5 - integerColumnCount;
  const columnCount = integerColumnCount + (decimal ? 1 : 0);
  const minimumWidth = columnCount * 4.25 + Math.max(0, columnCount - 1) * 0.4;
  const placeStyle = ` style="--ke-place-columns: ${columnCount}; --ke-place-min: ${numberValue(minimumWidth)}rem"`;
  const sources = new Set(model.regroupEvents.map(({ fromIndex }) => fromIndex));
  const targets = new Set(model.regroupEvents.map(({ toIndex }) => toIndex));
  const divisor = Math.max(1, Math.floor(config.second));
  const valueHighlights = config.mode === "regroup-subtract"
    ? { sources, targets }
    : { sources };
  const secondHighlights = config.mode === "regroup-add" ? { sources } : {};
  const operationResult = ["regroup-add", "regroup-subtract", "decimal", "multiply"].includes(config.mode)
    ? `<div class="ke-family__place-operation-result"><span class="ke-family__place-operator" aria-hidden="true">=</span><div class="ke-family__place-board" data-place-board="result">${placeValueColumns(decimal ? decimalResult : model.result, "result", decimal, { targets }, startIndex)}</div></div>`
    : "";
  const regroup = ["regroup-add", "regroup-subtract"].includes(config.mode)
    ? placeRegroupMarkup(model.regroupEvents)
    : "";
  const partials = config.mode === "multiply"
    ? placePartialProductsMarkup(model.partialProducts)
    : "";
  const divisionResult = config.mode === "divide"
    ? `<div class="ke-family__place-division-result"><span class="ke-family__place-operator" aria-hidden="true">=</span><div class="ke-family__place-board" data-place-board="quotient">${placeValueColumns(model.quotient, "quotient", false, {}, startIndex)}</div><section class="ke-family__place-distribution"><strong data-place-division-summary>${familyUiMarkup(`${numberValue(divisor)}つの組に、${numberValue(model.quotient)}こずつ`)}</strong><div class="ke-family__place-division-groups" data-place-division-groups>${placeDivisionGroupItems(divisor, model.quotient)}</div></section><div class="ke-family__place-remainder"><strong data-place-remainder-label>あまり ${numberValue(model.remainder)}こ</strong><div data-place-remainder-tokens>${placeRemainderItems(model.remainder)}</div></div></div>`
    : "";
  const operationSymbol = config.mode === "regroup-add" || (decimal && config.operation === "add")
    ? "+"
    : config.mode === "regroup-subtract" || (decimal && config.operation === "subtract")
      ? "−"
      : config.mode === "multiply" ? "×" : "÷";
  return `<div class="ke-family__place-stack${decimal ? " ke-family__place-stack--decimal" : ""}" data-place-decimal="${decimal ? "true" : "false"}"${placeStyle}><div class="ke-family__place-board" data-place-board="value">${placeValueColumns(config.value, "value", decimal, valueHighlights, startIndex)}</div>${showSecond ? `<div class="ke-family__place-operator" data-place-operation-symbol aria-hidden="true">${operationSymbol}</div><div class="ke-family__place-board" data-place-board="second">${placeValueColumns(config.second, "second", decimal, secondHighlights, startIndex)}</div>` : ""}${regroup}${operationResult}${partials}${divisionResult}</div>`;
}

function linePosition(config: FamilyInteractiveConfig, value: number): number {
  const ratio = (value - config.min) / (config.max - config.min);
  return 40 + Math.max(0, Math.min(1, ratio)) * 480;
}

function renderNumberLine(config: FamilyInteractiveConfig): string {
  const middleValue = config.min + (config.max - config.min) / 2;
  const dynamicMarkerUsesMiddle = config.mode !== "zero" &&
    (Math.abs(config.value - middleValue) < Number.EPSILON ||
      Math.abs(config.second - middleValue) < Number.EPSILON);
  const ticks = Array.from({ length: 11 }, (_, index) => {
    const x = 40 + index * 48;
    const value = config.min + ((config.max - config.min) * index) / 10;
    const label = index === 0 || index === 5 || index === 10
      ? `<text${index === 5 ? ` data-line-tick="middle"${dynamicMarkerUsesMiddle ? " hidden" : ""}` : ""} x="${x}" y="175" text-anchor="middle">${escapeHtml(numberValue(value))}</text>`
      : "";
    return `<line x1="${x}" y1="118" x2="${x}" y2="145"></line>${label}`;
  }).join("");
  if (config.mode === "zero") {
    const zeroX = linePosition(config, 0);
    return `<svg class="ke-family__svg" viewBox="0 0 560 210" aria-hidden="true"><line class="ke-family__line" x1="40" y1="130" x2="520" y2="130"></line>${ticks}<line class="ke-family__line-guide" x1="${numberValue(zeroX)}" y1="105" x2="${numberValue(zeroX)}" y2="118"></line><circle class="ke-family__marker" data-line-zero cx="${numberValue(zeroX)}" cy="92" r="13"></circle><text x="${numberValue(zeroX + 12)}" y="58" text-anchor="start">0（はじまり）</text></svg>`;
  }
  const valueX = linePosition(config, config.value);
  const secondX = linePosition(config, config.second);
  return `<svg class="ke-family__svg ke-family__number-line" viewBox="0 0 560 270" aria-hidden="true">
<line class="ke-family__line" x1="40" y1="130" x2="520" y2="130"></line>${ticks}
<line class="ke-family__line-guide" data-line-guide="value" x1="${numberValue(valueX)}" y1="105" x2="${numberValue(valueX)}" y2="118"></line>
<circle class="ke-family__marker" data-line-marker="value" cx="${numberValue(valueX)}" cy="92" r="13"></circle>
<text data-line-label="value" x="${numberValue(valueX)}" y="58" text-anchor="middle">${escapeHtml(numberValue(config.value))}</text>
<line class="ke-family__line-guide ke-family__line-guide--second" data-line-guide="second" x1="${numberValue(secondX)}" y1="145" x2="${numberValue(secondX)}" y2="195"></line>
<circle class="ke-family__marker ke-family__marker--second" data-line-marker="second" cx="${numberValue(secondX)}" cy="208" r="13"></circle>
<text data-line-label="second" x="${numberValue(secondX)}" y="255" text-anchor="middle">${escapeHtml(numberValue(config.second))}</text>
</svg>`;
}

function fractionBar(
  name: string,
  parts: number,
  selected: number,
  y: number,
): string {
  const width = 480 / parts;
  return Array.from({ length: parts }, (_, index) =>
    `<rect class="ke-family__fraction-part${index < selected ? " is-selected" : ""}" data-fraction-bar="${name}" data-fraction-index="${index}" x="${numberValue(40 + index * width)}" y="${y}" width="${numberValue(width)}" height="62"></rect>`,
  ).join("");
}

function renderFraction(config: FamilyInteractiveConfig): string {
  const showSecond = config.mode === "compare";
  if (config.mode === "add-subtract") {
    const operation = config.operation === "subtract" ? "subtract" : "add";
    const model = fractionOperationModel(
      config.parts,
      config.selected,
      config.secondParts,
      config.second,
      operation,
    );
    const numerator = model?.numerator ?? 0;
    const firstResult = Math.min(config.parts, numerator);
    const secondResult = Math.max(0, numerator - config.parts);
    return `<svg class="ke-family__svg ke-family__fraction-operation" data-fraction-operation-scene viewBox="0 0 560 ${secondResult > 0 ? 420 : 335}" aria-hidden="true">
${fractionBar("selected", config.parts, config.selected, 25)}
<text data-fraction-operation-symbol x="280" y="125" text-anchor="middle">${operation === "subtract" ? "−" : "+"}</text>
${fractionBar("second", config.secondParts, config.second, 145)}
<text x="280" y="235" text-anchor="middle">=</text>
${fractionBar("result-0", config.parts, firstResult, 255)}
<g data-fraction-result-extra${secondResult > 0 ? "" : " hidden"}>${fractionBar("result-1", config.parts, secondResult, 338)}</g>
</svg>`;
  }
  return `<svg class="ke-family__svg" viewBox="0 0 560 230" aria-hidden="true">
${fractionBar("selected", config.parts, config.selected, 35)}
${showSecond ? fractionBar("second", config.secondParts, config.second, 132) : ""}
</svg>`;
}

function renderBalance(config: FamilyInteractiveConfig): string {
  const mode = config.interactiveKind === "equation-balance"
    ? config.mode as "equality" | "unknown" | "properties"
    : "equality";
  const model = equationBalanceModel(mode, config.operation, config.value, config.second, config.selected);
  return `<svg class="ke-family__svg ke-family__balance" data-balance viewBox="0 0 560 270" aria-hidden="true"><path d="M280 105 L220 235 H340 Z"></path><g data-balance-beam transform="rotate(${numberValue(balanceTilt(model.leftValue, model.rightValue))} 280 105)"><line x1="60" y1="105" x2="500" y2="105"></line><path d="M125 105 V155 M435 105 V155"></path><rect x="20" y="155" width="210" height="55" rx="12"></rect><rect x="330" y="155" width="210" height="55" rx="12"></rect><text data-balance-label="value" x="125" y="188" text-anchor="middle">${escapeHtml(model.leftLabel)}</text><text data-balance-label="second" x="435" y="188" text-anchor="middle">${escapeHtml(model.rightLabel)}</text></g></svg>`;
}

function geometryClamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function geometryProgress(value: number): number {
  return geometryClamp(value, 0, 100) / 100;
}

function geometryPath(points: readonly (readonly [number, number])[]): string {
  return `${points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${numberValue(x)} ${numberValue(y)}`).join(" ")} Z`;
}

function rightAngleMarkerPath(x: number, y: number, width: number, height: number): string {
  const inset = Math.min(18, width / 5, height / 5);
  return `M${numberValue(x)} ${numberValue(y + inset)} H${numberValue(x + inset)} V${numberValue(y)} M${numberValue(x + width - inset)} ${numberValue(y)} V${numberValue(y + inset)} H${numberValue(x + width)} M${numberValue(x + width)} ${numberValue(y + height - inset)} H${numberValue(x + width - inset)} V${numberValue(y + height)} M${numberValue(x + inset)} ${numberValue(y + height)} V${numberValue(y + height - inset)} H${numberValue(x)}`;
}

function geometryProgressMarkup(value: number): string {
  const width = geometryProgress(value) * 400;
  return `<g class="ke-family__geometry-progress"><rect x="80" y="232" width="400" height="10" rx="5"></rect><rect data-geometry-progress x="80" y="232" width="${numberValue(width)}" height="10" rx="5"></rect><circle data-geometry-drag="value" class="ke-family__geometry-drag" cx="${numberValue(80 + width)}" cy="237" r="14"></circle></g>`;
}

function solidPath(value: number): string {
  const angle = (geometryClamp(value, 0, 60) * Math.PI) / 180;
  const dx = 58 + Math.cos(angle) * 34;
  const dy = -24 - Math.sin(angle) * 24;
  const left = 150;
  const right = 350;
  const top = 75;
  const bottom = 205;
  return `M${numberValue(left + dx)} ${numberValue(top + dy)} H${numberValue(right + dx)} V${numberValue(bottom + dy)} H${numberValue(left + dx)} Z M${left} ${top} H${right} V${bottom} H${left} Z M${left} ${top} L${numberValue(left + dx)} ${numberValue(top + dy)} M${right} ${top} L${numberValue(right + dx)} ${numberValue(top + dy)} M${right} ${bottom} L${numberValue(right + dx)} ${numberValue(bottom + dy)} M${left} ${bottom} L${numberValue(left + dx)} ${numberValue(bottom + dy)}`;
}

function geometryScene(config: FamilyInteractiveConfig): string {
  const value = config.value;
  switch (config.mode) {
    case "point-line": {
      const pointX = 280 + geometryClamp(value, 0, 10) * 16;
      const verticalGrid = Array.from({ length: 21 }, (_, index) => `M${120 + index * 16} 55 V205`).join(" ");
      return `<path class="ke-family__geometry-grid" d="M80 70 H480 M80 100 H480 M80 130 H480 M80 160 H480 M80 190 H480 ${verticalGrid}"></path><line data-point-line x1="65" y1="130" x2="495" y2="130"></line><path data-point-distance class="ke-family__geometry-measure" d="M120 205 V188 H${numberValue(pointX)} V205"></path><circle cx="120" cy="130" r="8"></circle><circle data-point-b cx="${numberValue(pointX)}" cy="130" r="8"></circle><circle data-geometry-drag="value" class="ke-family__geometry-hit" cx="${numberValue(pointX)}" cy="130" r="24"></circle><text x="120" y="112" text-anchor="middle">A</text><text data-point-label x="${numberValue(pointX)}" y="112" text-anchor="middle">B</text><text x="280" y="230" text-anchor="middle">2てんをとおる1ぽんのちょくせん</text>`;
    }
    case "segment": {
      const betweenX = 280 + geometryClamp(value, 0, 10) * 12;
      return `<line x1="110" y1="135" x2="450" y2="135"></line><circle cx="110" cy="135" r="8"></circle><circle class="ke-family__shape--accent" data-between-point cx="${numberValue(betweenX)}" cy="135" r="8"></circle><circle data-geometry-drag="value" class="ke-family__geometry-hit" cx="${numberValue(betweenX)}" cy="135" r="24"></circle><circle cx="450" cy="135" r="8"></circle><text x="110" y="108" text-anchor="middle">A</text><text data-segment-label x="${numberValue(betweenX)}" y="108" text-anchor="middle">B</text><text x="450" y="108" text-anchor="middle">C</text><path class="ke-family__geometry-measure" d="M110 190 V170 H450 V190"></path><text x="280" y="218" text-anchor="middle">BはAとCのあいだ</text>`;
    }
    case "recognize": {
      const angle = geometryClamp(value, 0, 360);
      return `<g data-recognize-shape data-factor="1" transform="rotate(${numberValue(angle)} 115 125)"><circle cx="115" cy="125" r="52"></circle><line x1="115" y1="125" x2="167" y2="125"></line><circle class="ke-family__shape--accent" cx="167" cy="125" r="5"></circle></g><g data-recognize-shape data-factor="-1" transform="rotate(${numberValue(-angle)} 280 125)"><path d="M218 180 L280 62 L342 180 Z"></path></g><g data-recognize-shape data-factor="0.5" transform="rotate(${numberValue(angle * 0.5)} 445 125)"><rect x="390" y="82" width="110" height="86"></rect></g><text x="115" y="220" text-anchor="middle">まる</text><text x="280" y="220" text-anchor="middle">さんかく</text><text x="445" y="220" text-anchor="middle">しかく</text>`;
    }
    case "compose": {
      const progress = geometryProgress(value);
      const offset = (1 - progress) * 90;
      return `<rect class="ke-family__geometry-target" x="160" y="55" width="240" height="150" rx="3"></rect><g data-compose-piece="left" transform="translate(${numberValue(-offset)} 0)"><path class="ke-family__shape--accent" d="M160 55 H400 L160 205 Z"></path></g><g data-compose-piece="right" data-geometry-drag="value" transform="translate(${numberValue(offset)} 0)"><path d="M400 55 V205 H160 Z"></path></g>${geometryProgressMarkup(value)}`;
    }
    case "elements": {
      const selected = ["edge", "vertex"][Math.floor(value) % 2] ?? "edge";
      return `<path data-geometry-element="edge" class="ke-family__geometry-edge ${selected === "edge" ? "is-active" : ""}" d="M155 190 L280 55 L425 190 Z"></path><g data-geometry-element="vertex" class="${selected === "vertex" ? "is-active" : ""}"><circle cx="155" cy="190" r="7"></circle><circle cx="280" cy="55" r="7"></circle><circle cx="425" cy="190" r="7"></circle></g><text x="280" y="230" text-anchor="middle">3ぼんのへん・3このちょうてん</text>`;
    }
    case "position": {
      const positions = [[280, 70], [420, 130], [280, 195], [140, 130], [280, 130]] as const;
      const [x, y] = positions[Math.floor(value) % positions.length] ?? positions[0];
      return `<path class="ke-family__geometry-grid" d="M80 45 V215 M160 45 V215 M240 45 V215 M320 45 V215 M400 45 V215 M480 45 V215 M80 55 H500 M80 105 H500 M80 155 H500 M80 205 H500"></path><path class="ke-family__position-axis" d="M280 40 V220 M65 130 H495 M280 40 l-8 12 M280 40 l8 12 M495 130 l-12 -8 M495 130 l-12 8"></path><circle data-position-object class="ke-family__shape--accent" cx="${x}" cy="${y}" r="18"></circle><circle class="ke-family__position-reference" cx="280" cy="130" r="10"></circle><path class="ke-family__position-reference-leader" d="M288 138 L316 158"></path><text x="322" y="166">きじゅん O</text><text x="280" y="32" text-anchor="middle">うえ</text><text x="515" y="136">みぎ</text><text x="280" y="238" text-anchor="middle">した</text><text x="42" y="136">ひだり</text>`;
    }
    case "triangle": {
      const apexX = 280 + (geometryClamp(value, 0, 60) - 30) * 2.2;
      return `<path data-geometry-shape="triangle" d="${geometryPath([[125, 205], [apexX, 48], [435, 205]])}"></path><g class="ke-family__geometry-vertices"><circle cx="125" cy="205" r="6"></circle><circle data-triangle-apex cx="${numberValue(apexX)}" cy="48" r="6"></circle><circle cx="435" cy="205" r="6"></circle></g><text x="280" y="238" text-anchor="middle">3ぼんのへん・3このちょうてん</text>`;
    }
    case "quadrilateral": {
      const shift = (geometryClamp(value, 0, 60) - 30) * 1.3;
      const points = [[105, 195], [190 + shift, 55 + Math.abs(shift) * 0.15], [410 - shift * 0.35, 75 - shift * 0.2], [465, 200]] as const;
      return `<path data-geometry-shape="quadrilateral" d="${geometryPath(points)}"></path><g class="ke-family__geometry-vertices">${points.map(([x, y], index) => `<circle data-quadrilateral-vertex="${index}" cx="${numberValue(x)}" cy="${numberValue(y)}" r="6"></circle>`).join("")}</g><text x="280" y="238" text-anchor="middle">4ほんのへん・4このちょうてん</text>`;
    }
    case "rectangle": {
      const width = 180 * (1 + geometryClamp(value, 0, 100) / 100);
      const x = 280 - width / 2;
      return `<rect data-geometry-rect x="${numberValue(x)}" y="65" width="${numberValue(width)}" height="140"></rect><path data-right-angle-markers d="${rightAngleMarkerPath(x, 65, width, 140)}"></path><text x="280" y="235" text-anchor="middle">4つのちょっかく</text>`;
    }
    case "square": {
      const side = 100 + geometryClamp(value, 0, 100);
      const x = 280 - side / 2;
      const y = 110 - side / 2;
      return `<rect data-geometry-square x="${numberValue(x)}" y="${numberValue(y)}" width="${numberValue(side)}" height="${numberValue(side)}"></rect><path data-right-angle-markers d="${rightAngleMarkerPath(x, y, side, side)}"></path><text x="280" y="247" text-anchor="middle">4ほんともおなじながさ</text>`;
    }
    case "right-angle": {
      const height = 100 + geometryClamp(value, 0, 60);
      const top = 210 - height;
      return `<path data-geometry-shape="right-angle" d="M120 210 L120 ${numberValue(top)} L455 210 Z"></path><path data-right-angle-corner d="M120 184 H146 V210"></path><text x="146" y="178">90°</text>`;
    }
    case "congruence": {
      const progress = geometryProgress(value);
      const offset = (1 - progress) * 240;
      const angle = (1 - progress) * 24;
      return `<g data-congruence-moving data-geometry-drag="value" transform="translate(${numberValue(offset)} 0) rotate(${numberValue(angle)} 170 150)"><path class="ke-family__shape--accent" d="M90 205 L170 65 L250 205 Z"></path></g><path class="ke-family__geometry-target-underlay" d="M90 205 L170 65 L250 205 Z"></path><path class="ke-family__geometry-target ke-family__geometry-target--outline" data-congruence-target d="M90 205 L170 65 L250 205 Z"></path>${geometryProgressMarkup(value)}`;
    }
    case "isosceles": {
      const stretch = 1 + geometryClamp(value, 0, 60) / 120;
      const scale = 0.82 + geometryClamp(value, 0, 60) / 300;
      return `<g data-isosceles-shape transform="translate(0 205) scale(1 ${numberValue(stretch)}) translate(0 -205)"><path d="M70 205 L160 95 L250 205 Z"></path><path class="ke-family__geometry-equal-marks" d="M108 150 l14 10 M198 160 l14 -10"></path></g><g data-equilateral-shape transform="translate(405 205) scale(${numberValue(scale)}) translate(-405 -205)"><path class="ke-family__shape--accent" d="M315 205 L405 49.115 L495 205 Z"></path><path class="ke-family__geometry-equal-marks" d="M353 139 l14 10 M398 190 h14 M443 149 l14 -10"></path></g><text x="160" y="238" text-anchor="middle">2ほんがおなじ</text><text x="405" y="238" text-anchor="middle">3ぼんがおなじ</text>`;
    }
    case "circle": {
      const radius = geometryClamp(value, 0, 10) * 10;
      return `<circle data-geometry-radius cx="280" cy="130" r="${numberValue(radius)}"></circle><line data-geometry-diameter-line x1="${numberValue(280 - radius)}" y1="130" x2="${numberValue(280 + radius)}" y2="130"></line><line data-geometry-radius-line x1="280" y1="130" x2="${numberValue(280 + radius)}" y2="130"></line><circle cx="280" cy="130" r="7"></circle><text x="292" y="151">O</text>`;
    }
    case "sphere": {
      const distance = geometryClamp(value, 0, 10);
      const distanceSvg = (distance / 10) * 96;
      const sectionRadius = Math.sqrt(Math.max(0, 96 * 96 - distanceSvg * distanceSvg));
      const planeY = 130 - distanceSvg * 0.75;
      const handleX = 280 + sectionRadius;
      const labelY = geometryClamp(planeY + 6, 50, 210);
      return `<circle class="ke-family__sphere-outline" cx="280" cy="130" r="96"></circle><path class="ke-family__sphere-meridian" d="M280 34 C220 75 220 185 280 226 M280 34 C340 75 340 185 280 226"></path><ellipse data-sphere-cut cx="280" cy="${numberValue(planeY)}" rx="${numberValue(sectionRadius)}" ry="${numberValue(sectionRadius * 0.27)}"></ellipse><line data-sphere-distance x1="280" y1="130" x2="280" y2="${numberValue(planeY)}"></line><circle class="ke-family__position-reference" cx="280" cy="130" r="6"></circle><circle data-sphere-handle data-geometry-drag="value" class="ke-family__geometry-drag" cx="${numberValue(handleX)}" cy="${numberValue(planeY)}" r="12"></circle><line data-sphere-label-leader x1="${numberValue(handleX + 12)}" y1="${numberValue(planeY)}" x2="408" y2="${numberValue(planeY)}"></line><text data-sphere-label x="420" y="${numberValue(labelY)}">${numberValue(distance)} cm</text><text x="292" y="151">O</text>`;
    }
    case "solid": {
      const angle = (geometryClamp(value, 0, 60) * Math.PI) / 180;
      const edgeX = 350 + 58 + Math.cos(angle) * 34;
      const edgeY = 75 - 24 - Math.sin(angle) * 24;
      return `<path data-solid-shape class="ke-family__solid-shape" d="${solidPath(value)}"></path><text x="250" y="150" text-anchor="middle">めん</text><line data-solid-edge-leader x1="${numberValue(edgeX)}" y1="${numberValue(edgeY)}" x2="462" y2="68"></line><text x="470" y="78">へん</text><circle class="ke-family__shape--accent" cx="350" cy="205" r="6"></circle><text x="365" y="225">ちょうてん</text>`;
    }
    case "tiling": {
      const progress = geometryProgress(value);
      const gap = 12 * (1 - progress);
      const tileWidth = (400 - gap * 4) / 5;
      const tileHeight = (160 - gap) / 2;
      const tiles = Array.from({ length: 10 }, (_, index) => {
        const row = Math.floor(index / 5);
        const column = index % 5;
        const x = 80 + column * (tileWidth + gap);
        const y = 55 + row * (tileHeight + gap);
        return `<rect data-tiling-tile="${index}" data-row="${row}" data-column="${column}" x="${numberValue(x)}" y="${numberValue(y)}" width="${numberValue(tileWidth)}" height="${numberValue(tileHeight)}"></rect>`;
      }).join("");
      return `<rect class="ke-family__geometry-target" x="80" y="55" width="400" height="160"></rect><g data-tiling-tiles>${tiles}</g>${geometryProgressMarkup(value)}`;
    }
    case "euclidean": {
      const gap = (3 + geometryClamp(value, 0, 5)) * 20;
      const parallelY = 190 - gap;
      const horizontalGrid = Array.from({ length: 10 }, (_, index) => `M65 ${30 + index * 20} H495`).join(" ");
      return `<path class="ke-family__geometry-grid" d="M80 30 V220 M120 30 V220 M160 30 V220 M200 30 V220 M240 30 V220 M280 30 V220 M320 30 V220 M360 30 V220 M400 30 V220 M440 30 V220 M480 30 V220 ${horizontalGrid}"></path><line x1="70" y1="190" x2="500" y2="190"></line><line data-euclidean-parallel x1="70" y1="${numberValue(parallelY)}" x2="500" y2="${numberValue(parallelY)}"></line><circle data-euclidean-point class="ke-family__shape--accent" cx="280" cy="${numberValue(parallelY)}" r="8"></circle><circle data-geometry-drag="value" class="ke-family__geometry-hit" cx="280" cy="${numberValue(parallelY)}" r="24"></circle><text data-euclidean-label x="294" y="${numberValue(Math.max(20, parallelY - 12))}">P</text><path data-euclidean-distance class="ke-family__geometry-measure" d="M95 ${numberValue(parallelY)} H80 V190 H95"></path><text x="280" y="230" text-anchor="middle">2ほんのへいこうせん</text>`;
    }
    default:
      return `<circle cx="280" cy="130" r="80"></circle>`;
  }
}

function renderGeometry(config: FamilyInteractiveConfig): string {
  return `<svg class="ke-family__svg ke-family__geometry ke-family__geometry--${escapeHtml(config.mode)}" data-geometry-mode="${escapeHtml(config.mode)}" viewBox="0 0 560 260" aria-hidden="true">${geometryScene(config)}</svg>`;
}

function clockHand(angle: number, length: number): { x: number; y: number } {
  const radians = ((angle - 90) * Math.PI) / 180;
  return { x: 280 + Math.cos(radians) * length, y: 130 + Math.sin(radians) * length };
}

async function metricRelationsMarkup(
  relations: readonly { text: string; tex: string }[],
  locale: "ja" | "en",
): Promise<string> {
  const items = await Promise.all(relations.map(async ({ text, tex }) => {
    const rendered = await renderArticleMath({ tex, display: false, profile: "core", locale });
    return `<div aria-label="${escapeHtml(text)}">${rendered.markup}</div>`;
  }));
  return `<div class="ke-family__metric-relations">${items.join("")}</div>`;
}

async function renderMeasurement(
  config: FamilyInteractiveConfig,
  locale: "ja" | "en",
): Promise<string> {
  if (config.mode === "elapsed") {
    const face = (center: number, hourValue: number, name: "value" | "second") => {
      const hand = clockHand((hourValue % 12) * 30, 58);
      const shiftedX = hand.x - 280 + center;
      return `<circle cx="${center}" cy="130" r="92"></circle>${Array.from({ length: 12 }, (_, index) => {
        const point = clockHand(index * 30, 77);
        return `<circle cx="${numberValue(point.x - 280 + center)}" cy="${numberValue(point.y)}" r="3"></circle>`;
      }).join("")}<line data-elapsed-hand="${name}" x1="${center}" y1="130" x2="${numberValue(shiftedX)}" y2="${numberValue(hand.y)}"></line><line x1="${center}" y1="130" x2="${center}" y2="58"></line><circle cx="${center}" cy="130" r="6"></circle><text data-elapsed-time="${name}" x="${center}" y="250" text-anchor="middle">${numberValue(hourValue)}:00</text>`;
    };
    return `<svg class="ke-family__svg ke-family__clock" viewBox="0 0 560 260" aria-hidden="true">${face(165, config.value, "value")}<path class="ke-family__elapsed-arrow" d="M270 130 H300 M290 120 L300 130 L290 140"></path>${face(395, config.second, "second")}</svg>`;
  }
  if (config.mode === "seconds") {
    const secondAngle = (config.value % 60) * 6;
    const secondHand = clockHand(secondAngle, 91);
    return `<svg class="ke-family__svg ke-family__clock" viewBox="0 0 560 260" aria-hidden="true"><circle cx="280" cy="130" r="105"></circle>${Array.from({ length: 60 }, (_, index) => {
      const point = clockHand(index * 6, index % 5 === 0 ? 88 : 94);
      return `<circle cx="${numberValue(point.x)}" cy="${numberValue(point.y)}" r="${index % 5 === 0 ? 3 : 1.4}"></circle>`;
    }).join("")}<line data-clock-hand="second" x1="280" y1="130" x2="${numberValue(secondHand.x)}" y2="${numberValue(secondHand.y)}"></line><circle cx="280" cy="130" r="7"></circle></svg>`;
  }
  if (config.mode === "duration") {
    const relations = await metricRelationsMarkup([
      { text: "1 day = 24 hours", tex: "1\\,\\mathrm{day}=24\\,\\mathrm{hours}" },
      { text: "1 hour = 60 minutes", tex: "1\\,\\mathrm{hour}=60\\,\\mathrm{minutes}" },
    ], locale);
    const minuteWidth = Math.max(0, Math.min(520, (config.second / 60) * 520));
    return `<div class="ke-family__duration"><div class="ke-family__day-track" data-duration-hours>${Array.from({ length: 24 }, (_, hour) => `<span class="${hour < config.value ? "is-active" : ""}" data-duration-hour="${hour}">${hour + 1}</span>`).join("")}</div><svg class="ke-family__duration-minutes" viewBox="0 0 560 80" aria-hidden="true"><rect x="20" y="20" width="520" height="32" rx="12"></rect><rect data-duration-minute-fill x="20" y="20" width="${numberValue(minuteWidth)}" height="32" rx="12"></rect><text data-duration-minute-label x="280" y="75" text-anchor="middle">${numberValue(config.second)} / 60 ふん</text></svg>${relations}</div>`;
  }
  if (config.mode === "clock") {
    const minuteAngle = (config.second % 60) * 6;
    const hourAngle = (config.value % 12) * 30 + minuteAngle / 12;
    const hour = clockHand(hourAngle, 58);
    const minute = clockHand(minuteAngle, 86);
    const timeLabel = `${numberValue(config.value)}:${String(Math.floor(config.second)).padStart(2, "0")}`;
    return `<svg class="ke-family__svg ke-family__clock" viewBox="0 0 560 285" aria-hidden="true"><circle cx="280" cy="130" r="105"></circle>${Array.from({ length: 12 }, (_, index) => {
      const point = clockHand(index * 30, 88);
      return `<circle cx="${numberValue(point.x)}" cy="${numberValue(point.y)}" r="3"></circle>`;
    }).join("")}<line data-clock-hand="hour" x1="280" y1="130" x2="${numberValue(hour.x)}" y2="${numberValue(hour.y)}"></line><line data-clock-hand="minute" x1="280" y1="130" x2="${numberValue(minute.x)}" y2="${numberValue(minute.y)}"></line><circle cx="280" cy="130" r="7"></circle><text data-clock-time x="280" y="270" text-anchor="middle">${timeLabel}</text></svg>`;
  }
  if (config.mode === "capacity") {
    const model = capacityTransferModel(config.value, config.second, config.max);
    const remainingHeight = 150 * (model.remaining / config.max);
    const containedHeight = 150 * (model.contained / config.max);
    const spillRadius = model.overflow <= 0
      ? 0
      : Math.max(8, Math.min(52, 52 * (model.overflow / Math.max(1, config.max * 0.4))));
    const unit = config.unit === "none" ? "" : ` ${config.unit}`;
    return `<svg class="ke-family__svg ke-family__capacity-transfer" data-capacity-transfer viewBox="0 0 600 300" aria-hidden="true"><path data-capacity-vessel="value" d="M70 40 H255 L235 225 H90 Z"></path><rect data-capacity-fill="remaining" x="93" y="${numberValue(220 - remainingHeight)}" width="139" height="${numberValue(remainingHeight)}"></rect><path class="ke-family__capacity-arrow" d="M260 90 H318 M304 76 L318 90 L304 104"></path><text data-capacity-transfer-label x="290" y="65" text-anchor="middle">${locale === "ja" ? "Bへ" : "to B"} ${numberValue(model.transferred)}${unit}</text><path data-capacity-vessel="second" d="M325 130 H465 L450 225 H340 Z"></path><rect data-capacity-fill="contained" x="343" y="${numberValue(220 - containedHeight)}" width="104" height="${numberValue(containedHeight)}"></rect><line class="ke-family__capacity-limit" x1="325" y1="130" x2="465" y2="130"></line><ellipse data-capacity-spill cx="525" cy="220" rx="${numberValue(spillRadius)}" ry="${numberValue(spillRadius * 0.28)}"${model.overflow <= 0 ? " hidden" : ""}></ellipse><text data-capacity-label="remaining" x="160" y="275" text-anchor="middle">A ${numberValue(model.remaining)}${unit}</text><text data-capacity-label="contained" x="395" y="275" text-anchor="middle">B ${numberValue(model.contained)}${unit}</text><text data-capacity-label="overflow" x="525" y="275" text-anchor="middle">${locale === "ja" ? "こぼれ" : "spill"} ${numberValue(model.overflow)}${unit}</text><text data-capacity-limit-label x="395" y="116" text-anchor="middle">${locale === "ja" ? "Bのようりょう" : "B capacity"} ${numberValue(model.vesselCapacity)}${unit}</text></svg>`;
  }
  if (config.mode === "metric-capacity") {
    const firstHeight = 150 * Math.max(0, Math.min(1, config.value / config.max));
    const secondHeight = 150 * Math.max(0, Math.min(1, config.second / config.max));
    const relations = await metricRelationsMarkup([
      { text: "100 mL = 1 dL", tex: "100\\,\\mathrm{mL}=1\\,\\mathrm{dL}" },
      { text: "10 dL = 1 L", tex: "10\\,\\mathrm{dL}=1\\,\\mathrm{L}" },
      { text: "1000 mL = 1 L", tex: "1000\\,\\mathrm{mL}=1\\,\\mathrm{L}" },
    ], locale);
    return `<div class="ke-family__metric-capacity"><svg class="ke-family__svg ke-family__cup" viewBox="0 0 560 260" aria-hidden="true"><path d="M70 40 H255 L235 225 H90 Z"></path><rect data-measure-fill="value" x="93" y="${numberValue(220 - firstHeight)}" width="139" height="${numberValue(firstHeight)}"></rect><path d="M310 40 H495 L475 225 H330 Z"></path><rect data-measure-fill="second" x="333" y="${numberValue(220 - secondHeight)}" width="139" height="${numberValue(secondHeight)}"></rect>${Array.from({ length: 6 }, (_, index) => `<path d="M235 ${55 + index * 30} H255 M475 ${55 + index * 30} H495"></path>`).join("")}<text x="160" y="250" text-anchor="middle">A</text><text x="400" y="250" text-anchor="middle">B</text></svg><div data-capacity-unit-relations>${relations}</div></div>`;
  }
  if (config.mode === "conservation") {
    const fills = conservationFillModel(config.value, config.max);
    return `<svg class="ke-family__svg ke-family__conservation" viewBox="0 0 560 260" aria-hidden="true"><rect x="95" y="30" width="130" height="195" rx="8"></rect><rect data-conservation-fill="left" x="${numberValue(fills.left.x)}" y="${numberValue(fills.left.y)}" width="${numberValue(fills.left.width)}" height="${numberValue(fills.left.height)}"></rect><rect x="315" y="115" width="190" height="110" rx="8"></rect><rect data-conservation-fill="right" x="${numberValue(fills.right.x)}" y="${numberValue(fills.right.y)}" width="${numberValue(fills.right.width)}" height="${numberValue(fills.right.height)}"></rect><path class="ke-family__same-mark" d="M255 118 H305 M255 138 H305"></path></svg>`;
  }
  if (config.mode === "area") {
    const tileCount = Math.max(1, Math.min(20, Math.floor(config.max)));
    const first = Math.max(0, Math.min(tileCount, Math.floor(config.value)));
    const second = Math.max(0, Math.min(tileCount, Math.floor(config.second)));
    return `<svg class="ke-family__svg ke-family__area-tiles" viewBox="0 0 560 360" aria-hidden="true">${(["value", "second"] as const).map((name, group) => {
      const selected = name === "value" ? first : second;
      const top = 15 + group * 170;
      const tiles = Array.from({ length: tileCount }, (_, index) => {
        const column = index % 10;
        const row = Math.floor(index / 10);
        return `<rect class="ke-family__area-tile${index < selected ? " is-selected" : ""}" data-area-tile="${name}-${index}" x="${30 + column * 50}" y="${top + 45 + row * 50}" width="50" height="50"></rect>`;
      }).join("");
      return `<g data-area-group="${name}"><rect class="ke-family__area-group-frame" x="15" y="${top}" width="530" height="155" rx="12"></rect><text x="30" y="${top + 32}">${name === "value" ? "A" : "B"}</text><text data-area-count-label="${name}" x="530" y="${top + 32}" text-anchor="end">${numberValue(selected)}こ</text>${tiles}</g>`;
    }).join("")}</svg>`;
  }
  if (config.mode === "choose-tool") {
    const model = measurementToolChoiceModel(config.value, config.second);
    const tools = [
      { name: "ものさし", icon: "ke-family__ruler-icon" },
      { name: "カップ", icon: "ke-family__cup-icon" },
      { name: "はかり", icon: "ke-family__scale-icon" },
    ];
    const options = tools.map((tool, toolIndex) => {
      const units = MEASUREMENT_TOOL_OPTIONS.map((option, index) => ({ option, index }))
        .filter(({ option }) => option.toolIndex === toolIndex)
        .map(({ option, index }) => `<span class="ke-family__tool-unit${index === model.selectedIndex ? " is-active" : ""}" data-tool-index="${index}">${option.unit}</span>`)
        .join("");
      return `<div class="ke-family__tool-card${toolIndex === model.selectedToolIndex ? " is-active" : ""}" data-tool-card="${toolIndex}"><span class="${tool.icon}" aria-hidden="true"></span><span>${tool.name}</span><div class="ke-family__tool-units">${units}</div></div>`;
    }).join("");
    const feedback = model.isCorrect
      ? `${model.selectedToolJa}と${model.selectedUnit}が合っています。`
      : `${model.objectLabelJa}に合う道具と単位を、もう一度考えよう。`;
    return `<div class="ke-family__tool-lab"><div class="ke-family__tool-choice" data-tool-choice><div class="ke-family__object-card"><span class="ke-family__object-icon ke-family__object-icon--${model.objectIcon}" data-tool-object-icon aria-hidden="true"></span><span data-tool-object-label>${familyUiMarkup(model.objectLabelJa)}</span></div><div class="ke-family__tool-arrow" aria-hidden="true">→</div><div class="ke-family__tool-options">${options}</div></div><p class="ke-family__tool-feedback${model.isCorrect ? " is-correct" : ""}" data-tool-feedback>${familyUiMarkup(feedback)}</p></div>`;
  }
  if (config.mode === "unit-relations") {
    const selected = unitRelationIndex(config.value);
    return `<div class="ke-family__unit-relations" data-unit-relations>${UNIT_RELATIONS.map((relation, index) => `<div class="${index === selected ? "is-active" : ""}" data-unit-relation="${index}">${relation.text}</div>`).join("")}</div>`;
  }
  if (config.mode === "nonstandard") {
    const clips = (name: "value" | "second", count: number) => `<div class="ke-family__clip-row" data-clip-row="${name}">${Array.from({ length: Math.max(0, Math.min(20, Math.floor(count))) }, () => `<span class="ke-family__clip" aria-hidden="true"></span>`).join("")}</div>`;
    return `<div class="ke-family__clip-measure"><div><span>A</span>${clips("value", config.value)}</div><div><span>B</span>${clips("second", config.second)}</div></div>`;
  }
  if (config.mode === "standard") {
    const units = (name: "value" | "second", count: number, standard: boolean) => {
      const wholeCount = Math.max(1, Math.min(20, Math.floor(count)));
      return `<div class="ke-family__standard-row" data-standard-row="${name}" style="--ke-standard-count: ${wholeCount}">${Array.from({ length: wholeCount }, () => `<span class="${standard ? "ke-family__standard-unit" : "ke-family__hand-unit"}" aria-hidden="true"></span>`).join("")}</div>`;
    };
    const targetLabel = familyUiMarkup("同じ長さのもの");
    return `<div class="ke-family__standard-measure"><div class="ke-family__standard-target"><span>${targetLabel}</span></div><div><strong data-standard-label="value">${familyUiMarkup(`Aの単位で ${numberValue(config.value)}こ`)}</strong>${units("value", config.value, false)}</div><div class="ke-family__standard-target"><span>${targetLabel}</span></div><div><strong data-standard-label="second">${familyUiMarkup(`Bの単位で ${numberValue(config.second)}こ`)}</strong>${units("second", config.second, true)}</div></div>`;
  }
  if (config.mode === "compare") {
    const firstWidth = MEASUREMENT_COMPARE_BAR_MAX_WIDTH * Math.max(0, Math.min(1, config.value / config.max));
    const secondWidth = MEASUREMENT_COMPARE_BAR_MAX_WIDTH * Math.max(0, Math.min(1, config.second / config.max));
    const unit = config.unit === "none" ? "" : ` ${config.unit}`;
    const directHidden = config.selected % 2 === 0 ? "" : " hidden";
    const tapeHidden = config.selected % 2 === 1 ? "" : " hidden";
    return `<div class="ke-family__measurement-compare" data-measure-compare><svg class="ke-family__svg ke-family__compare-scene" data-measure-compare-scene="direct" viewBox="0 0 560 250" aria-hidden="true"${directHidden}><text x="280" y="28" text-anchor="middle">${locale === "ja" ? "ちょくせつならべる" : "direct comparison"}</text><line class="ke-family__compare-start" x1="80" y1="48" x2="80" y2="205"></line><line class="ke-family__compare-label-divider" x1="458" y1="48" x2="458" y2="205"></line><text x="52" y="94" text-anchor="middle">A</text><rect data-measure-compare-bar="value" x="80" y="62" width="${numberValue(firstWidth)}" height="50"></rect><text data-measure-compare-label="value" x="530" y="94" text-anchor="end">${numberValue(config.value)}${unit}</text><text x="52" y="174" text-anchor="middle">B</text><rect data-measure-compare-bar="second" x="80" y="142" width="${numberValue(secondWidth)}" height="50"></rect><text data-measure-compare-label="second" x="530" y="174" text-anchor="end">${numberValue(config.second)}${unit}</text></svg><svg class="ke-family__svg ke-family__compare-scene" data-measure-compare-scene="tape" viewBox="0 0 560 280" aria-hidden="true"${tapeHidden}><text x="280" y="28" text-anchor="middle">${locale === "ja" ? "テープにうつす" : "copy onto tape"}</text><line class="ke-family__compare-label-divider" x1="458" y1="42" x2="458" y2="255"></line><text x="52" y="80" text-anchor="middle">A</text><rect data-measure-compare-bar="value" x="80" y="52" width="${numberValue(firstWidth)}" height="44"></rect><path class="ke-family__compare-copy-arrow" d="M260 103 V125 M250 115 L260 125 L270 115"></path><text x="52" y="158" text-anchor="middle">${locale === "ja" ? "テープ" : "tape"}</text><rect data-measure-compare-copy="value" x="80" y="132" width="${numberValue(firstWidth)}" height="44"></rect><text x="52" y="230" text-anchor="middle">B</text><rect data-measure-compare-bar="second" x="80" y="204" width="${numberValue(secondWidth)}" height="44"></rect><text data-measure-compare-label="value" x="530" y="80" text-anchor="end">${numberValue(config.value)}${unit}</text><text data-measure-compare-label="second" x="530" y="230" text-anchor="end">${numberValue(config.second)}${unit}</text></svg></div>`;
  }
  if (config.mode === "kilometres") {
    const model = kilometreComparisonModel(config.value, config.second);
    return `<svg class="ke-family__svg ke-family__kilometres" viewBox="0 0 560 260" aria-hidden="true"><path d="M60 80 H500 M60 180 H500"></path><rect data-kilometre-bar="value" x="75" y="55" width="${numberValue(model.kilometreWidth)}" height="50" rx="12"></rect><rect data-kilometre-bar="second" x="75" y="155" width="${numberValue(model.metreWidth)}" height="50" rx="12"></rect><text data-kilometre-label="value" x="75" y="42">${numberValue(config.value)} km</text><text data-kilometre-label="second" x="75" y="142">${numberValue(config.second)} m</text><text data-kilometre-relation x="520" y="135" text-anchor="middle">${model.relation}</text></svg>`;
  }
  if (config.mode === "metric-length") {
    const firstRatio = Math.max(0, Math.min(1, config.value / config.max));
    const secondRatio = Math.max(0, Math.min(1, config.second / config.max));
    const relations = await metricRelationsMarkup([
      { text: "10 mm = 1 cm", tex: "10\\,\\mathrm{mm}=1\\,\\mathrm{cm}" },
      { text: "100 cm = 1 m", tex: "100\\,\\mathrm{cm}=1\\,\\mathrm{m}" },
      { text: "1000 mm = 1 m", tex: "1000\\,\\mathrm{mm}=1\\,\\mathrm{m}" },
    ], locale);
    return `<div class="ke-family__metric-length"><svg class="ke-family__svg ke-family__ruler" viewBox="0 0 560 240" aria-hidden="true"><rect x="35" y="75" width="490" height="90"></rect>${Array.from({ length: 101 }, (_, index) => {
      const x = 35 + index * 4.9;
      const tick = index % 10 === 0 ? 55 : index % 5 === 0 ? 35 : 22;
      return `<line x1="${numberValue(x)}" y1="75" x2="${numberValue(x)}" y2="${75 + tick}"></line>`;
    }).join("")}<line class="ke-family__measure-marker" data-measure-marker="value" x1="${numberValue(35 + firstRatio * 490)}" y1="42" x2="${numberValue(35 + firstRatio * 490)}" y2="188"></line><line class="ke-family__measure-marker ke-family__measure-marker--second" data-measure-marker="second" x1="${numberValue(35 + secondRatio * 490)}" y1="55" x2="${numberValue(35 + secondRatio * 490)}" y2="202"></line><text data-measure-marker-label="value" x="${numberValue(35 + firstRatio * 490)}" y="30" text-anchor="middle">A</text><text data-measure-marker-label="second" x="${numberValue(35 + secondRatio * 490)}" y="64" text-anchor="middle">B</text><text x="35" y="222">0</text><text x="525" y="222" text-anchor="end">${numberValue(config.max)} ${config.unit === "none" ? "cm" : config.unit}</text></svg><div data-length-unit-relations>${relations}</div></div>`;
  }
  if (config.mode === "length") {
    const firstRatio = Math.max(0, Math.min(1, config.value / config.max));
    const secondRatio = Math.max(0, Math.min(1, config.second / config.max));
    return `<svg class="ke-family__svg ke-family__ruler" viewBox="0 0 560 240" aria-hidden="true"><rect x="35" y="75" width="490" height="90"></rect>${Array.from({ length: 11 }, (_, index) => `<line x1="${35 + index * 49}" y1="75" x2="${35 + index * 49}" y2="${index % 5 === 0 ? 130 : 110}"></line>`).join("")}<line class="ke-family__measure-marker" data-measure-marker="value" x1="${numberValue(35 + firstRatio * 490)}" y1="42" x2="${numberValue(35 + firstRatio * 490)}" y2="188"></line><line class="ke-family__measure-marker ke-family__measure-marker--second" data-measure-marker="second" x1="${numberValue(35 + secondRatio * 490)}" y1="55" x2="${numberValue(35 + secondRatio * 490)}" y2="202"></line><text data-measure-marker-label="value" x="${numberValue(35 + firstRatio * 490)}" y="30" text-anchor="middle">A</text><text data-measure-marker-label="second" x="${numberValue(35 + secondRatio * 490)}" y="64" text-anchor="middle">B</text></svg>`;
  }
  if (config.mode === "mass") {
    return renderBalance(config);
  }
  return "";
}

function die(face: number): string {
  const normalized = ((Math.floor(face) - 1) % 6 + 6) % 6 + 1;
  const positions: Record<number, readonly [number, number][]> = {
    1: [[50, 50]],
    2: [[30, 30], [70, 70]],
    3: [[30, 30], [50, 50], [70, 70]],
    4: [[30, 30], [70, 30], [30, 70], [70, 70]],
    5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
    6: [[30, 25], [70, 25], [30, 50], [70, 50], [30, 75], [70, 75]],
  };
  return `<svg class="ke-family__die" viewBox="0 0 100 100" aria-hidden="true"><rect x="5" y="5" width="90" height="90" rx="14"></rect>${(positions[normalized] ?? []).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7"></circle>`).join("")}</svg>`;
}

function objectCards(count: number, category: number): string {
  const variants = ["round", "square", "diamond"] as const;
  const variant = variants[category % variants.length] ?? "round";
  const label = String.fromCharCode(65 + category);
  return Array.from({ length: Math.max(0, Math.min(20, Math.floor(count))) }, (_, index) =>
    `<span class="ke-family__data-card ke-family__data-card--${variant} ke-family__data-card--category-${category % 6}" aria-hidden="true" data-data-card="${index}">${label}</span>`,
  ).join("");
}

function criteriaCardMarkup(card: CriteriaCard): string {
  return `<span class="ke-family__data-card ke-family__data-card--${card.shape} ke-family__data-card--${card.tone}" data-criteria-card="${card.id}">${card.id}</span>`;
}

function dataCategoryAdjustments(values: readonly number[], locale: "ja" | "en"): string {
  return `<div class="ke-family__data-adjustments" data-data-adjustments>${values.map((count, index) => {
    const label = String.fromCharCode(65 + index);
    const decreaseLabel = locale === "ja" ? `${label}を1へらす` : `Decrease category ${label} by 1`;
    const increaseLabel = locale === "ja" ? `${label}を1ふやす` : `Increase category ${label} by 1`;
    return `<div><span>${label}</span><button type="button" data-family-inline-action data-data-category-adjust="${index}" data-data-delta="-1" aria-label="${decreaseLabel}" hidden disabled>−</button><output data-data-category-control-count="${index}">${numberValue(count)}</output><button type="button" data-family-inline-action data-data-category-adjust="${index}" data-data-delta="1" aria-label="${increaseLabel}" hidden disabled>＋</button></div>`;
  }).join("")}</div>`;
}

function dataSourceCards(values: readonly number[]): string {
  return `<div class="ke-family__data-source"><strong>もとのカード</strong><div data-data-source-cards>${values.map((count, category) => Array.from({ length: Math.max(0, Math.floor(count)) }, (_, index) => `<span class="ke-family__data-card ke-family__data-card--${["round", "square", "diamond"][category % 3]} ke-family__data-card--category-${category % 6}" data-source-category="${category}" data-source-card="${category}-${index}">${String.fromCharCode(65 + category)}</span>`).join("")).join("")}</div></div>`;
}

function twoWaySourceCards(cells: readonly number[]): string {
  return `<div class="ke-family__data-source"><strong>もとのカード</strong><div data-two-way-source-cards>${cells.map((count, cell) => Array.from({ length: Math.max(0, Math.floor(count)) }, (_, index) => {
    const shape = cell < 2 ? "round" : "square";
    const tone = cell % 2 === 0 ? "accent" : "outline";
    return `<span class="ke-family__data-card ke-family__data-card--${shape} ke-family__data-card--${tone}" data-two-way-source-cell="${cell}" data-two-way-source-card="${cell}-${index}">${cell % 2 === 0 ? "A" : "B"}</span>`;
  }).join("")).join("")}</div></div>`;
}

function tallyMarks(count: number): string {
  return Array.from({ length: Math.max(0, Math.min(40, Math.floor(count))) }, (_, index) =>
    `<span aria-hidden="true" class="ke-family__tally${index % 5 === 4 ? " ke-family__tally--fifth" : ""}"></span>`,
  ).join("");
}

function pictureSymbols(count: number, variant: "apple" | "orange" | "pear"): string {
  return Array.from({ length: Math.max(0, Math.min(20, Math.floor(count))) }, (_, index) =>
    `<span class="ke-family__fruit ke-family__fruit--${variant}" aria-hidden="true" data-picture-symbol="${index}"><span></span></span>`,
  ).join("");
}

function renderData(config: FamilyInteractiveConfig, locale: "ja" | "en"): string {
  if (config.mode === "dice-frequency") {
    const frequencies = initialDiceFrequencies(config.value, config.second);
    const recorded = frequencies.reduce((sum, count) => sum + count, 0);
    const caption = locale === "ja" ? "でためのかず" : "Recorded die faces";
    const recordedLabel = locale === "ja" ? "きろくしため" : "Recorded faces";
    return `<div class="ke-family__dice-frequency"><div class="ke-family__dice-row" data-dice-row>${die(config.value)}${die(config.second)}</div><table class="ke-family__data-table" data-dice-frequency-table><caption>${caption}</caption><thead><tr>${frequencies.map((_, index) => `<th scope="col">${index + 1}</th>`).join("")}</tr></thead><tbody><tr>${frequencies.map((count, index) => `<td data-dice-frequency="${index + 1}">${count}</td>`).join("")}</tr></tbody><tfoot><tr><th scope="row" colspan="5">${recordedLabel}</th><td data-dice-recorded>${recorded}</td></tr></tfoot></table></div>`;
  }
  const values = dataCategoryValues(config.value, config.second, config.categories, [
    config.third ?? 0,
    config.fourth ?? 0,
    config.fifth ?? 0,
    config.sixth ?? 0,
  ]);
  const label = (index: number) => String.fromCharCode(65 + index);
  if (config.mode === "criteria") {
    const model = classificationCriteriaModel(config.value, config.second, config.selected);
    return `<div class="ke-family__criteria" data-criteria><strong data-criteria-label>${familyUiMarkup(model.criterionLabel)}</strong><p>${familyUiMarkup(`同じ ${numberValue(config.value + config.second)}まいのカードを、ちがう見方で分けます。`)}</p><div class="ke-family__classification">${model.bins.map((cards, index) => `<div class="ke-family__classification-bin" data-criteria-bin="${index}"><span data-criteria-bin-label="${index}">${familyUiMarkup(model.binLabels[index] ?? "")}</span><div>${cards.map(criteriaCardMarkup).join("")}</div></div>`).join("")}</div></div>`;
  }
  if (config.mode === "classify") {
    return `<div class="ke-family__classification">${values.map((count, index) => `<div class="ke-family__classification-bin" data-classification-category="${index}"${index < 2 ? ` data-classification-bin="${index === 0 ? "value" : "second"}"` : ""}><span>${label(index)}</span><div>${objectCards(count, index)}</div></div>`).join("")}</div>${dataCategoryAdjustments(values, locale)}`;
  }
  if (config.mode === "frequency") {
    return `<div class="ke-family__frequency">${values.map((count, index) => `<div><strong>${label(index)}</strong><div data-frequency-category="${index}"${index < 2 ? ` data-frequency-row="${index === 0 ? "value" : "second"}"` : ""}>${tallyMarks(count)}</div><output data-frequency-count="${index}">${numberValue(count)}</output></div>`).join("")}</div>${dataCategoryAdjustments(values, locale)}`;
  }
  if (config.mode === "pictograph") {
    return `${dataSourceCards(values)}<div class="ke-family__pictograph">${values.map((count, index) => `<div><strong>${label(index)}</strong><div data-picture-category="${index}"${index < 2 ? ` data-picture-row="${index === 0 ? "value" : "second"}"` : ""}>${pictureSymbols(count, (["apple", "orange", "pear"] as const)[index % 3] ?? "apple")}</div></div>`).join("")}</div>${dataCategoryAdjustments(values, locale)}`;
  }
  if (config.mode === "two-way") {
    const model = twoWayTableModel(config.value, config.second);
    return `${twoWaySourceCards(model.cells)}<table class="ke-family__data-table" data-two-way-table><caption>ふたつのわけかた</caption><thead><tr><th></th><th scope="col">A</th><th scope="col">B</th><th scope="col">ぜんぶ</th></tr></thead><tbody><tr><th scope="row">●</th><td data-two-way-cell="0">${numberValue(model.cells[0])}</td><td data-two-way-cell="1">${numberValue(model.cells[1])}</td><td data-two-way-row-total="0">${numberValue(model.rowTotals[0])}</td></tr><tr><th scope="row">■</th><td data-two-way-cell="2">${numberValue(model.cells[2])}</td><td data-two-way-cell="3">${numberValue(model.cells[3])}</td><td data-two-way-row-total="1">${numberValue(model.rowTotals[1])}</td></tr><tr><th scope="row">ぜんぶ</th><td data-two-way-column-total="0">${numberValue(model.columnTotals[0])}</td><td data-two-way-column-total="1">${numberValue(model.columnTotals[1])}</td><td data-two-way-grand-total>${numberValue(model.grandTotal)}</td></tr></tbody></table>`;
  }
  if (config.mode === "table") {
    const total = values.reduce((sum, count) => sum + count, 0);
    return `${dataSourceCards(values)}<table class="ke-family__data-table"><caption>ひとつのわけかた</caption><thead><tr>${values.map((_, index) => `<th scope="col">${label(index)}</th>`).join("")}<th scope="col">ぜんぶ</th></tr></thead><tbody><tr>${values.map((count, index) => `<td data-table-category="${index}">${numberValue(count)}</td>`).join("")}<td data-table-total>${numberValue(total)}</td></tr></tbody></table>${dataCategoryAdjustments(values, locale)}`;
  }
  const slot = 420 / values.length;
  const barWidth = Math.max(28, slot * 0.62);
  const chart = `<svg class="ke-family__svg ke-family__chart" viewBox="0 0 560 260" aria-hidden="true"><line x1="70" y1="220" x2="500" y2="220"></line><line x1="70" y1="35" x2="70" y2="220"></line>${values.map((count, index) => {
    const height = count <= 0 ? 0 : Math.max(2, Math.min(180, (count / config.max) * 180));
    const center = 75 + slot * (index + 0.5);
    return `<rect data-data-category="${index}"${index < 2 ? ` data-data-bar="${index === 0 ? "value" : "second"}"` : ""} x="${numberValue(center - barWidth / 2)}" y="${numberValue(220 - height)}" width="${numberValue(barWidth)}" height="${numberValue(height)}"></rect><text x="${numberValue(center)}" y="248" text-anchor="middle">${label(index)}</text><text data-data-category-label="${index}"${index < 2 ? ` data-data-label="${index === 0 ? "value" : "second"}"` : ""} x="${numberValue(center)}" y="${numberValue(205 - height)}" text-anchor="middle">${numberValue(count)}</text>`;
  }).join("")}</svg>`;
  const total = values.reduce((sum, count) => sum + count, 0);
  const adjustments = dataCategoryAdjustments(values, locale);
  return config.mode === "evidence"
    ? `<div class="ke-family__evidence" data-evidence><div data-evidence-view="chart"${config.selected % 2 === 0 ? "" : " hidden"}>${chart}</div><div data-evidence-view="table"${config.selected % 2 === 1 ? "" : " hidden"}><table class="ke-family__data-table"><caption>ひょうでたしかめる</caption><thead><tr>${values.map((_, index) => `<th scope="col">${label(index)}</th>`).join("")}<th scope="col">ぜんぶ</th></tr></thead><tbody><tr>${values.map((count, index) => `<td data-table-category="${index}">${numberValue(count)}</td>`).join("")}<td data-table-total>${numberValue(total)}</td></tr></tbody></table></div></div>${adjustments}`
    : `<div class="ke-family__chart-lab">${chart}${adjustments}</div>`;
}

function sorobanColumns(value: number, name: "value" | "second", locale: "ja" | "en"): string {
  const normalizedValue = Math.max(0, Math.min(99_999, Math.floor(value)));
  const digits = String(normalizedValue)
    .padStart(5, "0")
    .slice(-5)
    .split("");
  return digits.map((digit, column) => {
    const active = Number(digit);
    const labelJa = PLACE_LABELS[column] ?? "くらい";
    const labelEn = SOROBAN_PLACE_LABELS_EN[column] ?? "place";
    const increaseLabel = locale === "ja" ? `${labelJa}のくらいを1ふやす` : `Increase the ${labelEn} digit by 1`;
    const decreaseLabel = locale === "ja" ? `${labelJa}のくらいを1へらす` : `Decrease the ${labelEn} digit by 1`;
    return `<div class="ke-family__soroban-column" data-soroban-column="${name}-${column}"><button type="button" data-family-inline-action data-soroban-adjust data-soroban-name="${name}" data-soroban-column-index="${column}" data-soroban-delta="1" aria-label="${increaseLabel}" hidden disabled>＋</button><span class="ke-family__soroban-upper${active >= 5 ? " is-active" : ""}" aria-hidden="true"></span><span class="ke-family__soroban-bar" aria-hidden="true"></span>${Array.from({ length: 4 }, (_, index) => `<span class="ke-family__soroban-lower${index < active % 5 ? " is-active" : ""}" aria-hidden="true"></span>`).join("")}<strong data-soroban-digit>${digit}</strong><button type="button" data-family-inline-action data-soroban-adjust data-soroban-name="${name}" data-soroban-column-index="${column}" data-soroban-delta="-1" aria-label="${decreaseLabel}" hidden disabled>−</button></div>`;
  }).join("");
}

function renderSoroban(config: FamilyInteractiveConfig, locale: "ja" | "en"): string {
  return `<div class="ke-family__soroban-stack"><div class="ke-family__soroban" data-soroban="value">${sorobanColumns(config.value, "value", locale)}</div>${config.mode === "calculate" ? `<div class="ke-family__place-operator" aria-hidden="true">+</div><div class="ke-family__soroban" data-soroban="second">${sorobanColumns(config.second, "second", locale)}</div>` : ""}</div>`;
}

async function renderVisual(
  config: FamilyInteractiveConfig,
  locale: "ja" | "en",
): Promise<string> {
  if (config.interactiveKind === "measurement-lab" && config.mode === "unit-relations") {
    const selected = unitRelationIndex(config.value);
    const relations = await Promise.all(
      UNIT_RELATIONS.map(async (relation, index) => {
        const rendered = await renderArticleMath({
          tex: relation.tex,
          display: false,
          profile: "core",
          locale,
        });
        return `<div class="${index === selected ? "is-active" : ""}" data-unit-relation="${index}" aria-label="${escapeHtml(relation.text)}">${rendered.markup}</div>`;
      }),
    );
    return `<div class="ke-family__unit-relations" data-unit-relations>${relations.join("")}</div>`;
  }
  switch (config.interactiveKind) {
    case "counter-mat":
      return renderCounterMat(config);
    case "place-value-board":
      return renderPlaceValue(config);
    case "number-line":
      return renderNumberLine(config);
    case "fraction-model":
      return renderFraction(config);
    case "equation-balance":
      return renderBalance(config);
    case "geometry-lab":
      return renderGeometry(config);
    case "measurement-lab":
      return renderMeasurement(config, locale);
    case "data-lab":
      return renderData(config, locale);
    case "soroban-board":
      return renderSoroban(config, locale);
  }
}

function controlMarkup(
  config: FamilyInteractiveConfig,
  instanceKey: string,
  locale: "ja" | "en",
): string {
  return familyControlDefinitions(config)
    .map((control) => {
      const id = `ke-family-${instanceKey}-${control.key}`;
      const current = control.key === "selected" ? config.selected : config[control.key];
      const state = {
        value: config.value,
        second: config.second,
        selected: config.selected,
        groups: config.groups,
        operation: config.operation,
      };
      const bounds = familyLiveControlBounds(config, state, control);
      const label = locale === "ja" ? control.labelJa : control.labelEn;
      const labelMarkup = locale === "ja" ? familyUiMarkup(label) : escapeHtml(label);
      const currentText = config.interactiveKind === "geometry-lab"
        ? familyControlValueText(config, current, locale)
        : familyControlDefinitionValueText(control, current, locale);
      const currentMarkup = locale === "ja" ? familyUiMarkup(currentText) : escapeHtml(currentText);
      const ariaValueText = locale === "ja" ? familyUiReading(currentText) : currentText;
      return `<div class="ke-interactive__control"><div class="ke-interactive__control-heading"><label for="${id}">${labelMarkup}</label><output for="${id}" data-family-output="${control.key}">${currentMarkup}</output></div><input id="${id}" type="${control.inputType}" min="${numberValue(bounds.minimum)}" max="${numberValue(bounds.maximum)}" step="${numberValue(control.step)}" value="${numberValue(current)}" aria-valuetext="${escapeHtml(ariaValueText)}" data-family-input="${control.key}"></div>`;
    })
    .join("");
}

export async function renderFamilyInteractive(
  config: FamilyInteractiveConfig,
  context: FamilyInteractiveRenderContext,
): Promise<string> {
  const dataset = familyInteractiveDataset(config);
  const dataAttributes = Object.entries(dataset)
    .map(([name, value]) => ` data-${dataAttributeName(name)}="${escapeHtml(value)}"`)
    .join("");
  const titleId = `ke-family-${context.instanceKey}-title`;
  const descriptionId = `ke-family-${context.instanceKey}-description`;
  const reset = context.locale === "ja" ? "はじめにもどす" : "Reset";
  const diceButton =
    config.interactiveKind === "data-lab" && config.mode === "dice-frequency"
      ? `<button type="button" data-family-dice-roll>${context.locale === "ja" ? "2このさいころをふる" : "Roll two dice"}</button>`
      : "";
  const fractionOperationLabel = context.locale === "ja"
    ? config.operation === "subtract" ? "たし算にする" : "ひき算にする"
    : config.operation === "subtract" ? "Use addition" : "Use subtraction";
  const fractionOperationButton =
    config.interactiveKind === "fraction-model" && config.mode === "add-subtract"
      ? `<button type="button" data-fraction-operation aria-pressed="${config.operation === "subtract" ? "true" : "false"}">${context.locale === "ja" ? familyUiMarkup(fractionOperationLabel) : escapeHtml(fractionOperationLabel)}</button>`
      : "";
  const decimalOperationLabel = context.locale === "ja"
    ? config.operation === "subtract" ? "たし算にする" : "ひき算にする"
    : config.operation === "subtract" ? "Use addition" : "Use subtraction";
  const decimalOperationButton =
    config.interactiveKind === "place-value-board" && config.mode === "decimal"
      ? `<button type="button" data-place-decimal-operation aria-pressed="${config.operation === "subtract" ? "true" : "false"}">${context.locale === "ja" ? familyUiMarkup(decimalOperationLabel) : escapeHtml(decimalOperationLabel)}</button>`
      : "";
  const equationOperationLabel = context.locale === "ja"
    ? config.operation === "multiply" ? "たし算のきまりにする" : "かけ算のきまりにする"
    : config.operation === "multiply" ? "Use addition properties" : "Use multiplication properties";
  const equationOperationButton =
    config.interactiveKind === "equation-balance" && config.mode === "properties"
      ? `<button type="button" data-equation-operation aria-pressed="${config.operation === "multiply" ? "true" : "false"}">${context.locale === "ja" ? familyUiMarkup(equationOperationLabel) : escapeHtml(equationOperationLabel)}</button>`
      : "";
  const controls = controlMarkup(config, context.instanceKey, context.locale);
  const controlsBlock = controls || diceButton || fractionOperationButton || decimalOperationButton || equationOperationButton
    ? `<div class="ke-interactive__controls ke-family__controls" data-interactive-controls hidden>${controls}${diceButton}${fractionOperationButton}${decimalOperationButton}${equationOperationButton}<button type="button" data-family-reset>${reset}</button></div>`
    : "";
  const isInteractive = controlsBlock.length > 0;
  const title = context.locale === "ja"
    ? isInteractive ? "そうさできるず" : "ずかい"
    : isInteractive ? "Interactive diagram" : "Diagram";
  const description = context.locale === "ja"
    ? isInteractive
      ? "つまみやボタンをつかわなくても、はじめのようすをよみとれます。"
      : "うごかさないずです。ずのないようは、つづくけっかとほんぶんでもかくにんできます。"
    : isInteractive
      ? "The initial state remains readable without using the controls."
      : "This is a static diagram. Its meaning is also available in the following result and article text.";
  const resultText = familyResultText(
    config,
    config.value,
    config.second,
    config.selected,
    context.locale,
    config.groups,
  );
  const resultTex = familyResultTex(config);
  const resultMarkup = resultTex === undefined
    ? context.locale === "ja" ? familyUiMarkup(resultText) : escapeHtml(resultText)
    : (await renderArticleMath({
        tex: resultTex,
        display: false,
        profile: "core",
        locale: context.locale,
      })).markup;
  const visualMarkup = await renderVisual(config, context.locale);
  const visualAttributes = isInteractive
    ? `role="region" tabindex="0" aria-labelledby="${titleId}" aria-describedby="${descriptionId} ke-family-${context.instanceKey}-result"`
    : `role="group" aria-labelledby="${titleId}" aria-describedby="${descriptionId} ke-family-${context.instanceKey}-result"`;
  return `<figure class="ke-interactive ke-family ke-family--${config.interactiveKind}${isInteractive ? "" : " ke-family--static"}" data-noetheca-interactive="${config.interactiveKind}" data-ke-family-version="1"${isInteractive ? "" : " data-ke-family-static=\"true\""} data-locale="${context.locale}"${dataAttributes}>
<figcaption>${context.captionHtml}</figcaption>
${controlsBlock}
<div class="ke-family__visual" ${visualAttributes}><span id="${titleId}" class="visually-hidden">${title}</span><span id="${descriptionId}" class="visually-hidden">${description}</span>${visualMarkup}</div>
<p class="ke-interactive__result"><output id="ke-family-${context.instanceKey}-result" data-family-result data-family-result-kind="${resultTex === undefined ? "text" : "math"}" aria-label="${escapeHtml(context.locale === "ja" ? familyUiReading(resultText) : resultText)}">${resultMarkup}</output></p>
<p class="visually-hidden" data-family-status aria-live="polite"></p>
</figure>`;
}
