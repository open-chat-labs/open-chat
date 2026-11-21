import type { Principal } from "@icp-sdk/core/principal";
import type { RulesAgreedOnJoining } from "@shared";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

const openDB = vi.hoisted(() => vi.fn());
vi.mock("idb", () => ({ openDB }));

import { ChatsDb } from "./chatsDb";

// The rules the user agreed to as they joined, kept in their cache on the device

type FakeDb = {
    objectStoreNames: {
        contains: (name: string) => boolean;
        [Symbol.iterator]: () => Iterator<string>;
    };
    deleteObjectStore: Mock;
    createObjectStore: Mock;
    addEventListener: Mock;
    get: (store: string, key: string) => Promise<unknown>;
    put: (store: string, value: unknown, key: string) => Promise<string>;
};

// A database on disk at `previousVersion` with `existingStores`, opened by a ChatsDb
function openFrom(previousVersion: number, existingStores: string[]) {
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
        get: async (store, key) => stores.get(store)?.get(key),
        put: async (store, value, key) => {
            const s = stores.get(store);
            if (s === undefined) throw new Error(`no store ${store}`);
            s.set(key, structuredClone(value));
            return key;
        },
    };
    openDB.mockImplementation(
        async (
            _name: string,
            version: number,
            { upgrade }: { upgrade: (db: FakeDb, from: number, to: number, tx: object) => void },
        ) => {
            upgrade(db, previousVersion, version, {});
            return db;
        },
    );
    const chatsDb = new ChatsDb({ toString: () => "principal" } as Principal, "2.0.0");
    return { chatsDb, db };
}

const agreed: RulesAgreedOnJoining = {
    chats: new Map([["g", { text: "be nice", agreedAt: 1 }]]),
    communities: new Map([["c", { text: "no spam", agreedAt: 2 }]]),
};

describe("the rules agreed to on joining, in the cache", () => {
    beforeEach(() => {
        openDB.mockReset();
    });

    test("are read back as they were written", async () => {
        const { chatsDb } = openFrom(0, []);

        expect(await chatsDb.getRulesAgreedOnJoining()).toBeUndefined();
        await chatsDb.setRulesAgreedOnJoining(agreed);
        expect(await chatsDb.getRulesAgreedOnJoining()).toEqual(agreed);
    });

    test("their store is added to a cache at the version before, which is otherwise kept", async () => {
        const { chatsDb, db } = openFrom(160, ["chats", "chat_events", "sync"]);

        await chatsDb.setRulesAgreedOnJoining(agreed);

        expect(db.deleteObjectStore).not.toHaveBeenCalled();
        expect(db.createObjectStore.mock.calls.map((c) => c[0])).toEqual(["rules_agreed"]);
        expect(await chatsDb.getRulesAgreedOnJoining()).toEqual(agreed);
    });
});
