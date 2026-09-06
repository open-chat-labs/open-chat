// Characterisation tests for the event-merging hot paths that run on every
// chat load / poll cycle. They pin down CURRENT behaviour so that performance
// work on these functions can be verified not to change results.
import {
    MessageMap,
    type ChatEvent,
    type EventWrapper,
    type Message,
    type MessageContext,
    type MessageFilter,
} from "@shared";
import DRange from "drange";
import { MessageLocalUpdates } from "../state/message/localUpdates";
import {
    groupEvents,
    TimelineGrouper,
    mergeEventsAndLocalUpdates,
    mergeEventsAndLocalUpdatesWithRange,
    mergeServerEvents,
    subrangesCover,
    updateExistingMessages,
} from "./chat";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
BigInt.prototype.toJSON = function () {
    return this.toString();
};

const ctx: MessageContext = { chatId: { kind: "group_chat", groupId: "abc" } };
const DAY = 24 * 60 * 60 * 1000;
const BASE = 1_700_000_000_000;

function msg(
    index: number,
    sender = "u1",
    text = `msg ${index}`,
    extra: Partial<Message> = {},
): Message {
    return {
        kind: "message",
        messageId: BigInt(index),
        messageIndex: index,
        sender,
        content: { kind: "text_content", text },
        reactions: [],
        tips: {},
        edited: false,
        forwarded: false,
        deleted: false,
        blockLevelMarkdown: false,
        ogPreviews: [],
        messagePreviews: [],
        ...extra,
    };
}

function ev<T extends ChatEvent>(
    index: number,
    event: T,
    timestamp = BASE + index * 1000,
): EventWrapper<T> {
    return { index, event, timestamp: BigInt(timestamp) };
}

function msgEv(index: number, sender = "u1", timestamp?: number): EventWrapper<Message> {
    return ev(index, msg(index, sender), timestamp);
}

function indexes(events: EventWrapper<ChatEvent>[]): number[] {
    return events.map((e) => e.index);
}

describe("mergeServerEvents", () => {
    test("dedupes by event index, new events win, result sorted by timestamp then index", () => {
        const existing = [msgEv(1), msgEv(2), msgEv(3)];
        const incoming = [ev(2, msg(2, "u1", "edited 2")), msgEv(4)];
        const merged = mergeServerEvents(existing, incoming, ctx);
        expect(indexes(merged)).toEqual([1, 2, 3, 4]);
        expect((merged[1].event as Message).content).toEqual({
            kind: "text_content",
            text: "edited 2",
        });
    });

    test("sorts by timestamp before index", () => {
        const existing = [msgEv(1, "u1", BASE + 5000)];
        const incoming = [msgEv(2, "u1", BASE + 1000)];
        expect(indexes(mergeServerEvents(existing, incoming, ctx))).toEqual([2, 1]);
    });

    test("does not mutate inputs when no reply contexts are affected", () => {
        const existing = [msgEv(1), msgEv(2)];
        const incoming = [msgEv(3)];
        const snapExisting = JSON.stringify(existing);
        const snapIncoming = JSON.stringify(incoming);
        mergeServerEvents(existing, incoming, ctx);
        expect(JSON.stringify(existing)).toBe(snapExisting);
        expect(JSON.stringify(incoming)).toBe(snapIncoming);
    });

    test("updates rehydrated reply contexts from the incoming events", () => {
        const replyTarget = ev(1, msg(1, "u2", "original"));
        const replier = ev(
            2,
            msg(2, "u1", "reply", {
                repliesTo: {
                    kind: "rehydrated_reply_context",
                    content: { kind: "text_content", text: "original" },
                    senderId: "u2",
                    messageId: 1n,
                    messageIndex: 1,
                    eventIndex: 1,
                    edited: false,
                    isThreadRoot: false,
                    sourceContext: ctx,
                },
            }),
        );
        const existing = [replyTarget, replier];
        const incoming = [ev(1, msg(1, "u2", "edited original", { edited: true }))];
        const merged = mergeServerEvents(existing, incoming, ctx);
        const r = (merged[1].event as Message).repliesTo;
        expect(r?.kind).toBe("rehydrated_reply_context");
        if (r?.kind === "rehydrated_reply_context") {
            expect(r.content).toEqual({ kind: "text_content", text: "edited original" });
            expect(r.edited).toBe(true);
        }
        // NOTE: current behaviour — the caller's array slot is replaced in place
        // (updateReplyContexts assigns events[i]); the original wrapper object
        // itself is untouched.
        expect(existing[1]).toBe(merged[1]);
        expect((replier.event as Message).repliesTo).toMatchObject({
            content: { kind: "text_content", text: "original" },
            edited: false,
        });
    });

    test("does not update reply contexts from a different source context", () => {
        const replier = ev(
            2,
            msg(2, "u1", "reply", {
                repliesTo: {
                    kind: "rehydrated_reply_context",
                    content: { kind: "text_content", text: "original" },
                    senderId: "u2",
                    messageId: 1n,
                    messageIndex: 1,
                    eventIndex: 1,
                    edited: false,
                    isThreadRoot: false,
                    sourceContext: { chatId: { kind: "group_chat", groupId: "other" } },
                },
            }),
        );
        const merged = mergeServerEvents([replier], [ev(1, msg(1, "u2", "edited"))], ctx);
        const r = (merged[1].event as Message).repliesTo;
        if (r?.kind === "rehydrated_reply_context") {
            expect(r.content).toEqual({ kind: "text_content", text: "original" });
        }
    });
});

