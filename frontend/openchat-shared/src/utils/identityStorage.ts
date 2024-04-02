import { type AuthClientStorage, IdbStorage } from "@dfinity/auth-client";
import { DelegationChain, DelegationIdentity, ECDSAKeyIdentity } from "@dfinity/identity";

const KEY_STORAGE_KEY = "identity";
const KEY_STORAGE_DELEGATION = "delegation";

export class IdentityStorage {
    private storage: AuthClientStorage = new IdbStorage({ dbName: "oc-auth-db" });

    async get(): Promise<DelegationIdentity | undefined> {
        const key = (await this.storage.get(KEY_STORAGE_KEY)) as CryptoKeyPair;
        if (key == null) return undefined;
        const chain = (await this.storage.get(KEY_STORAGE_DELEGATION)) as string;
        if (chain == null) return undefined;

        const id = await ECDSAKeyIdentity.fromKeyPair(key);

        return DelegationIdentity.fromDelegation(id, DelegationChain.fromJSON(chain));
    }

    async set(key: ECDSAKeyIdentity, chain: DelegationChain): Promise<void> {
        await this.storage.set(KEY_STORAGE_KEY, key.getKeyPair());
        await this.storage.set(KEY_STORAGE_DELEGATION, JSON.stringify(chain.toJSON()));
    }

    async remove(): Promise<void> {
        await this.storage.remove(KEY_STORAGE_KEY);
        await this.storage.remove(KEY_STORAGE_DELEGATION);
    }
}
