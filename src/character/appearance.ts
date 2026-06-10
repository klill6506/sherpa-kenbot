/**
 * Everything about how KenBot *looks* (colors, hair, glasses) lives here,
 * separate from how he *moves* (that's the animation layer).
 * The demo control panel edits one of these objects live.
 */

export type HairStyle = 'short' | 'buzz' | 'side-part';

export interface CharacterAppearance {
  /** Base skin fill. Shading tones are derived from this automatically. */
  skinColor: string;
  hairColor: string;
  hairStyle: HairStyle;
  /** Iris color. */
  eyeColor: string;
  shirtColor: string;
  tieColor: string;
  pantsColor: string;
  shoeColor: string;
  /** Ken doesn't wear glasses, but the toggle exists for experimenting. */
  glasses: boolean;
  /** Pens at the ready in a shirt-pocket protector. The CPA touch. */
  pocketProtector: boolean;
}

/** Ken's default look: light blond very short hair, no glasses, white shirt + black tie. */
export const defaultAppearance: CharacterAppearance = {
  skinColor: '#F3C9A4',
  hairColor: '#E9D8A0',
  hairStyle: 'short',
  eyeColor: '#5B7C99',
  shirtColor: '#FBFBF8',
  tieColor: '#23232B',
  pantsColor: '#3F4756',
  shoeColor: '#4D3A2C',
  glasses: false,
  pocketProtector: true,
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
