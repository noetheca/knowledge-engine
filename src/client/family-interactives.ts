import {
  diceFrequencyResultText,
  familyControlDefinitionValueText,
  familyControlDefinitions,
  familyControlValueText,
  familyLiveControlBounds,
  familyResultTex,
  familyResultText,
  isFamilyInteractiveKind,
  parseFamilyInteractiveDataset,
  type FamilyInteractiveConfig,
  type FamilyStateKey,
} from "../interactives/family-contracts.js";
import {
  MEASUREMENT_COMPARE_BAR_MAX_WIDTH,
  conservationFillModel,
  balanceTilt,
  capacityTransferModel,
  classificationCriteriaModel,
  dataCategoryValues,
  divisionModel,
  equationBalanceModel,
  fractionOperationModel,
  initialDiceFrequencies,
  kilometreComparisonModel,
  measurementToolChoiceModel,
  normalizeStepValue,
  placeOperationModel,
  recordDiceFaces,
  twoWayTableModel,
  unitRelationIndex,
  type FamilyOperation,
  type PlaceOperationMode,
  type PlacePartialProduct,
  type PlaceRegroupEvent,
} from "../interactives/family-models.js";
import {
  familyUiReading,
  segmentFamilyUiText,
} from "../interactives/family-ui-ruby.js";
import { renderClientMath } from "./math-renderer.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const enhancedRoots = new WeakSet<HTMLElement>();

export function dieFaceFromByte(value: number): number | undefined {
  return Number.isInteger(value) && value >= 0 && value < 252
    ? (value % 6) + 1
    : undefined;
}

function rollDie(): number {
  const byte = new Uint8Array(1);
  for (;;) {
    crypto.getRandomValues(byte);
    const face = dieFaceFromByte(byte[0] ?? -1);
    if (face !== undefined) {
      return face;
    }
  }
}

interface FamilyState {
  value: number;
  second: number;
  selected: number;
  groups: number;
  operation: FamilyOperation;
}

function setFamilyUiText(element: HTMLElement, text: string): void {
  const nodes: Node[] = segmentFamilyUiText(text).map((segment) => {
    if (segment.reading === undefined) return document.createTextNode(segment.text);
    const ruby = document.createElement("ruby");
    const open = document.createElement("rp");
    open.textContent = "（";
    const reading = document.createElement("rt");
    reading.textContent = segment.reading;
    const close = document.createElement("rp");
    close.textContent = "）";
    ruby.append(document.createTextNode(segment.text), open, reading, close);
    return ruby;
  });
  element.replaceChildren(...nodes);
}

function setLocalizedFamilyUiText(
  element: HTMLElement,
  text: string,
  locale: "ja" | "en",
): void {
  if (locale === "ja") setFamilyUiText(element, text);
  else element.textContent = text;
}

function conciseNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}

