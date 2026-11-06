// The "@word" being typed in a text field, for a mention picker: where it starts, what's typed after the "@", and the
// text once one is picked.

import type { TextEdit } from './textEdit';

/** The "@word" that ends at the caret: an "@" at the start or after a space, then no space or "@". */
export interface MentionAt {
  /** Where its "@" is. */
  start: number;
  /** What's typed after the "@" ("" just after it). */
  query: string;
}

const MENTION_BEFORE_CARET = /(?:^|\s)@([^\s@]*)$/;

/** The "@word" being typed at the caret, if there's one. */
export function mentionAt(text: string, caret: number): MentionAt | undefined {
  const before = text.slice(0, caret);
  const m = MENTION_BEFORE_CARET.exec(before);
  if (!m) return undefined;
  return { start: caret - m[1].length - 1, query: m[1] };
}

/** "@handle " in place of the "@word" from `start` to the caret, the caret after its space. */
export function insertMention(text: string, start: number, caret: number, handle: string): TextEdit {
  const mention = `@${handle} `;
  // a space already after the word isn't doubled
  const rest = text.slice(caret);
  const after = rest.startsWith(' ') ? rest.slice(1) : rest;
  return { text: text.slice(0, start) + mention + after, caret: start + mention.length };
}
