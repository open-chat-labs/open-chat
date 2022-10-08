import { openDB, DBSchema, IDBPDatabase } from "idb";
import type { UserSummary } from "../domain/user/user";
import { rollbar } from "./logging";

const CACHE_VERSION = 1;

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

export function openUserCache(): UserDatabase | undefined {
    if (process.env.NODE_ENV === "test" || !process.env.CLIENT_CACHING) {
        return undefined;
    }
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
    }
}

export async function getCachedUsers(db: UserDatabase, userIds: string[]): Promise<UserSummary[]> {
    const resolvedDb = await db;

    const fromCache = await Promise.all(userIds.map((u) => resolvedDb.get("users", u)));

    return fromCache.reduce((users, next) => {
        if (next !== undefined) users.push(next);
        return users;
    }, [] as UserSummary[]);
}

export async function getAllUsers(db: UserDatabase): Promise<UserSummary[]> {
    return (await db).getAll("users");
}

export async function setCachedUsers(db: UserDatabase, users: UserSummary[]): Promise<void> {
    if (users.length === 0) return;

    const tx = (await db).transaction("users", "readwrite", { durability: "relaxed" });
    const store = tx.objectStore("users");

    await Promise.all(users.map((u) => store.put(u, u.userId)));
    await tx.done;
}

export async function setUsername(
    db: UserDatabase,
    userId: string,
    username: string
): Promise<void> {
    const tx = (await db).transaction("users", "readwrite", { durability: "relaxed" });
    const store = tx.objectStore("users");
    const user = await store.get(userId);
    if (user !== undefined) {
        user.username = username;
        await store.put(user, userId);
    }
    await tx.done;
}

let db: UserDatabase | undefined;

export function getDb(): UserDatabase | undefined {
    return db;
}

export function initUserDb(): UserDatabase | undefined {
    db = openUserCache();
    return db;
}

export function closeDb(): void {
    db = undefined;
}
