import type { AuthClientStorage } from "@dfinity/auth-client";

export enum AuthProvider {
    II = "Internet Identity",
    EMAIL = "Email",
    ETH = "Ethereum",
    SOL = "Solana",
    NFID = "Google via NFID",
    WEBAUTHN = "Passkey",
}

export class InMemoryAuthClientStorage implements AuthClientStorage {
    private _map: Map<string, string>;

    constructor() {
        this._map = new Map();
    }

    get(key: string): Promise<string | null> {
        return Promise.resolve(this._map.get(key) ?? null);
    }
    set(key: string, value: string): Promise<void> {
        this._map.set(key, value);
        return Promise.resolve();
    }
    remove(key: string): Promise<void> {
        this._map.delete(key);
        return Promise.resolve();
    }
}
