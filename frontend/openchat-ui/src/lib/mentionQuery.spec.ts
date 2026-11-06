import { describe, expect, test } from 'vitest';
import { insertMention, mentionAt } from './mentionQuery';

describe('the "@word" being typed', () => {
  test('is what follows an "@" at the start or after a space, up to the caret', () => {
    expect(mentionAt('@al', 3)).toEqual({ start: 0, query: 'al' });
    expect(mentionAt('hi @al', 6)).toEqual({ start: 3, query: 'al' });
    expect(mentionAt('hi\n@', 4)).toEqual({ start: 3, query: '' });
    // the caret mid-word: what's before it
    expect(mentionAt('hi @alice there', 6)).toEqual({ start: 3, query: 'al' });
  });

  test('is none in an email address, after a space, or without an "@"', () => {
    expect(mentionAt('me@example', 10)).toBeUndefined();
    expect(mentionAt('@al ', 4)).toBeUndefined();
    expect(mentionAt('hello', 5)).toBeUndefined();
    expect(mentionAt('@@', 2)).toBeUndefined();
  });
});

describe('a mention picked', () => {
  test('takes the place of the "@word", followed by a space', () => {
    expect(insertMention('hi @al', 3, 6, 'alice')).toEqual({ text: 'hi @alice ', caret: 10 });
    expect(insertMention('@ and more', 0, 1, 'bob')).toEqual({ text: '@bob and more', caret: 5 });
  });

  test('keeps the text after the caret', () => {
    expect(insertMention('hi @al!', 3, 6, 'alice')).toEqual({ text: 'hi @alice !', caret: 10 });
  });
});
