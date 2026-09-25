import { deleteDB, type DBSchema, type IDBPDatabase } from "idb";
import { deletedUser, type DiamondMembershipStatus, type UserSummary } from "@shared";
import { IndexedDbConnectionManager } from "./indexedDb";

const CACHE_VERSION = 14;
const DB_NAME = "openchat_users";

export interface UserSchema extends DBSchema {
    users: {
        key: string;
        value: UserSummary;
    };

    suspendedUsersSyncedUpTo: {
        key: "value";
        value: bigint;
    };

    deletedUserIds: {
        key: string;
        value: string;
    };

    // The id a user had before being migrated to a MultiUser canister, mapped to the id they
    // were migrated to
    migratedUserIds: {
        key: string;
        value: string;
    };
}

async function createMigratedUserIdsStore(db: IDBPDatabase<UserSchema>) {
    if (!db.objectStoreNames.contains("migratedUserIds")) {
        db.createObjectStore("migratedUserIds");
    }
}

export class UserDb {
    private readonly connectionManager: IndexedDbConnectionManager<UserSchema>;

    constructor() {
        this.connectionManager = IndexedDbConnectionManager.create<UserSchema>(
            DB_NAME,
            [
                { name: "users" },
                { name: "suspendedUsersSyncedUpTo" },
                { name: "deletedUserIds" },
                { name: "migratedUserIds" },
            ],
            CACHE_VERSION,
        ).withMigration(13, createMigratedUserIdsStore);
    }

    async getCachedUsers(userIds: string[]): Promise<UserSummary[]> {
        if (userIds.length === 0) return [];
        const db = await this.connectionManager.getDb();
        // one transaction for the whole batch - db.get would open one per user id
        const tx = db.transaction("users", "readonly");
        const store = tx.objectStore("users");
        const fromCache = await Promise.all(userIds.map((u) => store.get(u)));
        await tx.done;
        return fromCache.reduce((users, next) => {
            if (next !== undefined) users.push(next);
            return users;
        }, [] as UserSummary[]);
    }

    // Returns the latest id of each of `userIds` which is known to belong to a user who has since
    // been migrated to a MultiUser canister, following them through any later migrations
    async getLatestUserIds(userIds: string[]): Promise<Map<string, string>> {
        const latest = new Map<string, string>();
        if (userIds.length === 0) return latest;
        const db = await this.connectionManager.getDb();
        const tx = db.transaction("migratedUserIds", "readonly");
        const store = tx.objectStore("migratedUserIds");
        await Promise.all(
            [...new Set(userIds)].map(async (userId) => {
                const seen = new Set([userId]);
                let next = await store.get(userId);
                let current = userId;
                while (next !== undefined && !seen.has(next)) {
                    seen.add(next);
                    current = next;
                    next = await store.get(current);
                }
                if (current !== userId) {
                    latest.set(userId, current);
                }
            }),
        );
        await tx.done;
        return latest;
    }

    // Records each earlier id's latest id, and removes any users cached under an earlier id, since
    // they're now cached under their latest id
    async setMigratedUserIds(migrated: ReadonlyMap<string, string>): Promise<void> {
        if (migrated.size === 0) return;
        const db = await this.connectionManager.getDb();
        const tx = db.transaction(["migratedUserIds", "users"], "readwrite", {
            durability: "relaxed",
        });
        const migratedStore = tx.objectStore("migratedUserIds");
        const userStore = tx.objectStore("users");
        const writes = [...migrated].flatMap(([previous, latest]) => [
            migratedStore.put(latest, previous),
            userStore.delete(previous),
        ]);
        await Promise.all(writes);
        await tx.done;
    }

    async getAllUsers(): Promise<UserSummary[]> {
        const db = await this.connectionManager.getDb();
        const users = await db.getAll("users");
        const deleted = await db.getAll("deletedUserIds");
        return [...users, ...deleted.map(deletedUser)];
    }

