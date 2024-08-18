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
    groupIndexActiveGroupsArgsSchema,
    groupIndexActiveGroupsResponseSchema,
    groupIndexAddHotGroupExclusionArgsSchema,
    groupIndexAddHotGroupExclusionResponseSchema,
    groupIndexDeleteFrozenGroupArgsSchema,
    groupIndexDeleteFrozenGroupResponseSchema,
    groupIndexExploreCommunitiesArgsSchema,
    groupIndexExploreCommunitiesResponseSchema,
    groupIndexExploreGroupsArgsSchema,
    groupIndexExploreGroupsResponseSchema,
    groupIndexFreezeGroupArgsSchema,
    groupIndexFreezeGroupResponseSchema,
    groupIndexLookupChannelByGroupIdArgsSchema,
    groupIndexLookupChannelByGroupIdResponseSchema,
    groupIndexMarkLocalGroupIndexFullArgsSchema,
    groupIndexMarkLocalGroupIndexFullResponseSchema,
    groupIndexRecommendedGroupsArgsSchema,
    groupIndexRecommendedGroupsResponseSchema,
    groupIndexRemoveHotGroupExclusionArgsSchema,
    groupIndexRemoveHotGroupExclusionResponseSchema,
    groupIndexSetCommunityModerationFlagsArgsSchema,
    groupIndexSetCommunityModerationFlagsResponseSchema,
    groupIndexSetCommunityUpgradeConcurrencyArgsSchema,
    groupIndexSetCommunityUpgradeConcurrencyResponseSchema,
    groupIndexSetGroupUpgradeConcurrencyArgsSchema,
    groupIndexSetGroupUpgradeConcurrencyResponseSchema,
    groupIndexUnfreezeGroupArgsSchema,
    groupIndexUnfreezeGroupResponseSchema,
} from "../../zod";

export class GroupIndexClient extends CandidService {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId);
    }

    activeGroups(
        communityIds: CommunityIdentifier[],
        groupIds: GroupChatIdentifier[],
        activeSince: bigint,
    ): Promise<ActiveGroupsResponse> {
        const args = {
            group_ids: groupIds.map((c) => c.groupId),
            community_ids: communityIds.map((c) => c.communityId),
            active_since: activeSince,
        };
        return this.executeJsonQuery(
            "active_groups",
            args,
            activeGroupsResponse,
            groupIndexActiveGroupsArgsSchema,
            groupIndexActiveGroupsResponseSchema,
        );
    }

    recommendedGroups(exclusions: string[]): Promise<GroupChatSummary[]> {
        const args = {
            count: 30,
            exclusions: exclusions,
        };
        return this.executeJsonUpdate(
            "recommended_groups",
            args,
            recommendedGroupsResponse,
            groupIndexRecommendedGroupsArgsSchema,
            groupIndexRecommendedGroupsResponseSchema,
        );
    }

    searchGroups(searchTerm: string, maxResults = 10): Promise<GroupSearchResponse> {
        const args = {
            search_term: searchTerm,
            page_index: 0,
            page_size: maxResults,
        };
        return this.executeJsonQuery(
            "explore_groups",
            args,
            exploreGroupsResponse,
            groupIndexExploreGroupsArgsSchema,
            groupIndexExploreGroupsResponseSchema,
        );
    }

    lookupChannelByGroupId(id: GroupChatIdentifier): Promise<ChannelIdentifier | undefined> {
        return this.executeJsonQuery(
            "lookup_channel_by_group_id",
            {
                group_id: id.groupId,
            },
            lookupChannelResponse,
            groupIndexLookupChannelByGroupIdArgsSchema,
            groupIndexLookupChannelByGroupIdResponseSchema,
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
        return this.executeJsonQuery(
            "explore_communities",
            args,
            exploreCommunitiesResponse,
            groupIndexExploreCommunitiesArgsSchema,
            groupIndexExploreCommunitiesResponseSchema,
        );
    }

    freezeGroup(chatId: string, reason: string | undefined): Promise<FreezeGroupResponse> {
        return this.executeJsonUpdate(
            "freeze_group",
            {
                chat_id: chatId,
                reason: reason,
            },
            freezeGroupResponse,
            groupIndexFreezeGroupArgsSchema,
            groupIndexFreezeGroupResponseSchema,
        );
    }

    unfreezeGroup(chatId: string): Promise<UnfreezeGroupResponse> {
        return this.executeJsonUpdate(
            "unfreeze_group",
            { chat_id: chatId },
            unfreezeGroupResponse,
            groupIndexUnfreezeGroupArgsSchema,
            groupIndexUnfreezeGroupResponseSchema,
        );
    }

    deleteFrozenGroup(chatId: string): Promise<DeleteFrozenGroupResponse> {
        return this.executeJsonUpdate(
            "delete_frozen_group",
            { chat_id: chatId },
            deleteFrozenGroupResponse,
            groupIndexDeleteFrozenGroupArgsSchema,
            groupIndexDeleteFrozenGroupResponseSchema,
        );
    }

    addHotGroupExclusion(chatId: string): Promise<AddHotGroupExclusionResponse> {
        return this.executeJsonUpdate(
            "add_hot_group_exclusion",
            { chat_id: chatId },
            addHotGroupExclusionResponse,
            groupIndexAddHotGroupExclusionArgsSchema,
            groupIndexAddHotGroupExclusionResponseSchema,
        );
    }

    removeHotGroupExclusion(chatId: string): Promise<RemoveHotGroupExclusionResponse> {
        return this.executeJsonUpdate(
            "remove_hot_group_exclusion",
            {
                chat_id: chatId,
            },
            removeHotGroupExclusionResponse,
            groupIndexRemoveHotGroupExclusionArgsSchema,
            groupIndexRemoveHotGroupExclusionResponseSchema,
        );
    }

    setCommunityModerationFlags(
        communityId: string,
        flags: number,
    ): Promise<SetCommunityModerationFlagsResponse> {
        return this.executeJsonUpdate(
            "set_community_moderation_flags",
            {
                community_id: communityId,
                flags,
            },
            setCommunityModerationFlagsResponse,
            groupIndexSetCommunityModerationFlagsArgsSchema,
            groupIndexSetCommunityModerationFlagsResponseSchema,
        );
    }

    setGroupUpgradeConcurrency(value: number): Promise<SetGroupUpgradeConcurrencyResponse> {
        return this.executeJsonUpdate(
            "set_group_upgrade_concurrency",
            { value },
            setUpgradeConcurrencyResponse,
            groupIndexSetGroupUpgradeConcurrencyArgsSchema,
            groupIndexSetGroupUpgradeConcurrencyResponseSchema,
        );
    }

    setCommunityUpgradeConcurrency(value: number): Promise<SetGroupUpgradeConcurrencyResponse> {
        return this.executeJsonUpdate(
            "set_community_upgrade_concurrency",
            { value },
            setUpgradeConcurrencyResponse,
            groupIndexSetCommunityUpgradeConcurrencyArgsSchema,
            groupIndexSetCommunityUpgradeConcurrencyResponseSchema,
        );
    }

    markLocalGroupIndexFull(canisterId: string, full: boolean): Promise<boolean> {
        return this.executeJsonUpdate(
            "mark_local_group_index_full",
            {
                canister_id: canisterId,
                full,
            },
            (resp) => resp === "Success",
            groupIndexMarkLocalGroupIndexFullArgsSchema,
            groupIndexMarkLocalGroupIndexFullResponseSchema,
        );
    }
}
