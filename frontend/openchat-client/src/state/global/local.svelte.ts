import type { CommunityIdentifier, CommunitySummary } from "openchat-shared";
import { LocalCommunityMap } from "../map";

// global local updates don't need the manager because they are not specific to a keyed entity (community, chat, message etc)
export class GlobalLocalState {
    // communities may be added or removed locally or they may be previewed. They are all handled by this.
    readonly communities = new LocalCommunityMap<CommunitySummary>();

    addCommunity(val: CommunitySummary) {
        return this.communities.addOrUpdate(val.id, val);
    }

    removeCommunity(id: CommunityIdentifier) {
        return this.communities.remove(id);
    }
}

export const globalLocalUpdates = new GlobalLocalState();
