import { openDB, DBSchema, IDBPDatabase } from "idb";
import { measure } from "../services/common/profiling";
import type { UserSummary } from "../domain/user/user";
import { rollbar } from "./logging";

const CACHE_VERSION = 1;

let db: UserDatabase | undefined;

export type UserDatabase = Promise<IDBPDatabase<UserSchema>>;

export interface UserSchema extends DBSchema {
    users: {
        key: string;
        value: UserSummary;
    };
}

export function cachingLocallyDisabled(): boolean {
    return !!localStorage.getItem("openchat_nocache");
}

export function lazyOpenUserCache(): UserDatabase {
    if (db) return db;
    console.log("user db undefined, opening db");
    db = openUserCache();
    return db;
}

export function openUserCache(): UserDatabase {
    try {
        return openDB<UserSchema>(`openchat_users`, CACHE_VERSION, {
            upgrade(db, _oldVersion, _newVersion, _transaction) {
                try {
                    if (db.objectStoreNames.contains("users")) {
                        db.deleteObjectStore("users");
                    }
                    db.createObjectStore("users");
                } catch (err) {
                    rollbar.error("Unable to upgrade indexedDB for users", err as Error);
                }
            },
        });
    } catch (err) {
        rollbar.error("Unable to open indexedDB for users", err as Error);
        throw err;
    }
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
    return (await lazyOpenUserCache()).getAll("users");
}

export async function setCachedUsers(users: UserSummary[]): Promise<void> {
    if (users.length === 0) return;
    writeCachedUsersToDatabase(lazyOpenUserCache(), users);
}

export async function writeCachedUsersToDatabase(
    db: UserDatabase,
    users: UserSummary[]
): Promise<void> {
    // in this one case we will open the db every time because we expect this to be done from the service worker
    const tx = (await db).transaction("users", "readwrite", {
        durability: "relaxed",
    });
    const store = tx.objectStore("users");
    Promise.all(users.map((u) => store.put(u, u.userId)));
    await tx.done;
}

export async function setUsername(userId: string, username: string): Promise<void> {
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