describe("updateExistingMessages", () => {
    test("replaces message events in place by message index, returns same array", () => {
        const events: EventWrapper<ChatEvent>[] = [
            msgEv(1),
            ev(2, { kind: "member_joined", userId: "u9" }),
            msgEv(3),
        ];
        const out = updateExistingMessages(events, [ev(3, msg(3, "u1", "updated 3"))]);
        expect(out).toBe(events);
        expect((events[2].event as Message).content).toEqual({
            kind: "text_content",
            text: "updated 3",
        });
        expect((events[0].event as Message).content).toEqual({
            kind: "text_content",
            text: "msg 1",
        });
        expect(events[1].event.kind).toBe("member_joined");
    });
});

describe("mergeEventsAndLocalUpdates", () => {
    const noFilters: MessageFilter[] = [];

    function run(
        events: EventWrapper<ChatEvent>[],
        unconfirmed: EventWrapper<Message>[] = [],
        updates = new MessageMap<MessageLocalUpdates>(),
        expired = new DRange(),
        blocked = new Set<string>(),
        recentlySent = new MessageMap<bigint>(),
        translations = new MessageMap<string>(),
    ) {
        return mergeEventsAndLocalUpdates(
            events,
            unconfirmed,
            expired,
            translations,
            blocked,
            updates,
            recentlySent,
            noFilters,
        );
    }

    test("returns the same event objects when there is nothing to apply", () => {
        const events = [msgEv(1), msgEv(2)];
        const out = run(events);
        expect(out).not.toBe(events);
        expect(out[0]).toBe(events[0]);
        expect(out[1]).toBe(events[1]);
    });

    test("applies local edit without mutating the source event", () => {
        const events = [msgEv(1)];
        const u = new MessageLocalUpdates();
        u.editedContent = { kind: "text_content", text: "edited" };
        const updates = new MessageMap<MessageLocalUpdates>([[1n, u]]);
        const out = run(events, [], updates);
        expect(out[0]).not.toBe(events[0]);
        expect((out[0].event as Message).content).toEqual({ kind: "text_content", text: "edited" });
        expect((events[0].event as Message).content).toEqual({
            kind: "text_content",
            text: "msg 1",
        });
    });

    test("applies local delete", () => {
        const u = new MessageLocalUpdates();
        u.deleted = { deletedBy: "u1", timestamp: 5n };
        const out = run([msgEv(1)], [], new MessageMap([[1n, u]]));
        const m = out[0].event as Message;
        expect(m.deleted).toBe(true);
        expect(m.content.kind).toBe("deleted_content");
    });

    test("applies translation", () => {
        const out = run(
            [msgEv(1)],
            [],
            undefined,
            undefined,
            undefined,
            undefined,
            new MessageMap([[1n, "bonjour"]]),
        );
        expect((out[0].event as Message).content).toMatchObject({
            kind: "text_content",
            text: "bonjour",
        });
    });

    test("hides messages from blocked senders", () => {
        const out = run([msgEv(1, "bad")], [], undefined, undefined, new Set(["bad"]));
        const m = out[0].event as Message;
        expect(m.content.kind).toBe("blocked_content");
    });

    test("appends contiguous unconfirmed messages and sorts them in", () => {
        const events = [msgEv(1), msgEv(2)];
        const unconfirmed = [msgEv(3, "me", BASE + 3000)];
        const out = run(events, unconfirmed);
        expect(indexes(out)).toEqual([1, 2, 3]);
    });

    test("drops non-contiguous unconfirmed messages", () => {
        const events = [msgEv(1), msgEv(2)];
        const unconfirmed = [msgEv(10, "me")];
        expect(indexes(run(events, unconfirmed))).toEqual([1, 2]);
    });

    test("drops unconfirmed messages that are already confirmed", () => {
        const events = [msgEv(1), msgEv(2)];
        const unconfirmed = [ev(2, msg(2, "me"))];
        expect(indexes(run(events, unconfirmed))).toEqual([1, 2]);
        expect(run(events, unconfirmed)).toHaveLength(2);
    });

    test("includes first unconfirmed message in an empty chat", () => {
        expect(indexes(run([], [msgEv(1, "me"), msgEv(0, "me")]))).toEqual([0, 1]);
    });

    test("treats expired ranges as loaded for contiguity", () => {
        const expired = new DRange(1, 5);
        const out = run([], [msgEv(6, "me")], undefined, expired);
        expect(indexes(out)).toEqual([6]);
    });

    test("orders unconfirmed messages using recently-sent local timestamps", () => {
        const confirmed = msgEv(1, "me", BASE + 10_000); // server timestamp later than local
        const unconfirmed = msgEv(2, "me", BASE + 2_000);
        const recentlySent = new MessageMap<bigint>([
            [1n, BigInt(BASE + 1_000)],
            [2n, BigInt(BASE + 2_000)],
        ]);
        const out = run([confirmed], [unconfirmed], undefined, undefined, undefined, recentlySent);
        expect(indexes(out)).toEqual([1, 2]);
        // without the overrides the raw timestamps would order them the other way
        const out2 = run([confirmed], [unconfirmed]);
        expect(indexes(out2)).toEqual([2, 1]);
    });

    test("sorts the unconfirmed input array in place", () => {
        const unconfirmed = [msgEv(3, "me"), msgEv(2, "me")];
        run([msgEv(1)], unconfirmed);
        expect(indexes(unconfirmed)).toEqual([2, 3]);
    });

    test("snapshot of a mixed merge", () => {
        const events: EventWrapper<ChatEvent>[] = [
            msgEv(1, "u1"),
            ev(2, { kind: "member_joined", userId: "u2" }),
            msgEv(3, "u2"),
            msgEv(4, "bad"),
        ];
        const u = new MessageLocalUpdates();
        u.reactions = [{ reaction: "👍", kind: "add", userId: "me" }];
        const updates = new MessageMap<MessageLocalUpdates>([[3n, u]]);
        const out = run(events, [msgEv(5, "me")], updates, undefined, new Set(["bad"]));
        expect(out).toMatchSnapshot();
    });
});

