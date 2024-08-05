import type { AuthClientStorage } from "@dfinity/auth-client";
import type { StoredKey } from "@dfinity/auth-client/lib/cjs/storage";

export enum AuthProvider {
    II = "Internet Identity",
    EMAIL = "Email",
    ETH = "Ethereum",
    SOL = "Solana",
    NFID = "Google via NFID",
}

export class InMemoryAuthClientStorage implements AuthClientStorage {
    private _map: Map<string, StoredKey>;

    constructor() {
        this._map = new Map();
    }

    get(key: string): Promise<StoredKey | null> {
        return Promise.resolve(this._map.get(key) ?? null);
    }
    set(key: string, value: StoredKey): Promise<void> {
        this._map.set(key, value);
        return Promise.resolve();
    }
    remove(key: string): Promise<void> {
        this._map.delete(key);
        return Promise.resolve();
    }
}
