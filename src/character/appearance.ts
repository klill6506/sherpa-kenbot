/**
 * Everything about how KenBot *looks* (colors, hair, glasses) lives here,
 * separate from how he *moves* (that's the animation layer).
 * The demo control panel edits one of these objects live.
 */

export type HairStyle = 'short' | 'buzz' | 'side-part' | 'bun';

export interface CharacterAppearance {
  /** Base skin fill. Shading tones are derived from this automatically. */
  skinColor: string;
  hairColor: string;
  hairStyle: HairStyle;
  /** Iris color. */
  eyeColor: string;
  shirtColor: string;
  /** Colors the tie OR the collar bow, whichever `neckwear` selects. */
  tieColor: string;
  pantsColor: string;
  shoeColor: string;
  /** Round glasses. Ken settled on glasses-on during Phase 1 iteration. */
  glasses: boolean;
  /** Pens at the ready in a shirt-pocket protector. The CPA touch. */
  pocketProtector: boolean;
  /** Tie (Ken's default) or a soft collar bow. */
  neckwear?: 'tie' | 'bow';
  /** Round-crowned hat with a small flower. */
  hat?: boolean;
  hatColor?: string;
  /** A-line skirt over the legs; the legs beneath read as stockings. */
  skirt?: boolean;
  /** Defaults to pantsColor when the skirt is on. */
  skirtColor?: string;
  /** A furled umbrella resting in the left hand. */
  umbrella?: boolean;
  umbrellaColor?: string;
}

/**
 * Ken's default look, picked by Ken in the Phase 1 playground session:
 * light blond buzz cut, glasses, light blue short-sleeve shirt + black tie,
 * pocket protector with pens.
 */
export const defaultAppearance: CharacterAppearance = {
  skinColor: '#E1BA98',
  hairColor: '#E9D8A0',
  hairStyle: 'buzz',
  eyeColor: '#2B6597',
  shirtColor: '#A6C5E2',
  tieColor: '#23232B',
  pantsColor: '#3F4756',
  shoeColor: '#4D3A2C',
  glasses: true,
  pocketProtector: true,
  neckwear: 'tie',
  hat: false,
  skirt: false,
  umbrella: false,
};

/**
 * A prim-British-nanny look (Ken 2026-07-25, "Mary Poppins-ish" — an
 * original character in that spirit, not the film design): dark hair in
 * a bun under a navy flowered hat, cream blouse with a burgundy collar
 * bow, navy A-line skirt, and a furled umbrella in hand.
 */
export const nannyAppearance: CharacterAppearance = {
  skinColor: '#EAC3A2',
  hairColor: '#4A3628',
  hairStyle: 'bun',
  eyeColor: '#3E6B8F',
  shirtColor: '#F5F1E6',
  tieColor: '#8E2F3C',
  pantsColor: '#2E3448',
  shoeColor: '#2A2126',
  glasses: false,
  pocketProtector: false,
  neckwear: 'bow',
  hat: true,
  hatColor: '#26303B',
  skirt: true,
  skirtColor: '#31405C',
  umbrella: true,
  umbrellaColor: '#26303B',
};

/**
 * Darken or lighten a hex color by a fraction (-1..1). Positive = darker.
 * Used to derive shading (cheeks, brow color, neck shadow) from the base
 * colors so the control panel only needs one picker per feature.
 */
export function shade(hex: string, amount: number): string {
  const parsed = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!parsed) return hex; // unknown format — just use it as-is
  const num = parseInt(parsed[1], 16);
  const channel = (offset: number): number => {
    const value = (num >> offset) & 0xff;
    const moved = amount >= 0 ? value * (1 - amount) : value + (255 - value) * -amount;
    return Math.round(Math.min(255, Math.max(0, moved)));
  };
  const toHex = (value: number): string => value.toString(16).padStart(2, '0');
  return `#${toHex(channel(16))}${toHex(channel(8))}${toHex(channel(0))}`;
}
