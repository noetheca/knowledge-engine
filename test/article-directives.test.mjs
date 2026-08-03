import assert from "node:assert/strict";
import test from "node:test";
import { markdownToHtml } from "satteri";
import {
  ARTICLE_MARKDOWN_FEATURES,
  FAMILY_INTERACTIVE_MODES,
  UNIT_RELATIONS,
  createArticleDirectivePlugin,
  familyControlDefinitions,
  familyControlDefinitionValueText,
  familyLiveControlBounds,
  familyInteractiveDataset,
  familyResultTex,
  familyResultText,
  diceFrequencyResultText,
  balanceTilt,
  capacityTransferModel,
  classificationCriteriaModel,
  conservationFillModel,
  dataCategoryValues,
  equationBalanceModel,
  fractionOperationModel,
  familyUiReading,
  initialDiceFrequencies,
  kilometreComparisonModel,
  measurementToolChoiceModel,
  normalizeStepValue,
  placeOperationModel,
  parseFamilyInteractiveConfig,
  parseFamilyInteractiveDataset,
  recordDiceFaces,
  segmentFamilyUiText,
  twoWayTableModel,
  unitRelationIndex,
  validateArticleDirectives,
} from "../dist/index.js";
import {
  adjustSorobanDigitValue,
  dieFaceFromByte,
} from "../dist/client/family-interactives.js";
import {
  createRectangleAreaGridCellLabels,
  createRectangleAreaGridDimensions,
  createRectangleAreaGridGeometry,
  RECTANGLE_AREA_GRID_CELL_SIZE,
  rectangleAreaGridCssLength,
} from "../dist/markdown/rectangle-area-grid.js";
import { segmentKanjiRuby } from "../dist/markdown/kanji-ruby.js";

function renderedBaseText(html) {
  return html
    .replace(/<rp>[^<]*<\/rp>/gu, "")
    .replace(/<rt>[^<]*<\/rt>/gu, "")
    .replace(/<[^>]+>/gu, "");
}

const valid = `
:ruby[面積]{reading="めんせき"}

:ruby[掛け算]{reading="かけざん"}と:ruby[平方センチメートル]{reading="へいほうセンチメートル"}

面積は $3 \\times 4 = 12\\,\\mathrm{cm}^2$ です。

$$
\\text{長方形の面積} = \\text{縦} \\times \\text{横}
$$

:::callout{type="note" title="単位" titleReading="たんい"}
1マスは1 cm²です。
:::

:::details{summary="証明の詳細" summaryReading="しょうめいのしょうさい"}
本文を示します。
:::

::interactive[縦と横を変えて確かめる]{kind="rectangle-area-grid" rows="3" columns="4" unit="cm" captionReading="たてとよこをかえてたしかめる"}
`;

test("accepts the registered article directives and math", async () => {
  assert.deepEqual(await validateArticleDirectives(valid), []);
});

test("keeps directive examples literal inside code", async () => {
  const source = `Use \`:ruby[面積]{reading="めんせき"}\` in an article.\n\n\`\`\`md\n:::callout{type="note"}\ntext\n:::\n\`\`\``;
  assert.deepEqual(await validateArticleDirectives(source), []);
});

test("rejects unknown, malformed, and out-of-range directives", async () => {
  const source = `
:::unknown{type="note"}
text
:::

::ruby[面積]{reading="めんせき"}

::interactive[図]{kind="rectangle-area-grid" rows="03" columns="13" unit="px"}

:::details{summary="閉じ忘れ"}
本文
`;
  const codes = (await validateArticleDirectives(source)).map(({ code }) => code);
  assert.ok(codes.includes("unknown-directive"));
  assert.ok(codes.includes("wrong-directive-form"));
  assert.ok(codes.includes("invalid-directive-attribute"));
  assert.ok(codes.includes("malformed-directive"));
});

test("renders accessible static HTML and MathML before interaction enhancement", async () => {
  const { html } = await markdownToHtml(valid, {
    features: ARTICLE_MARKDOWN_FEATURES,
    mdastPlugins: [createArticleDirectivePlugin()],
    data: { astro: { frontmatter: { locale: "ja" } } },
  });

  assert.match(
    html,
    /<ruby>面積<rp>（<\/rp><rt>めんせき<\/rt><rp>）<\/rp><\/ruby>/,
  );
  assert.match(html, /<aside class="ke-callout ke-callout--note" role="note"/);
  assert.match(
    html,
    /ke-callout__title.*<ruby>単位<rp>（<\/rp><rt>たんい<\/rt>/,
  );
  assert.match(
    html,
    /<details class="ke-details"><summary><ruby>証明<rp>（<\/rp><rt>しょうめい<\/rt>.*<\/ruby>の<ruby>詳細<rp>（<\/rp><rt>しょうさい<\/rt>/,
  );
  assert.match(
    html,
    /<ruby>掛<rp>（<\/rp><rt>か<\/rt>.*<\/ruby>け<ruby>算<rp>（<\/rp><rt>ざん<\/rt>/,
  );
  assert.match(
    html,
    /<ruby>平方<rp>（<\/rp><rt>へいほう<\/rt>.*<\/ruby>センチメートル/,
  );
  assert.match(html, /class="ke-math ke-math--inline"/);
  assert.match(html, /class="ke-math ke-math--display"/);
  assert.match(html, /<math xmlns="http:\/\/www\.w3\.org\/1998\/Math\/MathML"/);
  assert.match(html, /data-noetheca-interactive="rectangle-area-grid"/);
  assert.match(html, /aria-valuetext="3 cm"/);
  assert.match(html, /<\/label><output for="ke-grid-/);
  assert.match(html, /data-grid-number-toggle/);
  assert.equal((html.match(/data-grid-dimension=/g) ?? []).length, 4);
  assert.match(html, /data-grid-dimension="unit-column"/);
  assert.match(html, /data-grid-dimension="unit-row"/);
  assert.match(html, /data-grid-unit-math/);
  assert.match(html, /data-grid-calculation/);
  assert.match(html, /data-grid-area/);
  assert.match(html, /data-grid-viewport/);
  assert.match(html, /width="6\.833333cm"/);
  assert.match(html, /1 CSS cm/);
  assert.match(
    html,
    /<figcaption><ruby>縦.*<\/ruby>と<ruby>横.*<\/ruby>を<ruby>変.*<\/ruby>えて<ruby>確.*<\/ruby>かめる<\/figcaption>/,
  );
  const rubyBases = [...html.matchAll(/<ruby>([^<]+)<rp>/gu)].map((match) => match[1]);
  assert.ok(rubyBases.length > 0);
  for (const base of rubyBases) {
    assert.match(base, /^[\p{Unified_Ideograph}々〇〆〻]+$/u);
  }
});

test("accepts every registered elementary family mode", async () => {
  for (const [kind, modes] of Object.entries(FAMILY_INTERACTIVE_MODES)) {
    for (const mode of modes) {
      const fixedAttributes =
        kind === "number-line" && mode === "zero"
          ? ' min="0" value="0" second="0"'
          : kind === "fraction-model" && mode === "decimal"
            ? ' parts="10" selected="1" second="1" secondParts="10"'
            : kind === "geometry-lab" && ["circle", "sphere", "elements", "position"].includes(mode)
              ? ' value="0"'
              : kind === "measurement-lab" && mode === "unit-relations"
                ? ' value="0"'
            : kind === "measurement-lab" && mode === "choose-tool"
              ? ' value="0" second="1"'
              : "";
      const source = `::interactive[Explore the model]{kind="${kind}" mode="${mode}"${fixedAttributes}}`;
      assert.deepEqual(
        await validateArticleDirectives(source),
        [],
        `${kind}:${mode}`,
      );
    }
  }
});

test("renders family-specific static fallbacks and finite data contracts", async () => {
  const cases = [
    ["counter-mat", "add", /ke-family__counter-mat/],
    ["place-value-board", "decimal", /data-place-decimal="true"/],
    ["number-line", "jump-add", /data-line-marker="value"/],
    ["fraction-model", "compare", /data-fraction-bar="selected"/],
    ["equation-balance", "equality", /data-balance-beam/],
    ["geometry-lab", "circle", /data-geometry-diameter-line/],
    ["measurement-lab", "area", /data-area-tile="second-/],
    ["data-lab", "classify", /data-classification-bin="value"/],
    ["soroban-board", "calculate", /data-soroban="second"/],
  ];
  for (const [kind, mode, expected] of cases) {
    const { html } = await markdownToHtml(
      `::interactive[Explore the model]{kind="${kind}" mode="${mode}"}`,
      {
        features: ARTICLE_MARKDOWN_FEATURES,
        mdastPlugins: [createArticleDirectivePlugin()],
        data: { astro: { frontmatter: { locale: "en" } } },
      },
    );
    assert.match(html, new RegExp(`data-noetheca-interactive="${kind}"`));
    assert.match(html, /data-ke-family-version="1"/);
    assert.match(html, /data-interactive-controls hidden/);
    assert.match(html, expected);
    assert.match(html, /role="region" tabindex="0"/);
  }
});

test("renders concrete measurement and data modes instead of a generic chart", async () => {
  const expectedBySource = new Map([
    ['::interactive[Test]{kind="measurement-lab" mode="conservation"}', /data-conservation-fill="right"/],
    ['::interactive[Test]{kind="measurement-lab" mode="nonstandard"}', /data-clip-row="second"/],
    ['::interactive[Test]{kind="measurement-lab" mode="choose-tool" value="0" second="1"}', /data-tool-index="1"/],
    ['::interactive[Test]{kind="measurement-lab" mode="elapsed"}', /data-elapsed-hand="second"/],
    ['::interactive[Test]{kind="data-lab" mode="frequency"}', /data-frequency-row="value"/],
    ['::interactive[Test]{kind="data-lab" mode="pictograph"}', /data-picture-row="second"/],
    ['::interactive[Test]{kind="data-lab" mode="table"}', /class="ke-family__data-table"/],
    ['::interactive[Test]{kind="data-lab" mode="two-way"}', /ふたつのわけかた/],
    ['::interactive[Test]{kind="data-lab" mode="evidence"}', /data-evidence-view="chart"/],
    ['::interactive[Test]{kind="data-lab" mode="dice-frequency"}', /data-family-dice-roll/],
  ]);
  for (const [source, expected] of expectedBySource) {
    const { html } = await markdownToHtml(source, {
      features: ARTICLE_MARKDOWN_FEATURES,
      mdastPlugins: [createArticleDirectivePlugin()],
    });
    assert.match(html, expected);
  }
});

test("keeps fixed mathematical models static and semantically exact", async () => {
  const sources = [
    '::interactive[Zero]{kind="number-line" mode="zero" min="0" value="0" second="0"}',
    '::interactive[Unit fraction]{kind="fraction-model" mode="unit" parts="4" selected="1"}',
    '::interactive[Decimal fraction]{kind="fraction-model" mode="decimal" parts="10" selected="1" second="1" secondParts="10"}',
  ];
  for (const source of sources) {
    const { html } = await markdownToHtml(source, {
      features: ARTICLE_MARKDOWN_FEATURES,
      mdastPlugins: [createArticleDirectivePlugin()],
    });
    assert.doesNotMatch(html, /data-interactive-controls/);
    assert.doesNotMatch(html, /data-family-reset/);
    assert.match(html, /ke-family--static/);
    assert.match(html, /data-ke-family-static="true"/);
    assert.match(html, /role="group" aria-labelledby=/);
    assert.doesNotMatch(html, /role="region" tabindex="0"/);
    assert.match(html, />ずかい</);
  }

  const zero = parseFamilyInteractiveConfig("number-line", {
    mode: "zero",
    min: "0",
    value: "0",
    second: "0",
  });
  assert.ok(zero.config);
  assert.deepEqual(familyControlDefinitions(zero.config), []);
  assert.equal(familyResultTex(zero.config), "0");
  const zeroHtml = await markdownToHtml(
    '::interactive[Zero]{kind="number-line" mode="zero" min="0" value="0" second="0"}',
    { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] },
  );
  assert.match(zeroHtml.html, /<text x="52" y="58" text-anchor="start">0（はじまり）<\/text>/);

  const order = parseFamilyInteractiveConfig("number-line", {
    mode: "order",
    min: "0",
    max: "10",
    value: "3",
    second: "7",
  });
  assert.ok(order.config);
  assert.equal(familyResultTex(order.config), "3 < 7");

  const estimateAtMiddle = await markdownToHtml(
    '::interactive[Estimate]{kind="number-line" mode="estimate" min="0" max="100" value="47" second="50" step="1"}',
    { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] },
  );
  assert.match(estimateAtMiddle.html, /data-line-tick="middle" hidden/);
  assert.match(estimateAtMiddle.html, /data-line-label="second"[^>]*>50<\/text>/);

  for (const source of [
    '::interactive[Zero]{kind="number-line" mode="zero" min="0" value="1" second="0"}',
    '::interactive[Unit fraction]{kind="fraction-model" mode="unit" parts="4" selected="2"}',
    '::interactive[Decimal fraction]{kind="fraction-model" mode="decimal" parts="4" selected="1" second="1" secondParts="4"}',
  ]) {
    assert.ok((await validateArticleDirectives(source)).length > 0, source);
  }
});

