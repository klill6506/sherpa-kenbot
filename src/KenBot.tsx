import { useEffect, useImperativeHandle } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Character } from './character/Character';
import type { CharacterAppearance } from './character/appearance';
import { defaultAppearance } from './character/appearance';
import { useBlink, useGlance } from './hooks/useIdleLife';
import { useFakeTalk, useKenBotState } from './hooks/useKenBotState';
import type { KenBotState } from './state/stateMachine';
import './styles/kenbot.css';

/**
 * <KenBot /> — the floating helper.
 *
 * Phase 2 scope: the full animation state machine. He greets on mount, and
 * hosts can drive him through the ref handle (celebrate, point) or watch his
 * state via onStateChange. The chat flow (Phase 3) will call request() with
 * listening/thinking/talking as the conversation moves.
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
  /** Imperative controls (celebrate / point / setState). */
  ref?: React.Ref<KenBotHandle>;
  /** Fires whenever his animation state changes — handy for demos and debugging. */
  onStateChange?: (state: KenBotState) => void;
  /** UI accent colors — used by the chat bubble from Phase 3 on. */
  colors?: { primary?: string; accent?: string };
  /** His name, shown in the chat header from Phase 3 on. Default "Ken". */
  name?: string;
  /** First message in the chat bubble (Phase 3). */
  greeting?: string;
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
  ref,
  onStateChange,
}: KenBotProps): React.JSX.Element {
  // prefers-reduced-motion: keep blinks, drop bounce/gestures (the gesture
  // states still snap to their pose — see Character — but nothing waves or
  // bounces, and we skip the hello wave entirely).
  const reducedMotion = useReducedMotion() ?? false;

  const look: CharacterAppearance = { ...defaultAppearance, ...appearance };
  const { state, request } = useKenBotState();

  // Idle life: always blink; only glance around when idle (a thinking or
  // pointing gaze is part of the pose and shouldn't wander).
  const eyesOpen = useBlink();
  const glance = useGlance(state === 'idle' && !reducedMotion);
  const fakeTalkMouth = useFakeTalk(state === 'talking');

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
        } as React.CSSProperties
      }
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
            mouthOpen: state === 'talking' ? fakeTalkMouth : statePose.mouthOpen,
            eyesOpen,
            browLift: statePose.browLift,
            pupilOffset: statePose.pupil ?? glance,
          }}
        />
      </motion.div>
    </div>
  );
}
