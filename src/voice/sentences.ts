/**
 * Incremental sentence splitting for streamed answers.
 *
 * Why: TTS for a whole long answer would mean seconds of silence before he
 * starts talking. Instead, as text chunks stream in we carve off each
 * complete sentence the moment it appears and hand it to the speech queue —
 * so he starts speaking after the FIRST sentence, while the rest is still
 * being generated.
 *
 * The splitting rule is deliberately simple: a sentence ends at .!?… (plus
 * any closing quotes/brackets) followed by whitespace. Notes on edge cases:
 * - Decimals ("3.5%") are safe automatically — no whitespace after the dot.
 * - Abbreviations ("e.g. ") do split. That just adds a tiny pause in speech,
 *   which is an acceptable price for keeping this readable.
 * - Text that rambles on with no punctuation is force-split near
 *   MAX_BUFFER_CHARS at a word boundary, so one run-on can't block speech.
 */

const BOUNDARY = /([.!?…]+["”'’)\]]*)\s+/g;
const MAX_BUFFER_CHARS = 280;

export interface SentenceSplitter {
  /** Feed a streamed chunk; returns any sentences completed by it. */
  push(chunk: string): string[];
  /** End of stream: returns whatever is left (or null), and resets. */
  flush(): string | null;
}

export function createSentenceSplitter(): SentenceSplitter {
  let buffer = '';

  return {
    push(chunk: string): string[] {
      buffer += chunk;
      const sentences: string[] = [];

      // Carve off every complete sentence currently in the buffer.
      let consumedUpTo = 0;
      BOUNDARY.lastIndex = 0;
      for (let match = BOUNDARY.exec(buffer); match !== null; match = BOUNDARY.exec(buffer)) {
        const sentenceEnd = match.index + match[1].length;
        const sentence = buffer.slice(consumedUpTo, sentenceEnd).trim();
        if (sentence) sentences.push(sentence);
        consumedUpTo = match.index + match[0].length;
      }
      buffer = buffer.slice(consumedUpTo);

      // Safety valve: no punctuation for a long stretch — split at the last
      // word break so the speech queue still gets fed.
      if (buffer.length > MAX_BUFFER_CHARS) {
        const breakAt = buffer.lastIndexOf(' ', MAX_BUFFER_CHARS);
        if (breakAt > 0) {
          const forced = buffer.slice(0, breakAt).trim();
          if (forced) sentences.push(forced);
          buffer = buffer.slice(breakAt + 1);
        }
      }

      return sentences;
    },

    flush(): string | null {
      const rest = buffer.trim();
      buffer = '';
      return rest || null;
    },
  };
}
