import { useCallback, useRef, useState } from 'react';
import type { AskFunction, KenBotMessage } from './backend';
import { toStream } from './backend';

/**
 * Owns the conversation: message history (session-only, by design), the
 * send flow, and a status the animation layer maps onto the state machine:
 *
 *   idle → (user sends) → thinking → (first chunk arrives) → streaming → idle
 *
 * Streamed chunks are appended to the last assistant message as they land,
 * which is what makes the text "type itself" into the bubble.
 */

export type ChatStatus = 'idle' | 'thinking' | 'streaming';

const ERROR_REPLY = "Sorry — I couldn't get an answer just now. Please try again in a moment.";
const NO_BACKEND_REPLY = "I'm not wired up to a help backend yet, so I can't answer — but the chat works!";

export interface ChatStreamCallbacks {
  /** A fresh answer is about to start streaming. */
  onAnswerStart?: () => void;
  /** A chunk of answer text just arrived (the voice layer splits these into sentences). */
  onChunk?: (chunk: string) => void;
  /** The answer finished (or failed) — flush any leftover partial sentence. */
  onAnswerDone?: () => void;
}

export function useChat(args: { ask: AskFunction | null; greeting: string; callbacks?: ChatStreamCallbacks }): {
  messages: KenBotMessage[];
  status: ChatStatus;
  send: (text: string) => void;
} {
  const { ask, greeting } = args;
  const [messages, setMessages] = useState<KenBotMessage[]>([{ role: 'assistant', content: greeting }]);
  const [status, setStatus] = useState<ChatStatus>('idle');

  // The async send flow needs the latest history without re-creating itself
  // every message, and a busy flag to block double-sends mid-stream.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const busyRef = useRef(false);
  // Callbacks live in a ref so freshly-rendered closures are always called
  // (the send callback itself only re-creates when `ask` changes).
  const callbacksRef = useRef(args.callbacks);
  callbacksRef.current = args.callbacks;

  const send = useCallback(
    (text: string): void => {
      const trimmed = text.trim();
      if (!trimmed || busyRef.current) return;

      // History per the contract: the conversation BEFORE this question.
      const history = messagesRef.current;
      setMessages((m) => [...m, { role: 'user', content: trimmed }]);

      if (!ask) {
        setMessages((m) => [...m, { role: 'assistant', content: NO_BACKEND_REPLY }]);
        return;
      }

      busyRef.current = true;
      setStatus('thinking');

      void (async () => {
        callbacksRef.current?.onAnswerStart?.();
        try {
          let answer = '';
          let started = false;
          for await (const chunk of toStream(ask(trimmed, history))) {
            answer += chunk;
            callbacksRef.current?.onChunk?.(chunk);
            if (!started) {
              started = true;
              setStatus('streaming');
              setMessages((m) => [...m, { role: 'assistant', content: answer }]);
            } else {
              // Replace the in-progress assistant message with the longer text.
              setMessages((m) => [...m.slice(0, -1), { role: 'assistant', content: answer }]);
            }
          }
          if (!started) {
            // Stream ended without a single chunk — treat as a failed answer.
            setMessages((m) => [...m, { role: 'assistant', content: ERROR_REPLY }]);
          }
        } catch {
          // Never surface raw errors to the end user.
          setMessages((m) => [...m, { role: 'assistant', content: ERROR_REPLY }]);
        } finally {
          callbacksRef.current?.onAnswerDone?.();
          setStatus('idle');
          busyRef.current = false;
        }
      })();
    },
    [ask],
  );

  return { messages, status, send };
}
