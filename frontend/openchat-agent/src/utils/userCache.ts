import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from "idb";
import { deletedUser, type DiamondMembershipStatus, type UserSummary } from "openchat-shared";

const CACHE_VERSION = 11;

let db: UserDatabase | undefined;

export type UserDatabase = Promise<IDBPDatabase<UserSchema>>;

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

export function lazyOpenUserCache(): UserDatabase {
    if (db) return db;
    console.log("user db undefined, opening db");
    db = openUserCache();
    return db;
}

function openUserCache(): UserDatabase {
    return openDB<UserSchema>(`openchat_users`, CACHE_VERSION, {
        upgrade(db, _oldVersion, _newVersion, _transaction) {
            if (db.objectStoreNames.contains("users")) {
                db.deleteObjectStore("users");
            }
            if (db.objectStoreNames.contains("suspendedUsersSyncedUpTo")) {
                db.deleteObjectStore("suspendedUsersSyncedUpTo");
            }
            if (db.objectStoreNames.contains("deletedUserIds")) {
                db.deleteObjectStore("deletedUserIds");
            }
            db.createObjectStore("users");
            db.createObjectStore("suspendedUsersSyncedUpTo");
            db.createObjectStore("deletedUserIds");
        },
    });
}

export async function getCachedUsers(userIds: string[]): Promise<UserSummary[]> {
    const resolvedDb = await lazyOpenUserCache();

    const fromCache = await Promise.all(userIds.map((u) => resolvedDb.get("users", u)));

    return fromCache.reduce((users, next) => {
        if (next !== undefined) users.push(next);
        return users;
    }, [] as UserSummary[]);
}

export async function getAllUsers(): Promise<UserSummary[]> {
    const users = await (await lazyOpenUserCache()).getAll("users");
    const deleted = await getDeletedUserIdsList();
    const userIds = new Set(users.map((u) => u.userId));

    // only consider records from the deleted list that do not exist in the real users list
    // this is necessary because a userId can be resurrected by being re-used
    const reallyDeleted = deleted.filter((u) => !userIds.has(u));
    return [...users, ...reallyDeleted.map(deletedUser)];
}

async function getDeletedUserIdsList(): Promise<string[]> {
    return (await lazyOpenUserCache()).getAll("deletedUserIds");
}

export async function getCachedDeletedUserIds(): Promise<Set<string>> {
    return getDeletedUserIdsList().then((list) => new Set(list));
}

export async function isUserIdDeleted(userId: string): Promise<boolean> {
    const user = await (await lazyOpenUserCache()).get("deletedUserIds", userId);
    return user !== undefined;
}

export async function setCachedUsers(users: UserSummary[]): Promise<void> {
    if (users.length === 0) return;
    writeCachedUsersToDatabase(lazyOpenUserCache(), users);
}

export async function setCachedDeletedUserIds(deletedUserIds: Set<string>): Promise<void> {
    if (deletedUserIds.size === 0) return;
    const db = await lazyOpenUserCache();
    const tx = (await db).transaction(["deletedUserIds", "users"], "readwrite", {
        durability: "relaxed",
    });
    const deletedStore = tx.objectStore("deletedUserIds");
    const userStore = tx.objectStore("users");

    // insert all the deletedIds into the deletedUserIds store
    const inserts = [...deletedUserIds].map((userId) => deletedStore.put(userId, userId));

    // delete all the deletedIds from the main userStore
    const deletes = [...deletedUserIds].map((userId) => userStore.delete(userId));

    Promise.all([...inserts, ...deletes]);
    await tx.done;
}

export async function writeCachedUsersToDatabase(
    db: UserDatabase,
    users: UserSummary[],
): Promise<void> {
    // in this one case we will open the db every time because we expect this to be done from the service worker
    const tx = (await db).transaction("users", "readwrite", {
        durability: "relaxed",
    });
    const store = tx.objectStore("users");
    Promise.all(users.map((u) => store.put(u, u.userId)));
    await tx.done;
}

export async function setUsernameInCache(userId: string, username: string): Promise<void> {
    const tx = (await lazyOpenUserCache()).transaction("users", "readwrite", {
        durability: "relaxed",
    });
    const store = tx.objectStore("users");
    const user = await store.get(userId);
    if (user !== undefined) {
        user.username = username;
        await store.put(user, userId);
    }
    await tx.done;
}

export async function setDisplayNameInCache(
    userId: string,
    displayName: string | undefined,
): Promise<void> {
    const tx = (await lazyOpenUserCache()).transaction("users", "readwrite", {
        durability: "relaxed",
    });
    const store = tx.objectStore("users");
    const user = await store.get(userId);
    if (user !== undefined) {
        user.displayName = displayName;
        await store.put(user, userId);
    }
    await tx.done;
}

export async function setUserDiamondStatusInCache(
    userId: string,
    status: DiamondMembershipStatus,
): Promise<void> {
    const tx = (await lazyOpenUserCache()).transaction("users", "readwrite", {
        durability: "relaxed",
    });
    const store = tx.objectStore("users");
    const user = await store.get(userId);
    if (user !== undefined) {
        user.diamondStatus = status.kind;
        await store.put(user, userId);
    }
    await tx.done;
}

export async function getSuspendedUsersSyncedUpTo(): Promise<bigint | undefined> {
    const resolvedDb = await lazyOpenUserCache();
    return await resolvedDb.get("suspendedUsersSyncedUpTo", "value");
}

export async function setSuspendedUsersSyncedUpTo(value: bigint): Promise<void> {
    const resolvedDb = await lazyOpenUserCache();
    await resolvedDb.put("suspendedUsersSyncedUpTo", value, "value");
}

export async function setChitInfoInCache(
    userId: string,
    chitBalance: number,
    streak: number,
): Promise<void> {
    const tx = (await lazyOpenUserCache()).transaction("users", "readwrite", {
        durability: "relaxed",
    });
    const store = tx.objectStore("users");
    const user = await store.get(userId);
    if (user !== undefined) {
        user.chitBalance = chitBalance;
        user.streak = streak;
        await store.put(user, userId);
    }
    await tx.done;
}

export async function clearCache(): Promise<void> {
    const name = `openchat_users`;
    try {
        if (db !== undefined) {
            (await db).close();
        }
        await deleteDB(name);
        console.log("deleted db: ", name);
    } catch (err) {
        console.error("Unable to delete db: ", name, err);
    }
}
