import { useEffect, useRef, useState } from 'react';
import type { KenBotMessage } from './backend';
import type { ChatStatus } from './useChat';

/**
 * The speech bubble: a compact (~320px) chat panel anchored above KenBot,
 * with a tail pointing down at him. Presentational — all conversation logic
 * lives in useChat, all positioning rules in kenbot.css.
 *
 * Text is always shown (captions by default); the mute toggle only controls
 * the voice (Phase 4). Styling uses --kb-primary / --kb-accent so host apps
 * can theme it via the colors prop.
 */

export interface ChatPanelProps {
  name: string;
  messages: KenBotMessage[];
  status: ChatStatus;
  muted: boolean;
  onToggleMute: () => void;
  onSend: (text: string) => void;
  onClose: () => void;
}

export function ChatPanel({
  name,
  messages,
  status,
  muted,
  onToggleMute,
  onSend,
  onClose,
}: ChatPanelProps): React.JSX.Element {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = status !== 'idle';

  // Keep the newest message in view as replies stream in.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, status]);

  // Ready to type the moment the bubble opens.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (): void => {
    if (busy || !draft.trim()) return;
    onSend(draft);
    setDraft('');
  };

  return (
    <div className="kb-chat" role="dialog" aria-label={`Chat with ${name}`}>
      <div className="kb-chat__header">
        <span className="kb-chat__title">{name}</span>
        <div className="kb-chat__header-buttons">
          <button
            type="button"
            className="kb-chat__icon-btn"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute voice' : 'Mute voice'}
            title={muted ? 'Unmute voice' : 'Mute voice'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            type="button"
            className="kb-chat__icon-btn"
            onClick={onClose}
            aria-label="Close chat"
            title="Close chat"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="kb-chat__messages" ref={listRef}>
        {messages.map((message, i) => (
          <div
            // Session history is append-only, so the index is a stable key.
            key={i}
            className={`kb-chat__msg kb-chat__msg--${message.role}`}
          >
            {message.content}
          </div>
        ))}
        {status === 'thinking' && (
          <div className="kb-chat__msg kb-chat__msg--assistant kb-chat__typing" aria-label={`${name} is thinking`}>
            <span />
            <span />
            <span />
          </div>
        )}
      </div>

      <form
        className="kb-chat__inputrow"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          ref={inputRef}
          className="kb-chat__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Ask ${name}…`}
          aria-label={`Ask ${name} a question`}
        />
        <button type="submit" className="kb-chat__send" disabled={busy || !draft.trim()} aria-label="Send">
          ➤
        </button>
      </form>

      <div className="kb-chat__tail" aria-hidden="true" />
    </div>
  );
}
