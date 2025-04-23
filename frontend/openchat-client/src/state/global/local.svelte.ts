import type { CommunityIdentifier, CommunitySummary } from "openchat-shared";
import { SvelteMap } from "svelte/reactivity";
import { LocalCommunityMap } from "../map";
import type { UndoLocalUpdate } from "../undo";

// global local updates don't need the manager because they are not specific to a keyed entity (community, chat, message etc)
export class GlobalLocalState {
    // communities may be added or removed locally or they may be previewed. They are all handled by this.
    readonly communities = new LocalCommunityMap<CommunitySummary>();
    readonly previewCommunities = new SvelteMap<string, CommunitySummary>();
    readonly communityIndexes = new SvelteMap<string, number>();

    isPreviewingCommunity(id: CommunityIdentifier) {
        return this.previewCommunities.has(JSON.stringify(id));
    }

    getPreviewingCommunity(id: CommunityIdentifier) {
        return this.previewCommunities.get(JSON.stringify(id));
    }

    addCommunityPreview(val: CommunitySummary) {
        return this.previewCommunities.set(JSON.stringify(val.id), val);
    }

    removeCommunityPreview(id: CommunityIdentifier) {
        const key = JSON.stringify(id);
        if (this.previewCommunities.has(key)) {
            return this.previewCommunities.delete(JSON.stringify(id));
        }
        return false;
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
        this.communityIndexes.set(JSON.stringify(id), index);
        return () => {
            this.communityIndexes.delete(JSON.stringify(id));
        };
    }
}

export const globalLocalUpdates = new GlobalLocalState();
