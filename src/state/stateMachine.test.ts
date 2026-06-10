import { describe, expect, it } from 'vitest';
import { KENBOT_STATES, TIMED_STATE_DURATIONS, reduce } from './stateMachine';

describe('reduce', () => {
  it('grants any requested state from idle', () => {
    for (const state of KENBOT_STATES) {
      expect(reduce('idle', { type: 'request', state })).toBe(state);
    }
  });

  it('grants requests from any state to any other (the chat flow can always interrupt)', () => {
    for (const from of KENBOT_STATES) {
      for (const to of KENBOT_STATES) {
        expect(reduce(from, { type: 'request', state: to })).toBe(to);
      }
    }
  });

  it('returns a timed state to idle when its own timer fires', () => {
    for (const state of ['greet', 'celebrate', 'point-left', 'point-right'] as const) {
      expect(reduce(state, { type: 'timeout', state })).toBe('idle');
    }
  });

  it('ignores a stale timer from an interrupted timed state', () => {
    // celebrate was interrupted by point-right; celebrate's timer fires late.
    expect(reduce('point-right', { type: 'timeout', state: 'celebrate' })).toBe('point-right');
    // greet was interrupted by talking; greet's timer must not stop the talking.
    expect(reduce('talking', { type: 'timeout', state: 'greet' })).toBe('talking');
  });

  it('never lets a timeout end a persistent state', () => {
    for (const state of ['idle', 'listening', 'thinking', 'talking', 'walking'] as const) {
      expect(reduce(state, { type: 'timeout', state })).toBe(state);
    }
  });
});

describe('TIMED_STATE_DURATIONS', () => {
  it('covers exactly the gesture states, all with positive durations', () => {
    expect(Object.keys(TIMED_STATE_DURATIONS).sort()).toEqual(
      ['celebrate', 'greet', 'point-left', 'point-right'].sort(),
    );
    for (const duration of Object.values(TIMED_STATE_DURATIONS)) {
      expect(duration).toBeGreaterThan(0);
    }
  });
});
