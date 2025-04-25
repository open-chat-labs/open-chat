import type { CommunityIdentifier, CommunitySummary } from "openchat-shared";
import { LocalCommunityMap, ReactiveCommunityMap } from "../map";
import type { UndoLocalUpdate } from "../undo";

// global local updates don't need the manager because they are not specific to a keyed entity (community, chat, message etc)
export class GlobalLocalState {
    // communities may be added or removed locally or they may be previewed. They are all handled by this.
    readonly communities = new LocalCommunityMap<CommunitySummary>();
    readonly previewCommunities = new ReactiveCommunityMap<CommunitySummary>();
    readonly communityIndexes = new ReactiveCommunityMap<number>();

    isPreviewingCommunity(id: CommunityIdentifier) {
        return this.previewCommunities.has(id);
    }

    getPreviewingCommunity(id: CommunityIdentifier) {
        return this.previewCommunities.get(id);
    }

    addCommunityPreview(val: CommunitySummary) {
        return this.previewCommunities.set(val.id, val);
    }

    removeCommunityPreview(id: CommunityIdentifier) {
        return this.previewCommunities.delete(id);
    }

    addCommunity(val: CommunitySummary) {
        return this.communities.addOrUpdate(val.id, val);
    }

    removeCommunity(id: CommunityIdentifier) {
        if (!this.removeCommunityPreview(id)) {
            return this.communities.remove(id);
        }
    }

    updateCommunityIndex(id: CommunityIdentifier, index: number): UndoLocalUpdate {
        this.communityIndexes.set(id, index);
        return () => {
            this.communityIndexes.delete(id);
        };
    }
}

export const globalLocalUpdates = new GlobalLocalState();
