import type { HttpAgent, Identity } from "@dfinity/agent";
import type {
    AddHotGroupExclusionResponse,
    DeleteFrozenGroupResponse,
    FreezeGroupResponse,
    GroupChatSummary,
    RemoveHotGroupExclusionResponse,
    SetCommunityModerationFlagsResponse,
    SetGroupUpgradeConcurrencyResponse,
    UnfreezeGroupResponse,
    GroupSearchResponse,
    CommunityIdentifier,
    GroupChatIdentifier,
    ActiveGroupsResponse,
    ExploreCommunitiesResponse,
    ChannelIdentifier,
    FreezeCommunityResponse,
    UnfreezeCommunityResponse,
} from "openchat-shared";
import { CanisterAgent } from "../canisterAgent";
import {
    addHotGroupExclusionResponse,
    deleteFrozenGroupResponse,
    freezeGroupResponse,
    recommendedGroupsResponse,
    removeHotGroupExclusionResponse,
    setCommunityModerationFlagsResponse,
    setUpgradeConcurrencyResponse,
    unfreezeGroupResponse,
    activeGroupsResponse,
    exploreCommunitiesResponse,
    lookupChannelResponse,
    exploreGroupsResponse,
    freezeCommunityResponse,
    unfreezeCommunityResponse,
} from "./mappers";
import {
    GroupIndexActiveGroupsArgs,
    GroupIndexActiveGroupsResponse,
    GroupIndexAddHotGroupExclusionArgs,
    GroupIndexAddHotGroupExclusionResponse,
    GroupIndexDeleteFrozenGroupArgs,
    GroupIndexDeleteFrozenGroupResponse,
    GroupIndexExploreCommunitiesArgs,
    GroupIndexExploreCommunitiesResponse,
    GroupIndexExploreGroupsArgs,
    GroupIndexExploreGroupsResponse,
    GroupIndexFreezeCommunityArgs,
    GroupIndexFreezeCommunityResponse,
    GroupIndexFreezeGroupArgs,
    GroupIndexFreezeGroupResponse,
    GroupIndexLookupChannelByGroupIdArgs,
    GroupIndexLookupChannelByGroupIdResponse,
    GroupIndexMarkLocalGroupIndexFullArgs,
    GroupIndexMarkLocalGroupIndexFullResponse,
    GroupIndexRecommendedGroupsArgs,
    GroupIndexRecommendedGroupsResponse,
    GroupIndexRemoveHotGroupExclusionArgs,
    GroupIndexRemoveHotGroupExclusionResponse,
    GroupIndexSetCommunityModerationFlagsArgs,
    GroupIndexSetCommunityModerationFlagsResponse,
    GroupIndexSetCommunityUpgradeConcurrencyArgs,
    GroupIndexSetCommunityUpgradeConcurrencyResponse,
    GroupIndexSetGroupUpgradeConcurrencyArgs,
    GroupIndexSetGroupUpgradeConcurrencyResponse,
    GroupIndexUnfreezeCommunityArgs,
    GroupIndexUnfreezeCommunityResponse,
    GroupIndexUnfreezeGroupArgs,
    GroupIndexUnfreezeGroupResponse,
} from "../../typebox";
import { principalStringToBytes } from "../../utils/mapping";

