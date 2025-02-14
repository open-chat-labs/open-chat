import {
    CommunityMap,
    type CommunityIdentifier,
    type LocalCommunitySummaryUpdates,
    type CommunitySummary,
    type ExternalBotPermissions,
} from "openchat-shared";
import { LocalUpdatesStore } from "./localUpdatesStore";

class LocalCommunitySummaryUpdatesStore extends LocalUpdatesStore<
    CommunityIdentifier,
    LocalCommunitySummaryUpdates
> {
    constructor() {
        super(new CommunityMap<LocalCommunitySummaryUpdates>());
    }

    installBot(id: CommunityIdentifier, botId: string, perm: ExternalBotPermissions) {
        this.applyUpdate(id, (current) => {
            const result = { ...current };
            if (result.installedBots === undefined) {
                result.installedBots = new Map();
            }
            result.removedBots?.delete(botId);
            result.installedBots.set(botId, perm);
            return result;
        });
    }

    removeBot(id: CommunityIdentifier, botId: string) {
        this.applyUpdate(id, (current) => {
            const result = { ...current };
            if (result.removedBots === undefined) {
                result.removedBots = new Set();
            }
            result.removedBots.add(botId);
            result.installedBots?.delete?.(botId);
            return result;
        });
    }

    updateIndex(id: CommunityIdentifier, index: number): void {
        this.applyUpdate(id, (_) => ({
            index,
        }));
    }
    updateDisplayName(id: CommunityIdentifier, displayName: string | undefined): void {
        this.applyUpdate(id, (_) => ({
            displayName: displayName !== undefined ? { value: displayName } : "set_to_none",
        }));
    }

    updateRulesAccepted(id: CommunityIdentifier, rulesAccepted: boolean): void {
        this.applyUpdate(id, (_) => ({
            rulesAccepted,
        }));
    }

    markAdded(summary: CommunitySummary): void {
        this.applyUpdate(summary.id, (_) => ({
            added: { ...summary, membership: { ...summary.membership, lapsed: false } },
            removedAtTimestamp: undefined,
        }));
    }
    markRemoved(id: CommunityIdentifier): void {
        this.applyUpdate(id, (_) => ({
            added: undefined,
            removedAtTimestamp: BigInt(Date.now()),
        }));
    }
    delete(id: CommunityIdentifier): void {
        this.deleteKey(id);
    }
}

export const localCommunitySummaryUpdates = new LocalCommunitySummaryUpdatesStore();
