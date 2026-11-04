import { describe, expect, test } from 'vitest';
import { deleteBackward, insertAt } from './textEdit';

describe('insertAt', () => {
  test('replaces the selection, the caret after the insert', () => {
    expect(insertAt('hello world', 6, 11, '🙂')).toEqual({ text: 'hello 🙂', caret: 8 });
    expect(insertAt('ab', 1, 1, 'X')).toEqual({ text: 'aXb', caret: 2 });
  });
});

describe('deleteBackward', () => {
  test('deletes the selection when there is one', () => {
    expect(deleteBackward('hello world', 0, 6)).toEqual({ text: 'world', caret: 0 });
  });

  test('deletes the whole emoji before the caret: skin tone, flag, family', () => {
    for (const emoji of ['👍🏽', '🇵🇹', '👨‍👩‍👧']) {
      const text = `hi ${emoji}`;
      expect(deleteBackward(text, text.length, text.length)).toEqual({ text: 'hi ', caret: 3 });
    }
  });

  test('deletes one plain character, keeping what follows the caret', () => {
    expect(deleteBackward('abc', 2, 2)).toEqual({ text: 'ac', caret: 1 });
  });

  test('does nothing at the start', () => {
    expect(deleteBackward('abc', 0, 0)).toEqual({ text: 'abc', caret: 0 });
  });
});