test("keeps visual action buttons inert until client enhancement succeeds", async () => {
  for (const source of [
    '::interactive[Data]{kind="data-lab" mode="classify" value="3" second="2" max="10"}',
    '::interactive[Soroban]{kind="soroban-board" mode="calculate" value="123" second="5" max="99999"}',
  ]) {
    const { html } = await markdownToHtml(source, {
      features: ARTICLE_MARKDOWN_FEATURES,
      mdastPlugins: [createArticleDirectivePlugin()],
    });
    const actions = html.match(/<button[^>]*data-family-inline-action[^>]*>/gu) ?? [];
    assert.ok(actions.length > 0, source);
    for (const action of actions) {
      assert.match(action, / hidden(?:\s|>)/u);
      assert.match(action, / disabled(?:\s|>)/u);
    }
  }
});

test("localizes visual action labels without exposing inert controls", async () => {
  for (const [source, labels] of [
    [
      '::interactive[Data]{kind="data-lab" mode="classify" value="3" second="2" max="10"}',
      ["Decrease category A by 1", "Increase category A by 1"],
    ],
    [
      '::interactive[Soroban]{kind="soroban-board" mode="calculate" value="123" second="5" max="99999"}',
      ["Increase the ten-thousands digit by 1", "Decrease the ten-thousands digit by 1"],
    ],
  ]) {
    const { html } = await markdownToHtml(source, {
      features: ARTICLE_MARKDOWN_FEATURES,
      mdastPlugins: [createArticleDirectivePlugin()],
      data: { astro: { frontmatter: { locale: "en" } } },
    });
    for (const label of labels) {
      assert.match(html, new RegExp(`aria-label="${label}"[^>]* hidden disabled`, "u"));
    }
  }
});

test("adds ruby only to registered Kanji runs in generated family UI", async () => {
  assert.deepEqual(segmentFamilyUiText("大きい単位"), [
    { text: "大", reading: "おお" },
    { text: "きい" },
    { text: "単位", reading: "たんい" },
  ]);
  assert.equal(familyUiReading("基準と同じ位置"), "きじゅんとおなじいち");
  assert.deepEqual(segmentFamilyUiText("もう一度考えよう"), [
    { text: "もう" },
    { text: "一度考", reading: "いちどかんが" },
    { text: "えよう" },
  ]);
  assert.throws(() => segmentFamilyUiText("未知"), /unregistered Kanji run/u);

  for (const [kind, modes] of Object.entries(FAMILY_INTERACTIVE_MODES)) {
    for (const mode of modes) {
      const fixedAttributes =
        kind === "number-line" && mode === "zero"
          ? ' min="0" value="0" second="0"'
          : kind === "fraction-model" && mode === "decimal"
            ? ' parts="10" selected="1" second="1" secondParts="10"'
            : kind === "geometry-lab" && ["circle", "sphere", "elements", "position"].includes(mode)
              ? ' value="0"'
              : kind === "measurement-lab" && mode === "unit-relations"
                ? ' value="0"'
                : kind === "measurement-lab" && mode === "choose-tool"
                  ? ' value="0" second="1"'
                  : "";
      const { html } = await markdownToHtml(
        `::interactive[Explore]{kind="${kind}" mode="${mode}"${fixedAttributes}}`,
        {
          features: ARTICLE_MARKDOWN_FEATURES,
          mdastPlugins: [createArticleDirectivePlugin()],
          data: { astro: { frontmatter: { locale: "ja" } } },
        },
      );
      const textOutsideRuby = html
        .replace(/<ruby>[\s\S]*?<\/ruby>/gu, "")
        .replace(/<[^>]+>/gu, "");
      assert.doesNotMatch(textOutsideRuby, /[\p{Unified_Ideograph}々〇〆〻]/u, `${kind}:${mode}`);
      for (const match of html.matchAll(/<ruby>([^<]+)<rp>（<\/rp><rt>([^<]+)<\/rt><rp>）<\/rp><\/ruby>/gu)) {
        assert.match(match[1] ?? "", /^[\p{Unified_Ideograph}々〇〆〻]+$/u);
        assert.doesNotMatch(match[2] ?? "", /[\p{Unified_Ideograph}々〇〆〻]/u);
      }
    }
  }

  const standard = await markdownToHtml(
    '::interactive[Test]{kind="measurement-lab" mode="standard" value="2" second="6" max="20"}',
    {
      features: ARTICLE_MARKDOWN_FEATURES,
      mdastPlugins: [createArticleDirectivePlugin()],
      data: { astro: { frontmatter: { locale: "ja" } } },
    },
  );
  assert.match(standard.html, /Aの<ruby>単位<rp>（<\/rp><rt>たんい<\/rt>/u);
  assert.match(standard.html, /<ruby>単位<rp>（<\/rp><rt>たんい<\/rt>/u);
});

