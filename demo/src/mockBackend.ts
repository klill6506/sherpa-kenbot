import type { KenBotMessage } from 'sherpa-kenbot';

/**
 * The demo's offline AI: waits a moment (so the thinking pose shows), then
 * streams a canned reply word by word (so the talking state and the
 * type-itself text can be watched without any real backend or API key).
 */

const CANNED_REPLIES = [
  'Great question! In a real app, my answer would come from your own help backend — I just echo for now.',
  "Here's the demo answer: everything you see is streamed word by word, exactly how a real reply would arrive.",
  "I'm running on the mock backend, so I can't actually look that up — but watch my mouth go while I pretend!",
  'As a small cartoon CPA, I should note this demo response is for illustrative purposes only.',
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function* mockAsk(message: string, history: KenBotMessage[]): AsyncGenerator<string> {
  // Pretend to think.
  await delay(1400 + Math.random() * 900);

  const opener = `You asked: "${message}". `;
  // Rotate through the canned replies as the conversation grows.
  const reply = CANNED_REPLIES[Math.floor(history.length / 2) % CANNED_REPLIES.length];

  // Stream word by word, like a real LLM response.
  for (const word of (opener + reply).split(/(?<=\s)/)) {
    yield word;
    await delay(35 + Math.random() * 70);
  }
}
