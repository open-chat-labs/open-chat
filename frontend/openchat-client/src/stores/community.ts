import { CommunityMap, type CommunityIdentifier, type CommunitySummary } from "openchat-shared";
import { writable, type Writable } from "svelte/store";
import { globalLocalUpdates } from "../state/global/local.svelte";

// Communities which the current user is previewing

// TODO - we can't get rid of this yet which is irritating
export const communityPreviewsStore: Writable<CommunityMap<CommunitySummary>> = writable(
    new CommunityMap<CommunitySummary>(),
);

export function addCommunityPreview(community: CommunitySummary): void {
    // localCommunitySummaryUpdates.delete(community.id);
    globalLocalUpdates.addCommunity(community);
    communityPreviewsStore.update((summaries) => {
        summaries.set(community.id, community);
        return summaries;
    });
}

export function removeCommunityPreview(id: CommunityIdentifier): void {
    globalLocalUpdates.removeCommunity(id);
    communityPreviewsStore.update((summaries) => {
        summaries.delete(id);
        return summaries;
    });
}

// these are the communities I am in
// export const communities = derived(
//     [globalStateStore, localCommunitySummaryUpdates, communityPreviewsStore],
//     ([$globalStateStore, $localUpdates, $previews]) => {
//         const merged = mergeLocalUpdates($globalStateStore.communities, $localUpdates);
//         return merged.merge($previews);
//     },
// );

// export const userGroupSummaries = derived([communities], ([$communities]) => {
//     return $communities.values().reduce((map, community) => {
//         community.userGroups.forEach((ug) => map.set(ug.id, ug));
//         return map;
//     }, new Map<number, UserGroupSummary>());
// });

// export const communitiesList = derived(communities, ($communities) => {
//     return $communities.values().toSorted((a, b) => {
//         return b.membership.index === a.membership.index
//             ? b.memberCount - a.memberCount
//             : b.membership.index - a.membership.index;
//     });
// });

// export const selectedCommunity = derived(
//     [communities, chatListScopeStore],
//     ([$communities, $chatListScope]) => {
//         if ($chatListScope.kind === "community") {
//             return $communities.get($chatListScope.id);
//         } else if ($chatListScope.kind === "favourite" && $chatListScope.communityId) {
//             return $communities.get($chatListScope.communityId);
//         } else {
//             return undefined;
//         }
//     },
// );

// export function nextCommunityIndex(): number {
//     return (get(communitiesList)[0]?.membership.index ?? -1) + 1;
// }