test("shows concrete subtraction and making-ten transformations", async () => {
  const options = {
    features: ARTICLE_MARKDOWN_FEATURES,
    mdastPlugins: [createArticleDirectivePlugin()],
  };
  const subtraction = await markdownToHtml(
    '::interactive[Test]{kind="counter-mat" mode="subtract" value="13" second="7" max="20"}',
    options,
  );
  const subtractionSource = subtraction.html.match(/data-counter-subtraction-source>([\s\S]*?)<\/div>/u)?.[1] ?? "";
  const subtractionRemaining = subtraction.html.match(/data-counter-subtraction-remaining>([\s\S]*?)<\/div>/u)?.[1] ?? "";
  assert.equal((subtractionSource.match(/data-counter-index=/gu) ?? []).length, 13);
  assert.equal((subtractionSource.match(/ke-family__counter--removed/gu) ?? []).length, 7);
  assert.equal((subtractionRemaining.match(/data-counter-index=/gu) ?? []).length, 6);
  assert.match(subtraction.html, /data-counter-ten-decomposition>/);
  const tenPieces = subtraction.html.match(/data-counter-ten-pieces>([\s\S]*?)<\/div>/u)?.[1] ?? "";
  assert.equal((tenPieces.match(/data-counter-index=/gu) ?? []).length, 10);

  const addition = await markdownToHtml(
    '::interactive[Test]{kind="counter-mat" mode="add" value="8" second="5" max="20"}',
    options,
  );
  assert.match(addition.html, /data-counter-make-ten>/);
  const tenGroup = addition.html.match(/data-counter-make-ten-group>([\s\S]*?)<\/div>/u)?.[1] ?? "";
  const rest = addition.html.match(/data-counter-make-ten-rest>([\s\S]*?)<\/div>/u)?.[1] ?? "";
  assert.equal((tenGroup.match(/data-counter-index=/gu) ?? []).length, 10);
  assert.equal((rest.match(/data-counter-index=/gu) ?? []).length, 3);
});

test("keeps specialized geometry controls and constructions faithful", async () => {
  const options = {
    features: ARTICLE_MARKDOWN_FEATURES,
    mdastPlugins: [createArticleDirectivePlugin()],
  };
  const isosceles = await markdownToHtml(
    '::interactive[Test]{kind="geometry-lab" mode="isosceles" value="0"}',
    options,
  );
  assert.match(isosceles.html, /data-isosceles-shape/);
  assert.match(isosceles.html, /data-equilateral-shape/);
  assert.match(isosceles.html, /ちょうてんのたかさ/);

  const circle = await markdownToHtml(
    '::interactive[Test]{kind="geometry-lab" mode="circle" value="0"}',
    options,
  );
  assert.match(circle.html, /data-geometry-radius[^>]*r="0"/);
  assert.match(circle.html, /data-geometry-diameter-line x1="280"[^>]*x2="280"/);

  const sphere = await markdownToHtml(
    '::interactive[Test]{kind="geometry-lab" mode="sphere" value="0"}',
    options,
  );
  assert.match(sphere.html, /data-sphere-cut[^>]*rx="96"[^>]*ry="25\.92"/);
  assert.match(sphere.html, /aria-valuetext="0 cm"/);

  const elements = await markdownToHtml(
    '::interactive[Test]{kind="geometry-lab" mode="elements" value="0"}',
    options,
  );
  assert.match(elements.html, /data-geometry-element="edge"/);
  assert.match(elements.html, /data-geometry-element="vertex"/);
  assert.doesNotMatch(elements.html, /data-geometry-element="face"/);

  const position = await markdownToHtml(
    '::interactive[Test]{kind="geometry-lab" mode="position" value="0"}',
    options,
  );
  assert.match(position.html, /ke-family__position-reference/);
  assert.match(position.html, /きじゅん O/);
  assert.match(position.html, />うえ<\/text>.*>みぎ<\/text>.*>した<\/text>.*>ひだり<\/text>/su);
});

test("forms equal-size groups and separates the remainder", async () => {
  const { html } = await markdownToHtml(
    '::interactive[Test]{kind="counter-mat" mode="remainder" value="14" groups="4"}',
    {
      features: ARTICLE_MARKDOWN_FEATURES,
      mdastPlugins: [createArticleDirectivePlugin()],
    },
  );
  const groupMarkup = [...html.matchAll(/data-counter-group="\d+">([\s\S]*?)<\/div>/gu)];
  assert.equal(groupMarkup.length, 3);
  assert.deepEqual(
    groupMarkup.map((match) => (match[1]?.match(/data-counter-index=/gu) ?? []).length),
    [4, 4, 4],
  );
  const remainder = html.match(/data-counter-remainder-tokens>([\s\S]*?)<\/div>/u);
  assert.equal((remainder?.[1]?.match(/data-counter-index=/gu) ?? []).length, 2);
  assert.match(html, /14 = 4/);
});

test("shares equally across the requested number of groups", async () => {
  const { html } = await markdownToHtml(
    '::interactive[Test]{kind="counter-mat" mode="share" value="14" groups="4"}',
    {
      features: ARTICLE_MARKDOWN_FEATURES,
      mdastPlugins: [createArticleDirectivePlugin()],
    },
  );
  const groupMarkup = [...html.matchAll(/data-counter-group="\d+">([\s\S]*?)<\/div>/gu)];
  assert.equal(groupMarkup.length, 4);
  assert.deepEqual(
    groupMarkup.map((match) => (match[1]?.match(/data-counter-index=/gu) ?? []).length),
    [3, 3, 3, 3],
  );
  const remainder = html.match(/data-counter-remainder-tokens>([\s\S]*?)<\/div>/u);
  assert.equal((remainder?.[1]?.match(/data-counter-index=/gu) ?? []).length, 2);
});

test("draws the right-angle marker on perpendicular triangle sides", async () => {
  const { html } = await markdownToHtml(
    '::interactive[Test]{kind="geometry-lab" mode="right-angle"}',
    {
      features: ARTICLE_MARKDOWN_FEATURES,
      mdastPlugins: [createArticleDirectivePlugin()],
    },
  );
  assert.match(html, /M120 210 L120 110 L455 210 Z/);
  assert.match(html, /data-right-angle-corner[^>]*M120 184 H146 V210/);
  assert.match(html, />90°<\/text>/);
});

test("keeps conservation fills equal in represented area", () => {
  for (const value of [0, 2.5, 5, 10]) {
    const model = conservationFillModel(value, 10);
    assert.equal(model.left.area, model.right.area);
  }
});

test("models same-denominator fraction addition and subtraction", async () => {
  assert.deepEqual(fractionOperationModel(8, 3, 8, 2, "add"), {
    denominator: 8,
    numerator: 5,
    wholeBars: 0,
    finalBarParts: 5,
  });
  assert.equal(fractionOperationModel(8, 3, 8, 2, "subtract")?.numerator, 1);
  const parsed = parseFamilyInteractiveConfig("fraction-model", {
    mode: "add-subtract",
    parts: "8",
    selected: "3",
    secondParts: "8",
    second: "2",
  });
  assert.ok(parsed.config);
  assert.equal(familyResultTex(parsed.config), "\\frac{3}{8} + \\frac{2}{8} = \\frac{5}{8}");
  const { html } = await markdownToHtml(
    '::interactive[Test]{kind="fraction-model" mode="add-subtract" parts="8" selected="3" second="2" secondParts="8"}',
    { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] },
  );
  assert.match(html, /data-fraction-operation/);
  assert.match(html, /data-fraction-bar="result-0"/);
});

test("models equation properties as equal expressions", async () => {
  assert.deepEqual(equationBalanceModel("properties", "multiply", 4, 6), {
    leftLabel: "4 × 6",
    rightLabel: "6 × 4",
    leftValue: 24,
    rightValue: 24,
  });
  const { html } = await markdownToHtml(
    '::interactive[Test]{kind="equation-balance" mode="properties" operation="multiply" value="4" second="6"}',
    { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] },
  );
  assert.match(html, />4 × 6<\/text>/u);
  assert.match(html, /aria-label="4 × 6 = 6 × 4"/u);
});

test("renders a seconds hand and a live unit-relation selector", async () => {
  const seconds = parseFamilyInteractiveConfig("measurement-lab", {
    mode: "seconds",
    value: "45",
    second: "60",
    max: "60",
  });
  assert.ok(seconds.config);
  assert.deepEqual(familyControlDefinitions(seconds.config).map(({ key }) => key), ["value"]);
  const secondsHtml = await markdownToHtml(
    '::interactive[Test]{kind="measurement-lab" mode="seconds" value="45" second="60" max="60"}',
    { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] },
  );
  assert.match(secondsHtml.html, /data-clock-hand="second"/);
  assert.doesNotMatch(secondsHtml.html, /data-clock-hand="hour"/);

  const relation = parseFamilyInteractiveConfig("measurement-lab", {
    mode: "unit-relations",
    value: "1",
    second: "1000",
    max: "1000",
    step: "100",
  });
  assert.ok(relation.config);
  assert.equal(unitRelationIndex(relation.config.value), 1);
  assert.deepEqual(familyControlDefinitions(relation.config).map(({ minimum, maximum, step }) => ({ minimum, maximum, step })), [
    { minimum: 0, maximum: 3, step: 1 },
  ]);
  const relationHtml = await markdownToHtml(
    '::interactive[Test]{kind="measurement-lab" mode="unit-relations" value="1" second="1000" max="1000" step="100"}',
    { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] },
  );
  assert.match(relationHtml.html, /class="is-active" data-unit-relation="1"/);
  assert.match(relationHtml.html, /class="ke-math ke-math--inline"/);
});

