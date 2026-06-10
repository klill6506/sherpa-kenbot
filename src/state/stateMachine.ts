/**
 * The animation state machine — deliberately tiny and 100% pure so it's easy
 * to unit test. No React, no timers in here: just "given the current state and
 * an event, what's the next state?". The timers live in useKenBotState.
 *
 * Two kinds of states:
 * - Persistent: idle, listening, thinking, talking. They hold until something
 *   (the chat flow, the host app, a demo button) requests a change.
 * - Timed: greet, celebrate, point-left, point-right. They play a gesture and
 *   automatically fall back to idle when their timer fires.
 */

export const KENBOT_STATES = [
  'idle',
  'greet',
  'listening',
  'thinking',
  'talking',
  'celebrate',
  'point-left',
  'point-right',
] as const;

export type KenBotState = (typeof KENBOT_STATES)[number];

/** How long each timed state plays before falling back to idle (ms). */
export const TIMED_STATE_DURATIONS: Readonly<Partial<Record<KenBotState, number>>> = {
  greet: 2200,
  celebrate: 2600,
  'point-left': 3000,
  'point-right': 3000,
};

export type KenBotEvent =
  | { type: 'request'; state: KenBotState } // someone asked for a state
  | { type: 'timeout'; state: KenBotState }; // a timed state's timer fired

/**
 * The whole machine. The one subtle rule: a timeout only matters if we're
 * still IN the state that scheduled it. If a celebrate was interrupted by a
 * point-right, the celebrate's late timer must not yank us out of pointing —
 * that's the "stale timer" case the tests pin down.
 */
export function reduce(current: KenBotState, event: KenBotEvent): KenBotState {
  switch (event.type) {
    case 'request':
      return event.state;
    case 'timeout':
      return current === event.state && event.state in TIMED_STATE_DURATIONS ? 'idle' : current;
  }
}
