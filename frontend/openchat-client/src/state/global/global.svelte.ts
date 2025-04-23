import { dequal } from "dequal";
import { CommunityMap, type CommunitySummary, type UserGroupSummary } from "openchat-shared";
import type { ReadonlyMap } from "../map";
import { globalLocalUpdates } from "./local.svelte";

// I don't know whether we are going to keep this split of classes. It's kind of arbitrary but I just
// want to mirror the existing structure for now so I don't have to think abou that too much.
export class GlobalState {
    #serverCommunities = $state<CommunityMap<CommunitySummary>>(new CommunityMap());
    #communities = $derived.by(() => {
        return globalLocalUpdates.communities.apply(this.#serverCommunities);
    });
    #sortedCommunities = $derived.by(() => {
        return this.#communities.values().toSorted((a, b) => {
            return b.membership.index === a.membership.index
                ? b.memberCount - a.memberCount
                : b.membership.index - a.membership.index;
        });
    });
    #userGroupSummaries = $derived.by(() => {
        return this.#communities.values().reduce((map, community) => {
            community.userGroups.forEach((ug) => map.set(ug.id, ug));
            return map;
        }, new Map<number, UserGroupSummary>());
    });

    set serverCommunities(val: CommunityMap<CommunitySummary>) {
        if (!dequal(val, this.#serverCommunities)) {
            this.#serverCommunities = val;
        }
    }

    get communities() {
        return this.#communities;
    }

    get sortedCommunities() {
        return this.#sortedCommunities;
    }

    get userGroupSummaries(): ReadonlyMap<number, UserGroupSummary> {
        return this.#userGroupSummaries;
    }
}

export const global = new GlobalState();