test("renders concrete measurement instruments with mode-specific semantics", async () => {
  const options = {
    features: ARTICLE_MARKDOWN_FEATURES,
    mdastPlugins: [createArticleDirectivePlugin()],
    data: { astro: { frontmatter: { locale: "ja" } } },
  };
  const duration = await markdownToHtml(
    '::interactive[Test]{kind="measurement-lab" mode="duration" value="3" second="30" max="60"}',
    options,
  );
  assert.equal((duration.html.match(/data-duration-hour="/gu) ?? []).length, 24);
  assert.match(duration.html, /data-duration-hour="0">1<\/span>/);
  assert.match(duration.html, /data-duration-hour="23">24<\/span>/);
  assert.match(duration.html, /data-duration-minute-fill/);
  assert.match(duration.html, /aria-label="1 day = 24 hours"/);
  assert.match(duration.html, /aria-label="1 hour = 60 minutes"/);
  assert.doesNotMatch(duration.html, /data-clock-hand/);

  const clock = await markdownToHtml(
    '::interactive[Test]{kind="measurement-lab" mode="clock" value="19" second="5" max="60"}',
    options,
  );
  assert.match(clock.html, /data-clock-time[^>]*>19:05<\/text>/);
  const fiveMinuteClock = await markdownToHtml(
    '::interactive[Test]{kind="measurement-lab" mode="clock" value="19" second="5" max="60" step="5"}',
    options,
  );
  assert.match(fiveMinuteClock.html, /max="55"[^>]*data-family-input="second"/);
  const elapsed = await markdownToHtml(
    '::interactive[Test]{kind="measurement-lab" mode="elapsed" value="8" second="20" max="24"}',
    options,
  );
  assert.match(elapsed.html, /data-elapsed-time="value"[^>]*>8:00<\/text>/);
  assert.match(elapsed.html, /data-elapsed-time="second"[^>]*>20:00<\/text>/);

  const zeroComparison = await markdownToHtml(
    '::interactive[Test]{kind="measurement-lab" mode="compare" value="0" second="5" selected="0" max="10"}',
    options,
  );
  assert.match(zeroComparison.html, /data-measure-compare-bar="value"[^>]*width="0"/);
  assert.match(zeroComparison.html, /data-measure-compare-scene="direct"[^>]*aria-hidden="true">/);
  assert.match(zeroComparison.html, /data-measure-compare-scene="tape"[^>]* hidden>/);

  const capacity = await markdownToHtml(
    '::interactive[Test]{kind="measurement-lab" mode="capacity" value="900" second="700" max="1000" unit="mL"}',
    options,
  );
  assert.match(capacity.html, /data-capacity-fill="remaining"[^>]*y="190"[^>]*height="30"/);
  assert.match(capacity.html, /data-capacity-fill="contained"[^>]*y="130"[^>]*height="90"/);
  assert.match(capacity.html, /data-capacity-transfer-label[^>]*>Bへ 700 mL</);
  assert.match(capacity.html, /data-capacity-label="overflow"[^>]*>こぼれ 100 mL</);
  assert.doesNotMatch(capacity.html, /data-capacity-unit-relations/);
  assert.doesNotMatch(capacity.html, /100 mL = 1 dL/);

  const metricCapacity = await markdownToHtml(
    '::interactive[Test]{kind="measurement-lab" mode="metric-capacity" value="250" second="500" max="1000" unit="mL"}',
    options,
  );
  assert.match(metricCapacity.html, /data-capacity-unit-relations/);
  assert.match(metricCapacity.html, /aria-label="100 mL = 1 dL"/);
  assert.match(metricCapacity.html, /class="ke-math ke-math--inline"/);

  const standard = parseFamilyInteractiveConfig("measurement-lab", {
    mode: "standard",
    value: "2",
    second: "6",
    max: "20",
  });
  assert.ok(standard.config);
  assert.deepEqual(
    familyControlDefinitions(standard.config).map(({ minimum }) => minimum),
    [1, 1],
  );
  const standardHtml = await markdownToHtml(
    '::interactive[Test]{kind="measurement-lab" mode="standard" value="2" second="6" max="20"}',
    options,
  );
  assert.equal((standardHtml.html.match(/class="ke-family__standard-target"/gu) ?? []).length, 2);
  assert.match(standardHtml.html, /data-standard-row="value"/);
  assert.match(standardHtml.html, /data-standard-row="second"/);
  assert.ok((await validateArticleDirectives(
    '::interactive[Test]{kind="measurement-lab" mode="standard" value="0" second="6" max="20"}',
  )).length > 0);

  const toolModel = measurementToolChoiceModel(0, 1);
  assert.equal(toolModel.objectLabelJa, "えんぴつ");
  assert.equal(toolModel.selectedToolJa, "ものさし");
  assert.equal(toolModel.selectedUnit, "cm");
  assert.equal(toolModel.isCorrect, true);
  const tool = parseFamilyInteractiveConfig("measurement-lab", {
    mode: "choose-tool",
    value: "0",
    second: "1",
  });
  assert.ok(tool.config);
  assert.deepEqual(
    familyControlDefinitions(tool.config).map(({ maximum }) => maximum),
    [2, 8],
  );
});

test("keeps capacity transfer conserved and compare methods explicit", async () => {
  const capacity = parseFamilyInteractiveConfig("measurement-lab", {
    mode: "capacity",
    value: "900",
    second: "700",
    max: "1000",
    step: "100",
    unit: "mL",
  });
  assert.ok(capacity.config);
  assert.deepEqual(capacityTransferModel(900, 700, 1000), {
    total: 900,
    transferred: 700,
    remaining: 200,
    vesselCapacity: 600,
    contained: 600,
    overflow: 100,
  });
  const capacityControls = familyControlDefinitions(capacity.config);
  assert.deepEqual(capacityControls.map(({ key, labelJa }) => [key, labelJa]), [
    ["value", "ぜんぶのりょう"],
    ["second", "Bへうつすりょう"],
  ]);
  const capacityState = {
    value: 900,
    second: 700,
    selected: capacity.config.selected,
    groups: capacity.config.groups,
    operation: capacity.config.operation,
  };
  assert.deepEqual(familyLiveControlBounds(capacity.config, capacityState, capacityControls[0]), {
    minimum: 700,
    maximum: 1000,
  });
  assert.deepEqual(familyLiveControlBounds(capacity.config, capacityState, capacityControls[1]), {
    minimum: 0,
    maximum: 900,
  });
  assert.match(familyResultText(capacity.config), /200 \+ 600 \+ 100 = 900 mL/u);
  assert.equal(
    familyResultTex(capacity.config),
    "600+100=700,\\quad 200+600+100=900\\,\\mathrm{mL}",
  );
  assert.ok(parseFamilyInteractiveConfig("measurement-lab", {
    mode: "capacity",
    value: "400",
    second: "500",
    max: "1000",
  }).issues.length > 0);
  assert.ok(parseFamilyInteractiveConfig("measurement-lab", {
    mode: "metric-capacity",
    value: "400",
    second: "500",
    max: "1000",
  }).config);

  const compare = parseFamilyInteractiveConfig("measurement-lab", {
    mode: "compare",
    value: "3",
    second: "5",
    selected: "1",
    max: "10",
    unit: "cm",
  });
  assert.ok(compare.config);
  const compareControls = familyControlDefinitions(compare.config);
  assert.deepEqual(compareControls.map(({ key }) => key), ["value", "second", "selected"]);
  assert.equal(familyControlDefinitionValueText(compareControls[2], 0, "ja"), "ちょくせつならべる");
  assert.equal(familyControlDefinitionValueText(compareControls[2], 1, "ja"), "テープにうつす");
  assert.match(familyResultText(compare.config), /^テープにうつす：A 3 cm < B 5 cm$/u);
  assert.equal(
    familyResultTex(compare.config),
    "A=3\\,\\mathrm{cm} < B=5\\,\\mathrm{cm}",
  );
  assert.ok(parseFamilyInteractiveConfig("measurement-lab", {
    mode: "compare",
    selected: "2",
  }).issues.length > 0);

  const tapeHtml = await markdownToHtml(
    '::interactive[Test]{kind="measurement-lab" mode="compare" value="3" second="5" selected="1" max="10" unit="cm"}',
    { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] },
  );
  assert.match(tapeHtml.html, /data-family-input="selected"/);
  assert.match(tapeHtml.html, /data-measure-compare-scene="direct"[^>]* hidden>/);
  assert.match(tapeHtml.html, /data-measure-compare-scene="tape"[^>]*aria-hidden="true">/);
  assert.match(tapeHtml.html, /data-measure-compare-copy="value"[^>]*width="108"/);
  assert.doesNotMatch(tapeHtml.html, /data-measure-bar=/);
});

test("uses category counts and accumulates dice frequencies", async () => {
  assert.deepEqual(dataCategoryValues(6, 4, 3, [5]), [6, 4, 5]);
  const initial = initialDiceFrequencies(6, 4);
  assert.deepEqual(initial, [0, 0, 0, 1, 0, 1]);
  assert.deepEqual(recordDiceFaces(initial, [4, 2]), [0, 1, 0, 2, 0, 1]);
  const { html } = await markdownToHtml(
    '::interactive[Test]{kind="data-lab" mode="dice-frequency" value="6" second="4" categories="6"}',
    { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] },
  );
  assert.match(html, /data-dice-frequency-table/);
  assert.match(html, /data-dice-frequency="4">1/);
  assert.match(html, /data-dice-frequency="6">1/);
});

test("keeps data categories independent and two-way totals auditable", async () => {
  assert.ok((await validateArticleDirectives(
    '::interactive[Test]{kind="data-lab" mode="bar" value="6" second="4" categories="3"}',
  )).length > 0);
  assert.deepEqual(await validateArticleDirectives(
    '::interactive[Test]{kind="data-lab" mode="bar" value="6" second="4" third="5" categories="3"}',
  ), []);

  const options = {
    features: ARTICLE_MARKDOWN_FEATURES,
    mdastPlugins: [createArticleDirectivePlugin()],
  };
  const bar = await markdownToHtml(
    '::interactive[Test]{kind="data-lab" mode="bar" value="6" second="4" third="5" categories="3" max="10"}',
    options,
  );
  assert.match(bar.html, /data-data-category="2"[^>]*height="90"/);
  assert.equal((bar.html.match(/data-data-category-adjust="/gu) ?? []).length, 6);

  const zero = await markdownToHtml(
    '::interactive[Test]{kind="data-lab" mode="bar" value="0" second="4" categories="2" max="10"}',
    options,
  );
  assert.match(zero.html, /data-data-category="0"[^>]*height="0"/);

  const table = await markdownToHtml(
    '::interactive[Test]{kind="data-lab" mode="table" value="6" second="4" third="5" categories="3" max="10"}',
    options,
  );
  assert.match(table.html, /data-data-source-cards/);
  assert.match(table.html, /data-table-category="2">5/);
  assert.match(table.html, /data-table-total>15/);

  assert.deepEqual(twoWayTableModel(6, 4), {
    cells: [4, 2, 1, 3],
    rowTotals: [6, 4],
    columnTotals: [5, 5],
    grandTotal: 10,
  });
  const twoWay = await markdownToHtml(
    '::interactive[Test]{kind="data-lab" mode="two-way" value="6" second="4"}',
    options,
  );
  assert.match(twoWay.html, /data-two-way-source-cards/);
  assert.match(twoWay.html, /data-two-way-cell="0">4/);
  assert.match(twoWay.html, /data-two-way-row-total="0">6/);
  assert.match(twoWay.html, /data-two-way-column-total="0">5/);
  assert.match(twoWay.html, /data-two-way-grand-total>10/);

  const criteriaByShape = classificationCriteriaModel(2, 2, 0);
  const criteriaByTone = classificationCriteriaModel(2, 2, 1);
  assert.equal(criteriaByShape.criterion, "shape");
  assert.equal(criteriaByTone.criterion, "tone");
  assert.deepEqual(
    [...criteriaByShape.bins[0], ...criteriaByShape.bins[1]].map(({ id }) => id).sort((a, b) => a - b),
    [1, 2, 3, 4],
  );
  const evidence = await markdownToHtml(
    '::interactive[Test]{kind="data-lab" mode="evidence" value="6" second="4" third="5" categories="3" selected="1" max="10"}',
    options,
  );
  assert.match(evidence.html, /data-evidence-view="chart" hidden/);
  assert.match(evidence.html, /data-evidence-view="table">/);
  assert.match(evidence.html, /data-table-category="2">5/);
});

test("keeps unit relations and specialized bounds finite", async () => {
  assert.deepEqual(UNIT_RELATIONS[0], {
    text: "1 m = 1000 mm",
    tex: "1\\,\\mathrm{m}=1000\\,\\mathrm{mm}",
  });
  for (const source of [
    '::interactive[Test]{kind="measurement-lab" mode="unit-relations" value="4"}',
    '::interactive[Test]{kind="measurement-lab" mode="kilometres" value="11" second="1000" max="1000"}',
    '::interactive[Test]{kind="measurement-lab" mode="duration" value="25" second="0" max="60"}',
    '::interactive[Test]{kind="measurement-lab" mode="duration" value="1" second="60" max="60"}',
    '::interactive[Test]{kind="measurement-lab" mode="choose-tool" value="3" second="1"}',
    '::interactive[Test]{kind="measurement-lab" mode="choose-tool" value="0" second="9"}',
    '::interactive[Test]{kind="counter-mat" mode="add" value="25" second="20" max="40"}',
    '::interactive[Test]{kind="geometry-lab" mode="elements" value="2"}',
    '::interactive[Test]{kind="data-lab" mode="classify" value="3" second="2" max="21"}',
  ]) {
    assert.ok((await validateArticleDirectives(source)).length > 0, source);
  }
});

test("adjusts soroban digits without hidden clamp-sized changes", async () => {
  assert.equal(adjustSorobanDigitValue(1_234, 0, -1, 99_999), 1_234);
  assert.equal(adjustSorobanDigitValue(99_995, 3, 1, 99_999), 99_995);
  assert.equal(adjustSorobanDigitValue(1_234, 3, 1, 99_999), 1_244);
  assert.equal(adjustSorobanDigitValue(1_234, 4, -1, 99_999), 1_233);
  assert.equal(adjustSorobanDigitValue(1_234, 3, 1, 1_235), 1_234);

  const { html } = await markdownToHtml(
    '::interactive[Test]{kind="soroban-board" mode="number" value="1234" max="99999"}',
    { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] },
  );
  assert.equal((html.match(/data-soroban-adjust/g) ?? []).length, 10);
  assert.match(html, /data-soroban-column-index="0" data-soroban-delta="-1"[^>]* disabled/);
});

test("keeps natural-number subtraction and division controls in valid ranges", async () => {
  for (const source of [
    '::interactive[Test]{kind="counter-mat" mode="subtract" value="3" second="5"}',
    '::interactive[Test]{kind="place-value-board" mode="regroup-subtract" value="3" second="5"}',
    '::interactive[Test]{kind="place-value-board" mode="divide" value="84" second="0"}',
  ]) {
    assert.ok((await validateArticleDirectives(source)).length > 0, source);
  }
  const subtraction = parseFamilyInteractiveConfig("counter-mat", {
    mode: "subtract",
    value: "8",
    second: "3",
  });
  assert.ok(subtraction.config);
  const definitions = familyControlDefinitions(subtraction.config);
  const state = { value: 8, second: 3, selected: 1, groups: 2, operation: "add" };
  assert.deepEqual(familyLiveControlBounds(subtraction.config, state, definitions[0]), {
    minimum: 3,
    maximum: 20,
  });
  assert.deepEqual(familyLiveControlBounds(subtraction.config, state, definitions[1]), {
    minimum: 0,
    maximum: 8,
  });

  const division = parseFamilyInteractiveConfig("place-value-board", {
    mode: "divide",
    value: "84",
    second: "4",
    max: "999",
  });
  assert.ok(division.config);
  assert.equal(familyControlDefinitions(division.config)[1]?.minimum, 1);
  assert.equal(
    familyResultTex(division.config, 85, 4),
    "85 = 4 \\times 21 + 1",
  );
  const divisionHtml = await markdownToHtml(
    '::interactive[Test]{kind="place-value-board" mode="divide" value="85" second="4" max="999"}',
    { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] },
  );
  assert.match(divisionHtml.html, /data-place-board="quotient"/);
  const remainderMarkup = divisionHtml.html.match(/data-place-remainder-tokens>([\s\S]*?)<\/div>/u);
  assert.equal((remainderMarkup?.[1]?.match(/data-counter-index=/gu) ?? []).length, 1);
  assert.match(divisionHtml.html, /aria-label="85 ÷ 4 = 21 あまり 1"/u);

  const largeRemainder = await markdownToHtml(
    '::interactive[Test]{kind="place-value-board" mode="divide" value="99999" second="50000" max="99999"}',
    { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] },
  );
  const largeRemainderMarkup = largeRemainder.html.match(/data-place-remainder-tokens>([\s\S]*?)<\/div>/u)?.[1] ?? "";
  assert.equal((largeRemainderMarkup.match(/data-counter-index=/gu) ?? []).length, 40);
  assert.match(largeRemainderMarkup, /data-place-remainder-overflow>…（ぜんぶで 49999こ）/u);

  const unknown = parseFamilyInteractiveConfig("equation-balance", {
    mode: "unknown",
    value: "5",
    second: "12",
    max: "30",
  });
  assert.ok(unknown.config);
  const unknownDefinitions = familyControlDefinitions(unknown.config);
  const unknownState = { value: 5, second: 12, selected: 1, groups: 2, operation: "add" };
  assert.equal(familyLiveControlBounds(unknown.config, unknownState, unknownDefinitions[0]).maximum, 12);
  assert.equal(familyLiveControlBounds(unknown.config, unknownState, unknownDefinitions[1]).minimum, 5);
});

test("models place-value regrouping, partial products, quotient, and remainder", () => {
  const addition = placeOperationModel("regroup-add", 276, 458);
  assert.equal(addition.result, 734);
  assert.deepEqual(addition.regroupEvents, [
    { kind: "exchange-up", fromIndex: 4, toIndex: 3 },
    { kind: "exchange-up", fromIndex: 3, toIndex: 2 },
  ]);

  const subtraction = placeOperationModel("regroup-subtract", 603, 278);
  assert.equal(subtraction.result, 325);
  assert.deepEqual(subtraction.regroupEvents, [
    { kind: "borrow-down", fromIndex: 2, toIndex: 3 },
    { kind: "borrow-down", fromIndex: 3, toIndex: 4 },
  ]);
  assert.deepEqual(placeOperationModel("regroup-subtract", 1000, 1).regroupEvents, [
    { kind: "borrow-down", fromIndex: 1, toIndex: 2 },
    { kind: "borrow-down", fromIndex: 2, toIndex: 3 },
    { kind: "borrow-down", fromIndex: 3, toIndex: 4 },
  ]);

  const multiplication = placeOperationModel("multiply", 23, 4);
  assert.equal(multiplication.result, 92);
  assert.deepEqual(multiplication.partialProducts, [
    { placeIndex: 4, groupValue: 3, multiplier: 4, product: 12 },
    { placeIndex: 3, groupValue: 20, multiplier: 4, product: 80 },
  ]);

  const division = placeOperationModel("divide", 85, 4);
  assert.equal(division.quotient, 21);
  assert.equal(division.remainder, 1);
});

test("renders place-value operation boards and concrete transformations", async () => {
  const options = { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] };
  const addition = await markdownToHtml(
    '::interactive[Test]{kind="place-value-board" mode="regroup-add" value="47" second="38" max="999"}',
    options,
  );
  assert.match(addition.html, /data-place-board="result"/);
  assert.match(addition.html, /data-place-regroup-panel/);
  assert.match(renderedBaseText(addition.html), /10こを、ひとつ上の位の1こにまとめる/u);
  assert.equal((addition.html.match(/data-place-regroup-item>/gu) ?? []).length, 1);
  assert.match(addition.html, /data-place-column="value-4"/);
  assert.match(addition.html, /is-regroup-source/);
  assert.match(addition.html, /is-regroup-target/);

  const subtraction = await markdownToHtml(
    '::interactive[Test]{kind="place-value-board" mode="regroup-subtract" value="603" second="278" max="999"}',
    options,
  );
  assert.match(subtraction.html, /data-place-board="result"/);
  assert.match(renderedBaseText(subtraction.html), /ひとつ上の位の1こを、10こに分ける/u);
  assert.equal((subtraction.html.match(/data-place-regroup-item>/gu) ?? []).length, 2);

  const multiplication = await markdownToHtml(
    '::interactive[Test]{kind="place-value-board" mode="multiply" value="23" second="4" max="9999"}',
    options,
  );
  assert.match(multiplication.html, /data-place-board="result"/);
  assert.equal((multiplication.html.match(/data-place-partial="/gu) ?? []).length, 2);
  assert.match(multiplication.html, /20 が 4こ → 80/u);

  const division = await markdownToHtml(
    '::interactive[Test]{kind="place-value-board" mode="divide" value="85" second="4" max="999"}',
    options,
  );
  assert.match(division.html, /data-place-board="quotient"/);
  assert.match(renderedBaseText(division.html), /4つの組に、21こずつ/u);
  assert.equal((division.html.match(/class="ke-family__place-division-group"/gu) ?? []).length, 4);
  assert.match(division.html, /data-place-remainder-label>あまり 1こ/u);
});

test("keeps five-digit place-value result boards consistent with formulas", async () => {
  for (const source of [
    '::interactive[Test]{kind="place-value-board" mode="regroup-add" value="99999" second="1" max="99999"}',
    '::interactive[Test]{kind="place-value-board" mode="multiply" value="99999" second="2" max="99999"}',
  ]) {
    assert.ok((await validateArticleDirectives(source)).length > 0, source);
  }

  const addition = parseFamilyInteractiveConfig("place-value-board", {
    mode: "regroup-add",
    value: "50000",
    second: "40000",
    max: "99999",
  });
  assert.ok(addition.config);
  const additionDefinitions = familyControlDefinitions(addition.config);
  const additionState = { value: 50_000, second: 40_000, selected: 1, groups: 2, operation: "add" };
  assert.equal(familyLiveControlBounds(addition.config, additionState, additionDefinitions[0]).maximum, 59_999);
  assert.equal(familyLiveControlBounds(addition.config, additionState, additionDefinitions[1]).maximum, 49_999);

  const multiplication = parseFamilyInteractiveConfig("place-value-board", {
    mode: "multiply",
    value: "300",
    second: "300",
    max: "99999",
  });
  assert.ok(multiplication.config);
  const multiplicationDefinitions = familyControlDefinitions(multiplication.config);
  for (const other of [0, 1, 2, 3, 9, 10, 99, 999, 9_999, 99_999]) {
    const state = { value: other, second: other, selected: 1, groups: 2, operation: "multiply" };
    const expected = other === 0 ? 99_999 : Math.floor(99_999 / other);
    const valueMaximum = familyLiveControlBounds(
      multiplication.config,
      { ...state, value: Math.min(other, expected) },
      multiplicationDefinitions[0],
    ).maximum;
    const secondMaximum = familyLiveControlBounds(
      multiplication.config,
      { ...state, second: Math.min(other, expected) },
      multiplicationDefinitions[1],
    ).maximum;
    assert.equal(valueMaximum, expected);
    assert.equal(secondMaximum, expected);
    assert.ok(valueMaximum * other <= 99_999 || other === 0);
    assert.ok(secondMaximum * other <= 99_999 || other === 0);
  }

  const { html } = await markdownToHtml(
    '::interactive[Test]{kind="place-value-board" mode="multiply" value="33333" second="3" max="99999"}',
    { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] },
  );
  const resultDigits = [...html.matchAll(/data-place-column="result-\d+"[\s\S]*?<strong data-place-digit>(\d)<\/strong>/gu)]
    .map((match) => match[1])
    .join("");
  assert.equal(resultDigits, "99999");
  assert.match(html, /aria-label="33333 × 3 = 99999"/u);
});

test("normalizes number inputs to the declared step", async () => {
  assert.equal(normalizeStepValue(12.7, 0, 99, 1), 13);
  assert.equal(normalizeStepValue(1.26, 0, 10, 0.1), 1.3);
  for (const source of [
    '::interactive[Test]{kind="place-value-board" mode="place-value" value="12.5"}',
    '::interactive[Test]{kind="soroban-board" mode="number" value="12.5"}',
    '::interactive[Test]{kind="place-value-board" mode="decimal" value="1.25"}',
  ]) {
    assert.ok((await validateArticleDirectives(source)).length > 0, source);
  }
});

test("draws composition as a quadrilateral and marks the point between endpoints", async () => {
  const compose = await markdownToHtml(
    '::interactive[Test]{kind="geometry-lab" mode="compose"}',
    { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] },
  );
  assert.match(compose.html, /data-compose-piece="left" transform="translate\(-90 0\)"/);
  assert.match(compose.html, /data-compose-piece="right" data-geometry-drag="value" transform="translate\(90 0\)"/);
  assert.match(compose.html, /data-geometry-progress[^>]*width="0"/);
  const segment = await markdownToHtml(
    '::interactive[Test]{kind="geometry-lab" mode="segment"}',
    { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] },
  );
  assert.match(segment.html, /data-between-point/);
  assert.match(segment.html, />A<\/text>.*>B<\/text>.*>C<\/text>/su);
  assert.match(segment.html, /BはAとCのあいだ/);
});

