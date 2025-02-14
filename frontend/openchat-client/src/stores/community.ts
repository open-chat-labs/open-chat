import { type Writable, derived, writable, get } from "svelte/store";
import { setsAreEqual } from "../utils/set";
import {
    type CommunitySpecificState,
    type CommunityIdentifier,
    emptyRules,
    CommunityMap,
    type CommunitySummary,
} from "openchat-shared";
import { createCommunitySpecificObjectStore } from "./dataByCommunityFactory";
import { createDerivedPropStore } from "./derived";
import { chatListScopeStore, globalStateStore } from "./global";
import { localCommunitySummaryUpdates } from "./localCommunitySummaryUpdates";
import { mergeLocalUpdates } from "../utils/community";
import type {
    Member,
    ExternalBotPermissions,
    UserGroupDetails,
    UserGroupSummary,
} from "openchat-shared";

// Communities which the current user is previewing
export const communityPreviewsStore: Writable<CommunityMap<CommunitySummary>> = writable(
    new CommunityMap<CommunitySummary>(),
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
    },
);

export const userGroupSummaries = derived([communities], ([$communities]) => {
    return $communities.values().reduce((map, community) => {
        community.userGroups.forEach((ug) => map.set(ug.id, ug));
        return map;
    }, new Map<number, UserGroupSummary>());
});

export const communitiesList = derived(communities, ($communities) => {
    return $communities.values().sort((a, b) => {
        return b.membership.index === a.membership.index
            ? b.memberCount - a.memberCount
            : b.membership.index - a.membership.index;
    });
});

export const communityStateStore = createCommunitySpecificObjectStore<CommunitySpecificState>(
    () => ({
        members: new Map<string, Member>(),
        blockedUsers: new Set<string>(),
        lapsedMembers: new Set<string>(),
        invitedUsers: new Set<string>(),
        referrals: new Set<string>(),
        userGroups: new Map<number, UserGroupDetails>(),
        rules: emptyRules(),
        bots: new Map(),
        apiKeys: new Map(),
    }),
);

const currentServerCommunityBots = createDerivedPropStore<CommunitySpecificState, "bots">(
    communityStateStore,
    "bots",
    () => new Map<string, ExternalBotPermissions>(),
);

export const currentCommunityApiKeys = createDerivedPropStore<CommunitySpecificState, "apiKeys">(
    communityStateStore,
    "apiKeys",
    () => new Map(),
);

export const currentCommunityUserGroups = createDerivedPropStore<
    CommunitySpecificState,
    "userGroups"
>(communityStateStore, "userGroups", () => new Map<number, UserGroupDetails>());

export const currentCommunityMembers = createDerivedPropStore<CommunitySpecificState, "members">(
    communityStateStore,
    "members",
    () => new Map<string, Member>(),
);

export const currentCommunityBlockedUsers = createDerivedPropStore<
    CommunitySpecificState,
    "blockedUsers"
>(communityStateStore, "blockedUsers", () => new Set<string>(), setsAreEqual);

export const currentCommunityLapsedMembers = createDerivedPropStore<
    CommunitySpecificState,
    "lapsedMembers"
>(communityStateStore, "lapsedMembers", () => new Set<string>(), setsAreEqual);

export const currentCommunityReferrals = createDerivedPropStore<
    CommunitySpecificState,
    "referrals"
>(communityStateStore, "referrals", () => new Set<string>(), setsAreEqual);

export const currentCommunityInvitedUsers = createDerivedPropStore<
    CommunitySpecificState,
    "invitedUsers"
>(communityStateStore, "invitedUsers", () => new Set<string>(), setsAreEqual);

export const currentCommunityRules = createDerivedPropStore<CommunitySpecificState, "rules">(
    communityStateStore,
    "rules",
    () => undefined,
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
    },
);

export const currentCommunityBots = derived(
    [selectedCommunity, currentServerCommunityBots, localCommunitySummaryUpdates],
    ([$community, $serverBots, $local]) => {
        if ($community === undefined) return $serverBots;
        const clone = new Map($serverBots);
        const localInstalled = [...($local.get($community.id)?.installedBots?.entries() ?? [])];
        const localDeleted = [...($local.get($community.id)?.removedBots?.values() ?? [])];
        localInstalled.forEach(([id, perm]) => {
            clone.set(id, perm);
        });
        localDeleted.forEach((id) => clone.delete(id));
        return clone;
    },
);

export function nextCommunityIndex(): number {
    return (get(communitiesList)[0]?.membership.index ?? -1) + 1;
}
