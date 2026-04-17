import { deleteDB, type DBSchema } from "idb";
import { deletedUser, type DiamondMembershipStatus, type UserSummary } from "openchat-shared";
import { IndexedDbConnectionManager } from "./indexedDb";

const CACHE_VERSION = 13;
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
}

export class UserDb {
    private readonly connectionManager: IndexedDbConnectionManager<UserSchema>;

    constructor() {
        this.connectionManager = IndexedDbConnectionManager.create<UserSchema>(
            DB_NAME,
            [{ name: "users" }, { name: "suspendedUsersSyncedUpTo" }, { name: "deletedUserIds" }],
            CACHE_VERSION,
        );
    }

    async getCachedUsers(userIds: string[]): Promise<UserSummary[]> {
        const db = await this.connectionManager.getDb();
        const fromCache = await Promise.all(userIds.map((u) => db.get("users", u)));
        return fromCache.reduce((users, next) => {
            if (next !== undefined) users.push(next);
            return users;
        }, [] as UserSummary[]);
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