test("uses mode-specific geometry changes instead of rotating the whole scene", async () => {
  const options = { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] };
  const renderGeometry = async (mode, value) => (await markdownToHtml(
    `::interactive[Test]{kind="geometry-lab" mode="${mode}" value="${value}"}`,
    options,
  )).html;
  const cases = [
    ["point-line", 0, 10, /data-point-b cx="280"/, /data-point-b cx="440"/],
    ["segment", 0, 10, /data-between-point cx="280"/, /data-between-point cx="400"/],
    ["compose", 0, 100, /translate\(-90 0\)/, /translate\(0 0\)/],
    ["triangle", 0, 60, /L214 48/, /L346 48/],
    ["quadrilateral", 0, 60, /data-quadrilateral-vertex="1" cx="151"/, /data-quadrilateral-vertex="1" cx="229"/],
    ["rectangle", 0, 100, /width="180" height="140"/, /width="360" height="140"/],
    ["square", 0, 100, /width="100" height="100"/, /width="200" height="200"/],
    ["right-angle", 0, 60, /L120 110/, /L120 50/],
    ["congruence", 0, 100, /translate\(240 0\) rotate\(24/, /translate\(0 0\) rotate\(0/],
    ["isosceles", 0, 60, /scale\(1 1\)/, /scale\(1 1\.5\)/],
    ["sphere", 0, 10, /data-sphere-cut[^>]*rx="96"[\s\S]*data-sphere-handle[^>]*cx="376"/, /data-sphere-cut[^>]*rx="0"[\s\S]*data-sphere-handle[^>]*cx="280"/],
    ["solid", 0, 60, /data-solid-shape/, /data-solid-shape/],
    ["tiling", 0, 100, /width="70\.4" height="74"/, /width="80" height="80"/],
    ["euclidean", 0, 5, /data-euclidean-parallel[^>]*y1="130"/, /data-euclidean-parallel[^>]*y1="30"/],
  ];
  for (const [mode, firstValue, secondValue, firstPattern, secondPattern] of cases) {
    const first = await renderGeometry(mode, firstValue);
    const second = await renderGeometry(mode, secondValue);
    assert.match(first, firstPattern, `${mode}: first state`);
    assert.match(second, secondPattern, `${mode}: second state`);
    assert.notEqual(first, second, `${mode}: states must differ`);
    assert.doesNotMatch(first, /data-geometry-moving|data-geometry-rotates/, `${mode}: generic rotator`);
    assert.doesNotMatch(second, /data-geometry-moving|data-geometry-rotates/, `${mode}: generic rotator`);
  }

  const recognize = await renderGeometry("recognize", 90);
  assert.match(recognize, /rotate\(90 115 125\)/);
  assert.match(recognize, /rotate\(-90 280 125\)/);
  assert.match(recognize, />まる<\/text>.*>さんかく<\/text>.*>しかく<\/text>/su);

  const semanticControls = await Promise.all([
    renderGeometry("point-line", 0),
    renderGeometry("segment", 5),
    renderGeometry("compose", 50),
    renderGeometry("euclidean", 2),
  ]);
  assert.match(semanticControls[0], /aria-valuetext="10 めもり"/);
  assert.match(semanticControls[1], /aria-valuetext="Cへちかづく 5だんかいめ"/);
  assert.match(semanticControls[2], /aria-valuetext="50%"/);
  assert.match(semanticControls[3], /aria-valuetext="5 めもり"/);
});

test("renders kilometre conversion as mixed units", async () => {
  assert.deepEqual(kilometreComparisonModel(1, 1000), {
    kilometresInMetres: 1000,
    metres: 1000,
    relation: "=",
    kilometreWidth: 400,
    metreWidth: 400,
  });
  const parsed = parseFamilyInteractiveConfig("measurement-lab", {
    mode: "kilometres",
    value: "1",
    second: "1000",
    max: "1000",
    step: "100",
  });
  assert.ok(parsed.config);
  assert.equal(familyResultTex(parsed.config), "1\\,\\mathrm{km} = 1000\\,\\mathrm{m}");
  const { html } = await markdownToHtml(
    '::interactive[Test]{kind="measurement-lab" mode="kilometres" value="1" second="1000" max="1000" step="100"}',
    { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] },
  );
  assert.match(html, /data-kilometre-bar="value"/);
  assert.match(html, /aria-label="1 km = 1000 m"/);
});

