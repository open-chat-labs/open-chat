import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { WebAuthnKeyFull } from "openchat-shared";
import { bytesToHexString } from "./mapping";

const CACHE_VERSION = 1;
const STORE_NAME = "webauthn_keys";

let db: WebAuthnKeyDatabase | undefined;

export type WebAuthnKeyDatabase = Promise<IDBPDatabase<WebAuthnKeySchema>>;

export interface WebAuthnKeySchema extends DBSchema {
    [STORE_NAME]: {
        key: string;
        value: WebAuthnKeyFull;
    };
}

export function lazyOpenWebAuthnKeyCache(): WebAuthnKeyDatabase {
    if (db) return db;
    console.log("WebAuthnKey db undefined, opening db");
    db = openWebAuthnKeyCache();
    return db;
}

function openWebAuthnKeyCache(): WebAuthnKeyDatabase {
    return openDB<WebAuthnKeySchema>(`openchat_webauthn_keys`, CACHE_VERSION, {
        upgrade(db, _oldVersion, _newVersion, _transaction) {
            if (db.objectStoreNames.contains(STORE_NAME)) {
                db.deleteObjectStore(STORE_NAME);
            }
            db.createObjectStore(STORE_NAME);
        },
    });
}

export async function getCachedWebAuthnKey(credentialId: Uint8Array): Promise<WebAuthnKeyFull | undefined> {
    const resolvedDb = await lazyOpenWebAuthnKeyCache();
    const key = bytesToHexString(credentialId);
    return await resolvedDb.get(STORE_NAME, key);
}

export async function setCachedWebAuthnKey(value: WebAuthnKeyFull): Promise<void> {
    const resolvedDb = await lazyOpenWebAuthnKeyCache();
    const key = bytesToHexString(value.credentialId);
    await resolvedDb.put(STORE_NAME, value, key);
}
