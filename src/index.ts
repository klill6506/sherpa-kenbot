export { KenBot } from './KenBot';
export type { KenBotProps, KenBotPosition } from './KenBot';

// The raw drawing is exported too so the demo playground (and any curious
// host app) can render him at any size with full pose control.
export { Character } from './character/Character';
export type { CharacterProps, CharacterPose } from './character/Character';
export { defaultAppearance, shade } from './character/appearance';
export type { CharacterAppearance, HairStyle } from './character/appearance';