test("shows both directions of inverse operations", async () => {
  const { html } = await markdownToHtml(
    '::interactive[Test]{kind="counter-mat" mode="inverse" value="5" second="3"}',
    { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] },
  );
  assert.match(html, /data-counter-zone="sum"/);
  assert.match(html, /aria-label="5 \+ 3 = 8, 8 − 3 = 5"/u);
});

test("tilts a balance toward the heavier side", async () => {
  assert.equal(balanceTilt(500, 750), 8);
  assert.equal(balanceTilt(750, 500), -8);
  assert.equal(balanceTilt(7, 7), 0);
  const { html } = await markdownToHtml(
    '::interactive[Test]{kind="measurement-lab" mode="mass" value="500" second="750" max="1000" step="50" unit="g"}',
    { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] },
  );
  assert.match(html, /data-balance-beam transform="rotate\(8 280 105\)"/);
});

test("rejects unknown family modes, presentation attributes, and unsafe bounds", async () => {
  for (const source of [
    '::interactive[Test]{kind="counter-mat" mode="unknown"}',
    '::interactive[Test]{kind="counter-mat" mode="count" scene="layout"}',
    '::interactive[Test]{kind="counter-mat" mode="count" value="41"}',
    '::interactive[Test]{kind="counter-mat" mode="multiply" value="11" second="2"}',
    '::interactive[Test]{kind="fraction-model" mode="count" parts="4" selected="5"}',
    '::interactive[Test]{kind="fraction-model" mode="compare" second="100" secondParts="8"}',
    '::interactive[Test]{kind="fraction-model" mode="add-subtract" parts="8" selected="3" second="100" secondParts="8"}',
    '::interactive[Test]{kind="number-line" mode="order" min="0" max="10" value="12"}',
    '::interactive[Test]{kind="place-value-board" mode="decimal" value="1.25"}',
  ]) {
    const issues = await validateArticleDirectives(source);
    assert.ok(
      issues.some(({ code }) =>
        code === "invalid-directive-attribute" || code === "unknown-directive-attribute"
      ),
      source,
    );
  }
});