export class GroupIndexClient extends CanisterAgent {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId);
    }

    activeGroups(
        communityIds: CommunityIdentifier[],
        groupIds: GroupChatIdentifier[],
        activeSince: bigint,
    ): Promise<ActiveGroupsResponse> {
        const args = {
            group_ids: groupIds.map((c) => principalStringToBytes(c.groupId)),
            community_ids: communityIds.map((c) => principalStringToBytes(c.communityId)),
            active_since: activeSince,
        };
        return this.executeMsgpackQuery(
            "active_groups",
            args,
            activeGroupsResponse,
            GroupIndexActiveGroupsArgs,
            GroupIndexActiveGroupsResponse,
        );
    }

    recommendedGroups(exclusions: string[]): Promise<GroupChatSummary[]> {
        const args = {
            count: 30,
            exclusions: exclusions.map(principalStringToBytes),
        };
        return this.executeMsgpackQuery(
            "recommended_groups",
            args,
            recommendedGroupsResponse,
            GroupIndexRecommendedGroupsArgs,
            GroupIndexRecommendedGroupsResponse,
        );
    }

    searchGroups(searchTerm: string, maxResults = 10): Promise<GroupSearchResponse> {
        const args = {
            search_term: searchTerm,
            page_index: 0,
            page_size: maxResults,
        };
        return this.executeMsgpackQuery(
            "explore_groups",
            args,
            exploreGroupsResponse,
            GroupIndexExploreGroupsArgs,
            GroupIndexExploreGroupsResponse,
        );
    }

    lookupChannelByGroupId(id: GroupChatIdentifier): Promise<ChannelIdentifier | undefined> {
        return this.executeMsgpackQuery(
            "lookup_channel_by_group_id",
            {
                group_id: principalStringToBytes(id.groupId),
            },
            lookupChannelResponse,
            GroupIndexLookupChannelByGroupIdArgs,
            GroupIndexLookupChannelByGroupIdResponse,
        );
    }

    exploreCommunities(
        searchTerm: string | undefined,
        pageIndex: number,
        pageSize: number,
        flags: number,
        languages: string[],
    ): Promise<ExploreCommunitiesResponse> {
        const args = {
            languages,
            include_moderation_flags: flags,
            page_size: pageSize,
            page_index: pageIndex,
            search_term: searchTerm,
        };
        return this.executeMsgpackQuery(
            "explore_communities",
            args,
            exploreCommunitiesResponse,
            GroupIndexExploreCommunitiesArgs,
            GroupIndexExploreCommunitiesResponse,
        );
    }

    freezeGroup(chatId: string, reason: string | undefined): Promise<FreezeGroupResponse> {
        return this.executeMsgpackUpdate(
            "freeze_group",
            {
                chat_id: principalStringToBytes(chatId),
                reason: reason,
            },
            freezeGroupResponse,
            GroupIndexFreezeGroupArgs,
            GroupIndexFreezeGroupResponse,
        );
    }

    freezeCommunity(
        id: CommunityIdentifier,
        reason: string | undefined,
    ): Promise<FreezeCommunityResponse> {
        return this.executeMsgpackUpdate(
            "freeze_community",
            {
                community_id: principalStringToBytes(id.communityId),
                reason: reason,
            },
            freezeCommunityResponse,
            GroupIndexFreezeCommunityArgs,
            GroupIndexFreezeCommunityResponse,
        );
    }

    unfreezeCommunity(id: CommunityIdentifier): Promise<UnfreezeCommunityResponse> {
        return this.executeMsgpackUpdate(
            "unfreeze_community",
            {
                community_id: principalStringToBytes(id.communityId),
            },
            unfreezeCommunityResponse,
            GroupIndexUnfreezeCommunityArgs,
            GroupIndexUnfreezeCommunityResponse,
        );
    }

    unfreezeGroup(chatId: string): Promise<UnfreezeGroupResponse> {
        return this.executeMsgpackUpdate(
            "unfreeze_group",
            { chat_id: principalStringToBytes(chatId) },
            unfreezeGroupResponse,
            GroupIndexUnfreezeGroupArgs,
            GroupIndexUnfreezeGroupResponse,
        );
    }

    deleteFrozenGroup(chatId: string): Promise<DeleteFrozenGroupResponse> {
        return this.executeMsgpackUpdate(
            "delete_frozen_group",
            { chat_id: principalStringToBytes(chatId) },
            deleteFrozenGroupResponse,
            GroupIndexDeleteFrozenGroupArgs,
            GroupIndexDeleteFrozenGroupResponse,
        );
    }

    addHotGroupExclusion(chatId: string): Promise<AddHotGroupExclusionResponse> {
        return this.executeMsgpackUpdate(
            "add_hot_group_exclusion",
            { chat_id: principalStringToBytes(chatId) },
            addHotGroupExclusionResponse,
            GroupIndexAddHotGroupExclusionArgs,
            GroupIndexAddHotGroupExclusionResponse,
        );
    }

    removeHotGroupExclusion(chatId: string): Promise<RemoveHotGroupExclusionResponse> {
        return this.executeMsgpackUpdate(
            "remove_hot_group_exclusion",
            { chat_id: principalStringToBytes(chatId) },
            removeHotGroupExclusionResponse,
            GroupIndexRemoveHotGroupExclusionArgs,
            GroupIndexRemoveHotGroupExclusionResponse,
        );
    }

    setCommunityModerationFlags(
        communityId: string,
        flags: number,
    ): Promise<SetCommunityModerationFlagsResponse> {
        return this.executeMsgpackUpdate(
            "set_community_moderation_flags",
            {
                community_id: principalStringToBytes(communityId),
                flags,
            },
            setCommunityModerationFlagsResponse,
            GroupIndexSetCommunityModerationFlagsArgs,
            GroupIndexSetCommunityModerationFlagsResponse,
        );
    }

    setGroupUpgradeConcurrency(value: number): Promise<SetGroupUpgradeConcurrencyResponse> {
        return this.executeMsgpackUpdate(
            "set_group_upgrade_concurrency",
            { value },
            setUpgradeConcurrencyResponse,
            GroupIndexSetGroupUpgradeConcurrencyArgs,
            GroupIndexSetGroupUpgradeConcurrencyResponse,
        );
    }

    setCommunityUpgradeConcurrency(value: number): Promise<SetGroupUpgradeConcurrencyResponse> {
        return this.executeMsgpackUpdate(
            "set_community_upgrade_concurrency",
            { value },
            setUpgradeConcurrencyResponse,
            GroupIndexSetCommunityUpgradeConcurrencyArgs,
            GroupIndexSetCommunityUpgradeConcurrencyResponse,
        );
    }

    markLocalGroupIndexFull(canisterId: string, full: boolean): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "mark_local_group_index_full",
            {
                canister_id: principalStringToBytes(canisterId),
                full,
            },
            (resp) => resp === "Success",
            GroupIndexMarkLocalGroupIndexFullArgs,
            GroupIndexMarkLocalGroupIndexFullResponse,
        );
    }
}
