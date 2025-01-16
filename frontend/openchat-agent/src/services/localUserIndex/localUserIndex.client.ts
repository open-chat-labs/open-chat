import type { HttpAgent, Identity, SignIdentity } from "@dfinity/agent";
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
    JoinCommunityResponse,
    JoinGroupResponse,
    MessageContext,
    RegisterUserResponse,
    VerifiedCredentialArgs,
} from "openchat-shared";
import { CandidService } from "../candidService";
import {
    accessTokenResponse,
    apiAccessTokenType,
    apiVerifiedCredentialArgs,
    chatEventsArgs,
    chatEventsBatchResponse,
    groupAndCommunitySummaryUpdates,
    inviteUsersResponse,
    joinChannelResponse,
    joinCommunityResponse,
    registerUserResponse,
    withdrawFromIcpSwapResponse,
} from "./mappers";
import { joinGroupResponse, apiChatIdentifier } from "../common/chatMappersV2";
import { to32bitBigInt, MAX_MISSING, textToCode, UnsupportedValueError } from "openchat-shared";
import {
    mapOptional,
    maybePrincipalStringToBytes,
    principalStringToBytes,
} from "../../utils/mapping";
import {
    type Database,
    getCachedEvents,
    getCachedEventsByIndex,
    getCachedEventsWindowByMessageIndex,
    setCachedEvents,
    setCachePrimerTimestamp,
} from "../../utils/caching";
import {
    LocalUserIndexAccessTokenArgs,
    LocalUserIndexAccessTokenResponse,
    LocalUserIndexChatEventsArgs,
    LocalUserIndexChatEventsResponse,
    LocalUserIndexGroupAndCommunitySummaryUpdatesArgs,
    LocalUserIndexGroupAndCommunitySummaryUpdatesResponse,
    LocalUserIndexInviteUsersToChannelArgs,
    LocalUserIndexInviteUsersToChannelResponse,
    LocalUserIndexInviteUsersToCommunityArgs,
    LocalUserIndexInviteUsersToCommunityResponse,
    LocalUserIndexInviteUsersToGroupArgs,
    LocalUserIndexInviteUsersToGroupResponse,
    LocalUserIndexJoinChannelArgs,
    LocalUserIndexJoinChannelResponse,
    LocalUserIndexJoinCommunityArgs,
    LocalUserIndexJoinCommunityResponse,
    LocalUserIndexJoinGroupArgs,
    LocalUserIndexJoinGroupResponse,
    LocalUserIndexRegisterUserArgs,
    LocalUserIndexRegisterUserResponse,
    LocalUserIndexWithdrawFromIcpswapArgs,
    LocalUserIndexWithdrawFromIcpswapResponse,
} from "../../typebox";

export class LocalUserIndexClient extends CandidService {
    constructor(
        identity: Identity,
        agent: HttpAgent,
        canisterId: string,
        private db: Database,
    ) {
        super(identity, agent, canisterId);
    }

