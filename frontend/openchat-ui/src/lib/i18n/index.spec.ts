import { describe, expect, test } from 'vitest';
import { dictionaryTranslator, durationText, interpolate, lookup, segments } from './index';

describe('interpolate', () => {
  test('simple placeholders', () => expect(interpolate('Hello {name}!', { name: 'Ada' })).toBe('Hello Ada!'));
  test('unknown placeholders are kept', () => expect(interpolate('Hello {name}')).toBe('Hello {name}'));

  test('plural with exact, category and #', () => {
    const msg = '{n, plural, =0 {none} one {# item} other {# items}}';
    expect(interpolate(msg, { n: 0 })).toBe('none');
    expect(interpolate(msg, { n: 1 })).toBe('1 item');
    expect(interpolate(msg, { n: 1234 })).toBe('1,234 items');
  });

  test('plural # follows the locale', () => expect(interpolate('{n, plural, other {# x}}', { n: 1234.5 }, 'de')).toBe('1.234,5 x'));

  test('select', () => {
    const msg = '{g, select, a {Alpha} other {Other}} end';
    expect(interpolate(msg, { g: 'a' })).toBe('Alpha end');
    expect(interpolate(msg, { g: 'z' })).toBe('Other end');
  });

  // malformed messages must never hang the tab
  test.each([
    ['Hello {name', 'Hello {name'],
    ['{ broken', '{ broken'],
    ['a } b {x}', 'a } b 1'],
  ])('malformed %j', (msg, out) => expect(interpolate(msg, { name: 'A', x: 1 })).toBe(out));

  test('unclosed plural terminates', () => expect(typeof interpolate('x {n, plural, one {', { n: 1 })).toBe('string'));
});

describe('lookup and dictionaryTranslator', () => {
  const dict = { ui: { greet: 'Hi {name}', nested: { deep: 'Deep' } } };
  test('nested keys', () => expect(lookup(dict, 'ui.nested.deep')).toBe('Deep'));
  test('missing key', () => expect(lookup(dict, 'ui.nope')).toBeUndefined());

  test('translator falls back to the key (literal text passes through)', () => {
    const { t } = dictionaryTranslator(dict);
    expect(t('ui.greet', { name: 'Bo' })).toBe('Hi Bo');
    expect(t('Plain text')).toBe('Plain text');
  });
});

describe('segments', () => {
  const { t } = dictionaryTranslator({ ui: { sent: 'Sent to {who} just now', two: '{a} and {b}' } });

  test('splits around slot placeholders', () =>
    expect(segments(t, 'ui.sent', ['who'])).toEqual([{ text: 'Sent to ' }, { slot: 'who' }, { text: ' just now' }]));

  test('keeps slot order as translated', () => expect(segments(t, 'ui.two', ['b', 'a'])).toEqual([{ slot: 'a' }, { text: ' and ' }, { slot: 'b' }]));

  test('no slots is one text segment', () => expect(segments(t, 'ui.sent', [], { who: 'Al' })).toEqual([{ text: 'Sent to Al just now' }]));
});

describe('durationText', () => {
  const { t } = dictionaryTranslator({ ui: { duration: { hours: '{count, plural, one {# hour} other {# hours}}' } } });
  test('duration ids translate', () => expect(durationText(t, '12 hours')).toBe('12 hours'));
  test('singular', () => expect(durationText(t, '1 hour')).toBe('1 hour'));
  test('other values pass through t()', () => expect(durationText(t, 'Forever')).toBe('Forever'));
});
