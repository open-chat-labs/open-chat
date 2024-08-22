import { GlobalMap, type LocalGlobalUpdates, type WalletConfig } from "openchat-shared";
import { LocalUpdatesStore } from "./localUpdatesStore";

class LocalGlobalUpdatesStore extends LocalUpdatesStore<"global", LocalGlobalUpdates> {
    constructor() {
        super(new GlobalMap());
    }

    updateWallet(walletConfig: WalletConfig) {
        this.applyUpdate("global", (_) => ({
            walletConfig,
        }));
    }
}

export const localGlobalUpdates = new LocalGlobalUpdatesStore();
