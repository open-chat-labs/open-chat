import { SignIdentity } from "@dfinity/agent";
import { IdbStorage } from "@dfinity/auth-client";
import { DelegationChain, DelegationIdentity, ECDSAKeyIdentity, isDelegationValid } from "@dfinity/identity";

const KEY_STORAGE_AUTH_PRINCIPAL = "auth_principal";
const KEY_STORAGE_KEY = "identity";
const KEY_STORAGE_DELEGATION = "delegation";

export class IdentityStorage {
    readonly storage: IdbStorage;

    private constructor(dbName: string) {
        this.storage = new IdbStorage({ dbName })
    }

    static createForAuthIdentity(): IdentityStorage {
        return new IdentityStorage("auth-client-db");
    }

    static createForOcIdentity(): IdentityStorage {
        return new IdentityStorage("oc-auth-db");
    }

    async get(authPrincipal?: string): Promise<SignIdentity | undefined> {
        if (authPrincipal !== undefined) {
            const storedAuthPrincipal = await this.storage.get<string>(KEY_STORAGE_AUTH_PRINCIPAL);
            if (storedAuthPrincipal == null) return undefined;
            if (storedAuthPrincipal !== authPrincipal) {
                this.remove();
                return undefined;
            }
        }

        const key = await this.storage.get<CryptoKeyPair>(KEY_STORAGE_KEY);
        if (key == null) return undefined;

        const chainJson = await this.storage.get<string>(KEY_STORAGE_DELEGATION);
        if (chainJson == null) return undefined;
        const chain = DelegationChain.fromJSON(chainJson);

        if (!isDelegationValid(chain)) {
            this.remove();
            return undefined;
        }

        const id = await ECDSAKeyIdentity.fromKeyPair(key);
        return DelegationIdentity.fromDelegation(id, chain);
    }

    async set(key: ECDSAKeyIdentity, chain: DelegationChain, authPrincipal?: string): Promise<void> {
        if (authPrincipal !== undefined) {
            await this.storage.set(KEY_STORAGE_AUTH_PRINCIPAL, authPrincipal);
        }
        await this.storage.set(KEY_STORAGE_KEY, key.getKeyPair());
        await this.storage.set(KEY_STORAGE_DELEGATION, JSON.stringify(chain.toJSON()));
    }

    async remove(): Promise<void> {
        await this.storage.remove(KEY_STORAGE_AUTH_PRINCIPAL);
        await this.storage.remove(KEY_STORAGE_KEY);
        await this.storage.remove(KEY_STORAGE_DELEGATION);
    }
}
