import { Writable, derived, writable } from "svelte/store";
import { setsAreEqual } from "../utils/set";
import {
    CommunitySpecificState,
    CommunityIdentifier,
    defaultAccessRules,
    CommunityMap,
    CommunitySummary,
} from "openchat-shared";
import { createCommunitySpecificObjectStore } from "./dataByCommunityFactory";
import { createDerivedPropStore } from "./derived";
import { chatListScopeStore, globalStateStore } from "./global";
import { localCommunitySummaryUpdates } from "./localCommunitySummaryUpdates";
import { mergeLocalUpdates } from "../utils/community";

// Communities which the current user is previewing
export const communityPreviewsStore: Writable<CommunityMap<CommunitySummary>> = writable(
    new CommunityMap<CommunitySummary>()
);

export function addCommunityPreview(community: CommunitySummary): void {
    localCommunitySummaryUpdates.delete(community.id);
    communityPreviewsStore.update((summaries) => {
        summaries.set(community.id, community);
        return summaries;
    });
}

export function removeCommunityPreview(id: CommunityIdentifier): void {
    communityPreviewsStore.update((summaries) => {
        summaries.delete(id);
        return summaries;
    });
}

// these are the communities I am in
export const communities = derived(
    [globalStateStore, localCommunitySummaryUpdates, communityPreviewsStore],
    ([$globalStateStore, $localUpdates, $previews]) => {
        const merged = mergeLocalUpdates($globalStateStore.communities, $localUpdates);
        return merged.merge($previews);
    }
);

export const communitiesList = derived(communities, ($communities) => {
    return $communities.values();
});

export const communityStateStore = createCommunitySpecificObjectStore<CommunitySpecificState>(
    () => ({
        detailsLoaded: false,
        members: [],
        blockedUsers: new Set<string>(),
        invitedUsers: new Set<string>(),
        lastUpdated: BigInt(0),
    })
);

export const currentCommunityMembers = createDerivedPropStore<CommunitySpecificState, "members">(
    communityStateStore,
    "members",
    () => []
);

export const currentCommunityBlockedUsers = createDerivedPropStore<
    CommunitySpecificState,
    "blockedUsers"
>(communityStateStore, "blockedUsers", () => new Set<string>(), setsAreEqual);

export const currentCommunityInvitedUsers = createDerivedPropStore<
    CommunitySpecificState,
    "invitedUsers"
>(communityStateStore, "invitedUsers", () => new Set<string>(), setsAreEqual);

export const currentCommunityRules = createDerivedPropStore<CommunitySpecificState, "rules">(
    communityStateStore,
    "rules",
    defaultAccessRules
);

export const selectedCommunity = derived(
    [communities, chatListScopeStore],
    ([$communities, $chatListScope]) => {
        if ($chatListScope.kind === "community") {
            return $communities.get($chatListScope.id);
        } else if ($chatListScope.kind === "favourite" && $chatListScope.communityId) {
            return $communities.get($chatListScope.communityId);
        } else {
            return undefined;
        }
    }
);

export function setSelectedCommunity(id: CommunityIdentifier): void {
    chatListScopeStore.set({ kind: "community", id });
}
