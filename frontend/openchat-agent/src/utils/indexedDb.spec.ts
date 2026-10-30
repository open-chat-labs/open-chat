import type { DBSchema, IDBPDatabase } from "idb";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

const openDB = vi.hoisted(() => vi.fn());
vi.mock("idb", () => ({ openDB }));

import { IndexedDbConnectionManager } from "./indexedDb";

interface Schema extends DBSchema {
    a: { key: string; value: string };
    b: { key: string; value: string };
}

type FakeDb = {
    objectStoreNames: string[];
    deleteObjectStore: Mock;
    createObjectStore: Mock;
    addEventListener: Mock;
};

function fakeDb(existingStores: string[]): FakeDb {
    return {
        objectStoreNames: existingStores,
        deleteObjectStore: vi.fn(),
        createObjectStore: vi.fn(() => ({ createIndex: vi.fn() })),
        addEventListener: vi.fn(),
    };
}

// Opens the manager's database as if the one on disk were at `previousVersion` with
// `existingStores`, and returns the fake database the upgrade ran against
async function upgradeFrom(
    manager: IndexedDbConnectionManager<Schema>,
    previousVersion: number,
    existingStores: string[],
): Promise<FakeDb> {
    const db = fakeDb(existingStores);
    openDB.mockImplementation(
        async (
            _name: string,
            version: number,
            { upgrade }: { upgrade: (db: FakeDb, from: number, to: number, tx: object) => void },
        ) => {
            upgrade(db, previousVersion, version, {});
            return db as unknown as IDBPDatabase<Schema>;
        },
    );
    await manager.getDb();
    // the migrations run one after another, each awaited
    await new Promise((resolve) => setTimeout(resolve, 0));
    return db;
}

function manager(): IndexedDbConnectionManager<Schema> {
    return IndexedDbConnectionManager.create<Schema>("test", [{ name: "a" }, { name: "b" }], 3);
}

describe("opening a cache database", () => {
    beforeEach(() => {
        openDB.mockReset();
    });

    test("a new database gets the stores", async () => {
        const db = await upgradeFrom(manager(), 0, []);

        expect(db.deleteObjectStore).not.toHaveBeenCalled();
        expect(db.createObjectStore.mock.calls.map((c) => c[0])).toEqual(["a", "b"]);
    });

    test("an earlier version is migrated when every version has a migration", async () => {
        const from1 = vi.fn(async () => {});
        const from2 = vi.fn(async () => {});
        const db = await upgradeFrom(manager().withMigration(1, from1).withMigration(2, from2), 1, [
            "a",
            "b",
        ]);

        expect(from1).toHaveBeenCalledOnce();
        expect(from2).toHaveBeenCalledOnce();
        expect(db.deleteObjectStore).not.toHaveBeenCalled();
    });

    test("with no migrations, any earlier version is wiped and recreated", async () => {
        const db = await upgradeFrom(manager(), 2, ["a", "b", "old"]);

        expect(db.deleteObjectStore.mock.calls.map((c) => c[0])).toEqual(["a", "b", "old"]);
        expect(db.createObjectStore.mock.calls.map((c) => c[0])).toEqual(["a", "b"]);
    });

    // The version on disk has a migration but a later one doesn't, which used to run the first,
    // log the gap and leave the data in place under the current version
    test("a later version with no migration wipes rather than skipping it", async () => {
        const from1 = vi.fn(async () => {});
        const db = await upgradeFrom(manager().withMigration(1, from1), 1, ["a", "b"]);

        expect(from1).not.toHaveBeenCalled();
        expect(db.deleteObjectStore.mock.calls.map((c) => c[0])).toEqual(["a", "b"]);
        expect(db.createObjectStore.mock.calls.map((c) => c[0])).toEqual(["a", "b"]);
    });
});
