import { describe, expect, it } from 'vitest';
import { pickInitialVoice } from './voices';

const MENU = [
  { id: 'ken', label: 'Ken' },
  { id: 'narrator', label: 'Narrator' },
];

describe('pickInitialVoice', () => {
  it('uses the saved pick when it is still on the menu', () => {
    expect(pickInitialVoice(MENU, 'narrator', 'ken')).toBe('narrator');
  });

  it('ignores a saved pick the host no longer offers', () => {
    // Voice lists change; a stale id would fail on every sentence.
    expect(pickInitialVoice(MENU, 'retired-voice', 'ken')).toBe('ken');
  });

  it("falls back to the host's default when nothing is saved", () => {
    expect(pickInitialVoice(MENU, null, 'narrator')).toBe('narrator');
  });

  it('falls back to the first voice when the default is not on the menu', () => {
    expect(pickInitialVoice(MENU, null, 'somebody-else')).toBe('ken');
  });

  it('trusts the voice prop when the host offers no menu at all', () => {
    expect(pickInitialVoice([], 'ignored', 'ken')).toBe('ken');
  });

  it('sends no voice at all when there is nothing to send', () => {
    // The server then uses whatever default it was configured with.
    expect(pickInitialVoice([], null, undefined)).toBeUndefined();
  });
});
