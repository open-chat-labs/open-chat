import type {
    ChatIdentifier,
    ChatStateFull,
    DirectChatSummary,
    GroupChatIdentifier,
    GroupChatSummary,
    Tally,
} from "@shared";
import { ChatMap } from "@shared";
import type { Principal } from "@icp-sdk/core/principal";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { ChatsDb, createCacheKey } from "./chatsDb";
import { emptyTouched, globalsOf, type ChatRow, type SyncStamps } from "./sync";

// jsdom has no IndexedDB. The fake below only needs the lower bound of a key range.
beforeAll(() => {
    vi.stubGlobal("IDBKeyRange", {
        lowerBound: (lower: number, open: boolean) => ({ lower, open }),
    });
});
afterAll(() => {
    vi.unstubAllGlobals();
});

const chatId: GroupChatIdentifier = { kind: "group_chat", groupId: "gid" };

/**
 * A stand-in for the idb database with one key/value map per store. Every read and write is
 * appended to `log` as `<op> <store> <key>` so a test can assert on the order of operations,
 * which is what the sync invariants are about (head read before rows, stamps written with the
 * state, and so on).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sortedKeys(store: Map<string, any>): string[] {
    return [...store.keys()].sort();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fakeDb(initial: Record<string, Record<string, any>> = {}) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stores: Record<string, Map<string, any>> = {};
    const storeNames = [
        "chats",
        "chat_rows",
        "chat_tombstones",
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
    // reads from a store named here fail, as a broken IndexedDB would
    const failing = new Set<string>();
    const read = <T>(name: string, value: () => T): Promise<T> =>
        failing.has(name) ? Promise.reject(new Error("idb")) : Promise.resolve(value());
    const objectStore = (name: string) => {
        const store = stores[name];
        return {
            get: (key: string) => {
                log.push(`get ${name} ${key}`);
                return read(name, () => store.get(key));
            },
            // IndexedDB returns a store in key order, and an index in index then key order
            getAll: () => {
                log.push(`getAll ${name}`);
                return read(name, () => sortedKeys(store).map((k) => store.get(k)));
            },
            getAllKeys: () => {
                log.push(`getAllKeys ${name}`);
                return read(name, () => sortedKeys(store));
            },
            index: (index: string) => ({
                getAll: (range: { lower: number; open: boolean }) => {
                    log.push(`getAll ${name}.${index} ${range.lower}`);
                    return read(name, () =>
                        sortedKeys(store)
                            .map((k) => store.get(k))
                            .filter((v) =>
                                range.open ? v[index] > range.lower : v[index] >= range.lower,
                            )
                            .sort((a, b) => a[index] - b[index]),
                    );
                },
            }),
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
    return { db, stores, log, failing };
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

const group = (groupId: string) =>
    ({ kind: "group_chat", id: { kind: "group_chat", groupId } }) as unknown as GroupChatSummary;

const direct = (userId: string, usable = true) =>
    ({
        kind: "direct_chat",
        id: { kind: "direct_chat", userId },
        them: usable ? { kind: "direct_chat", userId } : undefined,
        membership: {},
    }) as unknown as DirectChatSummary;

const groupRow = (groupId: string, version: number): ChatRow => ({
    kind: "group_chat",
    version,
    summary: group(groupId),
});

const directRow = (userId: string, version: number, usable = true): ChatRow => ({
    kind: "direct_chat",
    version,
    summary: direct(userId, usable),
});

const globals = (overrides: Partial<ChatStateFull> = {}) => globalsOf(state(overrides));

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
    test("takes the next version from the head, and writes globals, rows, stamps and head together", async () => {
        const { chatsDb, stores, log } = chatsDbWith();

        const first = await chatsDb.setCachedChats(state(), emptyTouched());
        const second = await chatsDb.setCachedChats(state(), emptyTouched());

        expect(first).toBe(1);
        expect(second).toBe(2);
        expect(stores.sync.get("head")).toBe(2);
        expect(stores.chats.get("principal")).toEqual(
            globals({
                latestUserCanisterUpdates: stores.chats.get("principal").latestUserCanisterUpdates,
            }),
        );
        expect("groupChats" in stores.chats.get("principal")).toBe(false);
        // everything is read before anything is written
        expect(log.slice(0, 7)).toEqual([
            "get sync head",
            "get sync stamps",
            "get chats principal",
            "getAllKeys chat_rows",
            "put chats principal",
            "put sync stamps",
            "put sync head",
        ]);
    });

    test("stamps the touched fields at the version taken", async () => {
        const { chatsDb, stores } = chatsDbWith({ sync: { head: 9 } });

        const version = await chatsDb.setCachedChats(state(), {
            ...emptyTouched(),
            fields: new Set(["blockedUsers"]),
        });

        expect(version).toBe(10);
        const stamps = stores.sync.get("stamps") as SyncStamps;
        expect(stamps.fields.blockedUsers).toBe(10);
    });

    test("rewrites only the touched and new chats, and tombstones the ones that are gone", async () => {
        const { chatsDb, stores, log } = chatsDbWith({
            chats: { principal: globals() },
            chat_rows: {
                "group_chat|a": groupRow("a", 1),
                "group_chat|b": groupRow("b", 1),
                "group_chat|c": groupRow("c", 1),
            },
            sync: { head: 4 },
        });

        await chatsDb.setCachedChats(state({ groupChats: [group("a"), group("b"), group("d")] }), {
            ...emptyTouched(),
            groupChats: new Set(["b"]),
        });

        expect(stores.chat_rows.get("group_chat|a").version).toBe(1);
        expect(stores.chat_rows.get("group_chat|b").version).toBe(5);
        expect(stores.chat_rows.get("group_chat|d").version).toBe(5);
        expect(stores.chat_rows.has("group_chat|c")).toBe(false);
        expect(stores.chat_tombstones.get("group_chat|c")).toEqual({
            kind: "group_chat",
            id: "c",
            version: 5,
        });
        expect(log).not.toContain("put chat_rows group_chat|a");
    });

    test("a chat that is back loses its tombstone", async () => {
        const { chatsDb, stores } = chatsDbWith({
            chats: { principal: globals() },
            chat_tombstones: { "group_chat|a": { kind: "group_chat", id: "a", version: 2 } },
            sync: { head: 2 },
        });

        await chatsDb.setCachedChats(state({ groupChats: [group("a")] }), emptyTouched());

        expect(stores.chat_rows.get("group_chat|a").version).toBe(3);
        expect(stores.chat_tombstones.has("group_chat|a")).toBe(false);
    });

    test("with no cached globals every row is rewritten, since the old ones are not trusted", async () => {
        const { chatsDb, stores } = chatsDbWith({
            chat_rows: { "direct_chat|u1": directRow("u1", 1, false) },
            sync: { head: 3 },
        });

        await chatsDb.setCachedChats(state({ directChats: [direct("u1")] }), emptyTouched());

        const row = stores.chat_rows.get("direct_chat|u1");
        expect(row.version).toBe(4);
        expect(row.summary.them).toBeDefined();
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
    test("reads the head first, then only the rows and tombstones written after since", async () => {
        const stamps: SyncStamps = { ...emptyTouched(), fields: {} } as unknown as SyncStamps;
        const { chatsDb, log } = chatsDbWith({
            chats: { principal: globals() },
            chat_rows: {
                "group_chat|a": groupRow("a", 2),
                "group_chat|b": groupRow("b", 3),
                "direct_chat|u1": directRow("u1", 4),
            },
            chat_tombstones: {
                "group_chat|x": { kind: "group_chat", id: "x", version: 1 },
                "community|y": { kind: "community", id: "y", version: 4 },
            },
            sync: { head: 4, stamps },
        });

        const result = await chatsDb.getChatsForSync(2);

        expect(result.head).toBe(4);
        expect(result.stamps).toBe(stamps);
        expect(result.chats?.state.groupChats.map((g) => g.id.groupId)).toEqual(["b"]);
        expect(result.chats?.state.directChats.map((c) => c.id.userId)).toEqual(["u1"]);
        expect(result.chats?.removed).toEqual({
            directChats: [],
            groupChats: [],
            communities: ["y"],
        });
        expect(log[0]).toBe("get sync head");
        expect(log).not.toContain("getAll chat_rows");
    });

    test("an empty cache answers with the head and nothing to answer from", async () => {
        const { chatsDb } = chatsDbWith({ sync: { head: 4 } });

        const result = await chatsDb.getChatsForSync(0);

        expect(result).toEqual({ head: 4, chats: undefined, stamps: undefined });
    });

    test("a stale cache answers with nothing, and is left for the updates loop to wipe", async () => {
        const { chatsDb, stores } = chatsDbWith({
            chats: { principal: globals({ latestUserCanisterUpdates: 0n }) },
            chat_rows: { "group_chat|a": groupRow("a", 2) },
            sync: { head: 4 },
        });

        const result = await chatsDb.getChatsForSync(0);

        expect(result.chats).toBeUndefined();
        expect(stores.chat_rows.size).toBe(1);
        expect(stores.sync.get("head")).toBe(4);
    });

    test("an unusable row answers with nothing", async () => {
        const { chatsDb } = chatsDbWith({
            chats: { principal: globals() },
            chat_rows: { "direct_chat|u1": directRow("u1", 2, false) },
            sync: { head: 4 },
        });

        expect((await chatsDb.getChatsForSync(0)).chats).toBeUndefined();
    });

    test("a failed read throws rather than answering as an empty cache", async () => {
        const { chatsDb, failing } = chatsDbWith({
            chats: { principal: globals() },
            sync: { head: 4 },
        });
        failing.add("chat_rows");
        vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(chatsDb.getChatsForSync(0)).rejects.toThrow("idb");
        // the updates loop's read still falls back to a full load
        await expect(chatsDb.getCachedChats()).resolves.toBeUndefined();
    });
});

describe("getCachedChats", () => {
    test("puts the globals and the rows back together", async () => {
        const { chatsDb } = chatsDbWith({
            chats: { principal: globals({ blockedUsers: ["x"] }) },
            chat_rows: {
                "direct_chat|u1": directRow("u1", 1),
                "group_chat|a": groupRow("a", 2),
            },
        });

        const cached = await chatsDb.getCachedChats();

        expect(cached?.blockedUsers).toEqual(["x"]);
        expect(cached?.directChats.map((c) => c.id.userId)).toEqual(["u1"]);
        expect(cached?.groupChats.map((g) => g.id.groupId)).toEqual(["a"]);
        expect(cached?.communities).toEqual([]);
    });

    test("an unusable row clears the globals but keeps the rows for the full load to tombstone", async () => {
        const { chatsDb, stores } = chatsDbWith({
            chats: { principal: globals() },
            chat_rows: {
                "direct_chat|u1": directRow("u1", 1, false),
                "group_chat|a": groupRow("a", 1),
            },
        });

        expect(await chatsDb.getCachedChats()).toBeUndefined();

        expect(stores.chats.size).toBe(0);
        expect(stores.chat_rows.size).toBe(2);
    });

    test("the 30 day wipe clears every store but the rows, and moves the head on", async () => {
        const { chatsDb, stores } = chatsDbWith({
            chats: { principal: globals({ latestUserCanisterUpdates: 0n }) },
            chat_rows: { "group_chat|a": groupRow("a", 1) },
            chat_tombstones: { "group_chat|b": { kind: "group_chat", id: "b", version: 1 } },
            chat_events: { [key(1)]: proposalMessage(1, 1n) },
            sync: { head: 7, stamps: { fields: {} } },
        });

        expect(await chatsDb.getCachedChats()).toBeUndefined();

        expect(stores.chats.size).toBe(0);
        expect(stores.chat_events.size).toBe(0);
        // kept, so the full load that follows can still tombstone what has gone
        expect(stores.chat_rows.size).toBe(1);
        expect(stores.chat_tombstones.size).toBe(1);
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

describe("across a 30 day wipe", () => {
    test("a chat removed meanwhile still reaches a UI that kept running", async () => {
        const { chatsDb } = chatsDbWith({
            chats: { principal: globals({ latestUserCanisterUpdates: 0n }) },
            chat_rows: { "group_chat|a": groupRow("a", 1), "group_chat|gone": groupRow("gone", 1) },
            sync: { head: 1 },
        });

        expect(await chatsDb.getCachedChats()).toBeUndefined();
        await chatsDb.setCachedChats(state({ groupChats: [group("a")] }), emptyTouched());

        const { chats } = await chatsDb.getChatsForSync(1);
        expect(chats?.state.groupChats.map((g) => g.id.groupId)).toEqual(["a"]);
        expect(chats?.removed.groupChats).toEqual(["gone"]);
    });
});

describe("getCachedChatSummary", () => {
    test("reads one chat's row, and a channel from its community's row", async () => {
        const channel = {
            kind: "channel",
            id: { kind: "channel", communityId: "c1", channelId: 7 },
        };
        const { chatsDb, log } = chatsDbWith({
            chat_rows: {
                "group_chat|a": groupRow("a", 1),
                "direct_chat|u1": directRow("u1", 1),
                "community|c1": {
                    kind: "community",
                    version: 1,
                    summary: { kind: "community", id: { communityId: "c1" }, channels: [channel] },
                },
            },
        });

        expect((await chatsDb.getCachedChatSummary(group("a").id))?.id).toEqual(group("a").id);
        expect((await chatsDb.getCachedChatSummary(direct("u1").id))?.id).toEqual(direct("u1").id);
        // a different object with the same value
        expect(
            await chatsDb.getCachedChatSummary({
                kind: "channel",
                communityId: "c1",
                channelId: 7,
            }),
        ).toBe(channel);
        expect(await chatsDb.getCachedChatSummary(group("missing").id)).toBeUndefined();
        expect(log.filter((l) => !l.startsWith("get chat_rows"))).toEqual([]);
    });

    test("a failed read answers with nothing and wipes nothing", async () => {
        const { chatsDb, stores, failing } = chatsDbWith({
            chats: { principal: globals({ latestUserCanisterUpdates: 0n }) },
        });
        failing.add("chat_rows");
        vi.spyOn(console, "error").mockImplementation(() => {});

        expect(await chatsDb.getCachedChatSummary(group("a").id)).toBeUndefined();
        expect(stores.chats.size).toBe(1);
    });
});
