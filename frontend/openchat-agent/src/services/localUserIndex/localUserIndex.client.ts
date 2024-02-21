import type { Identity, SignIdentity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory, type LocalUserIndexService } from "./candid/idl";
import type {
    AccessTokenType,
    ChannelIdentifier,
    ChatIdentifier,
    GroupAndCommunitySummaryUpdatesArgs,
    GroupAndCommunitySummaryUpdatesResponse,
    InviteUsersResponse,
    JoinCommunityResponse,
    JoinGroupResponse,
    RegisterUserResponse,
} from "openchat-shared";
import { CandidService } from "../candidService";
import {
    accessTokenResponse,
    apiAccessTokenType,
    groupAndCommunitySummaryUpdates,
    inviteUsersResponse,
    joinChannelResponse,
    joinCommunityResponse,
    registerUserResponse,
} from "./mappers";
import type { AgentConfig } from "../../config";
import { joinGroupResponse, apiOptional, apiChatIdentifier } from "../common/chatMappers";
import { textToCode } from "openchat-shared";
import { identity } from "../../utils/mapping";

export class LocalUserIndexClient extends CandidService {
    private localUserIndexService: LocalUserIndexService;

    private constructor(identity: Identity, config: AgentConfig, canisterId: string) {
        super(identity);

        this.localUserIndexService = this.createServiceClient<LocalUserIndexService>(
            idlFactory,
            canisterId,
            config,
        );
    }

    static create(
        identity: Identity,
        config: AgentConfig,
        canisterId: string,
    ): LocalUserIndexClient {
        return new LocalUserIndexClient(identity, config, canisterId);
    }

    groupAndCommunitySummaryUpdates(
        requests: GroupAndCommunitySummaryUpdatesArgs[],
    ): Promise<GroupAndCommunitySummaryUpdatesResponse[]> {
        const args = {
            requests: requests.map((r) => ({
                canister_id: Principal.fromText(r.canisterId),
                is_community: r.isCommunity,
                invite_code: apiOptional(identity, r.inviteCode),
                updates_since: apiOptional(identity, r.updatesSince),
            })),
        };

        return this.handleQueryResponse(
            () => this.localUserIndexService.group_and_community_summary_updates(args),
            groupAndCommunitySummaryUpdates,
            args,
        );
    }

    registerUser(
        username: string,
        referralCode: string | undefined,
    ): Promise<RegisterUserResponse> {
        return this.handleResponse(
            this.localUserIndexService.register_user({
                username,
                referral_code: apiOptional(identity, referralCode),
                public_key: new Uint8Array((this.identity as SignIdentity).getPublicKey().toDer()),
            }),
            registerUserResponse,
        );
    }

    joinCommunity(
        communityId: string,
        inviteCode: string | undefined,
    ): Promise<JoinCommunityResponse> {
        return this.handleResponse(
            this.localUserIndexService.join_community({
                community_id: Principal.fromText(communityId),
                invite_code: apiOptional(textToCode, inviteCode),
            }),
            joinCommunityResponse,
        );
    }

    joinGroup(chatId: string, inviteCode: string | undefined): Promise<JoinGroupResponse> {
        return this.handleResponse(
            this.localUserIndexService.join_group({
                chat_id: Principal.fromText(chatId),
                invite_code: apiOptional(textToCode, inviteCode),
                correlation_id: BigInt(0),
            }),
            joinGroupResponse,
        );
    }

    joinChannel(id: ChannelIdentifier, inviteCode: string | undefined): Promise<JoinGroupResponse> {
        return this.handleResponse(
            this.localUserIndexService.join_channel({
                community_id: Principal.fromText(id.communityId),
                channel_id: BigInt(id.channelId),
                invite_code: apiOptional(textToCode, inviteCode),
            }),
            (resp) => joinChannelResponse(resp, id.communityId),
        );
    }

    inviteUsersToCommunity(communityId: string, userIds: string[]): Promise<InviteUsersResponse> {
        return this.handleResponse(
            this.localUserIndexService.invite_users_to_community({
                community_id: Principal.fromText(communityId),
                user_ids: userIds.map((u) => Principal.fromText(u)),
            }),
            inviteUsersResponse,
        );
    }

    inviteUsersToGroup(chatId: string, userIds: string[]): Promise<InviteUsersResponse> {
        return this.handleResponse(
            this.localUserIndexService.invite_users_to_group({
                group_id: Principal.fromText(chatId),
                user_ids: userIds.map((u) => Principal.fromText(u)),
                correlation_id: BigInt(0),
            }),
            inviteUsersResponse,
        );
    }

    inviteUsersToChannel(
        communityId: string,
        channelId: string,
        userIds: string[],
    ): Promise<InviteUsersResponse> {
        return this.handleResponse(
            this.localUserIndexService.invite_users_to_channel({
                community_id: Principal.fromText(communityId),
                channel_id: BigInt(channelId),
                user_ids: userIds.map((u) => Principal.fromText(u)),
            }),
            inviteUsersResponse,
        );
    }

    getAccessToken(
        chatId: ChatIdentifier,
        accessType: AccessTokenType,
    ): Promise<string | undefined> {
        return this.handleQueryResponse(
            () =>
                this.localUserIndexService.access_token({
                    chat: apiChatIdentifier(chatId),
                    token_type: apiAccessTokenType(accessType),
                }),
            accessTokenResponse,
        );
    }
}
