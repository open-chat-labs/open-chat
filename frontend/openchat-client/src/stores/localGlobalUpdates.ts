import {
    GlobalMap,
    type LocalGlobalUpdates,
    type StreakInsurance,
    type WalletConfig,
} from "openchat-shared";
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

    updateStreakInsurance(streakInsurance: StreakInsurance) {
        this.applyUpdate("global", (_) => ({
            streakInsurance,
        }));
    }
}

export const localGlobalUpdates = new LocalGlobalUpdatesStore();