describe("groupEvents", () => {
    test("groups by day then by sender, emitting group then date marker", () => {
        const events: EventWrapper<ChatEvent>[] = [
            msgEv(1, "u1", BASE),
            msgEv(2, "u1", BASE + 1000),
            msgEv(3, "u2", BASE + 2000),
            msgEv(4, "u2", BASE + DAY),
        ];
        const timeline = groupEvents(events, "me", false, new Set());
        expect(timeline.map((t) => t.kind)).toEqual([
            "timeline_event_group",
            "timeline_date",
            "timeline_event_group",
            "timeline_date",
        ]);
        const day1 = timeline[0];
        if (day1.kind === "timeline_event_group") {
            expect(day1.group.map(indexes)).toEqual([[1, 2], [3]]);
        }
        const day2 = timeline[2];
        if (day2.kind === "timeline_event_group") {
            expect(day2.group.map(indexes)).toEqual([[4]]);
        }
    });

    test("aggregates joined/left events into a single aggregate event", () => {
        const events: EventWrapper<ChatEvent>[] = [
            msgEv(1, "u1", BASE),
            ev(2, { kind: "member_joined", userId: "a" }, BASE + 1),
            ev(3, { kind: "member_joined", userId: "b" }, BASE + 2),
            ev(4, { kind: "member_left", userId: "a" }, BASE + 3),
            msgEv(5, "u1", BASE + 4),
        ];
        const timeline = groupEvents(events, "me", false, new Set());
        expect(timeline).toMatchSnapshot();
    });

    test("does not mutate the input array", () => {
        const events: EventWrapper<ChatEvent>[] = [
            msgEv(1, "u1", BASE),
            ev(2, { kind: "member_joined", userId: "a" }, BASE + 1),
        ];
        const snap = JSON.stringify(events);
        groupEvents(events, "me", false, new Set());
        expect(JSON.stringify(events)).toBe(snap);
    });

    test("iterateBackwards produces exactly what reversing the input would", () => {
        const events: EventWrapper<ChatEvent>[] = [
            msgEv(1, "u1", BASE),
            ev(2, { kind: "member_joined", userId: "a" }, BASE + 1),
            ev(3, { kind: "member_left", userId: "b" }, BASE + 2),
            ev(4, { kind: "message_pinned", pinnedBy: "u1", messageIndex: 1 }, BASE + 3),
            msgEv(5, "u2", BASE + 4),
            msgEv(6, "u2", BASE + DAY),
            ev(7, { kind: "member_joined", userId: "c" }, BASE + DAY + 1),
            msgEv(8, "u1", BASE + DAY + 2),
        ];
        for (const isPublic of [false, true]) {
            const expected = groupEvents([...events].reverse(), "me", isPublic, new Set());
            const actual = groupEvents(events, "me", isPublic, new Set(), undefined, true);
            expect(actual).toEqual(expected);
        }
        expect(groupEvents(events, "me", false, new Set(), undefined, false)).toEqual(
            groupEvents(events, "me", false, new Set()),
        );
        expect(groupEvents([], "me", false, new Set(), undefined, true)).toEqual([]);
    });
});

