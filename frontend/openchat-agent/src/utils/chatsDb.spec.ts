import type { ChatIdentifier, GroupChatIdentifier } from "@shared";
import type { Principal } from "@icp-sdk/core/principal";
import { beforeAll, describe, expect, test } from "vitest";
import { ChatsDb, createCacheKey } from "./chatsDb";

const chatId: GroupChatIdentifier = { kind: "group_chat", groupId: "gid" };

beforeAll(() => {
    // jsdom has no IndexedDB, so provide just enough of IDBKeyRange for the code under test.
    if (globalThis.IDBKeyRange === undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).IDBKeyRange = {
            bound: (lower: string, upper: string) => ({ lower, upper }),
        };
    }
});

type Range = { lower: string; upper: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function messageEvent(index: number, messageIndex: number): any {
    return {
        kind: "event",
        index,
        timestamp: BigInt(index),
        expiresAt: undefined,
        event: { kind: "message", messageIndex, messageId: BigInt(index), content: {} },
    };
}

/**
 * A tiny stand-in for the idb database. `entries` is keyed by cache key; a bounded `get`
 * returns the first entry within the bound in key order (which is what IndexedDB does).
 * Both the explicit transaction api and the implicit `db.get` / `db.getFromIndex` helpers
 * are modelled, and each opened transaction (implicit or explicit) is counted.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fakeDb(entries: Record<string, any>, byMessageIdx: Record<string, any> = {}) {
    const state = { transactions: 0 };
    const keys = Object.keys(entries).sort();
    const boundedGet = (range: Range) =>
        Promise.resolve(entries[keys.find((k) => k >= range.lower && k <= range.upper) ?? ""]);
    const indexGet = (key: string) => Promise.resolve(byMessageIdx[key]);
    const store = {
        get: boundedGet,
        index: (_name: string) => ({ get: indexGet }),
    };
    const db = {
        transaction(_storeName: string, _mode: string) {
            state.transactions++;
            return { store, objectStore: (_n: string) => store, done: Promise.resolve() };
        },
        get(_storeName: string, range: Range) {
            state.transactions++;
            return boundedGet(range);
        },
        getFromIndex(_storeName: string, _indexName: string, key: string) {
            state.transactions++;
            return indexGet(key);
        },
    };
    return { db, state };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function chatsDbWith(entries: Record<string, any>, byMessageIdx: Record<string, any> = {}) {
    const { db, state } = fakeDb(entries, byMessageIdx);
    const chatsDb = new ChatsDb({ toString: () => "principal" } as Principal);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chatsDb as any).getDb = () => Promise.resolve(db);
    return { chatsDb, state };
}

function key(index: number, threadRootMessageIndex?: number): string {
    return createCacheKey({ chatId: chatId as ChatIdentifier, threadRootMessageIndex }, index);
}

describe("getCachedEventsByIndex", () => {
    test("returns cached events and records the missing indexes", async () => {
        const { chatsDb, state } = chatsDbWith({
            [key(1)]: messageEvent(1, 1),
            [key(3)]: messageEvent(3, 3),
        });

        const [result, missing, dirty] = await chatsDb.getCachedEventsByIndex([1, 2, 3], {
            chatId: chatId as ChatIdentifier,
            threadRootMessageIndex: undefined,
        });

        expect(result.events.map((e) => e.index)).toEqual([1, 3]);
        expect(result.expiredEventRanges).toEqual([]);
        expect(result.latestEventIndex).toBe(undefined);
        expect([...missing]).toEqual([2]);
        expect([...dirty]).toEqual([]);
        expect(state.transactions).toBe(1);
    });

    test("collects dirty event indexes", async () => {
        const dirtyEvent = { ...messageEvent(2, 2), dirty: true };
        const { chatsDb } = chatsDbWith({ [key(2)]: dirtyEvent });

        const [result, missing, dirty] = await chatsDb.getCachedEventsByIndex([2], {
            chatId: chatId as ChatIdentifier,
            threadRootMessageIndex: undefined,
        });

        expect(result.events.map((e) => e.index)).toEqual([2]);
        expect([...missing]).toEqual([]);
        expect([...dirty]).toEqual([2]);
    });

    test("returns expired event ranges separately", async () => {
        const { chatsDb } = chatsDbWith({
            [key(5)]: { kind: "expired_events_range", start: 4, end: 6 },
        });

        const [result, missing] = await chatsDb.getCachedEventsByIndex([5], {
            chatId: chatId as ChatIdentifier,
            threadRootMessageIndex: undefined,
        });

        expect(result.events).toEqual([]);
        expect(result.expiredEventRanges).toEqual([
            { kind: "expired_events_range", start: 4, end: 6 },
        ]);
        expect([...missing]).toEqual([]);
    });
});

describe("loadMessagesByMessageIndex", () => {
    test("returns the messages found and records the missing indexes", async () => {
        const { chatsDb, state } = chatsDbWith(
            {},
            {
                [key(10)]: messageEvent(100, 10),
                [key(12)]: messageEvent(102, 12),
            },
        );

        const { messageEvents, missing, dirty } = await chatsDb.loadMessagesByMessageIndex(
            chatId as ChatIdentifier,
            undefined,
            [10, 11, 12],
        );

        expect(messageEvents.map((m) => m.index)).toEqual([100, 102]);
        expect([...missing]).toEqual([11]);
        expect([...dirty]).toEqual([]);
        expect(state.transactions).toBe(1);
    });

    test("collects dirty message indexes", async () => {
        const { chatsDb } = chatsDbWith(
            {},
            { [key(10)]: { ...messageEvent(100, 10), dirty: true } },
        );

        const { missing, dirty } = await chatsDb.loadMessagesByMessageIndex(
            chatId as ChatIdentifier,
            undefined,
            [10],
        );

        expect([...missing]).toEqual([]);
        expect([...dirty]).toEqual([100]);
    });
});
