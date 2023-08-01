import type { Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import type { AgentConfig } from "../../config";
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
import { idlFactory, GroupIndexService } from "./candid/idl";
import {
    addHotGroupExclusionResponse,
    deleteFrozenGroupResponse,
    freezeGroupResponse,
    recommendedGroupsResponse,
    removeHotGroupExclusionResponse,
    setCommunityModerationFlagsResponse,
    setUpgradeConcurrencyResponse,
    unfreezeGroupResponse,
    searchGroupsResponse,
    activeGroupsResponse,
    exploreCommunitiesResponse,
    lookupChannelResponse,
} from "./mappers";
import { apiOptional } from "../common/chatMappers";
import { identity } from "../../utils/mapping";

export class GroupIndexClient extends CandidService {
    private groupIndexService: GroupIndexService;

    private constructor(identity: Identity, config: AgentConfig) {
        super(identity);

        this.groupIndexService = this.createServiceClient<GroupIndexService>(
            idlFactory,
            config.groupIndexCanister,
            config
        );
    }

    static create(identity: Identity, config: AgentConfig): GroupIndexClient {
        return new GroupIndexClient(identity, config);
    }

    activeGroups(
        communityIds: CommunityIdentifier[],
        groupIds: GroupChatIdentifier[],
        activeSince: bigint
    ): Promise<ActiveGroupsResponse> {
        const args = {
            group_ids: groupIds.map((c) => Principal.fromText(c.groupId)),
            community_ids: communityIds.map((c) => Principal.fromText(c.communityId)),
            active_since: apiOptional(identity, activeSince),
        };
        return this.handleQueryResponse(
            () => this.groupIndexService.active_groups(args),
            activeGroupsResponse,
            args
        );
    }

    recommendedGroups(exclusions: string[]): Promise<GroupChatSummary[]> {
        const args = {
            count: 30,
            exclusions: exclusions.map((c) => Principal.fromText(c)),
        };
        return this.handleQueryResponse(
            () => this.groupIndexService.recommended_groups(args),
            recommendedGroupsResponse,
            args
        );
    }

    searchGroups(searchTerm: string, maxResults = 10): Promise<GroupSearchResponse> {
        const args = {
            search_term: searchTerm,
            max_results: maxResults,
        };
        return this.handleQueryResponse(
            () => this.groupIndexService.search(args),
            searchGroupsResponse,
            args
        );
    }

    lookupChannelByGroupId(id: GroupChatIdentifier): Promise<ChannelIdentifier | undefined> {
        return this.handleQueryResponse(
            () =>
                this.groupIndexService.lookup_channel_by_group_id({
                    group_id: Principal.fromText(id.groupId),
                }),
            lookupChannelResponse
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
            search_term: apiOptional(identity, searchTerm),
        };
        return this.handleQueryResponse(
            () => this.groupIndexService.explore_communities(args),
            exploreCommunitiesResponse,
            args
        );
    }

    freezeGroup(chatId: string, reason: string | undefined): Promise<FreezeGroupResponse> {
        return this.handleResponse(
            this.groupIndexService.freeze_group({
                suspend_members: [],
                chat_id: Principal.fromText(chatId),
                reason: apiOptional(identity, reason),
            }),
            freezeGroupResponse
        );
    }

    unfreezeGroup(chatId: string): Promise<UnfreezeGroupResponse> {
        return this.handleResponse(
            this.groupIndexService.unfreeze_group({ chat_id: Principal.fromText(chatId) }),
            unfreezeGroupResponse
        );
    }

    deleteFrozenGroup(chatId: string): Promise<DeleteFrozenGroupResponse> {
        return this.handleResponse(
            this.groupIndexService.delete_frozen_group({ chat_id: Principal.fromText(chatId) }),
            deleteFrozenGroupResponse
        );
    }

    addHotGroupExclusion(chatId: string): Promise<AddHotGroupExclusionResponse> {
        return this.handleResponse(
            this.groupIndexService.add_hot_group_exclusion({ chat_id: Principal.fromText(chatId) }),
            addHotGroupExclusionResponse
        );
    }

    removeHotGroupExclusion(chatId: string): Promise<RemoveHotGroupExclusionResponse> {
        return this.handleResponse(
            this.groupIndexService.remove_hot_group_exclusion({
                chat_id: Principal.fromText(chatId),
            }),
            removeHotGroupExclusionResponse
        );
    }

    setCommunityModerationFlags(communityId: string, flags: number): Promise<SetCommunityModerationFlagsResponse> {
        return this.handleResponse(
            this.groupIndexService.set_community_moderation_flags({ community_id: Principal.fromText(communityId), flags }),
            setCommunityModerationFlagsResponse
        );
    }

    setGroupUpgradeConcurrency(value: number): Promise<SetGroupUpgradeConcurrencyResponse> {
        return this.handleResponse(
            this.groupIndexService.set_group_upgrade_concurrency({ value }),
            setUpgradeConcurrencyResponse
        );
    }
}