test("round-trips normalized family data and exposes only live controls", () => {
  const parsed = parseFamilyInteractiveConfig("counter-mat", {
    mode: "share",
    value: "11",
    groups: "3",
  });
  assert.ok(parsed.config);
  const dataset = familyInteractiveDataset(parsed.config);
  assert.deepEqual(parseFamilyInteractiveDataset("counter-mat", dataset), parsed.config);
  assert.deepEqual(
    familyControlDefinitions(parsed.config).map(({ key }) => key),
    ["value", "groups"],
  );

  const dice = parseFamilyInteractiveConfig("data-lab", { mode: "dice-frequency" });
  assert.ok(dice.config);
  assert.deepEqual(familyControlDefinitions(dice.config), []);
});

test("keeps decimal operations and equation trials in one canonical state", async () => {
  const decimal = parseFamilyInteractiveConfig("place-value-board", {
    mode: "decimal",
    value: "1.2",
    second: "0.3",
    operation: "add",
    max: "10",
  });
  assert.ok(decimal.config);
  assert.deepEqual(
    familyControlDefinitions(decimal.config).map(({ key, labelJa }) => [key, labelJa]),
    [["value", "ひとつめのしょうすう"], ["second", "ふたつめのしょうすう"]],
  );
  assert.equal(familyResultTex(decimal.config), "1.2 + 0.3 = 1.5");
  const decimalHtml = await markdownToHtml(
    '::interactive[Test]{kind="place-value-board" mode="decimal" value="1.2" second="0.3" operation="add" max="10"}',
    { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] },
  );
  assert.match(decimalHtml.html, /data-place-board="second"/);
  assert.match(decimalHtml.html, /data-place-board="result"/);
  assert.match(decimalHtml.html, /data-place-decimal-operation/);
  assert.match(decimalHtml.html, /aria-label="1\.2 \+ 0\.3 = 1\.5"/);

  const wrongTrial = equationBalanceModel("unknown", "add", 5, 12, 6);
  const correctTrial = equationBalanceModel("unknown", "add", 5, 12, 7);
  assert.deepEqual([wrongTrial.leftValue, wrongTrial.rightValue], [11, 12]);
  assert.deepEqual([correctTrial.leftValue, correctTrial.rightValue], [12, 12]);
  const unknown = parseFamilyInteractiveConfig("equation-balance", {
    mode: "unknown",
    value: "5",
    second: "12",
    selected: "6",
    max: "20",
  });
  assert.ok(unknown.config);
  assert.deepEqual(familyControlDefinitions(unknown.config).map(({ key }) => key), ["value", "second", "selected"]);
  const unknownHtml = await markdownToHtml(
    '::interactive[Test]{kind="equation-balance" mode="unknown" value="5" second="12" selected="6" max="20"}',
    { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] },
  );
  assert.match(unknownHtml.html, /data-balance-beam transform="rotate\(1\.5 280 105\)"/);
  assert.match(unknownHtml.html, />6 \+ 5<\/text>/);

  assert.equal(equationBalanceModel("properties", "add", 4, 6, 1).leftLabel, "(4 + 6) + 2");
  assert.equal(equationBalanceModel("properties", "multiply", 4, 6, 2).rightLabel, "4 × 6 + 4 × 2");
  const propertiesHtml = await markdownToHtml(
    '::interactive[Test]{kind="equation-balance" mode="properties" operation="multiply" selected="2" value="4" second="6"}',
    { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] },
  );
  assert.match(propertiesHtml.html, /data-equation-operation/);
  assert.match(propertiesHtml.html, /data-family-output="selected">わけてかける<\/output>/);
});

