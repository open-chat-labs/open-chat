import {
    GlobalMap,
    type ExternalBotPermissions,
    type LocalGlobalUpdates,
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

    installBot(botId: string, perm: ExternalBotPermissions) {
        this.applyUpdate("global", (current) => {
            const result = { ...current };
            if (result.installedDirectBots === undefined) {
                result.installedDirectBots = new Map();
            }
            result.removedDirectBots?.delete(botId);
            result.installedDirectBots.set(botId, perm);
            return result;
        });
    }

    removeBot(botId: string) {
        this.applyUpdate("global", (current) => {
            const result = { ...current };
            if (result.removedDirectBots === undefined) {
                result.removedDirectBots = new Set();
            }
            result.removedDirectBots.add(botId);
            result.installedDirectBots?.delete?.(botId);
            return result;
        });
    }
}

export const localGlobalUpdates = new LocalGlobalUpdatesStore();