describe("mergeEventsAndLocalUpdates fast path", () => {
    const noFilters: MessageFilter[] = [];
    const replyCtx = {
        kind: "rehydrated_reply_context" as const,
        content: { kind: "text_content" as const, text: "original" },
        senderId: "u2",
        messageId: 1n,
        messageIndex: 1,
        eventIndex: 1,
        edited: false,
        isThreadRoot: false,
        sourceContext: ctx,
    };

    function run(
        events: EventWrapper<ChatEvent>[],
        unconfirmed: EventWrapper<Message>[] = [],
        blocked = new Set<string>(),
        updates = new MessageMap<MessageLocalUpdates>(),
    ) {
        return mergeEventsAndLocalUpdates(
            events,
            unconfirmed,
            new DRange(),
            new MessageMap<string>(),
            blocked,
            updates,
            new MessageMap<bigint>(),
            noFilters,
        );
    }

    test("returns identical references for messages with reply contexts when nothing applies", () => {
        const events: EventWrapper<ChatEvent>[] = [
            msgEv(1, "u2"),
            ev(2, msg(2, "u1", "reply", { repliesTo: replyCtx })),
            ev(3, { kind: "member_joined", userId: "u3" }),
        ];
        const out = run(events);
        expect(out).toEqual(events);
        out.forEach((e, i) => expect(e).toBe(events[i]));
    });

    test("non-matching blocked users / updates still return identical references", () => {
        const events: EventWrapper<ChatEvent>[] = [msgEv(1, "u2"), msgEv(2, "u1")];
        const u = new MessageLocalUpdates();
        u.editedContent = { kind: "text_content", text: "edited" };
        const out = run(events, [], new Set(["nobody"]), new MessageMap([[2n, u]]));
        expect(out[0]).toBe(events[0]);
        expect(out[1]).not.toBe(events[1]);
        expect((out[1].event as Message).content).toEqual({ kind: "text_content", text: "edited" });
    });

    test("fast path still tracks confirmed ids and contiguity for unconfirmed messages", () => {
        const out = run(
            [msgEv(1), msgEv(2)],
            [ev(2, msg(2, "me")), msgEv(3, "me"), msgEv(9, "me")],
        );
        expect(indexes(out)).toEqual([1, 2, 3]);
    });
});

