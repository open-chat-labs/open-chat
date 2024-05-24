import type { Identity, SignIdentity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory, type LocalUserIndexService } from "./candid/idl";
import type {
    AccessTokenType,
    ChannelIdentifier,
    ChatEvent,
    ChatEventsArgs,
    ChatEventsBatchResponse,
    ChatEventsResponse,
    ChatIdentifier,
    EventsSuccessResult,
    GroupAndCommunitySummaryUpdatesArgs,
    GroupAndCommunitySummaryUpdatesResponse,
    InviteUsersResponse,
    JoinCommunityResponse,
    JoinGroupResponse,
    RegisterUserResponse,
    VerifiedCredentialArgs,
} from "openchat-shared";
import { CandidService } from "../candidService";
import {
    chatEventsArgs,
    chatEventsBatchResponse,
    accessTokenResponse,
    apiAccessTokenType,
    apiVerifiedCredentialArgs,
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
import {
    type Database,
    getCachedEvents,
    getCachedEventsWindowByMessageIndex,
    setCachedEvents,
    setCachePrimerTimestamp,
} from "../../utils/caching";

export class LocalUserIndexClient extends CandidService {
    private localUserIndexService: LocalUserIndexService;

    private constructor(
        identity: Identity,
        config: AgentConfig,
        canisterId: string,
        private db: Database,
    ) {
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
        db: Database,
    ): LocalUserIndexClient {
        return new LocalUserIndexClient(identity, config, canisterId, db);
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

    async chatEvents(
        requests: ChatEventsArgs[],
        cachePrimer = false,
    ): Promise<ChatEventsResponse[]> {
        // The responses must be ordered such that the response at index i matches the request at index i
        const responses = [] as ChatEventsResponse[];
        const requestsToBackend = [] as ChatEventsArgs[];

        for (let i = 0; i < requests.length; i++) {
            const request = requests[i];
            let fromCache: EventsSuccessResult<ChatEvent> | undefined = undefined;

            if (request.args.kind === "page") {
                const [cached, missing] = await getCachedEvents(
                    this.db,
                    request.args.eventIndexRange,
                    request.context,
                    request.args.startIndex,
                    request.args.ascending,
                    undefined,
                    undefined,
                    1,
                );
                if (missing.size === 0) {
                    fromCache = cached;
                }
            } else if (request.args.kind === "window") {
                const [cached, missing] = await getCachedEventsWindowByMessageIndex(
                    this.db,
                    request.args.eventIndexRange,
                    request.context,
                    request.args.midPoint,
                    undefined,
                    undefined,
                    1,
                );
                if (missing.size === 0) {
                    fromCache = cached;
                }
            }
            if (fromCache !== undefined) {
                // Insert the response into the index matching the request
                responses[i] = {
                    kind: "success",
                    result: fromCache,
                };
                if (cachePrimer && request.latestKnownUpdate !== undefined) {
                    setCachePrimerTimestamp(
                        this.db,
                        request.context.chatId,
                        request.latestKnownUpdate,
                    );
                }
            } else {
                requestsToBackend.push(request);
            }
        }

        if (requestsToBackend.length > 0) {
            const batchResponse = await this.getChatEventsFromBackend(requestsToBackend);

            for (let i = 0; i < batchResponse.responses.length; i++) {
                const request = requestsToBackend[i];
                const response = batchResponse.responses[i];

                if (response.kind === "success") {
                    setCachedEvents(
                        this.db,
                        request.context.chatId,
                        response.result,
                        request.context.threadRootMessageIndex,
                    );
                    if (cachePrimer) {
                        setCachePrimerTimestamp(
                            this.db,
                            request.context.chatId,
                            batchResponse.timestamp,
                        );
                    }
                }

                // Insert the response into the first empty index, this will match the index of the request
                for (let j = i; j <= responses.length; j++) {
                    if (responses[j] === undefined) {
                        responses[j] = response;
                        break;
                    }
                }
            }
        }

        return responses;
    }

    private getChatEventsFromBackend(requests: ChatEventsArgs[]): Promise<ChatEventsBatchResponse> {
        const args = {
            requests: requests.map(chatEventsArgs),
        };

        return this.handleQueryResponse(
            () => this.localUserIndexService.chat_events(args),
            (resp) => chatEventsBatchResponse(this.principal, requests, resp),
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
        credentialArgs: VerifiedCredentialArgs | undefined,
    ): Promise<JoinCommunityResponse> {
        return this.handleResponse(
            this.localUserIndexService.join_community({
                community_id: Principal.fromText(communityId),
                invite_code: apiOptional(textToCode, inviteCode),
                verified_credential_args: apiOptional(apiVerifiedCredentialArgs, credentialArgs),
            }),
            joinCommunityResponse,
        );
    }

    joinGroup(
        chatId: string,
        inviteCode: string | undefined,
        credentialArgs: VerifiedCredentialArgs | undefined,
    ): Promise<JoinGroupResponse> {
        return this.handleResponse(
            this.localUserIndexService.join_group({
                chat_id: Principal.fromText(chatId),
                invite_code: apiOptional(textToCode, inviteCode),
                verified_credential_args: apiOptional(apiVerifiedCredentialArgs, credentialArgs),
                correlation_id: BigInt(0),
            }),
            joinGroupResponse,
        );
    }

    joinChannel(
        id: ChannelIdentifier,
        inviteCode: string | undefined,
        credentialArgs: VerifiedCredentialArgs | undefined,
    ): Promise<JoinGroupResponse> {
        return this.handleResponse(
            this.localUserIndexService.join_channel({
                community_id: Principal.fromText(id.communityId),
                channel_id: BigInt(id.channelId),
                invite_code: apiOptional(textToCode, inviteCode),
                verified_credential_args: apiOptional(apiVerifiedCredentialArgs, credentialArgs),
            }),
            (resp) => joinChannelResponse(resp, id.communityId),
        );
    }

    inviteUsersToCommunity(
        communityId: string,
        userIds: string[],
        callerUsername: string,
    ): Promise<InviteUsersResponse> {
        return this.handleResponse(
            this.localUserIndexService.invite_users_to_community({
                community_id: Principal.fromText(communityId),
                user_ids: userIds.map((u) => Principal.fromText(u)),
                caller_username: callerUsername,
            }),
            inviteUsersResponse,
        );
    }

    inviteUsersToGroup(
        chatId: string,
        userIds: string[],
        callerUsername: string,
    ): Promise<InviteUsersResponse> {
        return this.handleResponse(
            this.localUserIndexService.invite_users_to_group({
                group_id: Principal.fromText(chatId),
                user_ids: userIds.map((u) => Principal.fromText(u)),
                caller_username: callerUsername,
                correlation_id: BigInt(0),
            }),
            inviteUsersResponse,
        );
    }

    inviteUsersToChannel(
        communityId: string,
        channelId: string,
        userIds: string[],
        callerUsername: string,
    ): Promise<InviteUsersResponse> {
        return this.handleResponse(
            this.localUserIndexService.invite_users_to_channel({
                community_id: Principal.fromText(communityId),
                channel_id: BigInt(channelId),
                user_ids: userIds.map((u) => Principal.fromText(u)),
                caller_username: callerUsername,
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
