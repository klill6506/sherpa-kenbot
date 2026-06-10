import { useId } from 'react';
import type { CharacterAppearance } from './appearance';
import { shade } from './appearance';
import type { KenBotState } from '../state/stateMachine';

/**
 * The character drawing itself — 100% code-drawn SVG, no image files.
 *
 * Two inputs shape him each frame:
 * - `pose`: fine-grained numbers (mouth openness, blink, brow lift, gaze).
 *   These come from timers, lip sync, and the per-state pose table in KenBot.
 * - `state`: the animation state. Gross motion (arm rotations, body lean,
 *   head tilt) is driven by plain CSS: each joint gets a static rotation from
 *   the tables below (tweened by a CSS transition with a springy easing), and
 *   the showy moves — greet wave, celebrate bounce, talking hand-waggle — are
 *   CSS keyframe animations in kenbot.css keyed off the `kb-state-*` class.
 *
 * Why plain CSS and not the motion library here: animation libraries manage
 * SVG transform-origin themselves (relative to each element's bounding box),
 * which made every joint spin around the wrong point. CSS with
 * `transform-box: view-box` pivots exactly at the viewBox coordinates we say.
 *
 * Arms are two-joint: a shoulder group (sleeve) containing a nested elbow
 * group (forearm + hand). Rotating shoulder + elbow together lets one rig
 * wave, point sideways, throw both arms up, and bring a hand to the chin.
 *
 * prefers-reduced-motion (see kenbot.css): keyframe animations are disabled,
 * so nothing waves or bounces — but joints still transition to their static
 * pose, because a raised pointing arm carries meaning.
 *
 * Layer order (painted back-to-front):
 *   shadow → ears → legs → torso → arms → neck → head/face → hair → glasses
 */

export interface CharacterPose {
  /** 0 = mouth closed (smile), 1 = wide open. Lip sync drives this in Phase 4. */
  mouthOpen: number;
  /** 1 = eyes open, 0 = mid-blink. */
  eyesOpen: number;
  /** 0 = relaxed brows, 1 = raised (surprised / listening). */
  browLift: number;
  /** Where the pupils look, each axis -1..1 (0,0 = straight ahead). */
  pupilOffset: { x: number; y: number };
}

export interface CharacterProps {
  appearance: CharacterAppearance;
  pose: CharacterPose;
  /** Animation state driving the gross-motion pose. Default: idle. */
  state?: KenBotState;
  className?: string;
}

/** A gentle overshoot so joint moves land with a little life, not a thunk. */
const SPRINGY = 'transform 0.55s cubic-bezier(0.34, 1.35, 0.64, 1)';

/**
 * Rotation pivot for a joint, in viewBox coordinates.
 * `transform-box: view-box` is what makes the px values mean "viewBox units";
 * without it the origin would be measured from the element's own bounding box.
 */
function jointStyle(rotate: number, x: number, y: number): React.CSSProperties {
  return {
    transform: `rotate(${rotate}deg)`,
    transformOrigin: `${x}px ${y}px`,
    transformBox: 'view-box',
    transition: SPRINGY,
  };
}

/* ------------------------------------------------------------------ */
/* Static joint angles per state (degrees, positive = clockwise).      */
/* The greet wave / celebrate bounce / talking waggle layer keyframe   */
/* animations on top of these — see kenbot.css.                        */
/* ------------------------------------------------------------------ */

interface JointAngles {
  shoulderRight: number;
  elbowRight: number;
  shoulderLeft: number;
  elbowLeft: number;
  headTilt: number;
}

const NEUTRAL: JointAngles = { shoulderRight: 0, elbowRight: 0, shoulderLeft: 0, elbowLeft: 0, headTilt: 0 };

const STATE_ANGLES: Record<KenBotState, JointAngles> = {
  idle: NEUTRAL,
  greet: NEUTRAL, // the wave itself is a keyframe animation
  listening: { ...NEUTRAL, headTilt: 3 },
  // Shoulder swings the arm across the body, elbow folds the hand up to the
  // chin (angles worked out so the hand lands just under the jaw).
  thinking: { ...NEUTRAL, shoulderRight: 80, elbowRight: 84, headTilt: -5 },
  talking: NEUTRAL, // hand waggle is a keyframe animation
  celebrate: { shoulderRight: -140, elbowRight: -18, shoulderLeft: 140, elbowLeft: 18, headTilt: -3 },
  // The slight elbow counter-rotation straightens the hand into the point
  // (the forearm artwork naturally curves downward).
  'point-left': { ...NEUTRAL, shoulderLeft: 75, elbowLeft: 15 },
  'point-right': { ...NEUTRAL, shoulderRight: -75, elbowRight: -15 },
};

