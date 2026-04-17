import { type DBSchema } from "idb";
import { Lazy, type WebAuthnKeyFull } from "openchat-shared";
import { bytesToHexString } from "./mapping";
import { IndexedDbConnectionManager } from "./indexedDb";

const CACHE_VERSION = 1;
const STORE_NAME = "webauthn_keys" as const;

interface WebAuthnKeySchema extends DBSchema {
    webauthn_keys: {
        key: string;
        value: WebAuthnKeyFull;
    };
}

export class WebAuthnDb {
    private readonly connectionManager: IndexedDbConnectionManager<WebAuthnKeySchema>;

    constructor() {
        this.connectionManager = IndexedDbConnectionManager.create<WebAuthnKeySchema>(
            "openchat_webauthn_keys",
            [{ name: STORE_NAME }],
            CACHE_VERSION,
        );
    }

    async getCachedWebAuthnKey(credentialId: Uint8Array): Promise<WebAuthnKeyFull | undefined> {
        const db = await this.connectionManager.getDb();
        const key = bytesToHexString(credentialId);
        return db.get(STORE_NAME, key);
    }

    async setCachedWebAuthnKey(value: WebAuthnKeyFull): Promise<void> {
        const db = await this.connectionManager.getDb();
        const key = bytesToHexString(value.credentialId);
        await db.put(STORE_NAME, value, key);
    }
}

const WebAuthnDbInstance = new Lazy(() => new WebAuthnDb());

export function getCachedWebAuthnKey(
    credentialId: Uint8Array,
): Promise<WebAuthnKeyFull | undefined> {
    return WebAuthnDbInstance.get().getCachedWebAuthnKey(credentialId);
}

export function setCachedWebAuthnKey(value: WebAuthnKeyFull): Promise<void> {
    return WebAuthnDbInstance.get().setCachedWebAuthnKey(value);
}
