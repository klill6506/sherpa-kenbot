/**
 * The pluggable AI backend layer. This package NEVER talks to an AI service
 * itself and never holds API keys — each host app brings its own backend in
 * one of two shapes:
 *
 * 1. `onAsk(message, history)` — any function returning a Promise<string>
 *    (whole answer at once) or an AsyncIterable<string> (streamed chunks).
 * 2. `askEndpoint` — a URL. We POST { message, history } and read the
 *    response body as a text stream (works with plain text responses too).
 *
 * Everything downstream (the chat hook, the talking animation, Phase 4's
 * sentence queue) consumes one shape: an async stream of text chunks.
 * `toStream` normalizes all the allowed return types into that.
 */

export interface KenBotMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type AskResult = Promise<string> | AsyncIterable<string> | Promise<AsyncIterable<string>>;

export type AskFunction = (message: string, history: KenBotMessage[]) => AskResult;

/** Normalizes any allowed AskFunction result into a stream of text chunks. */
export async function* toStream(result: AskResult): AsyncGenerator<string> {
  // An object with Symbol.asyncIterator is already a stream — pass it through.
  if (Symbol.asyncIterator in Object(result)) {
    yield* result as AsyncIterable<string>;
    return;
  }
  // Otherwise it's a promise of either a whole string or a stream.
  const awaited = await (result as Promise<string | AsyncIterable<string>>);
  if (typeof awaited === 'string') {
    yield awaited;
    return;
  }
  yield* awaited;
}

/**
 * Builds an AskFunction from a URL. POSTs { message, history } as JSON and
 * streams the response body back as text chunks, so a Django StreamingHttpResponse
 * (or any plain text response) streams straight into the bubble.
 */
export function createEndpointAsk(url: string): AskFunction {
  return async function* ask(message: string, history: KenBotMessage[]): AsyncGenerator<string> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
    });
    if (!response.ok) {
      throw new Error(`askEndpoint responded ${response.status}`);
    }
    if (!response.body) {
      // Some environments (old polyfills) expose no body stream — fall back
      // to reading the whole answer at once.
      yield await response.text();
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield decoder.decode(value, { stream: true });
      }
    } finally {
      reader.releaseLock();
    }
  };
}
