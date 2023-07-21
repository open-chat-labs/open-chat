import { openDB, DBSchema, IDBPDatabase } from "idb";
import type { RegistryValue } from "openchat-shared";

const CACHE_VERSION = 1;
const KEY = "registry";

let db: RegistryDatabase | undefined;

export type RegistryDatabase = Promise<IDBPDatabase<RegistrySchema>>;

export interface RegistrySchema extends DBSchema {
    registry: {
        key: string;
        value: RegistryValue;
    };
}

export function lazyOpenRegistryCache(): RegistryDatabase {
    if (db) return db;
    console.log("registry db undefined, opening db");
    db = openRegistryCache();
    return db;
}

function openRegistryCache(): RegistryDatabase {
    return openDB<RegistrySchema>(`openchat_registry`, CACHE_VERSION, {
        upgrade(db, _oldVersion, _newVersion, _transaction) {
            if (db.objectStoreNames.contains("registry")) {
                db.deleteObjectStore("registry");
            }
            db.createObjectStore("registry");
        },
    });
}

export async function getRegistry(): Promise<RegistryValue | undefined> {
    const resolvedDb = await lazyOpenRegistryCache();

    return await resolvedDb.get(KEY, KEY);
}

export async function setRegistry(value: RegistryValue): Promise<void> {
    const resolvedDb = await lazyOpenRegistryCache();

    await resolvedDb.put(KEY, value, KEY);
}
