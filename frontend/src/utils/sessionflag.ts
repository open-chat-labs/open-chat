import { openDB, DBSchema, IDBPDatabase } from "idb";
import { rollbar } from "./logging";

const CACHE_VERSION = 1;

export type Database = Promise<IDBPDatabase<SessionSchema>>;

export interface SessionSchema extends DBSchema {
    signed_in: {
        key: string;
        value: number;
    };
}

export function openSessionFlagDb(): Database | undefined {
    if (process.env.NODE_ENV === "test") {
        return undefined;
    }
    try {
        return openDB<SessionSchema>(`openchat_session_flag`, CACHE_VERSION, {
            upgrade(db, _oldVersion, _newVersion) {
                try {
                    if (!db.objectStoreNames.contains("signed_in")) {
                        db.createObjectStore("signed_in");
                    }
                } catch (err) {
                    rollbar.error("Unable to upgrade session flag indexedDB", err as Error);
                }
            },
        });
    } catch (err) {
        rollbar.error("Unable to open session flag indexedDB", err as Error);
    }
}

export async function updateSessionFlag(timestamp: number): Promise<void> {
    if (db !== undefined) {
        (await db).put("signed_in", timestamp, "signed_in");
    }
}

const db = openSessionFlagDb();