    async isUserIdDeleted(userId: string): Promise<boolean> {
        const db = await this.connectionManager.getDb();
        const user = await db.get("deletedUserIds", userId);
        return user !== undefined;
    }

    async setCachedUsers(users: UserSummary[]): Promise<void> {
        if (users.length === 0) return;
        const db = await this.connectionManager.getDb();
        const tx = db.transaction("users", "readwrite", { durability: "relaxed" });
        const store = tx.objectStore("users");
        await Promise.all(users.map((u) => store.put(u, u.userId)));
        await tx.done;
    }

    async setCachedDeletedUserIds(deletedUserIds: Set<string>): Promise<void> {
        if (deletedUserIds.size === 0) return;
        const db = await this.connectionManager.getDb();
        const tx = db.transaction(["deletedUserIds", "users"], "readwrite", {
            durability: "relaxed",
        });
        const deletedStore = tx.objectStore("deletedUserIds");
        const userStore = tx.objectStore("users");
        const inserts = [...deletedUserIds].map((userId) => deletedStore.put(userId, userId));
        const deletes = [...deletedUserIds].map((userId) => userStore.delete(userId));
        await Promise.all([...inserts, ...deletes]);
        await tx.done;
    }

    async setUsernameInCache(userId: string, username: string): Promise<void> {
        const db = await this.connectionManager.getDb();
        const tx = db.transaction("users", "readwrite", { durability: "relaxed" });
        const store = tx.objectStore("users");
        const user = await store.get(userId);
        if (user !== undefined) {
            user.username = username;
            await store.put(user, userId);
        }
        await tx.done;
    }

    async setDisplayNameInCache(userId: string, displayName: string | undefined): Promise<void> {
        const db = await this.connectionManager.getDb();
        const tx = db.transaction("users", "readwrite", { durability: "relaxed" });
        const store = tx.objectStore("users");
        const user = await store.get(userId);
        if (user !== undefined) {
            user.displayName = displayName;
            await store.put(user, userId);
        }
        await tx.done;
    }

    async setUserDiamondStatusInCache(
        userId: string,
        status: DiamondMembershipStatus,
    ): Promise<void> {
        const db = await this.connectionManager.getDb();
        const tx = db.transaction("users", "readwrite", { durability: "relaxed" });
        const store = tx.objectStore("users");
        const user = await store.get(userId);
        if (user !== undefined) {
            user.diamondStatus = status.kind;
            await store.put(user, userId);
        }
        await tx.done;
    }

    async getSuspendedUsersSyncedUpTo(): Promise<bigint | undefined> {
        const db = await this.connectionManager.getDb();
        return db.get("suspendedUsersSyncedUpTo", "value");
    }

    async setSuspendedUsersSyncedUpTo(value: bigint): Promise<void> {
        const db = await this.connectionManager.getDb();
        await db.put("suspendedUsersSyncedUpTo", value, "value");
    }

    async userSuspended(userId: string, suspended: boolean): Promise<void> {
        const db = await this.connectionManager.getDb();
        const tx = db.transaction("users", "readwrite", { durability: "relaxed" });
        const store = tx.objectStore("users");
        const user = await store.get(userId);
        if (user !== undefined) {
            user.suspended = suspended;
            await store.put(user, userId);
        }
        await tx.done;
    }

    async setChitInfoInCache(userId: string, chitBalance: number, streak: number): Promise<void> {
        const db = await this.connectionManager.getDb();
        const tx = db.transaction("users", "readwrite", { durability: "relaxed" });
        const store = tx.objectStore("users");
        const user = await store.get(userId);
        if (user !== undefined) {
            user.chitBalance = chitBalance;
            user.streak = streak;
            await store.put(user, userId);
        }
        await tx.done;
    }

    async clearCache(): Promise<void> {
        try {
            const db = await this.connectionManager.getDb();
            db.close();
            await deleteDB(DB_NAME);
            console.log("deleted db: ", DB_NAME);
        } catch (err) {
            console.error("Unable to delete db: ", DB_NAME, err);
        }
    }
}
