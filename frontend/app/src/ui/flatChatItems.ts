import type { ChatEvent, EventWrapper, TimelineItem } from "@client";

// Flat, individually-keyed representation of the chat timeline for
// virtualisation. items[0] = newest (visual bottom in column-reverse).
//
// Keys must be stable identities that survive index shifts when messages are
// prepended/appended — the virtual list keys measured heights by them.

export type FlatChatDate = {
    kind: "timeline_date";
    key: string;
    timestamp: bigint;
};

// Placeholder rendered at the oldest end of the list (e.g. the chat avatar)
// once the earliest events have been loaded.
export type FlatChatStart = {
    kind: "chat_start";
    key: string;
};

export type FlatChatEvent<T extends ChatEvent = ChatEvent> = {
    kind: "event";
    key: string;
    event: EventWrapper<T>;
    // first in the user group == visually at the top of the group
    first: boolean;
    // last in the user group == visually at the bottom of the group
    last: boolean;
};

export type FlatChatItem<T extends ChatEvent = ChatEvent> =
    | FlatChatDate
    | FlatChatStart
    | FlatChatEvent<T>;

// The key must be per-chat: the virtual list's key→height cache survives item
// replacement, and the chat-start row's height varies per chat (avatar, name,
// description) — a shared key would seed the new chat's estimate with the
// previous chat's height.
export function chatStartItem(chatKey: string): FlatChatStart {
    return { kind: "chat_start", key: `chat_start_${chatKey}` };
}

export function eventKey(e: EventWrapper<ChatEvent>): string {
    return e.event.kind === "message" ? `${e.index}_${e.event.messageId}` : e.index.toString();
}

// Date keys must be per-day, not per-timestamp: a TimelineDate's timestamp is
// that of the newest event of the day, which changes as new messages arrive.
function dateKey(timestamp: bigint): string {
    const d = new Date(Number(timestamp));
    return `date_${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Flatten the output of client.groupEvents into individually-keyed items for
 * the virtual list, preserving order (newest first) and computing the
 * first/last-in-group flags that the nested {#each} loops used to derive.
 */
export function flattenTimeline<T extends ChatEvent>(
    timeline: TimelineItem<T>[],
): FlatChatItem<T>[] {
    const result: FlatChatItem<T>[] = [];
    for (const item of timeline) {
        if (item.kind === "timeline_date") {
            result.push({
                kind: "timeline_date",
                key: dateKey(item.timestamp),
                timestamp: item.timestamp,
            });
        } else {
            for (const group of item.group) {
                for (let i = 0; i < group.length; i++) {
                    result.push({
                        kind: "event",
                        key: eventKey(group[i]),
                        event: group[i],
                        first: i + 1 === group.length,
                        last: i === 0,
                    });
                }
            }
        }
    }
    return result;
}
