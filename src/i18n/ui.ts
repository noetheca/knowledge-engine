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
    interactionHint: string;
    viewportLabel: string;
    legend: string;
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
      interactionHint: "背景をドラッグで移動・ノードは直接ドラッグ",
      viewportLabel: "前提知識を上から下へ示す知識マップ",
      legend: "実線は「前提知識 → 次に学ぶ知識」を示します",
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
      interactionHint: "Drag the canvas to move; drag nodes directly",
      viewportLabel: "Knowledge map ordered from prerequisites to later concepts",
      legend: "Solid lines show “prerequisite → next concept”",
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
  },
};

export function getUiStrings(locale: string): UiStrings {
  return stringsByLocale[locale] ?? stringsByLocale.en!;
}
