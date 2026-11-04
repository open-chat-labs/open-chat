// Editing a text field's value at its selection, for typing that doesn't come from the keyboard (an emoji picker, a
// host's emoji panel and its delete key).

/** What an edit leaves: the new value and where the caret goes. */
export interface TextEdit {
  text: string;
  caret: number;
}

/** The value's characters as a reader sees them: an emoji with a skin tone, a flag or a family is one. */
function graphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

/** `insert` in place of the selection [start, end), the caret after it. */
export function insertAt(text: string, start: number, end: number, insert: string): TextEdit {
  return { text: text.slice(0, start) + insert + text.slice(end), caret: start + insert.length };
}

/** A delete key: the selection, or else the whole character (grapheme) before the caret. */
export function deleteBackward(text: string, start: number, end: number): TextEdit {
  if (start !== end) return { text: text.slice(0, start) + text.slice(end), caret: start };
  const before = graphemes(text.slice(0, start));
  before.pop();
  const head = before.join('');
  return { text: head + text.slice(end), caret: head.length };
}
