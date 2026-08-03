import type { ContentStatus } from "../types.js";

export interface UiStrings {
  layout: {
    skipLink: string;
    changeLanguage: string;
    languageMenu: string;
    translationPending: string;
    switchToLightTheme: string;
    switchToDarkTheme: string;
    lightTheme: string;
    darkTheme: string;
    draftNotice: string;
  };
  graph: {
    status: Record<ContentStatus, string>;
    toolbarLabel: string;
    fit: string;
    list: string;
    map: string;
    showThumbnails: string;
    showText: string;
    settings: string;
    nodeSize: string;
    repulsionStrength: string;
    attractionStrength: string;
    groupStrength: string;
    groupSeparation: string;
    hierarchyEnabled: string;
    hierarchyStrength: string;
    simulationExplanation: string;
    simulationRun: string;
    simulationStop: string;
    simulationRunning: string;
    simulationSettled: string;
    simulationStopped: string;
    simulationReducedMotion: string;
    simulationEngine: string;
    simulationWorkerEngine: string;
    simulationMainThreadEngine: string;
    simulationReset: string;
    interactionHint: string;
    viewportLabel: string;
    legend: string;
    relatedLegend: string;
    inspectorLabel: string;
    accessibleList: string;
    knowledgeList: string;
    closeArticleLabel: string;
    articleLabel: string;
    articleEyebrow: string;
    navigationLabel: string;
    close: string;
    fullPage: string;
    selectedKnowledge: string;
    closeDetailsLabel: string;
    prerequisites: string;
    noPrerequisites: string;
    dependents: string;
    noDependents: string;
    related: string;
    learn: string;
    previous: string;
    next: string;
    noKnowledge: string;
    loadingArticle: string;
    articleLoadFailed: string;
    openDirectly: string;
  };
  article: {
    relationsLabel: string;
    prerequisites: string;
    related: string;
    noRelations: string;
    sources: string;
    sourcesPending: string;
    reportIssue: string;
  };
}

