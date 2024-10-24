import {
    CommunityMap,
    type CommunityIdentifier,
    type LocalCommunitySummaryUpdates,
    type CommunitySummary,
} from "openchat-shared";
import { LocalUpdatesStore } from "./localUpdatesStore";

class LocalCommunitySummaryUpdatesStore extends LocalUpdatesStore<
    CommunityIdentifier,
    LocalCommunitySummaryUpdates
> {
    constructor() {
        super(new CommunityMap<LocalCommunitySummaryUpdates>());
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