test("renders correspondence, recorded dice outcomes, and equal-length unit rows", async () => {
  const options = { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] };
  const comparison = await markdownToHtml(
    '::interactive[Test]{kind="counter-mat" mode="compare" value="5" second="3" max="10"}',
    options,
  );
  assert.equal((comparison.html.match(/data-counter-pair="/g) ?? []).length, 3);
  assert.match(comparison.html, /data-counter-extra-label="value">Aのあまり 2こ/);

  const labelled = await markdownToHtml(
    '::interactive[Test]{kind="counter-mat" mode="label" value="4" selected="1" max="10"}',
    options,
  );
  assert.equal((labelled.html.match(/data-counter-number/g) ?? []).length, 4);
  assert.doesNotMatch(labelled.html, /data-counter-number hidden/);

  assert.match(diceFrequencyResultText(6, 4, [0, 0, 0, 1, 0, 1]), /きろくしため 2こ/);
  const dice = await markdownToHtml(
    '::interactive[Test]{kind="data-lab" mode="dice-frequency" value="6" second="4" categories="6"}',
    options,
  );
  assert.match(dice.html, /data-dice-recorded>2<\/td>/);
  assert.match(dice.html, /aria-label="いまのめは 6 と 4。きろくしため 2こ/);

  const standard = await markdownToHtml(
    '::interactive[Test]{kind="measurement-lab" mode="standard" value="2" second="6" max="20"}',
    options,
  );
  assert.match(standard.html, /data-standard-row="value" style="--ke-standard-count: 2"/);
  assert.match(standard.html, /data-standard-row="second" style="--ke-standard-count: 6"/);
  assert.match(standard.html, /aria-label="おなじながさ：Aのたんい 2こ、Bのたんい 6こ"/);
});

test("rejects fractional discrete measurements and exposes categorical meanings", async () => {
  for (const attributes of [
    { mode: "area", value: "2.5", second: "3", max: "10", step: "1" },
    { mode: "area", value: "2", second: "3", max: "10.5", step: "1" },
    { mode: "standard", value: "2", second: "6", max: "20", step: "2" },
  ]) {
    assert.ok(parseFamilyInteractiveConfig("measurement-lab", attributes).issues.length > 0);
  }
  const area = await markdownToHtml(
    '::interactive[Test]{kind="measurement-lab" mode="area" value="2" second="3" max="12" step="1"}',
    { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] },
  );
  assert.equal((area.html.match(/data-area-tile=/g) ?? []).length, 24);

  const evidence = parseFamilyInteractiveConfig("data-lab", {
    mode: "evidence",
    selected: "1",
  });
  assert.ok(evidence.config);
  const selected = familyControlDefinitions(evidence.config).find(({ key }) => key === "selected");
  assert.ok(selected);
  assert.equal(familyControlDefinitionValueText(selected, 0, "ja"), "棒グラフ");
  assert.equal(familyControlDefinitionValueText(selected, 1, "ja"), "表");
  const evidenceHtml = await markdownToHtml(
    '::interactive[Test]{kind="data-lab" mode="evidence" selected="1"}',
    { features: ARTICLE_MARKDOWN_FEATURES, mdastPlugins: [createArticleDirectivePlugin()] },
  );
  assert.match(evidenceHtml.html, /data-family-input="selected"[^>]*aria-valuetext="ひょう"|aria-valuetext="ひょう"[^>]*data-family-input="selected"/);
});

test("maps unbiased accepted random bytes to deterministic die faces", () => {
  assert.equal(dieFaceFromByte(0), 1);
  assert.equal(dieFaceFromByte(5), 6);
  assert.equal(dieFaceFromByte(6), 1);
  assert.equal(dieFaceFromByte(251), 6);
  assert.equal(dieFaceFromByte(252), undefined);
});

test("renders emphasized ruby next to article math", async () => {
  const rendered = await markdownToHtml(
    ':ruby[偶数]{reading="ぐうすう" strong="true"}とは、$2$ で割り切れる整数です。',
    {
      features: ARTICLE_MARKDOWN_FEATURES,
      mdastPlugins: [createArticleDirectivePlugin()],
    },
  );
  assert.match(
    rendered.html,
    /<strong><ruby>偶数<rp>（<\/rp><rt>ぐうすう<\/rt>.*<\/ruby><\/strong>/,
  );
  assert.match(rendered.html, /class="ke-math ke-math--inline"/);

  const emphasizedMath = await markdownToHtml("**答えは $2$ です**", {
    features: ARTICLE_MARKDOWN_FEATURES,
    mdastPlugins: [createArticleDirectivePlugin()],
  });
  assert.match(emphasizedMath.html, /<strong>答えは .*ke-math.*です<\/strong>/);
});

test("rejects invalid strong values on ruby", async () => {
  assert.ok(
    (
      await validateArticleDirectives(
        ':ruby[偶数]{reading="ぐうすう" strong="yes"}',
      )
    ).some(({ code }) => code === "invalid-directive-attribute"),
  );
});

test("segments ruby around Kanji while leaving kana and katakana unchanged", () => {
  assert.deepEqual(segmentKanjiRuby("掛け算", "かけざん"), [
    { text: "掛", reading: "か" },
    { text: "け" },
    { text: "算", reading: "ざん" },
  ]);
  assert.deepEqual(segmentKanjiRuby("平方センチメートル", "へいほうセンチメートル"), [
    { text: "平方", reading: "へいほう" },
    { text: "センチメートル" },
  ]);
  assert.deepEqual(segmentKanjiRuby("𠮷田々〆", "よしだだめ"), [
    { text: "𠮷田々〆", reading: "よしだだめ" },
  ]);
  assert.equal(segmentKanjiRuby("センチメートル", "センチメートル"), undefined);
});

test("requires explicit Kanji-run readings when a full reading is ambiguous", async () => {
  const ambiguous = `:::details{summary="練習問題の解答と考え方" summaryReading="れんしゅうもんだいのかいとうとかんがえかた"}\n本文\n:::`;
  assert.ok(
    (await validateArticleDirectives(ambiguous)).some(
      ({ code }) => code === "invalid-directive-attribute",
    ),
  );
  const explicit = `:::details{summary="練習問題の解答と考え方" summaryReading="れんしゅうもんだい|かいとう|かんが|かた"}\n本文\n:::`;
  assert.deepEqual(await validateArticleDirectives(explicit), []);
});

test("rejects invalid, stateful, and trusted TeX commands", async () => {
  for (const source of [
    "$\\notARealCommand{1}$",
    "$\\newcommand{\\x}{1}\\x$",
    "$\\href{https://example.com}{x}$",
  ]) {
    assert.ok(
      (await validateArticleDirectives(source)).some(
        ({ code }) => code === "invalid-math",
      ),
    );
  }
});

test("supports the portable chemistry profile through mhchem", async () => {
  const source = "$\\ce{2H2 + O2 -> 2H2O}$";
  assert.deepEqual(await validateArticleDirectives(source), []);
  const { html } = await markdownToHtml(source, {
    features: ARTICLE_MARKDOWN_FEATURES,
    mdastPlugins: [createArticleDirectivePlugin()],
  });
  assert.match(html, /class="ke-math ke-math--inline"/);
  assert.match(html, /H/);
});

test("Markdown renderer enforces the article-wide math budget", async () => {
  const source = Array.from({ length: 201 }, () => "$1$").join(" ");
  await assert.rejects(
    async () =>
      markdownToHtml(source, {
        features: ARTICLE_MARKDOWN_FEATURES,
        mdastPlugins: [createArticleDirectivePlugin()],
      }),
    /article math limit exceeded/,
  );
});

test("keeps dimension labels and cell numbers inside the grid viewBox", () => {
  for (let rows = 1; rows <= 12; rows += 1) {
    for (let columns = 1; columns <= 12; columns += 1) {
      const geometry = createRectangleAreaGridGeometry(rows, columns);
      assert.equal(geometry.cellSize, RECTANGLE_AREA_GRID_CELL_SIZE);
      assert.equal(geometry.width / columns, RECTANGLE_AREA_GRID_CELL_SIZE);
      assert.equal(geometry.height / rows, RECTANGLE_AREA_GRID_CELL_SIZE);

      const dimensions = createRectangleAreaGridDimensions(rows, columns);
      assert.equal(dimensions.length, 4);
      for (const dimension of dimensions) {
        assert.ok(dimension.labelX >= 0 && dimension.labelX <= geometry.canvasWidth);
        assert.ok(dimension.labelY >= 0 && dimension.labelY <= geometry.canvasHeight);
      }
    }
  }
  assert.equal(rectangleAreaGridCssLength(RECTANGLE_AREA_GRID_CELL_SIZE), "1cm");
  const cells = createRectangleAreaGridCellLabels(12, 12);
  assert.equal(cells.length, 144);
  assert.equal(cells.at(-1)?.index, 144);
});

test("renderer also rejects unsafe source Markdown", async () => {
  assert.ok(
    (await validateArticleDirectives("<!-- hidden HTML -->")).some(
      ({ code }) => code === "unsafe-markdown-raw-html",
    ),
  );
  assert.throws(
    () =>
      markdownToHtml("<script>alert(1)</script>", {
        features: ARTICLE_MARKDOWN_FEATURES,
        mdastPlugins: [createArticleDirectivePlugin()],
      }),
    /raw HTML is not allowed/,
  );
});
