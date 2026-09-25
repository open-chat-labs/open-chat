import type { UserSummary } from "@shared";
import { describe, expect, test } from "vitest";
import { fakeIdb } from "./fakeIdb";
import { UserDb } from "./userCache";

function user(userId: string): UserSummary {
    return { userId, username: userId } as UserSummary;
}

// A tiny stand-in for an idb database. We only need `transaction` / `objectStore` / `get`
// because that is all `getCachedUsers` touches. It also records how many transactions were
// opened so we can pin the batching behaviour.
function fakeDb(users: Record<string, UserSummary>) {
    const state = { transactions: 0, gets: [] as string[] };
    const db = {
        transaction(_storeName: string, _mode: string) {
            state.transactions++;
            return {
                objectStore(_name: string) {
                    return {
                        get(key: string) {
                            state.gets.push(key);
                            return Promise.resolve(users[key]);
                        },
                    };
                },
                done: Promise.resolve(),
            };
        },
        // idb's `db.get` opens an implicit transaction per call - model that so the
        // transaction count means the same thing whichever api is used.
        get(_storeName: string, key: string) {
            state.transactions++;
            state.gets.push(key);
            return Promise.resolve(users[key]);
        },
    };
    return { db, state };
}

function dbWith(users: Record<string, UserSummary>) {
    const { db, state } = fakeDb(users);
    const userDb = new UserDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (userDb as any).connectionManager = { getDb: () => Promise.resolve(db) };
    return { userDb, state };
}

describe("getCachedUsers", () => {
    test("returns the users in the order they were asked for", async () => {
        const { userDb } = dbWith({ a: user("a"), b: user("b"), c: user("c") });
        const result = await userDb.getCachedUsers(["c", "a", "b"]);
        expect(result.map((u) => u.userId)).toEqual(["c", "a", "b"]);
    });

    test("silently drops ids that are not in the cache", async () => {
        const { userDb } = dbWith({ a: user("a"), c: user("c") });
        const result = await userDb.getCachedUsers(["a", "b", "c"]);
        expect(result.map((u) => u.userId)).toEqual(["a", "c"]);
    });

    test("returns an empty array for an empty input", async () => {
        const { userDb, state } = dbWith({ a: user("a") });
        expect(await userDb.getCachedUsers([])).toEqual([]);
        expect(state.transactions).toBe(0);
    });

    test("uses a single transaction for the whole batch", async () => {
        const { userDb, state } = dbWith({ a: user("a"), b: user("b") });
        await userDb.getCachedUsers(["a", "b", "missing"]);
        expect(state.transactions).toBe(1);
        expect(state.gets).toEqual(["a", "b", "missing"]);
    });
});

function storesDb(initial: Record<string, Record<string, unknown>>) {
    const { db, stores } = fakeIdb(initial);
    const userDb = new UserDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (userDb as any).connectionManager = { getDb: () => Promise.resolve(db) };
    return { userDb, stores };
}

describe("migrated user ids", () => {
    test("getLatestUserIds maps each migrated id to its latest id", async () => {
        const { userDb } = storesDb({ migratedUserIds: { a: "b", c: "d" } });
        const latest = await userDb.getLatestUserIds(["a", "c", "e"]);
        expect(latest).toEqual(
            new Map([
                ["a", "b"],
                ["c", "d"],
            ]),
        );
    });

    test("getLatestUserIds follows a user through each of their migrations", async () => {
        const { userDb } = storesDb({ migratedUserIds: { a: "b", b: "c" } });
        const latest = await userDb.getLatestUserIds(["a", "b"]);
        expect(latest).toEqual(
            new Map([
                ["a", "c"],
                ["b", "c"],
            ]),
        );
    });

    test("getLatestUserIds stops at a cycle rather than looping", async () => {
        const { userDb } = storesDb({ migratedUserIds: { a: "b", b: "a" } });
        const latest = await userDb.getLatestUserIds(["a"]);
        expect(latest).toEqual(new Map([["a", "b"]]));
    });

    test("setMigratedUserIds records the mapping and drops users cached under earlier ids", async () => {
        const { userDb, stores } = storesDb({
            users: { a: user("a"), b: user("b"), x: user("x") },
        });
        await userDb.setMigratedUserIds(new Map([["a", "b"]]));
        expect(stores.get("migratedUserIds")).toEqual(new Map([["a", "b"]]));
        expect([...stores.get("users")!.keys()]).toEqual(["b", "x"]);
    });
});
