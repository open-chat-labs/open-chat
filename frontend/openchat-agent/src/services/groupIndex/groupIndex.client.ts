import type { Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import type { AgentConfig } from "../../config";
import type {
    DeleteFrozenGroupResponse,
    FilterGroupsResponse,
    FreezeGroupResponse,
    GroupChatSummary,
    GroupSearchResponse,
    UnfreezeGroupResponse
} from "openchat-shared";
import { CandidService } from "../candidService";
import { idlFactory, GroupIndexService } from "./candid/idl";
import type { IGroupIndexClient } from "./groupIndex.client.interface";
import {
    deleteFrozenGroupResponse,
    filterGroupsResponse,
    freezeGroupResponse,
    groupSearchResponse,
    recommendedGroupsResponse,
    unfreezeGroupResponse
} from "./mappers";
import { apiOptional } from "../common/chatMappers";
import { identity } from "../../utils/mapping";

export class GroupIndexClient extends CandidService implements IGroupIndexClient {
    private groupIndexService: GroupIndexService;

    private constructor(identity: Identity, config: AgentConfig) {
        super(identity);

        this.groupIndexService = this.createServiceClient<GroupIndexService>(
            idlFactory,
            config.groupIndexCanister,
            config
        );
    }

    static create(identity: Identity, config: AgentConfig): IGroupIndexClient {
        return new GroupIndexClient(identity, config);
    }

    filterGroups(chatIds: string[], activeSince: bigint): Promise<FilterGroupsResponse> {
        const args = {
            chat_ids: chatIds.map((c) => Principal.fromText(c)),
            active_since: apiOptional(identity, activeSince)
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
            exclusions: exclusions.map((c) => Principal.fromText(c))
        };
        return this.handleQueryResponse(
            () => this.groupIndexService.recommended_groups(args),
            recommendedGroupsResponse,
            args
        );
    }

    search(searchTerm: string, maxResults = 10): Promise<GroupSearchResponse> {
        const args = {
            search_term: searchTerm,
            max_results: maxResults,
        };
        return this.handleQueryResponse(
            () => this.groupIndexService.search(args),
            groupSearchResponse,
            args
        );
    }

    freezeGroup(chatId: string, reason: string | undefined): Promise<FreezeGroupResponse> {
        return this.handleResponse(
            this.groupIndexService.freeze_group({ chat_id: Principal.fromText(chatId), reason: apiOptional(identity, reason) }),
            freezeGroupResponse)
    }

    unfreezeGroup(chatId: string): Promise<UnfreezeGroupResponse> {
        return this.handleResponse(
            this.groupIndexService.unfreeze_group({ chat_id: Principal.fromText(chatId) }),
            unfreezeGroupResponse)
    }

    deleteFrozenGroup(chatId: string): Promise<DeleteFrozenGroupResponse> {
        return this.handleResponse(
            this.groupIndexService.delete_frozen_group({ chat_id: Principal.fromText(chatId) }),
            deleteFrozenGroupResponse)
    }
}
