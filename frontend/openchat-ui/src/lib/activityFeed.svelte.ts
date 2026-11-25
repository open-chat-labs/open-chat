// The activity feed's rules, the same wherever it's shown (ActivityPanel on the web, the native
// Activity tab): its item, the All / Mentions / Payments tabs, each tab's unread badge, the day
// headings, a row's tip chips, and marks read that show at once and roll back if the host rejects
// them.

import type { Tip as ActivityTip } from './components/ReactionChips.svelte';

export type { ActivityTip };

/** One entry of the feed (ActivityPanel re-exports it). */
export interface ActivityItem {
  id: string;
  /** Day heading the item sits under; consecutive items share it. */
  day: string;
  title: string;
  context: string;
  preview?: string;
  time: string;
  unread?: boolean;
  color?: 'violet' | 'blue' | 'teal' | 'amber' | 'plum';
  /** The person's own picture, over `color` (which shows while it loads, and without one). */
  avatarUrl?: string;
  kind?: 'user' | 'group';
  reactions?: string[];
  /** The tips the message got, a chip per token (a tip's item only). */
  tips?: ActivityTip[];
  /** Which tab besides All shows it; none (a poll vote) is under All only. */
  type?: 'reaction' | 'mention' | 'reply' | 'payment';
  /** Chat to open. */
  chatId: string;
  /** Message to land on. */
  messageId?: string;
}

/**
 * The tabs, in order, the same on the web and native: All, Mentions, Payments. Poll votes have no
 * tab of their own, only All (the user's decision, web L3, 2026-11-24).
 */
export const ACTIVITY_TABS = ['all', 'mention', 'payment'] as const;
export type ActivityTab = (typeof ACTIVITY_TABS)[number];

/** Each tab's label (resource keys), in `ACTIVITY_TABS` order. */
export const ACTIVITY_TAB_LABELS = ['ui.activityPanel.tabAll', 'ui.activityPanel.tabMentions', 'ui.activityPanel.tabPayments'];

/** The items a tab shows: everything under All, else the items of its type. */
export function activityTabItems(items: ActivityItem[], tab: number): ActivityItem[] {
  const type = ACTIVITY_TABS[tab];
  return type === 'all' ? items : items.filter((it) => it.type === type);
}

/** Each tab's unread count, in `ACTIVITY_TABS` order: null where there's none, so it has no badge. */
export function activityTabCounts(items: ActivityItem[], isUnread: (item: ActivityItem) => boolean): (number | null)[] {
  return ACTIVITY_TABS.map((_, tab) => activityTabItems(items, tab).filter(isUnread).length || null);
}

/** A row's tip chips: the first `max` (the row is one line in a narrow feed), and how many more. */
export function foldTips(tips: ActivityTip[], max = 4): { shown: ActivityTip[]; more: number } {
  return { shown: tips.slice(0, max), more: Math.max(0, tips.length - max) };
}

/** Whether the item at `index` of a tab's items starts a new day, so a heading goes above it. */
export function startsDay(shown: ActivityItem[], index: number): boolean {
  return index === 0 || shown[index - 1].day !== shown[index].day;
}

/**
 * The items marked read here until the host's items catch up: a mark shows at once, and rolls back
 * (with `failed` set) if the host's call rejects.
 */
export class ActivityReadMarks {
  #read = $state<string[]>([]);
  #failed = $state(false);

  /** The last mark was rolled back. Cleared when the next one starts. */
  get failed(): boolean {
    return this.#failed;
  }

  isUnread(item: ActivityItem): boolean {
    return !!item.unread && !this.#read.includes(item.id);
  }

  /** Marks these read now, and runs `call`; if it rejects, they're unread again. */
  async mark(ids: string[], call: () => Promise<unknown> | void): Promise<void> {
    const fresh = ids.filter((id) => !this.#read.includes(id));
    if (!fresh.length) return;
    this.#failed = false;
    this.#read = [...this.#read, ...fresh];
    try {
      await call();
    } catch {
      this.#read = this.#read.filter((id) => !fresh.includes(id));
      this.#failed = true;
    }
  }

  /** Opening an unread item marks it read (through `onMarkRead`). Settles when the mark has. */
  async open(item: ActivityItem, onMarkRead: ((ids: string[]) => Promise<unknown> | void) | undefined): Promise<void> {
    if (this.isUnread(item) && onMarkRead) await this.mark([item.id], () => onMarkRead([item.id]));
  }

  /**
   * "Mark all read": every unread item, through `onMarkAllRead`, else `onMarkRead` with their ids.
   * Settles when the mark has.
   */
  async markAll(
    items: ActivityItem[],
    onMarkAllRead: (() => Promise<unknown> | void) | undefined,
    onMarkRead: ((ids: string[]) => Promise<unknown> | void) | undefined,
  ): Promise<void> {
    const ids = items.filter((it) => this.isUnread(it)).map((it) => it.id);
    if (onMarkAllRead) await this.mark(ids, onMarkAllRead);
    else if (onMarkRead) await this.mark(ids, () => onMarkRead(ids));
  }
}
