import { SafeMap, type LocalGlobalUpdates, type WalletConfig } from "openchat-shared";
import { LocalUpdatesStore } from "./localUpdatesStore";

class LocalGlobalUpdatesStore extends LocalUpdatesStore<"global", LocalGlobalUpdates> {
    constructor() {
        super(
            new SafeMap<"global", LocalGlobalUpdates>(
                (s) => s,
                (_) => "global",
            ),
        );
    }

    updateWallet(walletConfig: WalletConfig) {
        this.applyUpdate("global", (_) => ({
            walletConfig,
        }));
    }
}

export const localGlobalUpdates = new LocalGlobalUpdatesStore();
