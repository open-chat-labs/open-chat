import type { Principal } from "@icp-sdk/core/principal";
import { RULES_AGREED_MAX_AGE_MS } from "@shared";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

const openDB = vi.hoisted(() => vi.fn());
vi.mock("idb", () => ({ openDB }));

import { ChatsDb } from "./chatsDb";

// The rules the user agreed to as they joined, kept in their cache on the device

type FakeStore = {
    get: (key: string) => Promise<unknown>;
    put: (value: unknown, key: string) => Promise<string>;
};

type FakeDb = {
    objectStoreNames: {
        contains: (name: string) => boolean;
        [Symbol.iterator]: () => Iterator<string>;
    };
    deleteObjectStore: Mock;
    createObjectStore: Mock;
    addEventListener: Mock;
    transaction: (store: string, mode: string) => { store: FakeStore; done: Promise<void> };
};

// One database on disk at `previousVersion` with `existingStores`; each `open()` is a ChatsDb on
// it, as each tab has
function onDisk(previousVersion: number, existingStores: string[]) {
    const stores = new Map<string, Map<string, unknown>>(
        existingStores.map((name) => [name, new Map()]),
    );
    const db: FakeDb = {
        objectStoreNames: {
            contains: (name) => stores.has(name),
            [Symbol.iterator]: () => [...stores.keys()][Symbol.iterator](),
        },
        deleteObjectStore: vi.fn((name: string) => stores.delete(name)),
        createObjectStore: vi.fn((name: string) => {
            stores.set(name, new Map());
            return { createIndex: vi.fn() };
        }),
        addEventListener: vi.fn(),
        transaction: (name) => {
            const s = stores.get(name);
            if (s === undefined) throw new Error(`no store ${name}`);
            return {
                store: {
                    get: async (key) => structuredClone(s.get(key)),
                    put: async (value, key) => {
                        s.set(key, structuredClone(value));
                        return key;
                    },
                },
                done: Promise.resolve(),
            };
        },
    };
    let upgraded = false;
    openDB.mockImplementation(
        async (
            _name: string,
            version: number,
            { upgrade }: { upgrade: (db: FakeDb, from: number, to: number, tx: object) => void },
        ) => {
            if (!upgraded) upgrade(db, previousVersion, version, {});
            upgraded = true;
            return db;
        },
    );
    const open = () => new ChatsDb({ toString: () => "principal" } as Principal, "2.0.0");
    return { db, open };
}

const now = 1_000_000_000_000;

describe("the rules agreed to on joining, in the cache", () => {
    beforeEach(() => {
        openDB.mockReset();
    });

    test("are read back as they were agreed to, and forgotten", async () => {
        const chatsDb = onDisk(0, []).open();

        expect((await chatsDb.updateRulesAgreedOnJoining({ kind: "read" }, now)).chats.size).toBe(
            0,
        );
        await chatsDb.updateRulesAgreedOnJoining(
            {
                kind: "agreed",
                chat: { key: "c_1", text: "be nice" },
                community: { id: "c", text: "no spam" },
            },
            now,
        );
        const read = await chatsDb.updateRulesAgreedOnJoining({ kind: "read" }, now + 1);
        expect(read.chats.get("c_1")).toEqual({ text: "be nice", agreedAt: now });
        expect(read.communities.get("c")).toEqual({ text: "no spam", agreedAt: now });

        await chatsDb.updateRulesAgreedOnJoining(
            { kind: "forget", chatKey: "c_1", communityId: "c" },
            now + 2,
        );
        const forgotten = await chatsDb.updateRulesAgreedOnJoining({ kind: "read" }, now + 3);
        expect(forgotten.chats.size + forgotten.communities.size).toBe(0);
    });

    test("one tab's change keeps another tab's agreements", async () => {
        const disk = onDisk(0, []);
        const tabA = disk.open();
        const tabB = disk.open();

        await tabB.updateRulesAgreedOnJoining(
            { kind: "agreed", chat: undefined, community: { id: "y", text: "y" } },
            now,
        );
        await tabA.updateRulesAgreedOnJoining(
            { kind: "agreed", chat: { key: "x", text: "x" }, community: undefined },
            now,
        );
        const afterB = await tabB.updateRulesAgreedOnJoining(
            { kind: "forget_community", communityId: "y" },
            now,
        );

        expect([...afterB.chats.keys()]).toEqual(["x"]);
        expect(afterB.communities.size).toBe(0);
    });

    test("those older than 30 days are dropped from the cache as they're read", async () => {
        const chatsDb = onDisk(0, []).open();
        await chatsDb.updateRulesAgreedOnJoining(
            { kind: "agreed", chat: { key: "g", text: "old" }, community: undefined },
            now,
        );

        const later = now + RULES_AGREED_MAX_AGE_MS;
        expect((await chatsDb.updateRulesAgreedOnJoining({ kind: "read" }, later)).chats.size).toBe(
            0,
        );
        // and stay gone
        expect((await chatsDb.updateRulesAgreedOnJoining({ kind: "read" }, now)).chats.size).toBe(
            0,
        );
    });

    test("their store is added to a cache at the version before, which is otherwise kept", async () => {
        const disk = onDisk(160, ["chats", "chat_events", "sync"]);
        const chatsDb = disk.open();

        await chatsDb.updateRulesAgreedOnJoining(
            { kind: "agreed", chat: { key: "g", text: "be nice" }, community: undefined },
            now,
        );

        expect(disk.db.deleteObjectStore).not.toHaveBeenCalled();
        expect(disk.db.createObjectStore.mock.calls.map((c) => c[0])).toEqual(["rules_agreed"]);
        const read = await chatsDb.updateRulesAgreedOnJoining({ kind: "read" }, now);
        expect(read.chats.get("g")?.text).toBe("be nice");
    });
});
