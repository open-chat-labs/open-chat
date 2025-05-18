import {
    applyOptionUpdate,
    CommunityMap,
    type CommunitySummary,
    type ExternalBotPermissions,
    type Member,
    type PublicApiKeyDetails,
    type UserGroupDetails,
    type UserGroupSummary,
} from "openchat-shared";
import { derived } from "svelte/store";
import { localUpdates } from "..";
import { CommunityMapStore } from "../map";
import { selectedCommunityIdStore } from "../path.svelte";
import { writable } from "../writable";
import { communityLocalUpdates } from "./detailUpdates";
import type { CommunityDetailsState } from "./server";
import { communitySummaryLocalUpdates } from "./summaryUpdates";

export const serverCommunitiesStore = new CommunityMapStore<CommunitySummary>();

export const communitiesStore = derived(
    [
        serverCommunitiesStore,
        localUpdates.communities,
        localUpdates.previewCommunities,
        communitySummaryLocalUpdates,
    ],
    ([serverCommunities, localCommunities, previewCommunities, localUpdates]) => {
        const merged = localCommunities.apply(serverCommunities.clone().merge(previewCommunities));
        return [...merged.entries()].reduce((result, [communityId, community]) => {
            const updates = localUpdates.get(communityId);

            const anyChanges =
                updates?.index !== undefined ||
                updates?.displayName !== undefined ||
                updates?.rulesAccepted !== undefined;

            if (anyChanges) {
                const clone = structuredClone(community);
                const index = updates?.index;
                if (index !== undefined) {
                    clone.membership.index = index;
                }
                clone.membership.displayName = applyOptionUpdate(
                    clone.membership.displayName,
                    updates?.displayName,
                );
                clone.membership.rulesAccepted =
                    updates?.rulesAccepted ?? clone.membership.rulesAccepted;

                result.set(communityId, clone);
            } else {
                result.set(communityId, community);
            }
            return result;
        }, new CommunityMap<CommunitySummary>());
    },
);

export const sortedCommunitiesStore = derived(communitiesStore, (communities) => {
    return [...communities.values()].toSorted((a, b) => {
        return b.membership.index === a.membership.index
            ? b.memberCount - a.memberCount
            : b.membership.index - a.membership.index;
    });
});

export const nextCommunityIndexStore = derived(
    sortedCommunitiesStore,
    (sortedCommunitiesStore) => (sortedCommunitiesStore[0]?.membership?.index ?? -1) + 1,
);

export const userGroupSummariesStore = derived(communitiesStore, (communities) => {
    return [...communities.values()].reduce((map, community) => {
        community.userGroups.forEach((ug) => map.set(ug.id, ug));
        return map;
    }, new Map<number, UserGroupSummary>());
});

export const selectedServerCommunityStore = writable<CommunityDetailsState | undefined>(undefined);
export const selectedCommunityMembersStore = derived(
    [selectedServerCommunityStore, communityLocalUpdates.members],
    ([community, members]) => {
        if (community === undefined) return new Map() as ReadonlyMap<string, Member>;
        const updates = members.get(community.communityId);
        if (updates === undefined) return community.members;
        return updates.apply(community.members);
    },
);
export const selectedCommunityBotsStore = derived(
    [selectedServerCommunityStore, communityLocalUpdates.bots],
    ([community, bots]) => {
        if (community === undefined)
            return new Map() as ReadonlyMap<string, ExternalBotPermissions>;
        const updates = bots.get(community.communityId);
        if (updates === undefined) return community.bots;
        return updates.apply(community.bots);
    },
);
export const selectedCommunityUserGroupsStore = derived(
    [selectedServerCommunityStore, communityLocalUpdates.userGroups],
    ([community, userGroups]) => {
        if (community === undefined) return new Map() as ReadonlyMap<number, UserGroupDetails>;
        const updates = userGroups.get(community.communityId);
        if (updates === undefined) return community.userGroups;
        return updates.apply(community.userGroups);
    },
);
export const selectedCommunityInvitedUsersStore = derived(
    [selectedServerCommunityStore, communityLocalUpdates.invitedUsers],
    ([community, invitedUsers]) => {
        if (community === undefined) return new Set() as ReadonlySet<string>;
        const updates = invitedUsers.get(community.communityId);
        if (updates === undefined) return community.invitedUsers;
        return updates.apply(community.invitedUsers);
    },
);
export const selectedCommunityBlockedUsersStore = derived(
    [selectedServerCommunityStore, communityLocalUpdates.blockedUsers],
    ([community, blockedUsers]) => {
        if (community === undefined) return new Set() as ReadonlySet<string>;
        const updates = blockedUsers.get(community.communityId);
        if (updates === undefined) return community.blockedUsers;
        return updates.apply(community.blockedUsers);
    },
);
export const selectedCommunityRulesStore = derived(
    [selectedServerCommunityStore, communityLocalUpdates.rules],
    ([community, rules]) => {
        if (community === undefined) return undefined;
        const updates = rules.get(community.communityId);
        return updates ?? community.rules;
    },
);
export const selectedCommunityLapsedMembersStore = derived(
    selectedServerCommunityStore,
    (selectedCommunity) => selectedCommunity?.lapsedMembers ?? (new Set() as ReadonlySet<string>),
);
export const selectedCommunityApiKeysStore = derived(
    selectedServerCommunityStore,
    (selectedCommunity) =>
        selectedCommunity?.apiKeys ?? (new Map() as ReadonlyMap<string, PublicApiKeyDetails>),
);
export const selectedCommunityReferralsStore = derived(
    selectedServerCommunityStore,
    (selectedCommunity) => selectedCommunity?.referrals ?? (new Set() as ReadonlySet<string>),
);
export const selectedCommunitySummaryStore = derived(
    [selectedCommunityIdStore, communitiesStore],
    ([selectedCommunityId, communities]) =>
        selectedCommunityId ? communities.get(selectedCommunityId) : undefined,
);