function dataCategoryResultText(values: readonly number[], locale: "ja" | "en"): string {
  return values
    .map((value, index) => `${String.fromCharCode(65 + index)}: ${conciseNumber(value)}`)
    .join(locale === "ja" ? "、" : ", ");
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function createCounter(second: boolean): HTMLSpanElement {
  const token = document.createElement("span");
  token.className = `ke-family__counter${second ? " ke-family__counter--second" : ""}`;
  token.setAttribute("aria-hidden", "true");
  return token;
}

function createNumberedCounter(index: number, showNumber: boolean): HTMLSpanElement {
  const token = createCounter(false);
  token.classList.add("ke-family__counter--numbered");
  token.dataset.counterIndex = String(index);
  const number = document.createElement("b");
  number.dataset.counterNumber = "";
  number.hidden = !showNumber;
  number.textContent = String(index);
  token.append(number);
  return token;
}

function createCounterPair(index: number): HTMLDivElement {
  const pair = document.createElement("div");
  pair.className = "ke-family__counter-pair";
  pair.dataset.counterPair = String(index);
  const line = document.createElement("span");
  line.className = "ke-family__counter-pair-line";
  line.setAttribute("aria-hidden", "true");
  pair.replaceChildren(createCounter(false), line, createCounter(true));
  return pair;
}

const PLACE_LABELS = ["まん", "せん", "ひゃく", "じゅう", "いち", "じゅうぶんのいち"] as const;

function createPlaceCounter(second = false): HTMLSpanElement {
  const token = createCounter(second);
  token.classList.add("ke-family__counter--place");
  return token;
}

function replacePlaceCounters(container: HTMLElement | null, count: number, second = false): void {
  container?.replaceChildren(
    ...Array.from({ length: Math.max(0, Math.min(40, Math.floor(count))) }, () => createPlaceCounter(second)),
  );
}

function createPlaceRegroupQuantity(placeIndex: number, count: number): HTMLDivElement {
  const quantity = document.createElement("div");
  quantity.className = "ke-family__place-regroup-quantity";
  const label = document.createElement("span");
  label.textContent = `${PLACE_LABELS[placeIndex]} ${count}こ`;
  const tokens = document.createElement("div");
  tokens.className = "ke-family__place-regroup-tokens";
  replacePlaceCounters(tokens, count);
  quantity.replaceChildren(label, tokens);
  return quantity;
}

function createPlaceRegroupItem(event: PlaceRegroupEvent): HTMLDivElement {
  const exchangeUp = event.kind === "exchange-up";
  const item = document.createElement("div");
  item.className = "ke-family__place-regroup-item";
  item.dataset.placeRegroupItem = "";
  const arrow = document.createElement("span");
  arrow.className = "ke-family__place-regroup-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "→";
  item.replaceChildren(
    createPlaceRegroupQuantity(event.fromIndex, exchangeUp ? 10 : 1),
    arrow,
    createPlaceRegroupQuantity(event.toIndex, exchangeUp ? 1 : 10),
  );
  return item;
}

function createPlacePartialProductItem(partial: PlacePartialProduct): HTMLDivElement {
  const item = document.createElement("div");
  item.className = "ke-family__place-partial";
  item.dataset.placePartial = String(partial.placeIndex);
  const groups = document.createElement("div");
  groups.className = "ke-family__place-partial-groups";
  groups.setAttribute("aria-hidden", "true");
  const visibleGroups = Math.min(12, partial.multiplier);
  const cells: HTMLElement[] = Array.from({ length: visibleGroups }, () => {
    const cell = document.createElement("span");
    cell.textContent = conciseNumber(partial.groupValue);
    return cell;
  });
  if (partial.multiplier > visibleGroups) {
    const overflow = document.createElement("b");
    overflow.textContent = "…";
    cells.push(overflow);
  }
  groups.replaceChildren(...cells);
  const label = document.createElement("strong");
  setFamilyUiText(label, `${PLACE_LABELS[partial.placeIndex]}の位：${conciseNumber(partial.groupValue)} が ${conciseNumber(partial.multiplier)}こ → ${conciseNumber(partial.product)}`);
  item.replaceChildren(groups, label);
  return item;
}

function createPlaceDivisionGroups(divisor: number, quotient: number): (HTMLDivElement | HTMLSpanElement)[] {
  const visibleGroups = Math.min(12, divisor);
  const groups: (HTMLDivElement | HTMLSpanElement)[] = Array.from(
    { length: visibleGroups },
    (_, index) => {
      const group = document.createElement("div");
      group.className = "ke-family__place-division-group";
      const number = document.createElement("span");
      number.textContent = String(index + 1);
      const count = document.createElement("strong");
      count.textContent = `${conciseNumber(quotient)}こ`;
      group.replaceChildren(number, count);
      return group;
    },
  );
  if (divisor > visibleGroups) {
    const overflow = document.createElement("span");
    overflow.className = "ke-family__place-division-overflow";
    overflow.textContent = `…（ぜんぶで ${conciseNumber(divisor)}くみ）`;
    groups.push(overflow);
  }
  return groups;
}

function updateCounterMat(
  root: HTMLElement,
  config: FamilyInteractiveConfig,
  state: FamilyState,
): void {
  const labelZone = root.querySelector<HTMLElement>("[data-counter-label-zone]");
  if (labelZone) {
    const count = Math.max(0, Math.min(40, Math.floor(state.value)));
    const showNumbers = state.selected % 2 === 1;
    labelZone.replaceChildren(...Array.from({ length: count }, (_, index) => createNumberedCounter(index + 1, showNumbers)));
    const note = root.querySelector<HTMLElement>("[data-counter-label-note]");
    if (note) note.textContent = showNumbers ? `1から${count}までのばんごう` : "ばんごうをかくしています";
    return;
  }
  const compareRoot = root.querySelector<HTMLElement>("[data-counter-compare]");
  if (compareRoot) {
    const value = Math.max(0, Math.floor(state.value));
    const second = Math.max(0, Math.floor(state.second));
    const pairs = Math.min(value, second);
    root.querySelector<HTMLElement>("[data-counter-pairs]")?.replaceChildren(
      ...Array.from({ length: pairs }, (_, index) => createCounterPair(index)),
    );
    for (const key of ["value", "second"] as const) {
      const count = key === "value" ? Math.max(0, value - second) : Math.max(0, second - value);
      root.querySelector<HTMLElement>(`[data-counter-extra="${key}"]`)?.replaceChildren(
        ...Array.from({ length: count }, () => createCounter(key === "second")),
      );
      const label = root.querySelector<HTMLElement>(`[data-counter-extra-label="${key}"]`);
      if (label) label.textContent = `${key === "value" ? "A" : "B"}のあまり ${count}こ`;
    }
    return;
  }
  const arrayRoot = root.querySelector<HTMLElement>("[data-counter-array]");
  if (arrayRoot) {
    const rows = Math.max(0, Math.floor(state.value));
    const columns = Math.max(0, Math.floor(state.second));
    arrayRoot.replaceChildren(
      ...Array.from({ length: rows }, (_, row) => {
        const rowElement = document.createElement("div");
        rowElement.dataset.counterArrayRow = String(row);
        rowElement.replaceChildren(
          ...Array.from({ length: columns }, () => createCounter(false)),
        );
        return rowElement;
      }),
    );
    return;
  }
  const groupsRoot = root.querySelector<HTMLElement>("[data-counter-groups]");
  if (groupsRoot) {
    const model = divisionModel(
      config.mode as "group" | "share" | "remainder",
      state.value,
      state.groups,
    );
    groupsRoot.replaceChildren(
      ...Array.from({ length: model.zoneCount }, (_, group) => {
        const zone = document.createElement("div");
        zone.className = "ke-family__counter-zone";
        zone.dataset.counterGroup = String(group);
        zone.replaceChildren(...Array.from({ length: model.tokensPerZone }, () => createCounter(false)));
        return zone;
      }),
    );
    const remainderTokens = root.querySelector<HTMLElement>("[data-counter-remainder-tokens]");
    remainderTokens?.replaceChildren(
      ...Array.from({ length: model.remainder }, () => createCounter(true)),
    );
    return;
  }
  const subtractionSource = root.querySelector<HTMLElement>("[data-counter-subtraction-source]");
  const subtractionRemaining = root.querySelector<HTMLElement>("[data-counter-subtraction-remaining]");
  if (subtractionSource && subtractionRemaining) {
    const removed = Math.min(state.value, state.second);
    const remaining = Math.max(0, state.value - removed);
    const remainingTokens = Array.from({ length: Math.floor(remaining) }, () => createCounter(false));
    const removedTokens = Array.from({ length: Math.floor(removed) }, () => {
      const token = createCounter(true);
      token.classList.add("ke-family__counter--removed");
      return token;
    });
    subtractionSource.replaceChildren(...remainingTokens, ...removedTokens);
    subtractionRemaining.replaceChildren(...Array.from({ length: Math.floor(remaining) }, () => createCounter(false)));
    const stages = root.querySelectorAll<HTMLElement>(".ke-family__counter-subtraction-stage > strong");
    if (stages[0]) stages[0].textContent = `はじめ ${conciseNumber(state.value)}こ`;
    if (stages[1]) stages[1].textContent = `のこり ${conciseNumber(remaining)}こ`;
    const decomposition = root.querySelector<HTMLElement>("[data-counter-ten-decomposition]");
    if (decomposition) {
      const ones = Math.floor(state.value) % 10;
      decomposition.hidden = !(state.value >= 10 && removed > ones);
    }
    return;
  }
  for (const key of ["value", "second"] as const) {
    const zone = root.querySelector<HTMLElement>(`[data-counter-zone="${key}"]`);
    if (!zone) {
      continue;
    }
    const count = Math.max(0, Math.min(40, Math.floor(state[key])));
    zone.replaceChildren(
      ...Array.from({ length: count }, () => createCounter(key === "second")),
    );
  }
  const sumZone = root.querySelector<HTMLElement>('[data-counter-zone="sum"]');
  if (sumZone) {
    const count = Math.max(0, Math.min(40, Math.floor(state.value + state.second)));
    sumZone.replaceChildren(...Array.from({ length: count }, () => createCounter(false)));
  }
  const makeTen = root.querySelector<HTMLElement>("[data-counter-make-ten]");
  const makeTenGroup = root.querySelector<HTMLElement>("[data-counter-make-ten-group]");
  const makeTenRest = root.querySelector<HTMLElement>("[data-counter-make-ten-rest]");
  if (makeTen && makeTenGroup && makeTenRest) {
    const makesTen = state.value < 10 && state.value + state.second >= 10;
    const needed = Math.max(0, Math.min(state.second, 10 - state.value));
    makeTen.hidden = !makesTen;
    makeTenGroup.replaceChildren(
      ...Array.from({ length: Math.floor(state.value) }, () => createCounter(false)),
      ...Array.from({ length: Math.floor(needed) }, () => createCounter(true)),
    );
    makeTenRest.replaceChildren(
      ...Array.from({ length: Math.floor(state.second - needed) }, () => createCounter(true)),
    );
  }
}

function updatePlaceValue(
  root: HTMLElement,
  config: FamilyInteractiveConfig,
  state: FamilyState,
): void {
  const decimal = root.querySelector<HTMLElement>("[data-place-decimal]")?.dataset.placeDecimal === "true";
  const divisor = Math.max(1, Math.floor(state.second));
  const model = placeOperationModel(config.mode as PlaceOperationMode, state.value, state.second);
  const decimalResult = Number((state.operation === "subtract"
    ? state.value - state.second
    : state.value + state.second).toFixed(10));
  const placeValues = {
    value: state.value,
    second: state.second,
    result: decimal ? decimalResult : model.result,
    quotient: model.quotient,
  } as const;
  for (const name of ["value", "second", "result", "quotient"] as const) {
    const current = placeValues[name];
    const integerDigits = String(Math.max(0, Math.min(99_999, Math.floor(current))))
      .padStart(5, "0")
      .slice(-5)
      .split("");
    const digits = decimal
      ? [
          ...integerDigits,
          String(Math.floor((current - Math.floor(current) + 0.000001) * 10)),
        ]
      : integerDigits;
    for (const [index, digit] of digits.entries()) {
      const column = root.querySelector<HTMLElement>(`[data-place-column="${name}-${index}"]`);
      const tokens = column?.querySelector<HTMLElement>(".ke-family__place-tokens");
      const output = column?.querySelector<HTMLElement>("[data-place-digit]");
      if (!column || !tokens || !output) {
        continue;
      }
      tokens.replaceChildren(
        ...Array.from({ length: Number(digit) }, () => createPlaceCounter()),
      );
      output.textContent = digit;
    }
  }

  const operationSymbol = root.querySelector<HTMLElement>("[data-place-operation-symbol]");
  if (operationSymbol && decimal) {
    operationSymbol.textContent = state.operation === "subtract" ? "−" : "+";
  }

  root.querySelectorAll<HTMLElement>("[data-place-index]").forEach((column) => {
    column.classList.remove("is-regroup-source", "is-regroup-target");
  });
  for (const { fromIndex, toIndex } of model.regroupEvents) {
    if (config.mode === "regroup-add") {
      root.querySelector<HTMLElement>(`[data-place-column="value-${fromIndex}"]`)?.classList.add("is-regroup-source");
      root.querySelector<HTMLElement>(`[data-place-column="second-${fromIndex}"]`)?.classList.add("is-regroup-source");
    } else {
      root.querySelector<HTMLElement>(`[data-place-column="value-${fromIndex}"]`)?.classList.add("is-regroup-source");
      root.querySelector<HTMLElement>(`[data-place-column="value-${toIndex}"]`)?.classList.add("is-regroup-target");
    }
    root.querySelector<HTMLElement>(`[data-place-column="result-${toIndex}"]`)?.classList.add("is-regroup-target");
  }

  const regroupPanel = root.querySelector<HTMLElement>("[data-place-regroup-panel]");
  const regroupTitle = root.querySelector<HTMLElement>("[data-place-regroup-title]");
  const regroupItems = root.querySelector<HTMLElement>("[data-place-regroup-items]");
  if (regroupPanel && regroupTitle && regroupItems) {
    regroupPanel.hidden = model.regroupEvents.length === 0;
    setFamilyUiText(
      regroupTitle,
      model.regroupEvents[0]?.kind === "exchange-up"
        ? "10こを、ひとつ上の位の1こにまとめる"
        : "ひとつ上の位の1こを、10こに分ける",
    );
    regroupItems.replaceChildren(...model.regroupEvents.map(createPlaceRegroupItem));
  }

  const partialItems = root.querySelector<HTMLElement>("[data-place-partial-items]");
  partialItems?.replaceChildren(...model.partialProducts.map(createPlacePartialProductItem));

  if (config.mode === "divide") {
    const remainderTokens = root.querySelector<HTMLElement>("[data-place-remainder-tokens]");
    replacePlaceCounters(remainderTokens, model.remainder, true);
    if (remainderTokens && model.remainder > 40) {
      const overflow = document.createElement("span");
      overflow.className = "ke-family__place-division-overflow";
      overflow.dataset.placeRemainderOverflow = "";
      overflow.textContent = `…（ぜんぶで ${conciseNumber(model.remainder)}こ）`;
      remainderTokens.append(overflow);
    }
    const remainderLabel = root.querySelector<HTMLElement>("[data-place-remainder-label]");
    if (remainderLabel) remainderLabel.textContent = `あまり ${conciseNumber(model.remainder)}こ`;
    const distributionSummary = root.querySelector<HTMLElement>("[data-place-division-summary]");
    if (distributionSummary) {
      setFamilyUiText(distributionSummary, `${conciseNumber(divisor)}つの組に、${conciseNumber(model.quotient)}こずつ`);
    }
    root.querySelector<HTMLElement>("[data-place-division-groups]")?.replaceChildren(
      ...createPlaceDivisionGroups(divisor, model.quotient),
    );
  }
}

function linePosition(config: FamilyInteractiveConfig, value: number): number {
  return 40 + clamp((value - config.min) / (config.max - config.min), 0, 1) * 480;
}

function updateNumberLine(
  root: HTMLElement,
  config: FamilyInteractiveConfig,
  state: FamilyState,
): void {
  for (const key of ["value", "second"] as const) {
    const x = conciseNumber(linePosition(config, state[key]));
    const marker = root.querySelector<SVGCircleElement>(`[data-line-marker="${key}"]`);
    const label = root.querySelector<SVGTextElement>(`[data-line-label="${key}"]`);
    marker?.setAttribute("cx", x);
    const guide = root.querySelector<SVGLineElement>(`[data-line-guide="${key}"]`);
    guide?.setAttribute("x1", x);
    guide?.setAttribute("x2", x);
    if (label) {
      label.setAttribute("x", x);
      label.textContent = conciseNumber(state[key]);
    }
  }
  const middle = config.min + (config.max - config.min) / 2;
  const middleTick = root.querySelector<SVGTextElement>('[data-line-tick="middle"]');
  if (middleTick) {
    const shouldHide = Math.abs(state.value - middle) < Number.EPSILON ||
      Math.abs(state.second - middle) < Number.EPSILON;
    middleTick.toggleAttribute("hidden", shouldHide);
  }
}

function updateFraction(
  root: HTMLElement,
  config: FamilyInteractiveConfig,
  state: FamilyState,
): void {
  const operationModel = fractionOperationModel(
    config.parts,
    state.selected,
    config.secondParts,
    state.second,
    state.operation,
  );
  for (const segment of root.querySelectorAll<SVGRectElement>("[data-fraction-bar]")) {
    const name = segment.dataset.fractionBar;
    const limit = name === "selected"
      ? state.selected
      : name === "second"
        ? state.second
        : name === "result-0"
          ? Math.min(config.parts, operationModel?.numerator ?? 0)
          : name === "result-1"
            ? Math.max(0, (operationModel?.numerator ?? 0) - config.parts)
            : 0;
    const index = Number(segment.dataset.fractionIndex);
    segment.classList.toggle("is-selected", Number.isInteger(index) && index < limit);
  }
  const symbol = root.querySelector<SVGTextElement>("[data-fraction-operation-symbol]");
  if (symbol) {
    symbol.textContent = state.operation === "subtract" ? "−" : "+";
  }
  const showExtraResult = (operationModel?.numerator ?? 0) > config.parts;
  root.querySelector<SVGGElement>("[data-fraction-result-extra]")?.toggleAttribute("hidden", !showExtraResult);
  root.querySelector<SVGSVGElement>("[data-fraction-operation-scene]")?.setAttribute(
    "viewBox",
    `0 0 560 ${showExtraResult ? 420 : 335}`,
  );
}

function updateBalance(
  root: HTMLElement,
  config: FamilyInteractiveConfig,
  state: FamilyState,
): void {
  const mode = config.interactiveKind === "equation-balance"
    ? config.mode as "equality" | "unknown" | "properties"
    : "equality";
  const model = equationBalanceModel(mode, state.operation, state.value, state.second, state.selected);
  root
    .querySelector<SVGGElement>("[data-balance-beam]")
    ?.setAttribute("transform", `rotate(${conciseNumber(balanceTilt(model.leftValue, model.rightValue))} 280 105)`);
  const left = root.querySelector<SVGTextElement>('[data-balance-label="value"]');
  const right = root.querySelector<SVGTextElement>('[data-balance-label="second"]');
  if (left) left.textContent = model.leftLabel;
  if (right) right.textContent = model.rightLabel;
}

function geometryPath(points: readonly (readonly [number, number])[]): string {
  return `${points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${conciseNumber(x)} ${conciseNumber(y)}`).join(" ")} Z`;
}

function geometryRightAngleMarkerPath(x: number, y: number, width: number, height: number): string {
  const inset = Math.min(18, width / 5, height / 5);
  return `M${conciseNumber(x)} ${conciseNumber(y + inset)} H${conciseNumber(x + inset)} V${conciseNumber(y)} M${conciseNumber(x + width - inset)} ${conciseNumber(y)} V${conciseNumber(y + inset)} H${conciseNumber(x + width)} M${conciseNumber(x + width)} ${conciseNumber(y + height - inset)} H${conciseNumber(x + width - inset)} V${conciseNumber(y + height)} M${conciseNumber(x + inset)} ${conciseNumber(y + height)} V${conciseNumber(y + height - inset)} H${conciseNumber(x)}`;
}

function geometrySolidPath(value: number): string {
  const angle = (clamp(value, 0, 60) * Math.PI) / 180;
  const dx = 58 + Math.cos(angle) * 34;
  const dy = -24 - Math.sin(angle) * 24;
  const left = 150;
  const right = 350;
  const top = 75;
  const bottom = 205;
  return `M${conciseNumber(left + dx)} ${conciseNumber(top + dy)} H${conciseNumber(right + dx)} V${conciseNumber(bottom + dy)} H${conciseNumber(left + dx)} Z M${left} ${top} H${right} V${bottom} H${left} Z M${left} ${top} L${conciseNumber(left + dx)} ${conciseNumber(top + dy)} M${right} ${top} L${conciseNumber(right + dx)} ${conciseNumber(top + dy)} M${right} ${bottom} L${conciseNumber(right + dx)} ${conciseNumber(bottom + dy)} M${left} ${bottom} L${conciseNumber(left + dx)} ${conciseNumber(bottom + dy)}`;
}

function updateGeometryProgress(root: HTMLElement, value: number): void {
  const width = clamp(value, 0, 100) * 4;
  root.querySelector<SVGRectElement>("[data-geometry-progress]")?.setAttribute("width", conciseNumber(width));
  const handle = root.querySelector<SVGCircleElement>('.ke-family__geometry-progress [data-geometry-drag="value"]');
  handle?.setAttribute("cx", conciseNumber(80 + width));
}

function updateGeometry(
  root: HTMLElement,
  config: FamilyInteractiveConfig,
  state: FamilyState,
): void {
  const mode = config.mode;
  if (mode === "circle") {
    const radius = root.querySelector<SVGCircleElement>("[data-geometry-radius]");
    const radiusLine = root.querySelector<SVGLineElement>("[data-geometry-radius-line]");
    const diameterLine = root.querySelector<SVGLineElement>("[data-geometry-diameter-line]");
    if (!radius || !radiusLine || !diameterLine) return;
    const radiusValue = clamp(state.value, 0, 10) * 10;
    radius.setAttribute("r", conciseNumber(radiusValue));
    radiusLine.setAttribute("x2", conciseNumber(280 + radiusValue));
    diameterLine.setAttribute("x1", conciseNumber(280 - radiusValue));
    diameterLine.setAttribute("x2", conciseNumber(280 + radiusValue));
    return;
  }
  if (mode === "sphere") {
    const distance = clamp(state.value, 0, 10);
    const distanceSvg = (distance / 10) * 96;
    const sectionRadius = Math.sqrt(Math.max(0, 96 * 96 - distanceSvg * distanceSvg));
    const planeY = 130 - distanceSvg * 0.75;
    const handleX = 280 + sectionRadius;
    const cut = root.querySelector<SVGEllipseElement>("[data-sphere-cut]");
    cut?.setAttribute("cy", conciseNumber(planeY));
    cut?.setAttribute("rx", conciseNumber(sectionRadius));
    cut?.setAttribute("ry", conciseNumber(sectionRadius * 0.27));
    root.querySelector<SVGLineElement>("[data-sphere-distance]")?.setAttribute("y2", conciseNumber(planeY));
    const handle = root.querySelector<SVGCircleElement>("[data-sphere-handle]");
    handle?.setAttribute("cx", conciseNumber(handleX));
    handle?.setAttribute("cy", conciseNumber(planeY));
    const label = root.querySelector<SVGTextElement>("[data-sphere-label]");
    if (label) {
      label.setAttribute("x", "420");
      label.setAttribute("y", conciseNumber(clamp(planeY + 6, 50, 210)));
      label.textContent = `${conciseNumber(distance)} cm`;
    }
    const labelLeader = root.querySelector<SVGLineElement>("[data-sphere-label-leader]");
    labelLeader?.setAttribute("x1", conciseNumber(handleX + 12));
    labelLeader?.setAttribute("y1", conciseNumber(planeY));
    labelLeader?.setAttribute("y2", conciseNumber(planeY));
    return;
  }
  if (mode === "position") {
    const positions = [
      [280, 70],
      [420, 130],
      [280, 195],
      [140, 130],
      [280, 130],
    ] as const;
    const [x, y] = positions[Math.floor(state.value) % positions.length] ?? positions[0];
    const positionObject = root.querySelector<SVGCircleElement>("[data-position-object]");
    positionObject?.setAttribute("cx", String(x));
    positionObject?.setAttribute("cy", String(y));
    return;
  }
  if (mode === "elements") {
    const selected = ["edge", "vertex"][Math.floor(state.value) % 2];
    for (const element of root.querySelectorAll<SVGElement>("[data-geometry-element]")) {
      element.classList.toggle("is-active", element.dataset.geometryElement === selected);
    }
    return;
  }
  if (mode === "point-line") {
    const pointX = 280 + clamp(state.value, 0, 10) * 16;
    for (const circle of root.querySelectorAll<SVGCircleElement>("[data-point-b], [data-geometry-hit]")) {
      circle.setAttribute("cx", conciseNumber(pointX));
    }
    root.querySelector<SVGTextElement>("[data-point-label]")?.setAttribute("x", conciseNumber(pointX));
    root.querySelector<SVGPathElement>("[data-point-distance]")?.setAttribute("d", `M120 205 V188 H${conciseNumber(pointX)} V205`);
    return;
  }
  if (mode === "segment") {
    const betweenX = 280 + clamp(state.value, 0, 10) * 12;
    root.querySelector<SVGCircleElement>("[data-between-point]")?.setAttribute("cx", conciseNumber(betweenX));
    root.querySelector<SVGCircleElement>("[data-geometry-hit]")?.setAttribute("cx", conciseNumber(betweenX));
    root.querySelector<SVGTextElement>("[data-segment-label]")?.setAttribute("x", conciseNumber(betweenX));
    return;
  }
  if (mode === "recognize") {
    const angle = clamp(state.value, 0, 360);
    const centres = [[115, 125], [280, 125], [445, 125]] as const;
    for (const [index, shape] of [...root.querySelectorAll<SVGGElement>("[data-recognize-shape]")].entries()) {
      const factor = Number(shape.dataset.factor);
      const [x, y] = centres[index] ?? centres[0];
      shape.setAttribute("transform", `rotate(${conciseNumber(angle * (Number.isFinite(factor) ? factor : 1))} ${x} ${y})`);
    }
    return;
  }
  if (mode === "compose") {
    const offset = (1 - clamp(state.value, 0, 100) / 100) * 90;
    root.querySelector<SVGGElement>('[data-compose-piece="left"]')?.setAttribute("transform", `translate(${conciseNumber(-offset)} 0)`);
    root.querySelector<SVGGElement>('[data-compose-piece="right"]')?.setAttribute("transform", `translate(${conciseNumber(offset)} 0)`);
    updateGeometryProgress(root, state.value);
    return;
  }
  if (mode === "triangle") {
    const apexX = 280 + (clamp(state.value, 0, 60) - 30) * 2.2;
    root.querySelector<SVGPathElement>('[data-geometry-shape="triangle"]')?.setAttribute("d", geometryPath([[125, 205], [apexX, 48], [435, 205]]));
    root.querySelector<SVGCircleElement>("[data-triangle-apex]")?.setAttribute("cx", conciseNumber(apexX));
    return;
  }
  if (mode === "quadrilateral") {
    const shift = (clamp(state.value, 0, 60) - 30) * 1.3;
    const points = [[105, 195], [190 + shift, 55 + Math.abs(shift) * 0.15], [410 - shift * 0.35, 75 - shift * 0.2], [465, 200]] as const;
    root.querySelector<SVGPathElement>('[data-geometry-shape="quadrilateral"]')?.setAttribute("d", geometryPath(points));
    for (const [index, point] of points.entries()) {
      const vertex = root.querySelector<SVGCircleElement>(`[data-quadrilateral-vertex="${index}"]`);
      vertex?.setAttribute("cx", conciseNumber(point[0]));
      vertex?.setAttribute("cy", conciseNumber(point[1]));
    }
    return;
  }
  if (mode === "rectangle" || mode === "square") {
    const square = mode === "square";
    const width = square
      ? 100 * (1 + clamp(state.value, 0, 100) / 100)
      : 180 * (1 + clamp(state.value, 0, 100) / 100);
    const height = square ? width : 140;
    const x = 280 - width / 2;
    const y = square ? 110 - height / 2 : 130 - height / 2;
    const shape = root.querySelector<SVGRectElement>(square ? "[data-geometry-square]" : "[data-geometry-rect]");
    shape?.setAttribute("x", conciseNumber(x));
    shape?.setAttribute("y", conciseNumber(y));
    shape?.setAttribute("width", conciseNumber(width));
    shape?.setAttribute("height", conciseNumber(height));
    root.querySelector<SVGPathElement>("[data-right-angle-markers]")?.setAttribute("d", geometryRightAngleMarkerPath(x, y, width, height));
    return;
  }
  if (mode === "right-angle") {
    const top = 210 - (100 + clamp(state.value, 0, 60));
    root.querySelector<SVGPathElement>('[data-geometry-shape="right-angle"]')?.setAttribute("d", `M120 210 L120 ${conciseNumber(top)} L455 210 Z`);
    return;
  }
  if (mode === "congruence") {
    const progress = clamp(state.value, 0, 100) / 100;
    const offset = (1 - progress) * 240;
    const angle = (1 - progress) * 24;
    root.querySelector<SVGGElement>("[data-congruence-moving]")?.setAttribute("transform", `translate(${conciseNumber(offset)} 0) rotate(${conciseNumber(angle)} 170 150)`);
    updateGeometryProgress(root, state.value);
    return;
  }
  if (mode === "isosceles") {
    const value = clamp(state.value, 0, 60);
    root.querySelector<SVGGElement>("[data-isosceles-shape]")?.setAttribute("transform", `translate(0 205) scale(1 ${conciseNumber(1 + value / 120)}) translate(0 -205)`);
    root.querySelector<SVGGElement>("[data-equilateral-shape]")?.setAttribute("transform", `translate(405 205) scale(${conciseNumber(0.82 + value / 300)}) translate(-405 -205)`);
    return;
  }
  if (mode === "solid") {
    root.querySelector<SVGPathElement>("[data-solid-shape]")?.setAttribute("d", geometrySolidPath(state.value));
    const angle = (clamp(state.value, 0, 60) * Math.PI) / 180;
    const edgeLeader = root.querySelector<SVGLineElement>("[data-solid-edge-leader]");
    edgeLeader?.setAttribute("x1", conciseNumber(350 + 58 + Math.cos(angle) * 34));
    edgeLeader?.setAttribute("y1", conciseNumber(75 - 24 - Math.sin(angle) * 24));
    return;
  }
  if (mode === "tiling") {
    const progress = clamp(state.value, 0, 100) / 100;
    const gap = 12 * (1 - progress);
    const tileWidth = (400 - gap * 4) / 5;
    const tileHeight = (160 - gap) / 2;
    for (const tile of root.querySelectorAll<SVGRectElement>("[data-tiling-tile]")) {
      const row = Number(tile.dataset.row);
      const column = Number(tile.dataset.column);
      tile.setAttribute("x", conciseNumber(80 + column * (tileWidth + gap)));
      tile.setAttribute("y", conciseNumber(55 + row * (tileHeight + gap)));
      tile.setAttribute("width", conciseNumber(tileWidth));
      tile.setAttribute("height", conciseNumber(tileHeight));
    }
    updateGeometryProgress(root, state.value);
    return;
  }
  if (mode === "euclidean") {
    const parallelY = 190 - (3 + clamp(state.value, 0, 5)) * 20;
    const parallel = root.querySelector<SVGLineElement>("[data-euclidean-parallel]");
    parallel?.setAttribute("y1", conciseNumber(parallelY));
    parallel?.setAttribute("y2", conciseNumber(parallelY));
    root.querySelector<SVGCircleElement>("[data-euclidean-point]")?.setAttribute("cy", conciseNumber(parallelY));
    root.querySelector<SVGCircleElement>("[data-geometry-hit]")?.setAttribute("cy", conciseNumber(parallelY));
    root.querySelector<SVGTextElement>("[data-euclidean-label]")?.setAttribute("y", conciseNumber(Math.max(20, parallelY - 12)));
    root.querySelector<SVGPathElement>("[data-euclidean-distance]")?.setAttribute("d", `M95 ${conciseNumber(parallelY)} H80 V190 H95`);
  }
}

function clockHand(angle: number, length: number): { x: number; y: number } {
  const radians = ((angle - 90) * Math.PI) / 180;
  return { x: 280 + Math.cos(radians) * length, y: 130 + Math.sin(radians) * length };
}

function updateMeasurement(
  root: HTMLElement,
  config: FamilyInteractiveConfig,
  state: FamilyState,
): void {
  if (root.querySelector("[data-balance]")) {
    updateBalance(root, config, state);
    return;
  }
  const elapsedHands = root.querySelectorAll<SVGLineElement>("[data-elapsed-hand]");
  if (elapsedHands.length > 0) {
    for (const handElement of elapsedHands) {
      const key = handElement.dataset.elapsedHand === "second" ? "second" : "value";
      const center = key === "second" ? 395 : 165;
      const hand = clockHand((state[key] % 12) * 30, 58);
      handElement.setAttribute("x2", conciseNumber(hand.x - 280 + center));
      handElement.setAttribute("y2", conciseNumber(hand.y));
      const label = root.querySelector<SVGTextElement>(`[data-elapsed-time="${key}"]`);
      if (label) label.textContent = `${conciseNumber(state[key])}:00`;
    }
    return;
  }
  const durationHours = root.querySelectorAll<HTMLElement>("[data-duration-hour]");
  if (durationHours.length > 0) {
    for (const hour of durationHours) {
      hour.classList.toggle("is-active", Number(hour.dataset.durationHour) < state.value);
    }
    const minuteFill = root.querySelector<SVGRectElement>("[data-duration-minute-fill]");
    minuteFill?.setAttribute("width", conciseNumber(clamp(state.second / 60, 0, 1) * 520));
    const minuteLabel = root.querySelector<SVGTextElement>("[data-duration-minute-label]");
    if (minuteLabel) minuteLabel.textContent = `${conciseNumber(state.second)} / 60 ふん`;
    return;
  }
  const conservationFills = root.querySelectorAll<SVGRectElement>(
    "[data-conservation-fill]",
  );
  if (conservationFills.length > 0) {
    const model = conservationFillModel(state.value, config.max);
    for (const fill of conservationFills) {
      const geometry = fill.dataset.conservationFill === "left" ? model.left : model.right;
      fill.setAttribute("y", conciseNumber(geometry.y));
      fill.setAttribute("height", conciseNumber(geometry.height));
    }
    return;
  }
  const areaTiles = root.querySelectorAll<SVGRectElement>("[data-area-tile]");
  if (areaTiles.length > 0) {
    for (const tile of areaTiles) {
      const [name, rawIndex] = (tile.dataset.areaTile ?? "").split("-");
      const index = Number(rawIndex);
      const limit = Math.floor(name === "second" ? state.second : state.value);
      tile.classList.toggle("is-selected", Number.isInteger(index) && index < limit);
    }
    for (const label of root.querySelectorAll<SVGTextElement>("[data-area-count-label]")) {
      const value = label.dataset.areaCountLabel === "second" ? state.second : state.value;
      label.textContent = `${conciseNumber(Math.floor(value))}こ`;
    }
    return;
  }
  if (root.querySelector("[data-tool-choice]")) {
    const model = measurementToolChoiceModel(state.value, state.second);
    const objectLabel = root.querySelector<HTMLElement>("[data-tool-object-label]");
    if (objectLabel) setFamilyUiText(objectLabel, model.objectLabelJa);
    const objectIcon = root.querySelector<HTMLElement>("[data-tool-object-icon]");
    if (objectIcon) {
      objectIcon.className = `ke-family__object-icon ke-family__object-icon--${model.objectIcon}`;
    }
    for (const card of root.querySelectorAll<HTMLElement>("[data-tool-card]")) {
      card.classList.toggle("is-active", Number(card.dataset.toolCard) === model.selectedToolIndex);
    }
    for (const unit of root.querySelectorAll<HTMLElement>("[data-tool-index]")) {
      unit.classList.toggle("is-active", Number(unit.dataset.toolIndex) === model.selectedIndex);
    }
    const feedback = root.querySelector<HTMLElement>("[data-tool-feedback]");
    if (feedback) {
      feedback.classList.toggle("is-correct", model.isCorrect);
      setFamilyUiText(
        feedback,
        model.isCorrect
          ? `${model.selectedToolJa}と${model.selectedUnit}が合っています。`
          : `${model.objectLabelJa}に合う道具と単位を、もう一度考えよう。`,
      );
    }
    return;
  }
  const relations = root.querySelectorAll<HTMLElement>("[data-unit-relation]");
  if (relations.length > 0) {
    const selected = unitRelationIndex(state.value);
    for (const relation of relations) {
      relation.classList.toggle(
        "is-active",
        Number(relation.dataset.unitRelation) === selected,
      );
    }
    return;
  }
  const kilometreBars = root.querySelectorAll<SVGRectElement>("[data-kilometre-bar]");
  if (kilometreBars.length > 0) {
    const model = kilometreComparisonModel(state.value, state.second);
    for (const bar of kilometreBars) {
      const width = bar.dataset.kilometreBar === "value"
        ? model.kilometreWidth
        : model.metreWidth;
      bar.setAttribute("width", conciseNumber(width));
    }
    const valueLabel = root.querySelector<SVGTextElement>('[data-kilometre-label="value"]');
    const secondLabel = root.querySelector<SVGTextElement>('[data-kilometre-label="second"]');
    const relation = root.querySelector<SVGTextElement>("[data-kilometre-relation]");
    if (valueLabel) valueLabel.textContent = `${conciseNumber(state.value)} km`;
    if (secondLabel) secondLabel.textContent = `${conciseNumber(state.second)} m`;
    if (relation) relation.textContent = model.relation;
    return;
  }
  const clipRows = root.querySelectorAll<HTMLElement>("[data-clip-row]");
  if (clipRows.length > 0) {
    for (const row of clipRows) {
      const key = row.dataset.clipRow === "second" ? "second" : "value";
      const count = Math.max(0, Math.min(20, Math.floor(state[key])));
      row.replaceChildren(
        ...Array.from({ length: count }, () => {
          const clip = document.createElement("span");
          clip.className = "ke-family__clip";
          clip.setAttribute("aria-hidden", "true");
          return clip;
        }),
      );
    }
    return;
  }
  const standardRows = root.querySelectorAll<HTMLElement>("[data-standard-row]");
  if (standardRows.length > 0) {
    for (const row of standardRows) {
      const key = row.dataset.standardRow === "second" ? "second" : "value";
      const count = Math.max(1, Math.min(20, Math.floor(state[key])));
      row.style.setProperty("--ke-standard-count", String(count));
      row.replaceChildren(
        ...Array.from({ length: count }, () => {
          const unit = document.createElement("span");
          unit.className = key === "second" ? "ke-family__standard-unit" : "ke-family__hand-unit";
          unit.setAttribute("aria-hidden", "true");
          return unit;
        }),
      );
      const label = root.querySelector<HTMLElement>(`[data-standard-label="${key}"]`);
      if (label) {
        setFamilyUiText(label, `${key === "second" ? "B" : "A"}の単位で ${conciseNumber(state[key])}こ`);
      }
    }
    return;
  }
  const hourHand = root.querySelector<SVGLineElement>('[data-clock-hand="hour"]');
  const minuteHand = root.querySelector<SVGLineElement>('[data-clock-hand="minute"]');
  if (hourHand && minuteHand) {
    const minuteAngle = (state.second % 60) * 6;
    const hourAngle = (state.value % 12) * 30 + minuteAngle / 12;
    const hour = clockHand(hourAngle, 58);
    const minute = clockHand(minuteAngle, 86);
    hourHand.setAttribute("x2", conciseNumber(hour.x));
    hourHand.setAttribute("y2", conciseNumber(hour.y));
    minuteHand.setAttribute("x2", conciseNumber(minute.x));
    minuteHand.setAttribute("y2", conciseNumber(minute.y));
    const timeLabel = root.querySelector<SVGTextElement>("[data-clock-time]");
    if (timeLabel) {
      timeLabel.textContent = `${conciseNumber(state.value)}:${String(Math.floor(state.second)).padStart(2, "0")}`;
    }
    return;
  }
  const secondHand = root.querySelector<SVGLineElement>('[data-clock-hand="second"]');
  if (secondHand) {
    const point = clockHand((state.value % 60) * 6, 91);
    secondHand.setAttribute("x2", conciseNumber(point.x));
    secondHand.setAttribute("y2", conciseNumber(point.y));
    return;
  }
  const capacityFills = root.querySelectorAll<SVGRectElement>("[data-capacity-fill]");
  if (capacityFills.length > 0) {
    const model = capacityTransferModel(state.value, state.second, config.max);
    for (const fill of capacityFills) {
      const amount = fill.dataset.capacityFill === "contained" ? model.contained : model.remaining;
      const height = 150 * (amount / config.max);
      fill.setAttribute("y", conciseNumber(220 - height));
      fill.setAttribute("height", conciseNumber(height));
    }
    const spillRadius = model.overflow <= 0
      ? 0
      : Math.max(8, Math.min(52, 52 * (model.overflow / Math.max(1, config.max * 0.4))));
    const spill = root.querySelector<SVGEllipseElement>("[data-capacity-spill]");
    if (spill) {
      spill.setAttribute("rx", conciseNumber(spillRadius));
      spill.setAttribute("ry", conciseNumber(spillRadius * 0.28));
      spill.toggleAttribute("hidden", model.overflow <= 0);
    }
    const unit = config.unit === "none" ? "" : ` ${config.unit}`;
    const labels = {
      remaining: `A ${conciseNumber(model.remaining)}${unit}`,
      contained: `B ${conciseNumber(model.contained)}${unit}`,
      overflow: `${root.dataset.locale === "en" ? "spill" : "こぼれ"} ${conciseNumber(model.overflow)}${unit}`,
    } as const;
    for (const label of root.querySelectorAll<SVGTextElement>("[data-capacity-label]")) {
      const key = label.dataset.capacityLabel as keyof typeof labels | undefined;
      if (key && labels[key]) label.textContent = labels[key];
    }
    const transferLabel = root.querySelector<SVGTextElement>("[data-capacity-transfer-label]");
    if (transferLabel) {
      transferLabel.textContent = `${root.dataset.locale === "en" ? "to B" : "Bへ"} ${conciseNumber(model.transferred)}${unit}`;
    }
    return;
  }
  const compareScenes = root.querySelectorAll<SVGSVGElement>("[data-measure-compare-scene]");
  if (compareScenes.length > 0) {
    const activeScene = state.selected % 2 === 0 ? "direct" : "tape";
    for (const scene of compareScenes) {
      scene.toggleAttribute("hidden", scene.dataset.measureCompareScene !== activeScene);
    }
    for (const bar of root.querySelectorAll<SVGRectElement>(
      "[data-measure-compare-bar], [data-measure-compare-copy]",
    )) {
      const key = bar.dataset.measureCompareBar === "second" ? "second" : "value";
      bar.setAttribute("width", conciseNumber(
        MEASUREMENT_COMPARE_BAR_MAX_WIDTH * clamp(state[key] / config.max, 0, 1),
      ));
    }
    const unit = config.unit === "none" ? "" : ` ${config.unit}`;
    for (const label of root.querySelectorAll<SVGTextElement>("[data-measure-compare-label]")) {
      const key = label.dataset.measureCompareLabel === "second" ? "second" : "value";
      label.textContent = `${conciseNumber(state[key])}${unit}`;
    }
    return;
  }
  const fills = root.querySelectorAll<SVGRectElement>("[data-measure-fill]");
  if (fills.length > 0) {
    for (const fill of fills) {
      const key = fill.dataset.measureFill === "second" ? "second" : "value";
      const height = 150 * clamp(state[key] / config.max, 0, 1);
      fill.setAttribute("y", conciseNumber(220 - height));
      fill.setAttribute("height", conciseNumber(height));
    }
    return;
  }
  const markers = root.querySelectorAll<SVGLineElement>("[data-measure-marker]");
  if (markers.length > 0) {
    for (const marker of markers) {
      const key = marker.dataset.measureMarker === "second" ? "second" : "value";
      const x = conciseNumber(35 + clamp(state[key] / config.max, 0, 1) * 490);
      marker.setAttribute("x1", x);
      marker.setAttribute("x2", x);
      root.querySelector<SVGTextElement>(`[data-measure-marker-label="${key}"]`)?.setAttribute("x", x);
    }
    return;
  }
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

const DIE_POSITIONS: Readonly<Record<number, readonly [number, number][]>> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[30, 30], [50, 50], [70, 70]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 25], [70, 25], [30, 50], [70, 50], [30, 75], [70, 75]],
};

function createDie(face: number): SVGSVGElement {
  const normalized = ((Math.floor(face) - 1) % 6 + 6) % 6 + 1;
  const svg = svgElement("svg", {
    class: "ke-family__die",
    viewBox: "0 0 100 100",
    "aria-hidden": "true",
  });
  svg.append(svgElement("rect", { x: "5", y: "5", width: "90", height: "90", rx: "14" }));
  for (const [x, y] of DIE_POSITIONS[normalized] ?? []) {
    svg.append(svgElement("circle", { cx: String(x), cy: String(y), r: "7" }));
  }
  return svg;
}

function createDataCard(category: number): HTMLSpanElement {
  const card = document.createElement("span");
  const variants = ["round", "square", "diamond"] as const;
  card.className = `ke-family__data-card ke-family__data-card--${variants[category % variants.length] ?? "round"} ke-family__data-card--category-${category % 6}`;
  card.textContent = String.fromCharCode(65 + category);
  card.setAttribute("aria-hidden", "true");
  return card;
}

function createTally(index: number): HTMLSpanElement {
  const tally = document.createElement("span");
  tally.className = `ke-family__tally${index % 5 === 4 ? " ke-family__tally--fifth" : ""}`;
  tally.setAttribute("aria-hidden", "true");
  return tally;
}

function createFruit(category: number): HTMLSpanElement {
  const fruit = document.createElement("span");
  const variants = ["apple", "orange", "pear"] as const;
  fruit.className = `ke-family__fruit ke-family__fruit--${variants[category % variants.length] ?? "apple"}`;
  fruit.setAttribute("aria-hidden", "true");
  fruit.append(document.createElement("span"));
  return fruit;
}

function updateData(
  root: HTMLElement,
  config: FamilyInteractiveConfig,
  state: FamilyState,
  diceFrequencies?: readonly number[],
  categoryValues?: readonly number[],
): void {
  const dice = root.querySelector<HTMLElement>("[data-dice-row]");
  if (dice) {
    dice.replaceChildren(createDie(state.value), createDie(state.second));
    for (const cell of root.querySelectorAll<HTMLElement>("[data-dice-frequency]")) {
      const face = Number(cell.dataset.diceFrequency);
      cell.textContent = String(diceFrequencies?.[face - 1] ?? 0);
    }
    const recorded = root.querySelector<HTMLElement>("[data-dice-recorded]");
    if (recorded) {
      recorded.textContent = String(diceFrequencies?.reduce((sum, count) => sum + count, 0) ?? 0);
    }
    return;
  }
  const values = categoryValues ?? dataCategoryValues(state.value, state.second, config.categories, [
    config.third ?? 0,
    config.fourth ?? 0,
    config.fifth ?? 0,
    config.sixth ?? 0,
  ]);
  for (const output of root.querySelectorAll<HTMLOutputElement>("[data-data-category-control-count]")) {
    const index = Number(output.dataset.dataCategoryControlCount);
    output.textContent = conciseNumber(values[index] ?? 0);
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-data-category-adjust]")) {
    const index = Number(button.dataset.dataCategoryAdjust);
    const delta = Number(button.dataset.dataDelta);
    const count = values[index] ?? 0;
    button.disabled = delta < 0 ? count <= 0 : count >= config.max;
  }
  const sourceCards = root.querySelector<HTMLElement>("[data-data-source-cards]");
  if (sourceCards) {
    const cards: HTMLSpanElement[] = [];
    for (const [category, count] of values.entries()) {
      for (let index = 0; index < Math.max(0, Math.floor(count)); index += 1) {
        const card = document.createElement("span");
        const variants = ["round", "square", "diamond"] as const;
        card.className = `ke-family__data-card ke-family__data-card--${variants[category % variants.length] ?? "round"} ke-family__data-card--category-${category % 6}`;
        card.dataset.sourceCategory = String(category);
        card.dataset.sourceCard = `${category}-${index}`;
        card.textContent = String.fromCharCode(65 + category);
        cards.push(card);
      }
    }
    sourceCards.replaceChildren(...cards);
  }
  const evidenceViews = root.querySelectorAll<HTMLElement>("[data-evidence-view]");
  if (evidenceViews.length > 0) {
    const selectedView = state.selected % 2 === 0 ? "chart" : "table";
    for (const view of evidenceViews) {
      view.hidden = view.dataset.evidenceView !== selectedView;
    }
  }
  const criteriaBins = root.querySelectorAll<HTMLElement>("[data-criteria-bin]");
  if (criteriaBins.length > 0) {
    const model = classificationCriteriaModel(state.value, state.second, state.selected);
    const criterionLabel = root.querySelector<HTMLElement>("[data-criteria-label]");
    if (criterionLabel) setFamilyUiText(criterionLabel, model.criterionLabel);
    for (const bin of criteriaBins) {
      const index = Number(bin.dataset.criteriaBin);
      const label = bin.querySelector<HTMLElement>(`[data-criteria-bin-label="${index}"]`);
      if (label) setFamilyUiText(label, model.binLabels[index] ?? "");
      const container = bin.querySelector<HTMLElement>(":scope > div");
      const cards = model.bins[index] ?? [];
      container?.replaceChildren(...cards.map((card) => {
        const item = document.createElement("span");
        item.className = `ke-family__data-card ke-family__data-card--${card.shape} ke-family__data-card--${card.tone}`;
        item.dataset.criteriaCard = String(card.id);
        item.textContent = String(card.id);
        return item;
      }));
    }
    return;
  }
  const classificationBins = root.querySelectorAll<HTMLElement>(
    "[data-classification-category]",
  );
  if (classificationBins.length > 0) {
    for (const bin of classificationBins) {
      const index = Number(bin.dataset.classificationCategory);
      const container = bin.querySelector<HTMLElement>(":scope > div");
      const count = Math.max(0, Math.min(20, Math.floor(values[index] ?? 0)));
      container?.replaceChildren(
        ...Array.from({ length: count }, () => createDataCard(index)),
      );
    }
    return;
  }
  const frequencyRows = root.querySelectorAll<HTMLElement>("[data-frequency-category]");
  if (frequencyRows.length > 0) {
    for (const row of frequencyRows) {
      const index = Number(row.dataset.frequencyCategory);
      const count = Math.max(0, Math.min(40, Math.floor(values[index] ?? 0)));
      row.replaceChildren(...Array.from({ length: count }, (_, index) => createTally(index)));
      const output = root.querySelector<HTMLOutputElement>(`[data-frequency-count="${index}"]`);
      if (output) {
        output.textContent = conciseNumber(values[index] ?? 0);
      }
    }
    return;
  }
  const pictureRows = root.querySelectorAll<HTMLElement>("[data-picture-category]");
  if (pictureRows.length > 0) {
    for (const row of pictureRows) {
      const index = Number(row.dataset.pictureCategory);
      const count = Math.max(0, Math.min(20, Math.floor(values[index] ?? 0)));
      row.replaceChildren(
        ...Array.from({ length: count }, () => createFruit(index)),
      );
    }
    return;
  }
  const twoWayCells = root.querySelectorAll<HTMLElement>("[data-two-way-cell]");
  if (twoWayCells.length > 0) {
    const model = twoWayTableModel(state.value, state.second);
    for (const cell of twoWayCells) {
      cell.textContent = conciseNumber(model.cells[Number(cell.dataset.twoWayCell)] ?? 0);
    }
    for (const total of root.querySelectorAll<HTMLElement>("[data-two-way-row-total]")) {
      total.textContent = conciseNumber(model.rowTotals[Number(total.dataset.twoWayRowTotal)] ?? 0);
    }
    for (const total of root.querySelectorAll<HTMLElement>("[data-two-way-column-total]")) {
      total.textContent = conciseNumber(model.columnTotals[Number(total.dataset.twoWayColumnTotal)] ?? 0);
    }
    const grandTotal = root.querySelector<HTMLElement>("[data-two-way-grand-total]");
    if (grandTotal) grandTotal.textContent = conciseNumber(model.grandTotal);
    const source = root.querySelector<HTMLElement>("[data-two-way-source-cards]");
    if (source) {
      const cards: HTMLSpanElement[] = [];
      for (const [cell, count] of model.cells.entries()) {
        for (let index = 0; index < count; index += 1) {
          const card = document.createElement("span");
          card.className = `ke-family__data-card ke-family__data-card--${cell < 2 ? "round" : "square"} ke-family__data-card--${cell % 2 === 0 ? "accent" : "outline"}`;
          card.dataset.twoWaySourceCell = String(cell);
          card.dataset.twoWaySourceCard = `${cell}-${index}`;
          card.textContent = cell % 2 === 0 ? "A" : "B";
          cards.push(card);
        }
      }
      source.replaceChildren(...cards);
    }
    return;
  }
  const tableCells = root.querySelectorAll<HTMLElement>("[data-table-category]");
  if (tableCells.length > 0) {
    for (const cell of tableCells) {
      const index = Number(cell.dataset.tableCategory);
      cell.textContent = conciseNumber(values[index] ?? 0);
    }
    const total = root.querySelector<HTMLElement>("[data-table-total]");
    if (total) total.textContent = conciseNumber(values.reduce((sum, count) => sum + count, 0));
    if (!root.querySelector("[data-data-category]")) return;
  }
  for (const bar of root.querySelectorAll<SVGRectElement>("[data-data-category]")) {
    const index = Number(bar.dataset.dataCategory);
    const count = values[index] ?? 0;
    const height = count <= 0 ? 0 : Math.max(2, Math.min(180, (count / config.max) * 180));
    const label = root.querySelector<SVGTextElement>(`[data-data-category-label="${index}"]`);
    bar?.setAttribute("y", conciseNumber(220 - height));
    bar?.setAttribute("height", conciseNumber(height));
    if (label) {
      label.setAttribute("y", conciseNumber(205 - height));
      label.textContent = conciseNumber(count);
    }
  }
}

function updateSoroban(
  root: HTMLElement,
  config: FamilyInteractiveConfig,
  state: FamilyState,
): void {
  for (const name of ["value", "second"] as const) {
    const digits = String(Math.max(0, Math.min(99_999, Math.floor(state[name]))))
      .padStart(5, "0")
      .slice(-5)
      .split("");
    for (const [columnIndex, digit] of digits.entries()) {
      const column = root.querySelector<HTMLElement>(`[data-soroban-column="${name}-${columnIndex}"]`);
      if (!column) {
        continue;
      }
      const value = Number(digit);
      column.querySelector(".ke-family__soroban-upper")?.classList.toggle("is-active", value >= 5);
      for (const [index, bead] of [...column.querySelectorAll(".ke-family__soroban-lower")].entries()) {
        bead.classList.toggle("is-active", index < value % 5);
      }
      const output = column.querySelector<HTMLElement>("[data-soroban-digit]");
      if (output) {
        output.textContent = digit;
      }
      const place = 10 ** (4 - columnIndex);
      const current = Math.floor(state[name]);
      const decrement = column.querySelector<HTMLButtonElement>('[data-soroban-delta="-1"]');
      const increment = column.querySelector<HTMLButtonElement>('[data-soroban-delta="1"]');
      if (decrement) decrement.disabled = value <= 0 || current - place < 0;
      if (increment) increment.disabled = value >= 9 || current + place > config.max;
    }
  }
}

export function adjustSorobanDigitValue(
  currentValue: number,
  column: number,
  delta: number,
  maximum: number,
): number {
  if (!Number.isInteger(column) || column < 0 || column > 4 || ![-1, 1].includes(delta)) {
    return currentValue;
  }
  const current = Math.floor(currentValue);
  const place = 10 ** (4 - column);
  const digit = Math.floor(current / place) % 10;
  const candidate = current + delta * place;
  if ((delta < 0 && digit === 0) || (delta > 0 && digit === 9) || candidate < 0 || candidate > maximum) {
    return current;
  }
  return candidate;
}

function updateVisual(
  root: HTMLElement,
  config: FamilyInteractiveConfig,
  state: FamilyState,
  diceFrequencies?: readonly number[],
  categoryValues?: readonly number[],
): void {
  switch (config.interactiveKind) {
    case "counter-mat":
      updateCounterMat(root, config, state);
      break;
    case "place-value-board":
      updatePlaceValue(root, config, state);
      break;
    case "number-line":
      updateNumberLine(root, config, state);
      break;
    case "fraction-model":
      updateFraction(root, config, state);
      break;
    case "equation-balance":
      updateBalance(root, config, state);
      break;
    case "geometry-lab":
      updateGeometry(root, config, state);
      break;
    case "measurement-lab":
      updateMeasurement(root, config, state);
      break;
    case "data-lab":
      updateData(root, config, state, diceFrequencies, categoryValues);
      break;
    case "soroban-board":
      updateSoroban(root, config, state);
      break;
  }
}

function initializeFamilyInteractive(root: HTMLElement): void {
  if (
    root.dataset.enhanced === "true" ||
    enhancedRoots.has(root) ||
    root.dataset.keFamilyVersion !== "1"
  ) {
    return;
  }
  const kind = root.dataset.noethecaInteractive;
  if (!kind || !isFamilyInteractiveKind(kind)) {
    return;
  }
  const config = parseFamilyInteractiveDataset(kind, root.dataset);
  const controls = root.querySelector<HTMLElement>("[data-interactive-controls]");
  const reset = root.querySelector<HTMLButtonElement>("[data-family-reset]");
  const result = root.querySelector<HTMLOutputElement>("[data-family-result]");
  const status = root.querySelector<HTMLElement>("[data-family-status]");
  if (!config || !controls || !reset || !result || !status) {
    return;
  }
  const diceButton = root.querySelector<HTMLButtonElement>("[data-family-dice-roll]");
  if (kind === "data-lab" && config.mode === "dice-frequency" && !diceButton) {
    return;
  }
  const fractionOperationButton = root.querySelector<HTMLButtonElement>("[data-fraction-operation]");
  if (kind === "fraction-model" && config.mode === "add-subtract" && !fractionOperationButton) {
    return;
  }
  const decimalOperationButton = root.querySelector<HTMLButtonElement>("[data-place-decimal-operation]");
  if (kind === "place-value-board" && config.mode === "decimal" && !decimalOperationButton) {
    return;
  }
  const equationOperationButton = root.querySelector<HTMLButtonElement>("[data-equation-operation]");
  if (kind === "equation-balance" && config.mode === "properties" && !equationOperationButton) {
    return;
  }
  const definitions = familyControlDefinitions(config);
  const inputs = new Map<FamilyStateKey, HTMLInputElement>();
  for (const definition of definitions) {
    const input = root.querySelector<HTMLInputElement>(
      `[data-family-input="${definition.key}"]`,
    );
    const output = root.querySelector<HTMLOutputElement>(
      `[data-family-output="${definition.key}"]`,
    );
    if (!input || !output) {
      return;
    }
    inputs.set(definition.key, input);
  }

  const initial: FamilyState = {
    value: config.value,
    second: config.second,
    selected: config.selected,
    groups: config.groups,
    operation: config.operation,
  };
  const state: FamilyState = { ...initial };
  const initialDiceCounts = initialDiceFrequencies(config.value, config.second);
  let diceFrequencies = [...initialDiceCounts];
  const initialCategoryValues = dataCategoryValues(config.value, config.second, config.categories, [
    config.third ?? 0,
    config.fourth ?? 0,
    config.fifth ?? 0,
    config.sixth ?? 0,
  ]);
  let categoryValues = [...initialCategoryValues];
  const locale = root.dataset.locale === "en" ? "en" : "ja";
  const parsedConfig = config;
  const resultOutput = result;
  let resultVersion = 0;

  function currentResultText(): string {
    if (parsedConfig.interactiveKind === "data-lab" && parsedConfig.mode === "dice-frequency") {
      return diceFrequencyResultText(state.value, state.second, diceFrequencies, locale);
    }
    if (parsedConfig.interactiveKind === "data-lab" && root.querySelector("[data-data-adjustments]")) {
      const summary = dataCategoryResultText(categoryValues, locale);
      return parsedConfig.mode === "evidence"
        ? `${state.selected % 2 === 0 ? (locale === "ja" ? "棒グラフ" : "bar chart") : (locale === "ja" ? "表" : "table")}：${summary}`
        : summary;
    }
    return familyResultText(
      parsedConfig,
      state.value,
      state.second,
      state.selected,
      locale,
      state.groups,
      state.operation,
    );
  }

  function render(): void {
    if (parsedConfig.interactiveKind === "fraction-model" && state.operation === "subtract") {
      state.second = Math.min(state.second, state.selected);
    }
    if (parsedConfig.interactiveKind === "place-value-board" && parsedConfig.mode === "decimal") {
      state.second = state.operation === "subtract"
        ? Math.min(state.second, state.value)
        : Math.min(state.second, Math.max(0, 99_999.9 - state.value));
    }
    if (
      parsedConfig.interactiveKind === "equation-balance" &&
      parsedConfig.mode === "properties" &&
      state.operation === "add"
    ) {
      state.selected = Math.min(state.selected, 1);
    }
    categoryValues[0] = state.value;
    categoryValues[1] = state.second;
    updateVisual(root, parsedConfig, state, diceFrequencies, categoryValues);
    const resultText = currentResultText();
    const resultTex = familyResultTex(
      parsedConfig,
      state.value,
      state.second,
      state.selected,
      state.groups,
      state.operation,
    );
    resultOutput.setAttribute("aria-label", locale === "ja" ? familyUiReading(resultText) : resultText);
    const version = ++resultVersion;
    if (resultTex === undefined) {
      resultOutput.dataset.familyResultKind = "text";
      setLocalizedFamilyUiText(resultOutput, resultText, locale);
    } else {
      resultOutput.dataset.familyResultKind = "math";
      // KaTeX is loaded lazily. Keep the newly computed, readable result visible
      // while the first client-side render is in flight instead of briefly
      // showing the previous mathematical state.
      resultOutput.textContent = resultText;
      resultOutput.setAttribute("aria-busy", "true");
      void renderClientMath(resultOutput, resultTex, false, () => version === resultVersion)
        .then(() => {
          if (version === resultVersion) {
            resultOutput.removeAttribute("aria-busy");
          }
        })
        .catch(() => {
          if (version === resultVersion) {
            resultOutput.removeAttribute("aria-busy");
          }
        });
    }
    for (const definition of definitions) {
      const input = inputs.get(definition.key);
      const output = root.querySelector<HTMLOutputElement>(
        `[data-family-output="${definition.key}"]`,
      );
      if (!input || !output) {
        continue;
      }
      const value = state[definition.key];
      const bounds = familyLiveControlBounds(parsedConfig, state, definition);
      input.value = conciseNumber(value);
      input.min = conciseNumber(bounds.minimum);
      input.max = conciseNumber(bounds.maximum);
      const valueText = parsedConfig.interactiveKind === "geometry-lab"
        ? familyControlValueText(parsedConfig, value, locale)
        : familyControlDefinitionValueText(definition, value, locale);
      input.setAttribute("aria-valuetext", locale === "ja" ? familyUiReading(valueText) : valueText);
      setLocalizedFamilyUiText(output, valueText, locale);
    }
    if (fractionOperationButton) {
      const subtraction = state.operation === "subtract";
      fractionOperationButton.setAttribute("aria-pressed", subtraction ? "true" : "false");
      setLocalizedFamilyUiText(
        fractionOperationButton,
        locale === "ja"
          ? subtraction ? "たし算にする" : "ひき算にする"
          : subtraction ? "Use addition" : "Use subtraction",
        locale,
      );
    }
    if (decimalOperationButton) {
      const subtraction = state.operation === "subtract";
      decimalOperationButton.setAttribute("aria-pressed", subtraction ? "true" : "false");
      setLocalizedFamilyUiText(
        decimalOperationButton,
        locale === "ja"
          ? subtraction ? "たし算にする" : "ひき算にする"
          : subtraction ? "Use addition" : "Use subtraction",
        locale,
      );
    }
    if (equationOperationButton) {
      const multiplication = state.operation === "multiply";
      equationOperationButton.setAttribute("aria-pressed", multiplication ? "true" : "false");
      setLocalizedFamilyUiText(
        equationOperationButton,
        locale === "ja"
          ? multiplication ? "たし算のきまりにする" : "かけ算のきまりにする"
          : multiplication ? "Use addition properties" : "Use multiplication properties",
        locale,
      );
    }
  }

  for (const definition of definitions) {
    const input = inputs.get(definition.key);
    if (!input) {
      continue;
    }
    input.value = conciseNumber(initial[definition.key]);
    input.addEventListener("input", () => {
      const parsed = Number(input.value);
      if (!Number.isFinite(parsed)) {
        return;
      }
      const bounds = familyLiveControlBounds(parsedConfig, state, definition);
      state[definition.key] = normalizeStepValue(
        parsed,
        bounds.minimum,
        bounds.maximum,
        definition.step,
      );
      const naturalSubtraction =
        (parsedConfig.interactiveKind === "counter-mat" && ["decompose", "subtract"].includes(parsedConfig.mode)) ||
        (parsedConfig.interactiveKind === "place-value-board" && parsedConfig.mode === "regroup-subtract") ||
        (parsedConfig.interactiveKind === "measurement-lab" && parsedConfig.mode === "capacity");
      if (naturalSubtraction) {
        if (definition.key === "value" && state.value < state.second) {
          state.second = state.value;
        } else if (definition.key === "second" && state.second > state.value) {
          state.second = state.value;
        }
      }
      if (parsedConfig.interactiveKind === "equation-balance" && parsedConfig.mode === "unknown") {
        if (definition.key === "value" && state.value > state.second) {
          state.second = state.value;
        } else if (definition.key === "second" && state.second < state.value) {
          state.value = state.second;
        }
      }
      render();
    });
    input.addEventListener("change", () => {
      setLocalizedFamilyUiText(status, currentResultText(), locale);
    });
  }
  reset.addEventListener("click", () => {
    Object.assign(state, initial);
    diceFrequencies = [...initialDiceCounts];
    categoryValues = [...initialCategoryValues];
    render();
    setLocalizedFamilyUiText(status, locale === "ja" ? "はじめのようすにもどしました。" : "Reset to the initial state.", locale);
  });
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-data-category-adjust]")) {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.dataCategoryAdjust);
      const delta = Number(button.dataset.dataDelta);
      if (!Number.isInteger(index) || index < 0 || index >= categoryValues.length || ![-1, 1].includes(delta)) {
        return;
      }
      categoryValues[index] = clamp((categoryValues[index] ?? 0) + delta, 0, parsedConfig.max);
      if (index === 0) state.value = categoryValues[index] ?? 0;
      if (index === 1) state.second = categoryValues[index] ?? 0;
      render();
      setLocalizedFamilyUiText(status, currentResultText(), locale);
    });
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-soroban-adjust]")) {
    button.addEventListener("click", () => {
      const key = button.dataset.sorobanName === "second" ? "second" : "value";
      const column = Number(button.dataset.sorobanColumnIndex);
      const delta = Number(button.dataset.sorobanDelta);
      if (!Number.isInteger(column) || column < 0 || column > 4 || ![-1, 1].includes(delta)) {
        return;
      }
      const current = Math.floor(state[key]);
      const candidate = adjustSorobanDigitValue(current, column, delta, parsedConfig.max);
      if (candidate === current) {
        return;
      }
      state[key] = candidate;
      render();
      setLocalizedFamilyUiText(status, familyResultText(
        parsedConfig,
        state.value,
        state.second,
        state.selected,
        locale,
        state.groups,
        state.operation,
      ), locale);
    });
  }
  diceButton?.addEventListener("click", () => {
    state.value = rollDie();
    state.second = rollDie();
    diceFrequencies = recordDiceFaces(diceFrequencies, [state.value, state.second]);
    render();
    setLocalizedFamilyUiText(status, currentResultText(), locale);
  });
  fractionOperationButton?.addEventListener("click", () => {
    state.operation = state.operation === "subtract" ? "add" : "subtract";
    render();
    setLocalizedFamilyUiText(status, currentResultText(), locale);
  });
  decimalOperationButton?.addEventListener("click", () => {
    state.operation = state.operation === "subtract" ? "add" : "subtract";
    render();
    setLocalizedFamilyUiText(status, currentResultText(), locale);
  });
  equationOperationButton?.addEventListener("click", () => {
    state.operation = state.operation === "multiply" ? "add" : "multiply";
    render();
    setLocalizedFamilyUiText(status, currentResultText(), locale);
  });

  const inlineActions = root.querySelectorAll<HTMLButtonElement>("[data-family-inline-action]");
  if (inlineActions.length > 0) {
    updateVisual(root, parsedConfig, state, diceFrequencies, categoryValues);
    for (const action of inlineActions) {
      action.hidden = false;
    }
  }

  root.dataset.enhanced = "true";
  enhancedRoots.add(root);
  controls.hidden = false;
  if (parsedConfig.interactiveKind === "geometry-lab") {
    const visual = root.querySelector<HTMLElement>(".ke-family__visual");
    requestAnimationFrame(() => {
      if (visual && visual.scrollWidth > visual.clientWidth && visual.scrollLeft < 2) {
        visual.scrollLeft = (visual.scrollWidth - visual.clientWidth) / 2;
      }
    });
  }
  // The server already rendered a consistent initial model and formula.
  // Avoid loading the client math chunk until the learner changes a value.
}

export function initializeFamilyInteractives(scope: ParentNode = document): void {
  for (const root of scope.querySelectorAll<HTMLElement>("[data-ke-family-version]")) {
    initializeFamilyInteractive(root);
  }
}
