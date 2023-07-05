import {
    CommunityMap,
    CommunityIdentifier,
    LocalCommunitySummaryUpdates,
    CommunitySummary,
} from "openchat-shared";
import { LocalUpdatesStore } from "./localUpdatesStore";

class LocalCommunitySummaryUpdatesStore extends LocalUpdatesStore<
    CommunityIdentifier,
    LocalCommunitySummaryUpdates
> {
    constructor() {
        super(new CommunityMap<LocalCommunitySummaryUpdates>());
    }

    markAdded(summary: CommunitySummary): void {
        this.applyUpdate(summary.id, (_) => ({
            added: summary,
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