    groupAndCommunitySummaryUpdates(
        requests: GroupAndCommunitySummaryUpdatesArgs[],
    ): Promise<GroupAndCommunitySummaryUpdatesResponse[]> {
        const args = {
            requests: requests.map((r) => ({
                canister_id: principalStringToBytes(r.canisterId),
                is_community: r.isCommunity,
                invite_code: r.inviteCode,
                updates_since: r.updatesSince,
            })),
        };

        return this.executeMsgpackQuery(
            "group_and_community_summary_updates",
            args,
            groupAndCommunitySummaryUpdates,
            LocalUserIndexGroupAndCommunitySummaryUpdatesArgs,
            LocalUserIndexGroupAndCommunitySummaryUpdatesResponse,
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

        return this.executeMsgpackQuery(
            "chat_events",
            args,
            (resp) => chatEventsBatchResponse(this.principal, requests, resp),
            LocalUserIndexChatEventsArgs,
            LocalUserIndexChatEventsResponse,
        );
    }

    registerUser(
        username: string,
        referralCode: string | undefined,
    ): Promise<RegisterUserResponse> {
        return this.executeMsgpackUpdate(
            "register_user",
            {
                username,
                referral_code: referralCode,
                public_key: new Uint8Array((this.identity as SignIdentity).getPublicKey().toDer()),
            },
            registerUserResponse,
            LocalUserIndexRegisterUserArgs,
            LocalUserIndexRegisterUserResponse,
        );
    }

    joinCommunity(
        communityId: string,
        inviteCode: string | undefined,
        credentialArgs: VerifiedCredentialArgs | undefined,
        referredBy?: string,
    ): Promise<JoinCommunityResponse> {
        return this.executeMsgpackUpdate(
            "join_community",
            {
                community_id: principalStringToBytes(communityId),
                invite_code: mapOptional(inviteCode, textToCode),
                verified_credential_args: mapOptional(credentialArgs, apiVerifiedCredentialArgs),
                referred_by: maybePrincipalStringToBytes(referredBy),
            },
            joinCommunityResponse,
            LocalUserIndexJoinCommunityArgs,
            LocalUserIndexJoinCommunityResponse,
        );
    }

    joinGroup(
        chatId: string,
        inviteCode: string | undefined,
        credentialArgs: VerifiedCredentialArgs | undefined,
    ): Promise<JoinGroupResponse> {
        return this.executeMsgpackUpdate(
            "join_group",
            {
                chat_id: principalStringToBytes(chatId),
                invite_code: mapOptional(inviteCode, textToCode),
                verified_credential_args: mapOptional(credentialArgs, apiVerifiedCredentialArgs),
                correlation_id: BigInt(0),
            },
            joinGroupResponse,
            LocalUserIndexJoinGroupArgs,
            LocalUserIndexJoinGroupResponse,
        );
    }

    joinChannel(
        id: ChannelIdentifier,
        inviteCode: string | undefined,
        credentialArgs: VerifiedCredentialArgs | undefined,
        referredBy?: string,
    ): Promise<JoinGroupResponse> {
        return this.executeMsgpackUpdate(
            "join_channel",
            {
                community_id: principalStringToBytes(id.communityId),
                channel_id: to32bitBigInt(id.channelId),
                invite_code: mapOptional(inviteCode, textToCode),
                verified_credential_args: mapOptional(credentialArgs, apiVerifiedCredentialArgs),
                referred_by: maybePrincipalStringToBytes(referredBy),
            },
            (resp) => {
                return joinChannelResponse(resp, id.communityId);
            },
            LocalUserIndexJoinChannelArgs,
            LocalUserIndexJoinChannelResponse,
        );
    }

    inviteUsersToCommunity(
        communityId: string,
        userIds: string[],
        callerUsername: string,
    ): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "invite_users_to_community",
            {
                community_id: principalStringToBytes(communityId),
                user_ids: userIds.map(principalStringToBytes),
                caller_username: callerUsername,
            },
            inviteUsersResponse,
            LocalUserIndexInviteUsersToCommunityArgs,
            LocalUserIndexInviteUsersToCommunityResponse,
        );
    }

    inviteUsersToGroup(
        chatId: string,
        userIds: string[],
        callerUsername: string,
    ): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "invite_users_to_group",
            {
                group_id: principalStringToBytes(chatId),
                user_ids: userIds.map(principalStringToBytes),
                caller_username: callerUsername,
                correlation_id: BigInt(0),
            },
            inviteUsersResponse,
            LocalUserIndexInviteUsersToGroupArgs,
            LocalUserIndexInviteUsersToGroupResponse,
        );
    }

    inviteUsersToChannel(
        communityId: string,
        channelId: number,
        userIds: string[],
        callerUsername: string,
    ): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "invite_users_to_channel",
            {
                community_id: principalStringToBytes(communityId),
                channel_id: to32bitBigInt(channelId),
                user_ids: userIds.map(principalStringToBytes),
                caller_username: callerUsername,
            },
            inviteUsersResponse,
            LocalUserIndexInviteUsersToChannelArgs,
            LocalUserIndexInviteUsersToChannelResponse,
        );
    }

    getAccessToken(
        chatId: ChatIdentifier,
        accessType: AccessTokenType,
    ): Promise<string | undefined> {
        return this.executeMsgpackQuery(
            "access_token",
            {
                chat: apiChatIdentifier(chatId),
                token_type: apiAccessTokenType(accessType),
            },
            accessTokenResponse,
            LocalUserIndexAccessTokenArgs,
            LocalUserIndexAccessTokenResponse,
        );
    }

    withdrawFromIcpSwap(userId: string, swapId: bigint, inputToken: boolean): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "withdraw_from_icpswap",
            {
                user_id: principalStringToBytes(userId),
                swap_id: swapId,
                input_token: inputToken
            },
            withdrawFromIcpSwapResponse,
            LocalUserIndexWithdrawFromIcpswapArgs,
            LocalUserIndexWithdrawFromIcpswapResponse
        );
    }
}
