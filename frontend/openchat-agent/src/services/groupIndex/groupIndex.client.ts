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
} from "openchat-shared";
import { CandidService } from "../candidService";
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
} from "./mappers";
import {
    groupIndexActiveGroupsArgs,
    groupIndexActiveGroupsResponse,
    groupIndexAddHotGroupExclusionArgs,
    groupIndexAddHotGroupExclusionResponse,
    groupIndexDeleteFrozenGroupArgs,
    groupIndexDeleteFrozenGroupResponse,
    groupIndexExploreCommunitiesArgs,
    groupIndexExploreCommunitiesResponse,
    groupIndexExploreGroupsArgs,
    groupIndexExploreGroupsResponse,
    groupIndexFreezeGroupArgs,
    groupIndexFreezeGroupResponse,
    groupIndexLookupChannelByGroupIdArgs,
    groupIndexLookupChannelByGroupIdResponse,
    groupIndexMarkLocalGroupIndexFullArgs,
    groupIndexMarkLocalGroupIndexFullResponse,
    groupIndexRecommendedGroupsArgs,
    groupIndexRecommendedGroupsResponse,
    groupIndexRemoveHotGroupExclusionArgs,
    groupIndexRemoveHotGroupExclusionResponse,
    groupIndexSetCommunityModerationFlagsArgs,
    groupIndexSetCommunityModerationFlagsResponse,
    groupIndexSetCommunityUpgradeConcurrencyArgs,
    groupIndexSetCommunityUpgradeConcurrencyResponse,
    groupIndexSetGroupUpgradeConcurrencyArgs,
    groupIndexSetGroupUpgradeConcurrencyResponse,
    groupIndexUnfreezeGroupArgs,
    groupIndexUnfreezeGroupResponse,
} from "../../typebox";
import { hexStringToBytes } from "../../utils/mapping";

export class GroupIndexClient extends CandidService {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId);
    }

    activeGroups(
        communityIds: CommunityIdentifier[],
        groupIds: GroupChatIdentifier[],
        activeSince: bigint
    ): Promise<ActiveGroupsResponse> {
        const args = {
            group_ids: groupIds.map((c) => hexStringToBytes(c.groupId)),
            community_ids: communityIds.map((c) => hexStringToBytes(c.communityId)),
            active_since: activeSince,
        };
        return this.executeMsgpackQuery(
            "active_groups",
            args,
            activeGroupsResponse,
            groupIndexActiveGroupsArgs,
            groupIndexActiveGroupsResponse
        );
    }

    recommendedGroups(exclusions: string[]): Promise<GroupChatSummary[]> {
        const args = {
            count: 30,
            exclusions: exclusions.map(hexStringToBytes),
        };
        return this.executeMsgpackUpdate(
            "recommended_groups",
            args,
            recommendedGroupsResponse,
            groupIndexRecommendedGroupsArgs,
            groupIndexRecommendedGroupsResponse
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
            groupIndexExploreGroupsArgs,
            groupIndexExploreGroupsResponse
        );
    }

    lookupChannelByGroupId(id: GroupChatIdentifier): Promise<ChannelIdentifier | undefined> {
        return this.executeMsgpackQuery(
            "lookup_channel_by_group_id",
            {
                group_id: hexStringToBytes(id.groupId),
            },
            lookupChannelResponse,
            groupIndexLookupChannelByGroupIdArgs,
            groupIndexLookupChannelByGroupIdResponse
        );
    }

    exploreCommunities(
        searchTerm: string | undefined,
        pageIndex: number,
        pageSize: number,
        flags: number,
        languages: string[]
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
            groupIndexExploreCommunitiesArgs,
            groupIndexExploreCommunitiesResponse
        );
    }

    freezeGroup(chatId: string, reason: string | undefined): Promise<FreezeGroupResponse> {
        return this.executeMsgpackUpdate(
            "freeze_group",
            {
                chat_id: hexStringToBytes(chatId),
                reason: reason,
            },
            freezeGroupResponse,
            groupIndexFreezeGroupArgs,
            groupIndexFreezeGroupResponse
        );
    }

    unfreezeGroup(chatId: string): Promise<UnfreezeGroupResponse> {
        return this.executeMsgpackUpdate(
            "unfreeze_group",
            { chat_id: hexStringToBytes(chatId) },
            unfreezeGroupResponse,
            groupIndexUnfreezeGroupArgs,
            groupIndexUnfreezeGroupResponse
        );
    }

    deleteFrozenGroup(chatId: string): Promise<DeleteFrozenGroupResponse> {
        return this.executeMsgpackUpdate(
            "delete_frozen_group",
            { chat_id: hexStringToBytes(chatId) },
            deleteFrozenGroupResponse,
            groupIndexDeleteFrozenGroupArgs,
            groupIndexDeleteFrozenGroupResponse
        );
    }

    addHotGroupExclusion(chatId: string): Promise<AddHotGroupExclusionResponse> {
        return this.executeMsgpackUpdate(
            "add_hot_group_exclusion",
            { chat_id: hexStringToBytes(chatId) },
            addHotGroupExclusionResponse,
            groupIndexAddHotGroupExclusionArgs,
            groupIndexAddHotGroupExclusionResponse
        );
    }

    removeHotGroupExclusion(chatId: string): Promise<RemoveHotGroupExclusionResponse> {
        return this.executeMsgpackUpdate(
            "remove_hot_group_exclusion",
            { chat_id: hexStringToBytes(chatId) },
            removeHotGroupExclusionResponse,
            groupIndexRemoveHotGroupExclusionArgs,
            groupIndexRemoveHotGroupExclusionResponse
        );
    }

    setCommunityModerationFlags(
        communityId: string,
        flags: number
    ): Promise<SetCommunityModerationFlagsResponse> {
        return this.executeMsgpackUpdate(
            "set_community_moderation_flags",
            {
                community_id: hexStringToBytes(communityId),
                flags,
            },
            setCommunityModerationFlagsResponse,
            groupIndexSetCommunityModerationFlagsArgs,
            groupIndexSetCommunityModerationFlagsResponse
        );
    }

    setGroupUpgradeConcurrency(value: number): Promise<SetGroupUpgradeConcurrencyResponse> {
        return this.executeMsgpackUpdate(
            "set_group_upgrade_concurrency",
            { value },
            setUpgradeConcurrencyResponse,
            groupIndexSetGroupUpgradeConcurrencyArgs,
            groupIndexSetGroupUpgradeConcurrencyResponse
        );
    }

    setCommunityUpgradeConcurrency(value: number): Promise<SetGroupUpgradeConcurrencyResponse> {
        return this.executeMsgpackUpdate(
            "set_community_upgrade_concurrency",
            { value },
            setUpgradeConcurrencyResponse,
            groupIndexSetCommunityUpgradeConcurrencyArgs,
            groupIndexSetCommunityUpgradeConcurrencyResponse
        );
    }

    markLocalGroupIndexFull(canisterId: string, full: boolean): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "mark_local_group_index_full",
            {
                canister_id: hexStringToBytes(canisterId),
                full,
            },
            (resp) => resp === "Success",
            groupIndexMarkLocalGroupIndexFullArgs,
            groupIndexMarkLocalGroupIndexFullResponse
        );
    }
}
