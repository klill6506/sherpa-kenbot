export { KenBot } from './KenBot';
export type { KenBotProps, KenBotPosition, KenBotHandle } from './KenBot';

export { KENBOT_STATES, TIMED_STATE_DURATIONS } from './state/stateMachine';
export type { KenBotState } from './state/stateMachine';

// Backend plumbing: hosts usually just pass onAsk or askEndpoint props, but
// createEndpointAsk is exported for anyone composing their own ask function.
export { createEndpointAsk, toStream } from './chat/backend';
export type { AskFunction, AskResult, KenBotMessage } from './chat/backend';

// The raw drawing is exported too so the demo playground (and any curious
// host app) can render him at any size with full pose control.
export { Character } from './character/Character';
export type { CharacterProps, CharacterPose } from './character/Character';
export { defaultAppearance, shade } from './character/appearance';
export type { CharacterAppearance, HairStyle } from './character/appearance';
