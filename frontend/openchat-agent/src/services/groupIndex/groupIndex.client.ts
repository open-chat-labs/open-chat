import type { Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import type { AgentConfig } from "../../config";
import type {
    AddHotGroupExclusionResponse,
    DeleteFrozenGroupResponse,
    FilterGroupsResponse,
    FreezeGroupResponse,
    GroupChatSummary,
    RemoveHotGroupExclusionResponse,
    SetGroupUpgradeConcurrencyResponse,
    UnfreezeGroupResponse,
    SearchResponse,
    SearchScope,
    GroupSearchResponse,
} from "openchat-shared";
import { CandidService } from "../candidService";
import { idlFactory, GroupIndexService } from "./candid/idl";
import {
    addHotGroupExclusionResponse,
    deleteFrozenGroupResponse,
    filterGroupsResponse,
    freezeGroupResponse,
    searchResponse,
    recommendedGroupsResponse,
    removeHotGroupExclusionResponse,
    setUpgradeConcurrencyResponse,
    unfreezeGroupResponse,
    apiSearchScope,
    searchGroupsResponse,
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

    filterGroups(chatIds: string[], activeSince: bigint): Promise<FilterGroupsResponse> {
        const args = {
            chat_ids: chatIds.map((c) => Principal.fromText(c)),
            active_since: apiOptional(identity, activeSince),
        };
        return this.handleQueryResponse(
            () => this.groupIndexService.filter_groups(args),
            filterGroupsResponse,
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

    search(
        searchTerm: string,
        maxResults = 10,
        scope: SearchScope = "groups"
    ): Promise<SearchResponse> {
        const args = {
            search_term: searchTerm,
            max_results: maxResults,
            scope: apiSearchScope(scope),
        };
        return this.handleQueryResponse(
            () => this.groupIndexService.search(args),
            searchResponse,
            args
        );
    }

    freezeGroup(chatId: string, reason: string | undefined): Promise<FreezeGroupResponse> {
        return this.handleResponse(
            this.groupIndexService.freeze_group({
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

    setGroupUpgradeConcurrency(value: number): Promise<SetGroupUpgradeConcurrencyResponse> {
        return this.handleResponse(
            this.groupIndexService.set_group_upgrade_concurrency({ value }),
            setUpgradeConcurrencyResponse
        );
    }
}
