import { describe, expect, it } from 'vitest';
import { createSentenceSplitter } from './sentences';

describe('createSentenceSplitter', () => {
  it('emits a sentence the moment its terminator + space arrives', () => {
    const splitter = createSentenceSplitter();
    expect(splitter.push('Hello there')).toEqual([]);
    expect(splitter.push('. How are')).toEqual(['Hello there.']);
    expect(splitter.push(' you? I am fine.')).toEqual(['How are you?']);
    // "I am fine." has no trailing whitespace yet — still buffered.
    expect(splitter.flush()).toBe('I am fine.');
  });

  it('handles several sentences arriving in one chunk', () => {
    const splitter = createSentenceSplitter();
    expect(splitter.push('One. Two! Three? Four')).toEqual(['One.', 'Two!', 'Three?']);
    expect(splitter.flush()).toBe('Four');
  });

  it('does not split decimals or version numbers', () => {
    const splitter = createSentenceSplitter();
    expect(splitter.push('The rate is 3.5% this year. Section 179 applies.')).toEqual([
      'The rate is 3.5% this year.',
    ]);
    expect(splitter.flush()).toBe('Section 179 applies.');
  });

  it('keeps closing quotes with their sentence', () => {
    const splitter = createSentenceSplitter();
    expect(splitter.push('He said "done." Then he left. ')).toEqual(['He said "done."', 'Then he left.']);
  });

  it('force-splits a long run-on at a word boundary so speech is not starved', () => {
    const splitter = createSentenceSplitter();
    const words = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ');
    const emitted = splitter.push(words);
    expect(emitted.length).toBeGreaterThan(0);
    // Forced splits land on word boundaries — no chopped words.
    expect(emitted[0].endsWith(' ')).toBe(false);
    expect(emitted[0].length).toBeLessThanOrEqual(280);
    // Nothing is lost between emitted parts and the remainder.
    const reassembled = [...emitted, splitter.flush() ?? ''].join(' ');
    expect(reassembled).toBe(words);
  });

  it('flush returns null when nothing is buffered', () => {
    const splitter = createSentenceSplitter();
    splitter.push('Complete. ');
    expect(splitter.flush()).toBeNull();
  });

  it('ignores whitespace-only fragments', () => {
    const splitter = createSentenceSplitter();
    expect(splitter.push('   ')).toEqual([]);
    expect(splitter.flush()).toBeNull();
  });
});
