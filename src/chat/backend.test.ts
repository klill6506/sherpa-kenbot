import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEndpointAsk, toStream } from './backend';

async function collect(stream: AsyncIterable<string>): Promise<string[]> {
  const chunks: string[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

describe('toStream', () => {
  it('passes an async iterable through chunk by chunk', async () => {
    async function* source(): AsyncGenerator<string> {
      yield 'Hello ';
      yield 'there';
    }
    expect(await collect(toStream(source()))).toEqual(['Hello ', 'there']);
  });

  it('turns a Promise<string> into a single-chunk stream', async () => {
    expect(await collect(toStream(Promise.resolve('whole answer')))).toEqual(['whole answer']);
  });

  it('unwraps a Promise<AsyncIterable<string>>', async () => {
    async function* source(): AsyncGenerator<string> {
      yield 'a';
      yield 'b';
    }
    expect(await collect(toStream(Promise.resolve(source())))).toEqual(['a', 'b']);
  });
});

describe('createEndpointAsk', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs message + history and streams the response body', async () => {
    const seen: { url: string; body: unknown }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      seen.push({ url, body: JSON.parse(String(init.body)) });
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('chunk one '));
          controller.enqueue(encoder.encode('chunk two'));
          controller.close();
        },
      });
      return new Response(stream, { status: 200 });
    });

    const ask = createEndpointAsk('/api/help/');
    const history = [{ role: 'assistant' as const, content: 'Hi!' }];
    const chunks = await collect(toStream(ask('How do I file?', history)));

    expect(chunks.join('')).toBe('chunk one chunk two');
    expect(seen[0].url).toBe('/api/help/');
    expect(seen[0].body).toEqual({ message: 'How do I file?', history });
  });

  it('throws on a non-OK response (the chat layer shows a friendly fallback)', async () => {
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 500 }));
    const ask = createEndpointAsk('/api/help/');
    await expect(collect(toStream(ask('hello', [])))).rejects.toThrow('500');
  });
});
