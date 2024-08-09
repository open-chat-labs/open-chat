import type { HttpAgent, Identity, SignIdentity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory, type LocalUserIndexService } from "./candid/idl";
import type {
    AccessTokenType,
    ChannelIdentifier,
    ChatEvent,
    ChatEventsArgs,
    ChatEventsArgsInner,
    ChatEventsBatchResponse,
    ChatEventsResponse,
    ChatIdentifier,
    EventsSuccessResult,
    EventWrapper,
    GroupAndCommunitySummaryUpdatesArgs,
    GroupAndCommunitySummaryUpdatesResponse,
    InviteUsersResponse,
    JoinCommunityResponse,
    JoinGroupResponse,
    MessageContext,
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
import { joinGroupResponse, apiOptional, apiChatIdentifier } from "../common/chatMappers";
import { MAX_MISSING, textToCode, UnsupportedValueError } from "openchat-shared";
import { identity } from "../../utils/mapping";
import {
    type Database,
    getCachedEvents,
    getCachedEventsByIndex,
    getCachedEventsWindowByMessageIndex,
    setCachedEvents,
    setCachePrimerTimestamp,
} from "../../utils/caching";

export class LocalUserIndexClient extends CandidService {
    private localUserIndexService: LocalUserIndexService;

    constructor(
        identity: Identity,
        agent: HttpAgent,
        canisterId: string,
        private db: Database,
    ) {
        super(identity, agent);

        this.localUserIndexService = this.createServiceClient<LocalUserIndexService>(
            idlFactory,
            canisterId,
        );
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
        const partialCachedResults = [] as EventWrapper<ChatEvent>[][];
        const requestsToBackend = [] as ChatEventsArgs[];

        for (let i = 0; i < requests.length; i++) {
            const request = requests[i];

            const [cached, missing] = await this.getEventsFromCache(request.context, request.args);

            if (missing.size === 0) {
                // Insert the response into the index matching the request
                responses[i] = {
                    kind: "success",
                    result: cached,
                };
                if (cachePrimer && request.latestKnownUpdate !== undefined) {
                    setCachePrimerTimestamp(
                        this.db,
                        request.context.chatId,
                        request.latestKnownUpdate,
                    );
                }
            } else if (missing.size > MAX_MISSING) {
                requestsToBackend.push(request);
            } else {
                partialCachedResults[i] = cached.events;
                requestsToBackend.push({
                    context: request.context,
                    args: {
                        kind: "by_index",
                        events: [...missing],
                    },
                    latestKnownUpdate: request.latestKnownUpdate,
                });
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
                        if (response.kind === "success") {
                            const fromCache = partialCachedResults[j];
                            if (fromCache !== undefined) {
                                response.result.events = [
                                    ...response.result.events,
                                    ...fromCache,
                                ].sort((a, b) => a.index - b.index);
                            }
                        }
                        responses[j] = response;
                        break;
                    }
                }
            }
        }

        return responses;
    }

    private async getEventsFromCache(
        context: MessageContext,
        args: ChatEventsArgsInner,
    ): Promise<[EventsSuccessResult<ChatEvent>, Set<number>]> {
        if (args.kind === "page") {
            return await getCachedEvents(
                this.db,
                args.eventIndexRange,
                context,
                args.startIndex,
                args.ascending,
                undefined,
                undefined,
                1,
            );
        }
        if (args.kind === "window") {
            const [cached, missing, _] = await getCachedEventsWindowByMessageIndex(
                this.db,
                args.eventIndexRange,
                context,
                args.midPoint,
                undefined,
                undefined,
                1,
            );
            return [cached, missing];
        }
        if (args.kind === "by_index") {
            return await getCachedEventsByIndex(this.db, args.events, context);
        }
        throw new UnsupportedValueError("Unexpected ChatEventsArgs type", args);
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
