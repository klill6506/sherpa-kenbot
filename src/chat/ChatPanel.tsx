import { useEffect, useRef, useState } from 'react';
import { useMic } from '../voice/useMic';
import type { KenBotVoice } from '../voice/voices';
import type { KenBotMessage } from './backend';
import type { ChatStatus } from './useChat';

/**
 * The speech bubble: a compact (~320px) chat panel anchored above KenBot,
 * with a tail pointing down at him. Presentational — all conversation logic
 * lives in useChat, all positioning rules in kenbot.css.
 *
 * Text is always shown (captions by default); the mute toggle only controls
 * the voice. Talking TO him is the mic button in the input row (useMic) —
 * click, speak, and it sends itself when you stop. Styling uses
 * --kb-primary / --kb-accent so host apps can theme it via the colors prop.
 */

export interface ChatPanelProps {
  name: string;
  messages: KenBotMessage[];
  status: ChatStatus;
  muted: boolean;
  onToggleMute: () => void;
  onSend: (text: string) => void;
  onClose: () => void;
  /** Voices on offer. Two or more shows the picker in the header. */
  voices: KenBotVoice[];
  /** Currently selected voice id. */
  voiceId: string | undefined;
  onSelectVoice: (id: string) => void;
  /** Show the mic button (when the browser supports recognition). */
  voiceInput: boolean;
  /** BCP-47 language for speech recognition, e.g. 'en-US'. */
  voiceInputLang?: string;
  /** Fires as the mic opens/closes — KenBot uses it to hush and to listen. */
  onListeningChange?: (listening: boolean) => void;
}

export function ChatPanel({
  name,
  messages,
  status,
  muted,
  onToggleMute,
  onSend,
  onClose,
  voices,
  voiceId,
  onSelectVoice,
  voiceInput,
  voiceInputLang,
  onListeningChange,
}: ChatPanelProps): React.JSX.Element {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = status !== 'idle';

  // Speaking to him: the recognized sentence is sent the moment the engine
  // decides you've stopped talking — no second click, no Enter key.
  const mic = useMic({
    enabled: voiceInput,
    lang: voiceInputLang,
    onFinal: (text) => {
      onSend(text);
      setDraft('');
    },
  });

  // Let KenBot react to the mic (stop mid-sentence, hold the listening pose).
  const listening = mic.listening;
  useEffect(() => {
    onListeningChange?.(listening);
  }, [listening, onListeningChange]);

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
          {/* One voice needs no menu — only offer a choice when there is one. */}
          {voices.length > 1 && (
            <select
              className="kb-chat__voice"
              value={voiceId ?? ''}
              onChange={(e) => onSelectVoice(e.target.value)}
              aria-label="Voice"
              title="Voice"
            >
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          )}
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
        {mic.supported && (
          <button
            type="button"
            className={`kb-chat__mic${mic.listening ? ' kb-chat__mic--live' : ''}`}
            onClick={() => (mic.listening ? mic.stop() : mic.start())}
            disabled={busy}
            aria-pressed={mic.listening}
            aria-label={mic.listening ? 'Stop listening' : `Speak to ${name}`}
            title={mic.listening ? 'Stop listening' : `Speak to ${name}`}
          >
            🎤
          </button>
        )}
        <input
          ref={inputRef}
          className="kb-chat__input"
          // While the mic is live the input becomes a live caption of what
          // he's hearing, so you can see the words land before they send.
          value={mic.listening ? mic.transcript : draft}
          onChange={(e) => setDraft(e.target.value)}
          readOnly={mic.listening}
          placeholder={mic.listening ? 'Listening… speak now' : `Ask ${name}…`}
          aria-label={`Ask ${name} a question`}
        />
        <button
          type="submit"
          className="kb-chat__send"
          disabled={busy || mic.listening || !draft.trim()}
          aria-label="Send"
        >
          ➤
        </button>
      </form>

      {/* A mic that heard nothing must say so — see the note in useMic. */}
      {mic.notice && (
        <p className="kb-chat__mic-note" role="status">
          {mic.notice}
        </p>
      )}

      <div className="kb-chat__tail" aria-hidden="true" />
    </div>
  );
}
