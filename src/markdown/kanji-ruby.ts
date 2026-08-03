export interface KanjiRubySegment {
  text: string;
  reading?: string;
}

interface SegmentationCandidate {
  alignments: number;
  score: number;
  segments: KanjiRubySegment[];
}

const KANJI_RUN_PATTERN = /^[\p{Unified_Ideograph}々〇〆〻]+$/u;
const RUBY_TOKEN_PATTERN =
  /[\p{Unified_Ideograph}々〇〆〻]+|[^\p{Unified_Ideograph}々〇〆〻]+/gu;

function characterCount(value: string): number {
  return [...value].length;
}

function readingScore(base: string, reading: string): number {
  const baseLength = characterCount(base);
  const readingLength = characterCount(reading);
  const expectedLength = baseLength * 2;
  const unusuallyLong = Math.max(0, readingLength - baseLength * 4);
  return Math.abs(readingLength - expectedLength) + unusuallyLong;
}

/**
 * Splits a base string into Kanji runs with readings and unchanged non-Kanji
 * runs. Kana, katakana, punctuation, numbers, and Latin text must appear
 * verbatim in the authored reading and are never placed inside a ruby element.
 */
export function segmentKanjiRuby(
  base: string,
  reading: string,
): readonly KanjiRubySegment[] | undefined {
  const tokens = [...base.matchAll(RUBY_TOKEN_PATTERN)].map(([token]) => token);
  if (
    tokens.length === 0 ||
    !tokens.some((token) => KANJI_RUN_PATTERN.test(token)) ||
    reading.length === 0
  ) {
    return undefined;
  }

  if (reading.includes("|")) {
    const kanjiReadings = reading.split("|");
    const kanjiRunCount = tokens.filter((token) => KANJI_RUN_PATTERN.test(token)).length;
    if (
      kanjiReadings.length !== kanjiRunCount ||
      kanjiReadings.some((kanjiReading) => kanjiReading.length === 0)
    ) {
      return undefined;
    }
    let readingIndex = 0;
    return tokens.map((token) =>
      KANJI_RUN_PATTERN.test(token)
        ? { text: token, reading: kanjiReadings[readingIndex++] }
        : { text: token },
    );
  }

  const memo = new Map<string, SegmentationCandidate | null>();

  function solve(tokenIndex: number, readingOffset: number): SegmentationCandidate | null {
    const key = `${tokenIndex}:${readingOffset}`;
    const cached = memo.get(key);
    if (cached !== undefined) {
      return cached;
    }

    if (tokenIndex === tokens.length) {
      const result =
        readingOffset === reading.length
          ? { alignments: 1, score: 0, segments: [] }
          : null;
      memo.set(key, result);
      return result;
    }

    const token = tokens[tokenIndex];
    if (token === undefined) {
      memo.set(key, null);
      return null;
    }

    if (!KANJI_RUN_PATTERN.test(token)) {
      if (!reading.startsWith(token, readingOffset)) {
        memo.set(key, null);
        return null;
      }
      const rest = solve(tokenIndex + 1, readingOffset + token.length);
      const result = rest
        ? {
            alignments: rest.alignments,
            score: rest.score,
            segments: [{ text: token }, ...rest.segments],
          }
        : null;
      memo.set(key, result);
      return result;
    }

    let best: SegmentationCandidate | null = null;
    let alignments = 0;
    for (let end = readingOffset + 1; end <= reading.length; end += 1) {
      const rest = solve(tokenIndex + 1, end);
      if (!rest) {
        continue;
      }
      alignments = Math.min(2, alignments + rest.alignments);
      const rubyReading = reading.slice(readingOffset, end);
      const candidate = {
        alignments: rest.alignments,
        score: readingScore(token, rubyReading) + rest.score,
        segments: [{ text: token, reading: rubyReading }, ...rest.segments],
      };
      if (!best || candidate.score < best.score) {
        best = candidate;
      }
    }
    if (best) {
      best.alignments = alignments;
    }
    memo.set(key, best);
    return best;
  }

  const result = solve(0, 0);
  return result?.alignments === 1 ? result.segments : undefined;
}
