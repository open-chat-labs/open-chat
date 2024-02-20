import { IdbKeyVal } from "@dfinity/auth-client";
import { DelegationChain, DelegationIdentity, ECDSAKeyIdentity } from "@dfinity/identity";

const DB_VERSION = 1;
const KEY_STORAGE_KEY = "identity";
const KEY_STORAGE_DELEGATION = "delegation";

class IdbStorage {
    // Initializes a KeyVal on first request
    private initializedDb: IdbKeyVal | undefined = undefined;
    get _db(): Promise<IdbKeyVal> {
        return new Promise((resolve) => {
            if (this.initializedDb) {
                resolve(this.initializedDb);
                return;
            }
            IdbKeyVal.create({ version: DB_VERSION, dbName: "oc-auth-db" }).then((db) => {
                this.initializedDb = db;
                resolve(db);
            });
        });
    }

    public async get<T = string>(key: string): Promise<T | null> {
        const db = await this._db;
        return await db.get(key);
    }

    public async set<T>(key: string, value: T): Promise<void> {
        const db = await this._db;
        await db.set(key, value);
    }

    public async remove(key: string): Promise<void> {
        const db = await this._db;
        await db.remove(key);
    }
}

export class IdentityStorage {
    private storage = new IdbStorage();

    async get(): Promise<DelegationIdentity | undefined> {
        const key = await this.storage.get<CryptoKeyPair>(KEY_STORAGE_KEY);
        if (key == null) return undefined;
        const chain = await this.storage.get(KEY_STORAGE_DELEGATION);
        if (chain == null) return undefined;

        const id = await ECDSAKeyIdentity.fromKeyPair(key);

        return DelegationIdentity.fromDelegation(id, DelegationChain.fromJSON(chain));
    }

    async set(key: ECDSAKeyIdentity, chain: DelegationChain): Promise<void> {
        await this.storage.set(KEY_STORAGE_KEY, key.getKeyPair());
        await this.storage.set(KEY_STORAGE_DELEGATION, chain.toJSON());
    }

    async remove(): Promise<void> {
        await this.storage.remove(KEY_STORAGE_KEY);
        await this.storage.remove(KEY_STORAGE_DELEGATION);
    }
}
