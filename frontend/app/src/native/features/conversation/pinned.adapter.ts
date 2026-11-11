import type { EventWrapper, Message } from "@client";
import { escapeMarkdown } from "@src/core/markdownRender";
import {
    messageAuthorName,
    messageText,
    type PreviewText,
} from "@src/logic/chats/latestMessagePreview";

// A chat's pinned messages (native plan 04, "Pinned messages"): the strip under the conversation's
// header, which goes through them newest first, and the Pinned messages screen, oldest first by
// day. Pins waiting out an unpin's Undo (the shell's PendingRemovals, under `unpinKey`) are left
// out of both.

/** A pin's key while its unpin waits out its Undo (PendingRemovals). */
export function unpinKey(chatKey: string, messageIndex: number): string {
    return `unpin:${chatKey}:${messageIndex}`;
}

/**
 * The pins the strip goes through, newest first. TODO(design): the plan orders them by when they
 * were pinned, which the backend doesn't send (only the pinned messages' indexes), so they go by
 * the message, the latest first (GAPS.md, "Native conversation").
 */
export function stripOrder(
    pinned: Iterable<number>,
    hidden: (messageIndex: number) => boolean,
): number[] {
    return [...pinned].filter((i) => !hidden(i)).sort((a, b) => b - a);
}

/** The pin the strip shows: the one it showed while it's still pinned, else the newest. */
export function stripCurrent(
    order: readonly number[],
    shown: number | undefined,
): number | undefined {
    return shown !== undefined && order.includes(shown) ? shown : order[0];
}

/** The pin after `messageIndex` (the next older one), round to the newest after the oldest. */
export function nextPin(order: readonly number[], messageIndex: number): number | undefined {
    if (order.length === 0) return undefined;
    const at = order.indexOf(messageIndex);
    return order[(at + 1) % order.length];
}

/** The strip's bar: a segment per pin, at most four, and which of them is the pin shown. */
export type StripBar = { segments: number; active: number };

export const STRIP_SEGMENTS = 4;

/**
 * The strip's bar for the pin at `position` (0, the newest) of `count`: past the fourth, the last
 * segment stays the current one as the bar moves on.
 */
export function stripBar(count: number, position: number): StripBar {
    const segments = Math.min(count, STRIP_SEGMENTS);
    return { segments, active: Math.max(0, Math.min(position, segments - 1)) };
}

/** A message's text as the strip's one line: its first line that has something on it. */
export function firstLine(text: string): string {
    return (
        text
            .split("\n")
            .map((line) => line.trim())
            .find((line) => line.length > 0) ?? ""
    );
}

/**
 * The strip's line, as markdown: "Author: first line", the message as the chat list previews one
 * (logic/chats/latestMessagePreview: restricted content as such, the reader's translation), the
 * author's name escaped so it shows as it is.
 */
export function stripLine(message: Message, names: PreviewText): string {
    const author = escapeMarkdown(messageAuthorName(message, names));
    return `${author}: ${firstLine(messageText(message, names))}`;
}

/**
 * What Unpin all unpins: every pin in the pinned set, the ones that didn't load too (deleted, out
 * of reach), less those already waiting to be unpinned. The pins the strip goes through.
 */
export function unpinAllIndexes(
    pinned: Iterable<number>,
    hidden: (messageIndex: number) => boolean,
): number[] {
    return stripOrder(pinned, hidden);
}

/**
 * The Pinned messages screen's days, oldest first, without the pins waiting to be unpinned (a day
 * left with none goes).
 */
export function shownDays(
    days: readonly EventWrapper<Message>[][],
    hidden: (messageIndex: number) => boolean,
): EventWrapper<Message>[][] {
    return days
        .map((day) => day.filter((evt) => !hidden(evt.event.messageIndex)))
        .filter((day) => day.length > 0);
}

/** Whether the Pinned messages screen offers Unpin all: to those who can pin, with two or more. */
export function offersUnpinAll(canPin: boolean, count: number): boolean {
    return canPin && count >= 2;
}

/** The pinned message's long-press menu: Go to message, and Unpin for those who can pin. */
export type PinnedMenuAction = "go_to" | "unpin";

export function pinnedMenuActions(canPin: boolean): PinnedMenuAction[] {
    return canPin ? ["go_to", "unpin"] : ["go_to"];
}
