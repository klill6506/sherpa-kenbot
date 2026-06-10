import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Character } from './character/Character';
import type { CharacterAppearance } from './character/appearance';
import { defaultAppearance } from './character/appearance';
import { ChatPanel } from './chat/ChatPanel';
import type { AskFunction } from './chat/backend';
import { createEndpointAsk } from './chat/backend';
import type { ChatStatus } from './chat/useChat';
import { useChat } from './chat/useChat';
import { useBlink, useGlance } from './hooks/useIdleLife';
import { useFakeTalk, useKenBotState } from './hooks/useKenBotState';
import { useWander } from './hooks/useWander';
import type { KenBotState } from './state/stateMachine';
import { createSentenceSplitter } from './voice/sentences';
import type { SentenceSplitter } from './voice/sentences';
import { useSpeech } from './voice/useSpeech';
import './styles/kenbot.css';

/**
 * <KenBot /> — the floating helper.
 *
 * Clicking him toggles the speech-bubble chat. The conversation drives the
 * state machine: bubble open → listening, waiting on the backend → thinking,
 * reply streaming in → talking, bubble closed → idle. Hosts can also drive
 * him through the ref handle (celebrate, point) or watch via onStateChange.
 */

export type KenBotPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

/**
 * Imperative controls for host apps, via ref:
 *   const bot = useRef<KenBotHandle>(null);
 *   <KenBot ref={bot} />  ...  bot.current?.celebrate();
 */
export interface KenBotHandle {
  /** Arms up! For when the user finishes something worth cheering. */
  celebrate: () => void;
  /** Point toward the left/right edge of the screen to direct attention. */
  pointLeft: () => void;
  pointRight: () => void;
  /** Full control for advanced hosts (e.g. force listening/thinking). */
  setState: (state: KenBotState) => void;
}

export interface KenBotProps {
  /** Which corner he lives in. Default: bottom-right. */
  position?: KenBotPosition;
  /** 1 = 160px tall (reads as a 2–3 inch figure). 1.5 = 240px, etc. */
  sizeScale?: number;
  /** Stacking order for the whole widget. Default 9999. */
  zIndex?: number;
  /** Override any part of his look (colors, hair style, glasses). */
  appearance?: Partial<CharacterAppearance>;
  /** Wave hello when he first appears. Default true (skipped under reduced motion). */
  autoGreet?: boolean;
  /** Occasionally stroll along the screen edge while idle. Default true
      (disabled under reduced motion). */
  wander?: boolean;
  /** Farthest he'll stroll from his corner, in px. Default 150. */
  wanderRange?: number;
  /** Imperative controls (celebrate / point / setState). */
  ref?: React.Ref<KenBotHandle>;
  /** Fires whenever his animation state changes — handy for demos and debugging. */
  onStateChange?: (state: KenBotState) => void;
  /** Chat UI colors: primary = header/user bubbles, accent = focus rings. */
  colors?: { primary?: string; accent?: string };
  /** His name, shown in the chat header. Default "Ken". */
  name?: string;
  /** First message waiting in the chat bubble. */
  greeting?: string;
  /**
   * The AI backend, option 1: a function. Gets (message, history) and returns
   * either a Promise<string> or an AsyncIterable<string> of streamed chunks.
   * Takes precedence over askEndpoint if both are given.
   */
  onAsk?: AskFunction;
  /**
   * The AI backend, option 2: a URL. The component POSTs { message, history }
   * as JSON and streams the text response into the bubble.
   */
  askEndpoint?: string;
  /**
   * Voice: a URL on the HOST'S OWN backend that proxies to ElevenLabs
   * (see /server-examples for the Django version). Gets POST { text } per
   * sentence, must return audio (mp3). The ElevenLabs API key lives on that
   * server and NEVER in this package. Omit for text-only.
   */
  ttsEndpoint?: string;
}

/** Mute persists across sessions; voice arrives in Phase 4 but the choice sticks now. */
const MUTED_STORAGE_KEY = 'kenbot-muted';

function readStoredMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_STORAGE_KEY) === '1';
  } catch {
    return false; // storage unavailable (private mode, SSR) — default unmuted
  }
}

const BASE_HEIGHT_PX = 160;

/**
 * Face settings per state. Gross motion (arms, lean, tilt) lives in
 * Character's variants; this table covers the face: brows, mouth, gaze.
 * A null pupil means "let the idle glance wander take over".
 */
const STATE_POSE: Record<
  KenBotState,
  { browLift: number; mouthOpen: number; pupil: { x: number; y: number } | null }
> = {
  idle: { browLift: 0, mouthOpen: 0, pupil: null },
  greet: { browLift: 0.5, mouthOpen: 0.2, pupil: { x: 0, y: 0 } },
  listening: { browLift: 1, mouthOpen: 0, pupil: { x: 0, y: 0.15 } },
  thinking: { browLift: 0.25, mouthOpen: 0.05, pupil: { x: 0.35, y: -1 } }, // eyes drift up
  talking: { browLift: 0.2, mouthOpen: 0, pupil: { x: 0, y: 0 } }, // mouth overridden by audio/fake talk
  walking: { browLift: 0, mouthOpen: 0, pupil: null }, // glance around while strolling
  celebrate: { browLift: 0.9, mouthOpen: 0.55, pupil: { x: 0, y: -0.2 } },
  'point-left': { browLift: 0.6, mouthOpen: 0.15, pupil: { x: -1, y: 0 } },
  'point-right': { browLift: 0.6, mouthOpen: 0.15, pupil: { x: 1, y: 0 } },
};

