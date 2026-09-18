import type { ChatIdentifier, ChatStateFull, GroupChatIdentifier, Tally } from "@shared";
import { ChatMap } from "@shared";
import type { Principal } from "@icp-sdk/core/principal";
import { describe, expect, test, vi } from "vitest";
import { ChatsDb, createCacheKey } from "./chatsDb";
import { emptyTouched, type SyncStamps } from "./sync";

const chatId: GroupChatIdentifier = { kind: "group_chat", groupId: "gid" };

/**
 * A stand-in for the idb database with one key/value map per store. Every read and write is
 * appended to `log` as `<op> <store> <key>` so a test can assert on the order of operations,
 * which is what the sync invariants are about (head read before rows, stamps written with the
 * state, and so on).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fakeDb(initial: Record<string, Record<string, any>> = {}) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stores: Record<string, Map<string, any>> = {};
    const storeNames = [
        "chats",
        "chat_events",
        "thread_events",
        "group_details",
        "cachePrimer",
        "sync",
    ];
    for (const name of storeNames) {
        stores[name] = new Map(Object.entries(initial[name] ?? {}));
    }
    const log: string[] = [];
    const objectStore = (name: string) => {
        const store = stores[name];
        return {
            get: (key: string) => {
                log.push(`get ${name} ${key}`);
                return Promise.resolve(store.get(key));
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            put: (value: any, key: string) => {
                log.push(`put ${name} ${key}`);
                store.set(key, value);
                return Promise.resolve(key);
            },
            delete: (key: string) => {
                log.push(`delete ${name} ${key}`);
                store.delete(key);
                return Promise.resolve();
            },
            clear: () => {
                log.push(`clear ${name}`);
                store.clear();
                return Promise.resolve();
            },
        };
    };
    const db = {
        objectStoreNames: Object.assign(storeNames.slice(), {
            contains: (name: string) => storeNames.includes(name),
        }),
        transaction: (_names: string | string[], _mode: string) => ({
            objectStore,
            done: Promise.resolve(),
        }),
        get: (name: string, key: string) => objectStore(name).get(key),
        clear: (name: string) => objectStore(name).clear(),
    };
    return { db, stores, log };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function chatsDbWith(initial: Record<string, Record<string, any>> = {}) {
    const fake = fakeDb(initial);
    const chatsDb = new ChatsDb({ toString: () => "principal" } as Principal);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chatsDb as any).getDb = () => Promise.resolve(fake.db);
    return { chatsDb, ...fake };
}

function state(overrides: Partial<ChatStateFull> = {}): ChatStateFull {
    return {
        latestUserCanisterUpdates: BigInt(Date.now()),
        directChats: [],
        groupChats: [],
        communities: [],
        ...overrides,
    } as ChatStateFull;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function proposalMessage(index: number, tallyTimestamp: bigint): any {
    return {
        kind: "event",
        index,
        timestamp: BigInt(index),
        event: {
            kind: "message",
            messageIndex: index,
            messageId: BigInt(index),
            content: {
                kind: "proposal_content",
                proposal: { tally: { yes: 0, no: 0, total: 0, timestamp: tallyTimestamp } },
            },
        },
    };
}

const tally = (timestamp: bigint): Tally => ({ yes: 1, no: 0, total: 1, timestamp });

function key(index: number): string {
    return createCacheKey(
        { chatId: chatId as ChatIdentifier, threadRootMessageIndex: undefined },
        index,
    );
}

describe("setCachedChats", () => {
    test("takes the next version from the head, and writes state, stamps and head together", async () => {
        const { chatsDb, stores, log } = chatsDbWith();

        const first = await chatsDb.setCachedChats(state(), emptyTouched());
        const second = await chatsDb.setCachedChats(state(), emptyTouched());

        expect(first).toBe(1);
        expect(second).toBe(2);
        expect(stores.sync.get("head")).toBe(2);
        expect(stores.chats.has("principal")).toBe(true);
        // head and stamps are read before anything is written
        expect(log.slice(0, 5)).toEqual([
            "get sync head",
            "get sync stamps",
            "put chats principal",
            "put sync stamps",
            "put sync head",
        ]);
    });

    test("stamps what was touched at the version taken", async () => {
        const { chatsDb, stores } = chatsDbWith({ sync: { head: 9 } });
        const group = {
            kind: "group_chat",
            id: chatId,
        } as unknown as ChatStateFull["groupChats"][0];

        const version = await chatsDb.setCachedChats(state({ groupChats: [group] }), {
            ...emptyTouched(),
            groupChats: new Set(["gid"]),
            fields: new Set(["blockedUsers"]),
        });

        expect(version).toBe(10);
        const stamps = stores.sync.get("stamps") as SyncStamps;
        expect(stamps.groupChats).toEqual({ gid: 10 });
        expect(stamps.fields.blockedUsers).toBe(10);
    });

    test("marks the updated events already cached as dirty", async () => {
        const { chatsDb, stores } = chatsDbWith({
            chat_events: { [key(3)]: proposalMessage(3, 1n) },
        });
        const updatedEvents = new ChatMap<{ eventIndex: number; timestamp: bigint }[]>();
        updatedEvents.set(chatId, [
            { eventIndex: 3, timestamp: 5n },
            { eventIndex: 4, timestamp: 5n },
        ]);

        await chatsDb.setCachedChats(state(), { ...emptyTouched(), updatedEvents });

        expect(stores.chat_events.get(key(3)).dirty).toBe(true);
        expect(stores.chat_events.has(key(4))).toBe(false);
        expect(
            (stores.sync.get("stamps") as SyncStamps).updatedEvents.map((s) => s.eventIndex),
        ).toEqual([3, 4]);
    });
});

describe("getChatsForSync", () => {
    test("reads the head before the state and the stamps", async () => {
        const stamps: SyncStamps = { ...emptyTouched(), fields: {} } as unknown as SyncStamps;
        const { chatsDb, log } = chatsDbWith({
            chats: { principal: state() },
            sync: { head: 4, stamps },
        });

        const result = await chatsDb.getChatsForSync();

        expect(result.head).toBe(4);
        expect(result.state).toBeDefined();
        expect(result.stamps).toBe(stamps);
        expect(log).toEqual(["get sync head", "get chats principal", "get sync stamps"]);
    });

    test("an empty cache answers with the head and no state", async () => {
        const { chatsDb } = chatsDbWith({ sync: { head: 4 } });

        const result = await chatsDb.getChatsForSync();

        expect(result).toEqual({ head: 4, state: undefined, stamps: undefined });
    });

    test("a failed read throws rather than answering as an empty cache", async () => {
        const { chatsDb, db } = chatsDbWith({ sync: { head: 4 } });
        db.get = (name: string) =>
            name === "chats" ? Promise.reject(new Error("idb")) : Promise.resolve(4);
        vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(chatsDb.getChatsForSync()).rejects.toThrow("idb");
        // the updates loop's read still falls back to a full load
        await expect(chatsDb.getCachedChats()).resolves.toBeUndefined();
    });
});

describe("getCachedChats", () => {
    test("the 30 day wipe clears every store but moves the head on", async () => {
        const stale = state({ latestUserCanisterUpdates: 0n });
        const { chatsDb, stores } = chatsDbWith({
            chats: { principal: stale },
            chat_events: { [key(1)]: proposalMessage(1, 1n) },
            sync: { head: 7, stamps: { fields: {} } },
        });

        expect(await chatsDb.getCachedChats()).toBeUndefined();

        expect(stores.chats.size).toBe(0);
        expect(stores.chat_events.size).toBe(0);
        expect(stores.sync.get("stamps")).toBeUndefined();
        expect(stores.sync.get("head")).toBe(8);
    });
});

describe("updateCachedProposalTallies", () => {
    test("a newer tally stamps the event and moves the head", async () => {
        const { chatsDb, stores } = chatsDbWith({
            chat_events: { [key(3)]: proposalMessage(3, 1n), [key(4)]: proposalMessage(4, 9n) },
            sync: { head: 2 },
        });

        const { messages, version } = await chatsDb.updateCachedProposalTallies(chatId, [
            [3, tally(5n)],
            [4, tally(5n)],
        ]);

        expect(messages.map((m) => m.index)).toEqual([3, 4]);
        expect(version).toBe(3);
        expect(stores.sync.get("head")).toBe(3);
        const stamps = stores.sync.get("stamps") as SyncStamps;
        expect(stamps.updatedEvents.map((s) => [s.eventIndex, s.version])).toEqual([[3, 3]]);
    });

    test("nothing newer leaves the head alone", async () => {
        const { chatsDb, stores } = chatsDbWith({
            chat_events: { [key(4)]: proposalMessage(4, 9n) },
            sync: { head: 2 },
        });

        const { version } = await chatsDb.updateCachedProposalTallies(chatId, [[4, tally(5n)]]);

        expect(version).toBeUndefined();
        expect(stores.sync.get("head")).toBe(2);
        expect(stores.sync.get("stamps")).toBeUndefined();
    });
});
