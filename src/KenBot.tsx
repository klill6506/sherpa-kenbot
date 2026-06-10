import { motion, useReducedMotion } from 'motion/react';
import { Character } from './character/Character';
import type { CharacterAppearance } from './character/appearance';
import { defaultAppearance } from './character/appearance';
import { useBlink, useGlance } from './hooks/useIdleLife';
import './styles/kenbot.css';

/**
 * <KenBot /> — the floating helper. Phase 1 scope: he stands in the corner,
 * breathes, blinks, and occasionally glances around.
 *
 * Later phases add the full state machine (greet/listening/thinking/talking/
 * celebrate/point), the chat bubble, and voice. The prop surface below is the
 * full planned API; props not used yet are marked.
 */

export type KenBotPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface KenBotProps {
  /** Which corner he lives in. Default: bottom-right. */
  position?: KenBotPosition;
  /** 1 = 160px tall (reads as a 2–3 inch figure). 1.5 = 240px, etc. */
  sizeScale?: number;
  /** Stacking order for the whole widget. Default 9999. */
  zIndex?: number;
  /** Override any part of his look (colors, hair style, glasses). */
  appearance?: Partial<CharacterAppearance>;
  /** UI accent colors — used by the chat bubble from Phase 3 on. */
  colors?: { primary?: string; accent?: string };
  /** His name, shown in the chat header from Phase 3 on. Default "Ken". */
  name?: string;
  /** First message in the chat bubble (Phase 3). */
  greeting?: string;
}

const BASE_HEIGHT_PX = 160;

export function KenBot({
  position = 'bottom-right',
  sizeScale = 1,
  zIndex = 9999,
  appearance,
}: KenBotProps): React.JSX.Element {
  // prefers-reduced-motion: keep blinks (they're tiny and natural), drop the
  // breathing bob and glance wandering.
  const reducedMotion = useReducedMotion() ?? false;

  const look: CharacterAppearance = { ...defaultAppearance, ...appearance };
  const eyesOpen = useBlink();
  const pupilOffset = useGlance(!reducedMotion);

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
          pose={{
            mouthOpen: 0,
            eyesOpen,
            browLift: 0,
            pupilOffset,
          }}
        />
      </motion.div>
    </div>
  );
}
