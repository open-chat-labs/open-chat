import { describe, expect, test, vi } from 'vitest';
import type { ActivityItem } from './activityFeed.svelte';
import { ActivityReadMarks, activityTabCounts, activityTabItems, startsDay } from './activityFeed.svelte';

const item = (id: string, fields: Partial<ActivityItem> = {}): ActivityItem => ({
  id,
  day: 'Today',
  title: id,
  context: '',
  time: '',
  chatId: 'c',
  ...fields,
});

const items = [
  item('r', { type: 'reaction', unread: true }),
  item('m1', { type: 'mention', unread: true }),
  item('m2', { type: 'mention' }),
  item('p', { type: 'payment', day: 'Yesterday' }),
  item('v', { day: 'Yesterday', unread: true }),
];

describe('the activity tabs', () => {
  test('All shows everything; Mentions and Payments their type', () => {
    expect(activityTabItems(items, 0).map((i) => i.id)).toEqual(['r', 'm1', 'm2', 'p', 'v']);
    expect(activityTabItems(items, 1).map((i) => i.id)).toEqual(['m1', 'm2']);
    expect(activityTabItems(items, 2).map((i) => i.id)).toEqual(['p']);
  });

  test('a badge only on a tab with unread items', () => {
    expect(activityTabCounts(items, (i) => !!i.unread)).toEqual([3, 1, null]);
    expect(activityTabCounts(items, () => false)).toEqual([null, null, null]);
  });

  test('a day heading above the first item of each day', () => {
    expect(items.map((_, i) => startsDay(items, i))).toEqual([true, false, false, true, false]);
  });
});

describe('marks read', () => {
  test('show at once and stay when the host takes them', async () => {
    const marks = new ActivityReadMarks();
    const onMarkRead = vi.fn(() => Promise.resolve());
    marks.open(items[0], onMarkRead);
    expect(marks.isUnread(items[0])).toBe(false);
    expect(onMarkRead).toHaveBeenCalledWith(['r']);
    await Promise.resolve();
    expect(marks.isUnread(items[0])).toBe(false);
    expect(marks.failed).toBe(false);
  });

  test('roll back, and say so, when the host rejects them', async () => {
    const marks = new ActivityReadMarks();
    await marks.mark(['r', 'm1'], () => Promise.reject(new Error('no')));
    expect(marks.isUnread(items[0])).toBe(true);
    expect(marks.isUnread(items[1])).toBe(true);
    expect(marks.failed).toBe(true);
    await marks.mark(['r'], () => undefined);
    expect(marks.failed).toBe(false);
  });

  test('opening a read item marks nothing', () => {
    const marks = new ActivityReadMarks();
    const onMarkRead = vi.fn();
    marks.open(items[2], onMarkRead);
    expect(onMarkRead).not.toHaveBeenCalled();
  });

  test('Mark all read takes every unread item, through onMarkAllRead else onMarkRead', () => {
    const all = vi.fn();
    new ActivityReadMarks().markAll(items, all, undefined);
    expect(all).toHaveBeenCalledOnce();

    const marks = new ActivityReadMarks();
    const each = vi.fn();
    marks.markAll(items, undefined, each);
    expect(each).toHaveBeenCalledWith(['r', 'm1', 'v']);
    expect(items.some((i) => marks.isUnread(i))).toBe(false);
  });
});
