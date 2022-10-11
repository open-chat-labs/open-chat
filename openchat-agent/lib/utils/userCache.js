import { openDB } from "idb";
import { logger } from "./logger";
const CACHE_VERSION = 1;
let db;
export function cachingLocallyDisabled() {
    return !!localStorage.getItem("openchat_nocache");
}
export function lazyOpenUserCache() {
    if (db)
        return db;
    console.log("user db undefined, opening db");
    db = openUserCache();
    return db;
}
export function openUserCache() {
    try {
        return openDB(`openchat_users`, CACHE_VERSION, {
            upgrade(db, _oldVersion, _newVersion, _transaction) {
                try {
                    if (db.objectStoreNames.contains("users")) {
                        db.deleteObjectStore("users");
                    }
                    db.createObjectStore("users");
                }
                catch (err) {
                    logger.error("Unable to upgrade indexedDB for users", err);
                }
            },
        });
    }
    catch (err) {
        logger.error("Unable to open indexedDB for users", err);
        throw err;
    }
}
export async function getCachedUsers(userIds) {
    const resolvedDb = await lazyOpenUserCache();
    const fromCache = await Promise.all(userIds.map((u) => resolvedDb.get("users", u)));
    return fromCache.reduce((users, next) => {
        if (next !== undefined)
            users.push(next);
        return users;
    }, []);
}
export async function getAllUsers() {
    return (await lazyOpenUserCache()).getAll("users");
}
export async function setCachedUsers(users) {
    if (users.length === 0)
        return;
    writeCachedUsersToDatabase(lazyOpenUserCache(), users);
}
export async function writeCachedUsersToDatabase(db, users) {
    // in this one case we will open the db every time because we expect this to be done from the service worker
    const tx = (await db).transaction("users", "readwrite", {
        durability: "relaxed",
    });
    const store = tx.objectStore("users");
    Promise.all(users.map((u) => store.put(u, u.userId)));
    await tx.done;
}
export async function setUsername(userId, username) {
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
//# sourceMappingURL=userCache.js.map