const stringsByLocale: Record<string, UiStrings> = {
  ja: {
    layout: {
      skipLink: "本文へ移動",
      changeLanguage: "表示言語を変更",
      languageMenu: "表示言語",
      translationPending: "翻訳準備中",
      switchToLightTheme: "ライトテーマへ切り替える",
      switchToDarkTheme: "ダークテーマへ切り替える",
      lightTheme: "ライトテーマ",
      darkTheme: "ダークテーマ",
      draftNotice: "下書きの知識コンテンツです。再利用前に事実と出典を確認してください。",
    },
    graph: {
      status: {
        draft: "下書き",
        review: "確認中",
        published: "公開済み",
      },
      toolbarLabel: "知識マップの表示操作",
      fit: "全体を表示",
      list: "一覧",
      map: "マップ",
      showThumbnails: "ノードをサムネイル表示に切り替える",
      showText: "ノードを文字表示に切り替える",
      settings: "グラフ設定",
      nodeSize: "ノードサイズ",
      repulsionStrength: "反発の強さ",
      attractionStrength: "引力の強さ",
      groupStrength: "グループ内のまとまり",
      groupSeparation: "グループ間の間隔",
      hierarchyEnabled: "前提順序の力を使う",
      hierarchyStrength: "前提順序の力",
      simulationExplanation:
        "近い知識ほど強く引き合い、ノード同士は反発します。前提順序とグループは固定座標ではなく、上下左右へ動ける柔らかな力として働きます。",
      simulationRun: "力学演算を再開",
      simulationStop: "力学演算を一時休止",
      simulationRunning: "力学演算中",
      simulationSettled: "安定配置を維持中",
      simulationStopped: "力学演算を一時休止中",
      simulationReducedMotion: "動きを減らす設定に合わせた静止表示です",
      simulationEngine: "演算方式",
      simulationWorkerEngine: "並列処理（Web Worker）",
      simulationMainThreadEngine: "互換処理（メインスレッド）",
      simulationReset: "標準設定に戻す",
      interactionHint: "背景をドラッグで移動・ノードは直接ドラッグ",
      viewportLabel: "前提知識を上から下へ示す知識マップ",
      legend: "細い線は前提関係です。ノードを選ぶと直接の関係を強調します",
      relatedLegend: "点線は選択した知識の関連を示します",
      inspectorLabel: "選択した知識の詳細",
      accessibleList: "アクセシブルな一覧",
      knowledgeList: "知識一覧",
      closeArticleLabel: "記事を閉じる",
      articleLabel: "知識の記事",
      articleEyebrow: "知識の記事",
      navigationLabel: "前後の知識",
      close: "閉じる",
      fullPage: "フルページで表示",
      selectedKnowledge: "選択した知識",
      closeDetailsLabel: "詳細を閉じる",
      prerequisites: "前提知識",
      noPrerequisites: "前提なし",
      dependents: "この知識を使う項目",
      noDependents: "現在はありません",
      related: "関連知識",
      learn: "この知識を学ぶ",
      previous: "前へ",
      next: "次へ",
      noKnowledge: "該当する知識はありません",
      loadingArticle: "記事を読み込んでいます…",
      articleLoadFailed: "記事を読み込めませんでした。",
      openDirectly: "通常のページで開く",
    },
    article: {
      relationsLabel: "知識の関係",
      prerequisites: "前提知識",
      related: "関連知識",
      noRelations: "登録されていません",
      sources: "出典・確認元",
      sourcesPending: "公開前に確認元を追加する必要があります。",
      reportIssue: "問題を報告",
    },
  },
  en: {
    layout: {
      skipLink: "Skip to content",
      changeLanguage: "Change display language",
      languageMenu: "Display language",
      translationPending: "Translation pending",
      switchToLightTheme: "Switch to light theme",
      switchToDarkTheme: "Switch to dark theme",
      lightTheme: "Light theme",
      darkTheme: "Dark theme",
      draftNotice: "Draft knowledge content. Verify facts and sources before reuse.",
    },
    graph: {
      status: {
        draft: "Draft",
        review: "In review",
        published: "Published",
      },
      toolbarLabel: "Knowledge map controls",
      fit: "Fit all",
      list: "List",
      map: "Map",
      showThumbnails: "Show node thumbnails",
      showText: "Show node text",
      settings: "Graph settings",
      nodeSize: "Node size",
      repulsionStrength: "Repulsion strength",
      attractionStrength: "Attraction strength",
      groupStrength: "Within-group cohesion",
      groupSeparation: "Between-group spacing",
      hierarchyEnabled: "Use prerequisite-order force",
      hierarchyStrength: "Prerequisite-order force",
      simulationExplanation:
        "Nearby concepts attract more strongly while nodes repel one another. Prerequisite order and groups act as soft forces, so nodes remain free to move in both axes.",
      simulationRun: "Resume physics",
      simulationStop: "Pause physics",
      simulationRunning: "Physics running",
      simulationSettled: "Maintaining a stable layout",
      simulationStopped: "Physics paused",
      simulationReducedMotion: "Static view follows your reduced-motion setting",
      simulationEngine: "Computation",
      simulationWorkerEngine: "Parallel (Web Worker)",
      simulationMainThreadEngine: "Compatibility (main thread)",
      simulationReset: "Reset defaults",
      interactionHint: "Drag the canvas to move; drag nodes directly",
      viewportLabel: "Knowledge map ordered from prerequisites to later concepts",
      legend: "Thin lines show prerequisites; selecting a node emphasizes its direct links",
      relatedLegend: "Dotted lines show relations for the selected concept",
      inspectorLabel: "Selected knowledge details",
      accessibleList: "Accessible list",
      knowledgeList: "Knowledge list",
      closeArticleLabel: "Close article",
      articleLabel: "Knowledge article",
      articleEyebrow: "Knowledge article",
      navigationLabel: "Previous and next knowledge",
      close: "Close",
      fullPage: "Open full page",
      selectedKnowledge: "Selected knowledge",
      closeDetailsLabel: "Close details",
      prerequisites: "Prerequisites",
      noPrerequisites: "No prerequisites",
      dependents: "Concepts that use this knowledge",
      noDependents: "None currently",
      related: "Related knowledge",
      learn: "Learn this concept",
      previous: "Previous",
      next: "Next",
      noKnowledge: "No matching knowledge",
      loadingArticle: "Loading article…",
      articleLoadFailed: "The article could not be loaded.",
      openDirectly: "Open the regular page",
    },
    article: {
      relationsLabel: "Knowledge relationships",
      prerequisites: "Prerequisites",
      related: "Related knowledge",
      noRelations: "None registered",
      sources: "Sources and verification",
      sourcesPending: "Sources must be added before publication.",
      reportIssue: "Report an issue",
    },
  },
};

export function getUiStrings(locale: string): UiStrings {
  return stringsByLocale[locale] ?? stringsByLocale.en!;
}