describe("subrangesCover", () => {
    test("matches DRange clone+intersect length check for every gap", () => {
        const loaded = new DRange();
        loaded.add(1, 5);
        loaded.add(6, 8); // adjacent: merges into 1..8
        loaded.add(12, 15);
        loaded.add(20);
        const subs = loaded.subranges();
        expect(subs).toEqual([
            { low: 1, high: 8, length: 8 },
            { low: 12, high: 15, length: 4 },
            { low: 20, high: 20, length: 1 },
        ]);
        for (let low = 0; low <= 22; low++) {
            for (let high = low; high <= 22; high++) {
                const legacy = loaded.clone().intersect(low, high).length === high - low + 1;
                expect(subrangesCover(subs, low, high)).toBe(legacy);
            }
        }
    });

    test("empty gap is covered, empty ranges cover nothing", () => {
        expect(subrangesCover([], 5, 4)).toBe(true);
        expect(subrangesCover([], 5, 5)).toBe(false);
    });
});

describe("mergeEventsAndLocalUpdatesWithRange", () => {
    function run(
        events: EventWrapper<ChatEvent>[],
        unconfirmed: EventWrapper<Message>[] = [],
        expired = new DRange(),
    ) {
        return mergeEventsAndLocalUpdatesWithRange(
            events,
            unconfirmed,
            expired,
            new MessageMap<string>(),
            new Set(),
            new MessageMap<MessageLocalUpdates>(),
            new MessageMap<bigint>(),
            [],
        );
    }

    // What indexesLoadedStore used to compute from the merged events.
    function rebuilt(events: EventWrapper<ChatEvent>[], expired: DRange): DRange {
        const ranges = new DRange();
        events.forEach((e) => ranges.add(e.index));
        ranges.add(expired);
        return ranges;
    }

    test("events match mergeEventsAndLocalUpdates and range matches a rebuild from them", () => {
        const events = [msgEv(1), msgEv(2), msgEv(5), msgEv(6)];
        const unconfirmed = [msgEv(7, "me"), msgEv(20, "me")];
        const expired = new DRange(3, 4);
        const { events: out, range } = run(events, unconfirmed, expired);
        const legacy = mergeEventsAndLocalUpdates(
            events,
            unconfirmed,
            expired,
            new MessageMap<string>(),
            new Set(),
            new MessageMap<MessageLocalUpdates>(),
            new MessageMap<bigint>(),
            [],
        );
        expect(indexes(out)).toEqual(indexes(legacy));
        expect(range.subranges()).toEqual(rebuilt(out, expired).subranges());
        expect(range.subranges()).toEqual([{ low: 1, high: 7, length: 7 }]);
    });

    test("range is just the expired ranges when there are no events", () => {
        const { events, range } = run([], [], new DRange(2, 9));
        expect(events).toEqual([]);
        expect(range.subranges()).toEqual([{ low: 2, high: 9, length: 8 }]);
    });

    test("range excludes unconfirmed messages that were dropped", () => {
        const { range } = run([msgEv(1)], [msgEv(10, "me")]);
        expect(range.subranges()).toEqual([{ low: 1, high: 1, length: 1 }]);
    });
});