export function KenBot({
  position = 'bottom-right',
  sizeScale = 1,
  zIndex = 9999,
  appearance,
  autoGreet = true,
  wander = true,
  wanderRange = 150,
  ref,
  onStateChange,
  colors,
  name = 'Ken',
  greeting = "Hi! I'm Ken. What can I help you with?",
  onAsk,
  askEndpoint,
  ttsEndpoint,
}: KenBotProps): React.JSX.Element {
  // prefers-reduced-motion: keep blinks, drop bounce/gestures (the gesture
  // states still snap to their pose — see Character — but nothing waves or
  // bounces, and we skip the hello wave entirely).
  const reducedMotion = useReducedMotion() ?? false;

  const look: CharacterAppearance = { ...defaultAppearance, ...appearance };
  const { state, request } = useKenBotState();

  // ----- Chat -----
  const [chatOpen, setChatOpen] = useState(false);
  const [muted, setMuted] = useState(readStoredMuted);

  const toggleMute = (): void => {
    setMuted((current) => {
      const next = !current;
      try {
        localStorage.setItem(MUTED_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // storage unavailable — the toggle still works for this session
      }
      return next;
    });
  };

  // ----- Voice -----
  const speech = useSpeech({ ttsEndpoint, muted });
  // One splitter per answer: streamed chunks go in, complete sentences come
  // out and are queued for TTS immediately — that's what makes him start
  // talking after the FIRST sentence instead of after the whole answer.
  const splitterRef = useRef<SentenceSplitter | null>(null);

  // onAsk wins if both backends are provided.
  const ask = useMemo<AskFunction | null>(() => {
    if (onAsk) return onAsk;
    if (askEndpoint) return createEndpointAsk(askEndpoint);
    return null;
  }, [onAsk, askEndpoint]);

  const { messages, status, send } = useChat({
    ask,
    greeting,
    callbacks: {
      onAnswerStart: () => {
        splitterRef.current = createSentenceSplitter();
      },
      onChunk: (chunk) => {
        for (const sentence of splitterRef.current?.push(chunk) ?? []) {
          speech.speak(sentence);
        }
      },
      onAnswerDone: () => {
        const leftover = splitterRef.current?.flush();
        if (leftover) speech.speak(leftover);
        splitterRef.current = null;
      },
    },
  });

  // Map the conversation onto the state machine — but only on TRANSITIONS.
  // Reacting to the values on every render would stomp gestures like the
  // mount greet or a host-triggered celebrate. He keeps "talking" while
  // audio is still playing, even after the text finished streaming.
  const speaking = speech.speaking;
  const prevChat = useRef<{ open: boolean; status: ChatStatus; speaking: boolean }>({
    open: false,
    status: 'idle',
    speaking: false,
  });
  useEffect(() => {
    const prev = prevChat.current;
    if (prev.open === chatOpen && prev.status === status && prev.speaking === speaking) return;
    prevChat.current = { open: chatOpen, status, speaking };
    if (status === 'thinking') request('thinking');
    else if (status === 'streaming' || speaking) request('talking');
    else request(chatOpen ? 'listening' : 'idle');
  }, [chatOpen, status, speaking, request]);

  // Idle life: always blink; only glance around when idle or strolling (a
  // thinking or pointing gaze is part of the pose and shouldn't wander).
  const eyesOpen = useBlink();
  const glance = useGlance((state === 'idle' || state === 'walking') && !reducedMotion);
  // The fake lip-flap only fills in when there's no real audio to sync to
  // (no ttsEndpoint, muted, or TTS quietly failed).
  const fakeTalkMouth = useFakeTalk(state === 'talking' && !speaking);

  // Occasional strolls along the screen edge. From a right corner he walks
  // left into the page, from a left corner he walks right.
  const wanderStyle = useWander({
    enabled: wander && !reducedMotion,
    state,
    request,
    range: wanderRange,
    direction: position.includes('right') ? -1 : 1,
  });

  // Wave hello once on mount.
  useEffect(() => {
    if (autoGreet && !reducedMotion) request('greet');
    // Intentionally mount-only: a later prop change shouldn't re-greet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Let the host observe state changes.
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  useImperativeHandle(
    ref,
    () => ({
      celebrate: () => request('celebrate'),
      pointLeft: () => request('point-left'),
      pointRight: () => request('point-right'),
      setState: (next: KenBotState) => request(next),
    }),
    [request],
  );

  const statePose = STATE_POSE[state];

  return (
    <div
      className={`kb-root kb-root--${position}`}
      style={
        {
          '--kb-z-index': zIndex,
          '--kb-height': `${BASE_HEIGHT_PX * sizeScale}px`,
          '--kb-primary': colors?.primary ?? '#2b6597',
          '--kb-accent': colors?.accent ?? '#3d86c6',
          ...wanderStyle,
        } as React.CSSProperties
      }
    >
      {chatOpen && (
        <ChatPanel
          name={name}
          messages={messages}
          status={status}
          muted={muted}
          onToggleMute={toggleMute}
          onSend={(text) => {
            // A submit is a real user gesture — the moment the browser lets
            // us start audio. unlock() here so the answer can be spoken.
            speech.unlock();
            send(text);
          }}
          onClose={() => {
            speech.stop(); // closing the bubble cuts him off mid-sentence
            setChatOpen(false);
          }}
        />
      )}

      {/* He IS the button: click to open the chat, click again to close. */}
      <button
        type="button"
        className="kb-trigger"
        onClick={() => {
          speech.unlock(); // user gesture — see autoplay note in useSpeech
          if (chatOpen) speech.stop();
          setChatOpen((open) => !open);
        }}
        aria-label={chatOpen ? `Close ${name}'s chat` : `Ask ${name} for help`}
        aria-expanded={chatOpen}
      >
        {/* Breathing: a slow, slight vertical bob on the whole figure. */}
        <motion.div
          animate={reducedMotion ? undefined : { y: [0, -2.5, 0] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Character
            className="kb-character"
            appearance={look}
            state={state}
            pose={{
              // Talking mouth: real audio amplitude when he's speaking,
              // the fake lip-flap otherwise, the state's pose when not talking.
              mouthOpen:
                state === 'talking' ? (speaking ? speech.mouthOpen : fakeTalkMouth) : statePose.mouthOpen,
              eyesOpen,
              browLift: statePose.browLift,
              pupilOffset: statePose.pupil ?? glance,
            }}
          />
        </motion.div>
      </button>
    </div>
  );
}