/** Whole-figure transform per state (lean in when listening). */
function figureStyle(state: KenBotState): React.CSSProperties {
  return {
    transform: state === 'listening' ? 'translateY(2px) scale(1.045)' : 'none',
    transformOrigin: '110px 248px', // pivot at his feet
    transformBox: 'view-box',
    transition: SPRINGY,
  };
}

/**
 * Builds the mouth outline for a given openness.
 * Closed (0) is a thin smiling lens; open (1) drops the lower lip into a
 * tall rounded shape. One path morphs smoothly between them, which is what
 * makes amplitude-driven lip sync look natural later.
 */
function mouthPath(open: number): string {
  const cx = 110;
  const cornerY = 104;
  const halfWidth = 14 + open * 3;
  const upperLip = cornerY + 3 + open * 2;
  const lowerLip = cornerY + 5 + open * 26;
  return [
    `M ${cx - halfWidth} ${cornerY}`,
    `Q ${cx} ${upperLip} ${cx + halfWidth} ${cornerY}`,
    `Q ${cx} ${lowerLip} ${cx - halfWidth} ${cornerY}`,
    'Z',
  ].join(' ');
}

export function Character({ appearance, pose, state = 'idle', className }: CharacterProps): React.JSX.Element {
  // SVG ids (gradients, clip paths) are global to the page. useId keeps two
  // KenBots on the same page from clobbering each other's defs.
  const uid = useId();
  const mouthClipId = `kb-mouth-clip-${uid}`;

  const {
    skinColor,
    hairColor,
    hairStyle,
    eyeColor,
    shirtColor,
    tieColor,
    pantsColor,
    shoeColor,
    glasses,
    pocketProtector,
  } = appearance;

  const skinShadow = shade(skinColor, 0.18);
  const blushColor = shade(skinColor, 0.16); // warm tone for cheeks/nose hints
  const browColor = shade(hairColor, 0.28); // brows read better a bit darker than hair
  const hairShadow = shade(hairColor, 0.15);

  // Pupils travel at most ~3px so they always stay inside the eye whites.
  const pupilX = pose.pupilOffset.x * 3;
  const pupilY = pose.pupilOffset.y * 2.5;

  // Brows slide up to ~4px when fully lifted.
  const browY = -4 * pose.browLift;

  // Blinks squash the eye group vertically around the eye centerline.
  const eyeScaleY = Math.max(0.06, pose.eyesOpen);

  const angles = STATE_ANGLES[state];

  return (
    <svg
      className={`kb-svg kb-state-${state}${className ? ` ${className}` : ''}`}
      viewBox="0 0 220 256"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="KenBot, an animated helper character"
    >
      <defs>
        <clipPath id={mouthClipId}>
          <path d={mouthPath(pose.mouthOpen)} />
        </clipPath>
      </defs>

      {/* Soft ground shadow so he doesn't look like he's floating mid-air */}
      <ellipse cx="110" cy="248" rx="46" ry="6" fill="#000000" opacity="0.08" />

      <g className="kb-figure" style={figureStyle(state)}>
        {/* Ears — drawn first so the skull overlaps their inner halves */}
        <g className="kb-ears">
          <circle cx="61" cy="82" r="9" fill={skinColor} />
          <circle cx="159" cy="82" r="9" fill={skinColor} />
          <path d="M 58 80 Q 60 84 58 87" fill="none" stroke={skinShadow} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M 162 80 Q 160 84 162 87" fill="none" stroke={skinShadow} strokeWidth="1.6" strokeLinecap="round" />
        </g>

        {/* Legs and shoes — hips tuck up under the shirt hem so there's no seam */}
        <g className="kb-legs">
          <rect x="72" y="194" width="76" height="22" rx="6" fill={pantsColor} />
          <rect x="76" y="206" width="30" height="32" rx="11" fill={pantsColor} />
          <rect x="114" y="206" width="30" height="32" rx="11" fill={pantsColor} />
          <ellipse cx="90" cy="241" rx="14" ry="6.5" fill={shoeColor} />
          <ellipse cx="130" cy="241" rx="14" ry="6.5" fill={shoeColor} />
        </g>

        {/* Torso: shirt, collar, tie, pocket protector */}
        <g className="kb-body">
          <path
            d="M 64 200 L 64 165 C 61 140 80 129 110 129 C 140 129 159 140 156 165 L 156 200 Z"
            fill={shirtColor}
          />
          {/* Collar wings */}
          <path d="M 100 132 L 110 144 L 93 141 Z" fill={shirtColor} stroke={shade(shirtColor, 0.12)} strokeWidth="1" />
          <path d="M 120 132 L 110 144 L 127 141 Z" fill={shirtColor} stroke={shade(shirtColor, 0.12)} strokeWidth="1" />
          {/* Tie: knot + tail */}
          <path d="M 110 141 L 117 148 L 110 155 L 103 148 Z" fill={tieColor} />
          <path d="M 106 153 L 114 153 L 119 188 L 110 197 L 101 188 Z" fill={tieColor} />
          {/* Pocket protector with pens — wearer's left chest (viewer's right).
              Pens are drawn first so the pocket panel hides their lower halves. */}
          {pocketProtector && (
            <g className="kb-pocket-protector">
              <rect x="127.5" y="144" width="3.4" height="12" rx="1.7" fill="#2D63AE" />
              <rect x="129.2" y="145" width="0.9" height="6" fill="#C9D4E2" />
              <rect x="133.5" y="142" width="3.4" height="14" rx="1.7" fill="#C03A3A" />
              <circle cx="135.2" cy="143.6" r="1" fill="#8C2626" />
              <rect x="139.5" y="145" width="3.4" height="11" rx="1.7" fill="#E8B91F" />
              <rect x="124" y="152" width="23" height="21" rx="3" fill={shade(shirtColor, 0.05)} stroke={shade(shirtColor, 0.18)} strokeWidth="1.2" />
              <rect x="124" y="152" width="23" height="6.5" rx="3" fill={shade(shirtColor, -0.4)} stroke={shade(shirtColor, 0.18)} strokeWidth="1.2" />
            </g>
          )}
        </g>

        {/* Arms — in front of the torso so gestures (hand to chin, pointing
            across the body) aren't hidden behind the shirt. Each arm:
            shoulder group → nested elbow group (forearm + hand) + sleeve. */}
        <g className="kb-arm-left" style={jointStyle(angles.shoulderLeft, 70, 143)}>
          <g className="kb-forearm-left" style={jointStyle(angles.elbowLeft, 58, 166)}>
            <path
              d="M 58 165 C 55 173 54 184 55 192"
              fill="none"
              stroke={skinColor}
              strokeWidth="11"
              strokeLinecap="round"
            />
            <circle cx="56" cy="197" r="7.5" fill={skinColor} />
          </g>
          <path
            d="M 70 143 C 62 150 58 158 57 166"
            fill="none"
            stroke={shirtColor}
            strokeWidth="15"
            strokeLinecap="round"
          />
        </g>
        <g className="kb-arm-right" style={jointStyle(angles.shoulderRight, 150, 143)}>
          <g className="kb-forearm-right" style={jointStyle(angles.elbowRight, 162, 166)}>
            <path
              d="M 162 165 C 165 173 166 184 165 192"
              fill="none"
              stroke={skinColor}
              strokeWidth="11"
              strokeLinecap="round"
            />
            <circle cx="164" cy="197" r="7.5" fill={skinColor} />
          </g>
          <path
            d="M 150 143 C 158 150 162 158 163 166"
            fill="none"
            stroke={shirtColor}
            strokeWidth="15"
            strokeLinecap="round"
          />
        </g>

        {/* Neck sits behind the head, with a soft jaw shadow */}
        <g className="kb-neck">
          <rect x="101" y="116" width="18" height="18" fill={skinColor} />
          <rect x="101" y="116" width="18" height="7" fill={skinShadow} opacity="0.5" />
        </g>

        {/* Head + face — tilts as one unit, pivoting at the neck */}
        <g className="kb-head" style={jointStyle(angles.headTilt, 110, 120)}>
          {/* Skull: egg shape, slightly fuller at the jaw for the friendly look */}
          <path
            d="M 62 74 C 62 38 84 22 110 22 C 136 22 158 38 158 74 C 158 106 138 126 110 126 C 82 126 62 106 62 74 Z"
            fill={skinColor}
          />

          {/* Cheek blush */}
          <ellipse cx="78" cy="94" rx="8" ry="4.5" fill={blushColor} opacity="0.3" />
          <ellipse cx="142" cy="94" rx="8" ry="4.5" fill={blushColor} opacity="0.3" />

          {/* Eyebrows — the group slides up with browLift */}
          <g className="kb-eyebrows" transform={`translate(0 ${browY})`}>
            <path d="M 77 58 Q 88 52 99 57" fill="none" stroke={browColor} strokeWidth="3.5" strokeLinecap="round" />
            <path d="M 121 57 Q 132 52 143 58" fill="none" stroke={browColor} strokeWidth="3.5" strokeLinecap="round" />
          </g>

          {/* Eyes — big and Pixar-expressive. The group squashes vertically
              around the eye centerline to blink; a fast CSS transition turns
              the snap into a real blink. */}
          <g
            className="kb-eyes"
            style={{
              transform: `scaleY(${eyeScaleY})`,
              transformOrigin: '110px 73px',
              transformBox: 'view-box',
              transition: 'transform 70ms ease-out',
            }}
          >
            <g className="kb-eye-left">
              <ellipse cx="88" cy="73" rx="13" ry="14" fill="#FDFDFB" />
              <g
                className="kb-pupil"
                style={{
                  transform: `translate(${pupilX}px, ${pupilY}px)`,
                  transition: 'transform 0.25s ease-out',
                }}
              >
                <circle cx="88" cy="74" r="6.5" fill={eyeColor} />
                <circle cx="88" cy="74" r="3" fill="#26262B" />
                <circle cx="90.2" cy="71.6" r="1.7" fill="#FFFFFF" />
              </g>
            </g>
            <g className="kb-eye-right">
              <ellipse cx="132" cy="73" rx="13" ry="14" fill="#FDFDFB" />
              <g
                className="kb-pupil"
                style={{
                  transform: `translate(${pupilX}px, ${pupilY}px)`,
                  transition: 'transform 0.25s ease-out',
                }}
              >
                <circle cx="132" cy="74" r="6.5" fill={eyeColor} />
                <circle cx="132" cy="74" r="3" fill="#26262B" />
                <circle cx="134.2" cy="71.6" r="1.7" fill="#FFFFFF" />
              </g>
            </g>
          </g>

          {/* Nose: one soft curve, Pixar-minimal */}
          <path d="M 107 84 Q 104 92 110 94" fill="none" stroke={skinShadow} strokeWidth="2.2" strokeLinecap="round" />

          {/* Mouth: a single morphing path. Teeth and tongue are clipped to the
              mouth outline so they never spill outside the lips at any openness. */}
          <g className="kb-mouth">
            <path d={mouthPath(pose.mouthOpen)} fill="#7C3A43" />
            <g clipPath={`url(#${mouthClipId})`}>
              {/* Upper teeth appear as the mouth opens */}
              {pose.mouthOpen > 0.15 && <rect x="96" y="103" width="28" height="6.5" rx="2" fill="#FDFDFB" />}
              {/* Tongue peeks in when wide open */}
              {pose.mouthOpen > 0.45 && <ellipse cx="110" cy="118" rx="10" ry="7" fill="#B05A60" />}
            </g>
          </g>

          {/* Hair — three styles, all "very short" variations */}
          <g className="kb-hair">
            {hairStyle === 'short' && (
              <>
                <path
                  d="M 61 76 C 59 36 84 19 110 19 C 136 19 161 36 159 76 C 158 80 154 80 153 75 C 153 52 136 42 110 42 C 84 42 67 52 67 75 C 66 80 62 80 61 76 Z"
                  fill={hairColor}
                />
                {/* A few cropped-texture flicks at the front hairline */}
                <path d="M 92 42 L 90 48" stroke={hairShadow} strokeWidth="2.5" strokeLinecap="round" />
                <path d="M 104 40 L 103 47" stroke={hairShadow} strokeWidth="2.5" strokeLinecap="round" />
                <path d="M 117 40 L 118 47" stroke={hairShadow} strokeWidth="2.5" strokeLinecap="round" />
                <path d="M 129 43 L 131 49" stroke={hairShadow} strokeWidth="2.5" strokeLinecap="round" />
              </>
            )}
            {hairStyle === 'buzz' && (
              <path
                d="M 62 70 C 62 34 86 20 110 20 C 134 20 158 34 158 70 C 157 74 154 74 153 70 C 151 46 134 36 110 36 C 86 36 69 46 67 70 C 66 74 63 74 62 70 Z"
                fill={hairColor}
                opacity="0.88"
              />
            )}
            {hairStyle === 'side-part' && (
              <>
                <path
                  d="M 61 76 C 59 36 84 19 110 19 C 136 19 161 36 159 76 C 158 80 154 80 153 75 C 153 50 138 41 112 41 C 108 41 98 44 94 48 C 88 52 70 56 67 75 C 66 80 62 80 61 76 Z"
                  fill={hairColor}
                />
                {/* The part line */}
                <path d="M 95 47 C 99 43 105 41 112 41" fill="none" stroke={hairShadow} strokeWidth="2" strokeLinecap="round" />
              </>
            )}
          </g>

          {/* Glasses: round frames, part of the head so they tilt with it */}
          {glasses && (
            <g className="kb-glasses">
              <circle cx="88" cy="73" r="17" fill="none" stroke="#2A2A2E" strokeWidth="2.5" />
              <circle cx="132" cy="73" r="17" fill="none" stroke="#2A2A2E" strokeWidth="2.5" />
              <path d="M 105 71 Q 110 67 115 71" fill="none" stroke="#2A2A2E" strokeWidth="2.5" />
              <path d="M 71 70 L 62 67" stroke="#2A2A2E" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 149 70 L 158 67" stroke="#2A2A2E" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}