describe("TimelineGrouper", () => {
    function base(): EventWrapper<ChatEvent>[] {
        return [
            msgEv(1, "u1", BASE),
            ev(2, { kind: "member_joined", userId: "a" }, BASE + 1),
            msgEv(3, "u1", BASE + 2000),
            msgEv(4, "u2", BASE + 3000),
            ev(
                5,
                msg(5, "u3", "gone", {
                    content: { kind: "deleted_content", deletedBy: "u3", timestamp: 0n },
                }),
                BASE + 4000,
            ),
            msgEv(6, "u2", BASE + DAY),
            msgEv(7, "u1", BASE + DAY + 1000),
        ];
    }

    function groupsOf(timeline: ReturnType<typeof groupEvents>) {
        return timeline.map((t) => (t.kind === "timeline_event_group" ? t.group : t.kind));
    }

    test("first call matches groupEvents exactly", () => {
        const events = base();
        const expanded = new Set<number>();
        const g = new TimelineGrouper();
        for (const backwards of [false, true]) {
            expect(g.group(events, "me", false, expanded, undefined, backwards)).toEqual(
                groupEvents(events, "me", false, expanded, undefined, backwards),
            );
        }
    });

    test("same array returns the same timeline instance", () => {
        const events = base();
        const expanded = new Set<number>();
        const g = new TimelineGrouper();
        const a = g.group(events, "me", false, expanded, undefined, true);
        expect(g.group(events, "me", false, expanded, undefined, true)).toBe(a);
    });

    test("cosmetic replacement of one message patches the timeline, keeping untouched groups", () => {
        const events = base();
        const expanded = new Set<number>();
        const g = new TimelineGrouper();
        const before = g.group(events, "me", false, expanded, undefined, true);

        const reacted = {
            ...events[3],
            event: {
                ...(events[3].event as Message),
                reactions: [{ reaction: "x", userIds: new Set(["me"]) }],
            },
        };
        const next = [...events];
        next[3] = reacted;
        const after = g.group(next, "me", false, expanded, undefined, true);

        expect(after).toEqual(groupEvents(next, "me", false, expanded, undefined, true));
        expect(after).not.toBe(before);
        // Day 2 (timeline[0]/[1] in backwards order) is untouched: identity kept.
        expect(after[0]).toBe(before[0]);
        expect(after[1]).toBe(before[1]);
        // Day 1's item is new, but only the group holding index 4 was copied.
        expect(after[2]).not.toBe(before[2]);
        const g2a = groupsOf(after)[2] as EventWrapper<ChatEvent>[][];
        const g2b = groupsOf(before)[2] as EventWrapper<ChatEvent>[][];
        expect(g2a.length).toBe(g2b.length);
        for (let i = 0; i < g2a.length; i++) {
            const holdsReacted = g2a[i].some((e) => e === reacted);
            if (holdsReacted) expect(g2a[i]).not.toBe(g2b[i]);
            else expect(g2a[i]).toBe(g2b[i]);
        }
    });

    test("replacing a hidden (aggregated) message keeps the whole timeline", () => {
        const events = base();
        const expanded = new Set<number>();
        const g = new TimelineGrouper();
        const before = g.group(events, "me", false, expanded, undefined, true);
        const next = [...events];
        next[4] = { ...events[4], event: { ...(events[4].event as Message) } };
        const after = g.group(next, "me", false, expanded, undefined, true);
        expect(after).toBe(before);
        expect(after).toEqual(groupEvents(next, "me", false, expanded, undefined, true));
    });

    test("structural changes fall back to a full regroup", () => {
        const events = base();
        const expanded = new Set<number>();
        const g = new TimelineGrouper();
        g.group(events, "me", false, expanded, undefined, true);

        const cases: [string, EventWrapper<ChatEvent>[], ReadonlySet<number>, string][] = [
            ["appended", [...events, msgEv(8, "u1", BASE + DAY + 2000)], expanded, "me"],
            ["removed", events.slice(1), expanded, "me"],
            [
                "sender changed",
                events.map((e, i) => (i === 3 ? msgEv(4, "u1", BASE + 3000) : e)),
                expanded,
                "me",
            ],
            [
                "timestamp changed",
                events.map((e, i) => (i === 3 ? msgEv(4, "u2", BASE + DAY) : e)),
                expanded,
                "me",
            ],
            [
                "message deleted",
                events.map((e, i) =>
                    i === 3
                        ? ev(
                              4,
                              msg(4, "u2", "", {
                                  content: {
                                      kind: "deleted_content",
                                      deletedBy: "u2",
                                      timestamp: 0n,
                                  },
                              }),
                              BASE + 3000,
                          )
                        : e,
                ),
                expanded,
                "me",
            ],
            [
                "non-message replaced",
                events.map((e, i) =>
                    i === 1 ? ev(2, { kind: "member_joined", userId: "b" }, BASE + 1) : e,
                ),
                expanded,
                "me",
            ],
            ["deleted message expanded", events.map((e) => ({ ...e })), new Set([5]), "me"],
            ["different user", events.map((e) => ({ ...e })), expanded, "u3"],
        ];
        for (const [name, next, exp, me] of cases) {
            const actual = g.group(next, me, false, exp, undefined, true);
            expect(actual, name).toEqual(groupEvents(next, me, false, exp, undefined, true));
        }
    });

    test("a new groupInner forces a regroup", () => {
        const events = [msgEv(1, "u1", BASE), msgEv(2, "u1", BASE + 1000)];
        const expanded = new Set<number>();
        const g = new TimelineGrouper();
        const one = (evs: EventWrapper<ChatEvent>[]) => evs.map((e) => [e]);
        const a = g.group(events, "me", false, expanded, one, true);
        expect(a).toEqual(groupEvents(events, "me", false, expanded, one, true));
        const b = g.group([...events], "me", false, expanded, undefined, true);
        expect(b).toEqual(groupEvents(events, "me", false, expanded, undefined, true));
        expect(b).not.toEqual(a);
    });

    test("proposal messages require identical content", () => {
        const proposal = { kind: "nns", id: 1n, topic: 3 };
        const mk = (content: unknown) =>
            ev(4, msg(4, "u2", "", { content: content as Message["content"] }), BASE + 3000);
        const events = base();
        events[3] = mk({
            kind: "proposal_content",
            governanceCanisterId: "x",
            proposal,
            myVote: undefined,
        });
        const expanded = new Set<number>();
        const g = new TimelineGrouper();
        const inner = (evs: EventWrapper<ChatEvent>[]) => evs.map((e) => [e]);
        const before = g.group(events, "me", false, expanded, inner, true);
        const next = [...events];
        next[3] = mk({
            kind: "proposal_content",
            governanceCanisterId: "x",
            proposal: { ...proposal },
            myVote: undefined,
        });
        const after = g.group(next, "me", false, expanded, inner, true);
        expect(after).toEqual(groupEvents(next, "me", false, expanded, inner, true));
        expect(after).not.toBe(before);
    });
});
