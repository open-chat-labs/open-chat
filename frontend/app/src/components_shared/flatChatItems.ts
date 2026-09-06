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
            result.push(dateItem(item.timestamp));
        } else {
            pushGroup(result, item.group);
        }
    }
    return result;
}

function dateItem<T extends ChatEvent>(timestamp: bigint): FlatChatItem<T> {
    return { kind: "timeline_date", key: dateKey(timestamp), timestamp };
}

function eventItem<T extends ChatEvent>(
    event: EventWrapper<T>,
    first: boolean,
    last: boolean,
): FlatChatEvent<T> {
    return { kind: "event", key: eventKey(event), event, first, last };
}

function pushGroup<T extends ChatEvent>(result: FlatChatItem<T>[], groups: EventWrapper<T>[][]) {
    for (const group of groups) {
        for (let i = 0; i < group.length; i++) {
            result.push(eventItem(group[i], i + 1 === group.length, i === 0));
        }
    }
}

// Memoising wrapper around `flattenTimeline`. One instance per list.
//
// Paired with TimelineGrouper: after a cosmetic update the new timeline shares
// every untouched item/group with the previous one, so the flat rows for those
// can be reused as-is. Rows whose identity is preserved are not re-rendered by
// the keyed {#each} downstream. Always returns a new array.
export class TimelineFlattener<T extends ChatEvent = ChatEvent> {
    #prevTimeline: TimelineItem<T>[] = [];
    #prevFlat: FlatChatItem<T>[] = [];

    flatten(timeline: TimelineItem<T>[]): FlatChatItem<T>[] {
        const prevTimeline = this.#prevTimeline;
        const prevFlat = this.#prevFlat;
        const result: FlatChatItem<T>[] = [];
        // Walk both timelines in lockstep; `offset` tracks where the previous
        // item's rows start in prevFlat.
        let offset = 0;
        for (let t = 0; t < timeline.length; t++) {
            const item = timeline[t];
            const prevItem = t < prevTimeline.length ? prevTimeline[t] : undefined;
            const prevLen = prevItem === undefined ? 0 : flatLength(prevItem);
            if (item === prevItem) {
                for (let i = 0; i < prevLen; i++) result.push(prevFlat[offset + i]);
            } else if (item.kind === "timeline_date") {
                result.push(dateItem(item.timestamp));
            } else if (prevItem?.kind === "timeline_event_group" && prevLen === flatLength(item)) {
                // Same shape (the grouper patched wrappers in place): reuse
                // rows whose wrapper and flags are unchanged.
                let i = 0;
                for (const group of item.group) {
                    for (let g = 0; g < group.length; g++, i++) {
                        const first = g + 1 === group.length;
                        const last = g === 0;
                        const prev = prevFlat[offset + i];
                        result.push(
                            prev.kind === "event" &&
                                prev.event === group[g] &&
                                prev.first === first &&
                                prev.last === last
                                ? prev
                                : eventItem(group[g], first, last),
                        );
                    }
                }
            } else {
                pushGroup(result, item.group);
            }
            offset += prevLen;
        }
        this.#prevTimeline = timeline;
        this.#prevFlat = result;
        return result;
    }
}

function flatLength<T extends ChatEvent>(item: TimelineItem<T>): number {
    if (item.kind === "timeline_date") return 1;
    let n = 0;
    for (const group of item.group) n += group.length;
    return n;
}
