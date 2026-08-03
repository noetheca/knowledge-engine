export interface FamilyUiTextSegment {
  text: string;
  reading?: string;
}

const FAMILY_UI_KANJI_READINGS: Readonly<Record<string, string>> = {
  一度: "いちど",
  上: "うえ",
  下: "した",
  位: "くらい",
  作: "つく",
  分: "わ",
  分母: "ぶんぼ",
  単位: "たんい",
  右: "みぎ",
  同: "おな",
  合: "あ",
  回: "かい",
  基準: "きじゅん",
  大: "おお",
  左: "ひだり",
  数: "かず",
  数直線: "すうちょくせん",
  棒: "ぼう",
  水: "みず",
  白: "しろ",
  確認: "かくにん",
  算: "ざん",
  組: "くみ",
  考: "かんが",
  色: "いろ",
  見: "み",
  見方: "みかた",
  資料: "しりょう",
  道具: "どうぐ",
  長: "なが",
  共通: "きょうつう",
  先: "さき",
  表: "ひょう",
  位置: "いち",
} as const;

const KANJI_RUN_PATTERN = /[\p{Unified_Ideograph}々〇〆〻]+/gu;
const REGISTERED_KANJI_TOKENS = Object.keys(FAMILY_UI_KANJI_READINGS)
  .sort((left, right) => right.length - left.length);

function readingForKanjiRun(run: string): string | undefined {
  const readings: Array<string | undefined> = Array.from({ length: run.length + 1 });
  readings[run.length] = "";
  for (let index = run.length - 1; index >= 0; index -= 1) {
    for (const token of REGISTERED_KANJI_TOKENS) {
      if (!run.startsWith(token, index)) continue;
      const suffix = readings[index + token.length];
      const reading = FAMILY_UI_KANJI_READINGS[token];
      if (suffix !== undefined && reading !== undefined) {
        readings[index] = `${reading}${suffix}`;
        break;
      }
    }
  }
  return readings[0];
}

/**
 * Splits engine-owned Japanese UI text so only Kanji runs receive ruby.
 * Unknown runs are rejected, keeping new generated copy inside the reviewed
 * reading allowlist instead of silently emitting unannotated Kanji.
 */
export function segmentFamilyUiText(text: string): readonly FamilyUiTextSegment[] {
  const segments: FamilyUiTextSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(KANJI_RUN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) segments.push({ text: text.slice(cursor, index) });
    const run = match[0];
    const reading = readingForKanjiRun(run);
    if (!reading) {
      throw new Error(`Generated family UI has an unregistered Kanji run: ${run}`);
    }
    segments.push({ text: run, reading });
    cursor = index + run.length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

export function familyUiReading(text: string): string {
  return segmentFamilyUiText(text)
    .map((segment) => segment.reading ?? segment.text)
    .join("");
}
