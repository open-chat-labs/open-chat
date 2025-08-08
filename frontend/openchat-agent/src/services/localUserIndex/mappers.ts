import { Principal } from "@dfinity/principal";
import type {
    AccessTokenType,
    BotActionScope,
    ChatEventsArgs,
    ChatEventsBatchResponse,
    ChatEventsResponse,
    CommandArg,
    GroupAndCommunitySummaryUpdatesResponse,
    GroupAndCommunitySummaryUpdatesResponseBatch,
    JoinCommunityResponse,
    JoinGroupResponse,
    MessageContext,
    MultiUserChatIdentifier,
    RegisterUserResponse,
    Tally,
    VerifiedCredentialArgs,
    VideoCallType,
} from "openchat-shared";
import {
    CommonResponses,
    MAX_EVENTS,
    MAX_MESSAGES,
    UnsupportedValueError,
    isSuccessfulEventsResponse,
    toBigInt32,
} from "openchat-shared";
import type {
    BotActionScope as ApiBotActionScope,
    BotCommandArg,
    BotCommandArgValue,
    LocalUserIndexAccessTokenV2Args,
    LocalUserIndexAccessTokenV2Response,
    LocalUserIndexActiveProposalTalliesResponse,
    LocalUserIndexChatEventsEventsArgs,
    LocalUserIndexChatEventsEventsContext,
    LocalUserIndexChatEventsEventsSelectionCriteria,
    LocalUserIndexChatEventsResponse,
    LocalUserIndexGroupAndCommunitySummaryUpdatesV2Response,
    LocalUserIndexInviteUsersToChannelResponse,
    LocalUserIndexInviteUsersToCommunityResponse,
    LocalUserIndexInviteUsersToGroupResponse,
    LocalUserIndexJoinChannelResponse,
    LocalUserIndexJoinCommunityResponse,
    LocalUserIndexRegisterUserResponse,
    SuccessOnly,
    VerifiedCredentialGateArgs as TVerifiedCredentialGateArgs,
    VideoCallType as TVideoCallType,
} from "../../typebox";
import {
    bytesToHexString,
    principalBytesToString,
    principalStringToBytes,
} from "../../utils/mapping";
import {
    apiChatIdentifier,
    communityChannelSummary,
    communitySummary,
    gateCheckFailedReason,
    getEventsSuccess,
    ocError,
    proposalTallies,
} from "../common/chatMappersV2";
import { communitySummaryUpdates } from "../community/mappersV2";
import { groupChatSummary, groupChatSummaryUpdates } from "../group/mappersV2";

export function apiAccessTokenType(domain: AccessTokenType): LocalUserIndexAccessTokenV2Args {
    switch (domain.kind) {
        case "join_video_call":
            return { JoinVideoCall: { chat: apiChatIdentifier(domain.chatId) } };
        case "start_video_call":
            return {
                StartVideoCall: {
                    call_type: apiCallType(domain.callType),
                    chat: apiChatIdentifier(domain.chatId),
                },
            };
        case "mark_video_call_ended":
            return { MarkVideoCallAsEnded: { chat: apiChatIdentifier(domain.chatId) } };

        case "bot_action_by_command":
            return {
                BotActionByCommand: {
                    bot_id: principalStringToBytes(domain.botId),
                    scope: apiBotActionScope(domain.scope),
                    command: {
                        name: domain.command.commandName,
                        args: domain.command.arguments
                            .filter(commandArgumentHasValue)
                            .map(apiBotCommandArg),
                        meta: domain.command.meta,
                    },
                },
            };
    }
}

function commandArgumentHasValue(arg: CommandArg): boolean {
    switch (arg.kind) {
        case "user":
            return arg.userId != null;
        default:
            return arg.value != null;
    }
}

export function apiBotActionScope(domain: BotActionScope): ApiBotActionScope {
    switch (domain.kind) {
        case "chat_scope":
            return {
                Chat: {
                    chat: apiChatIdentifier(domain.chatId),
                    thread: domain.threadRootMessageIndex,
                    message_id: domain.messageId,
                    user_message_id: domain.userMessageId,
                },
            };
        case "community_scope":
            return {
                Community: {
                    community_id: principalStringToBytes(domain.communityId.communityId),
                },
            };
    }
}

export function apiBotCommandArg(domain: CommandArg): BotCommandArg {
    return {
        name: domain.name,
        value: apiBotCommandArgValue(domain),
    };
}

export function apiBotCommandArgValue(domain: CommandArg): BotCommandArgValue {
    switch (domain.kind) {
        case "boolean":
            return {
                Boolean: domain.value!,
            };
        case "integer":
            return {
                Integer: domain.value!,
            };
        case "decimal":
            return {
                Decimal: domain.value!,
            };
        case "string":
            return {
                String: domain.value!,
            };
        case "user":
            return {
                User: principalStringToBytes(domain.userId!),
            };
        case "dateTime":
            return {
                DateTime: domain.value!,
            };
    }
}

export function apiCallType(domain: VideoCallType): TVideoCallType {
    if (domain === "broadcast") return "Broadcast";
    if (domain === "default") return "Default";
    throw new UnsupportedValueError("Unexpected VideoCallType received", domain);
}

export function accessTokenResponse(
    value: LocalUserIndexAccessTokenV2Response,
): string | undefined {
    if (typeof value === "object" && "Success" in value) {
        return value.Success;
    }
    console.warn("Unable to get access token: ", value);
    return undefined;
}

export function groupAndCommunitySummaryUpdates(
    value: LocalUserIndexGroupAndCommunitySummaryUpdatesV2Response,
): GroupAndCommunitySummaryUpdatesResponseBatch {
    const updates: GroupAndCommunitySummaryUpdatesResponse[] = [];
    for (const response of value.Success.updates) {
        if (response === "SuccessNoUpdates") {
            continue;
        } else if ("SuccessGroup" in response) {
            updates.push({
                kind: "group",
                value: groupChatSummary(response.SuccessGroup),
            });
        } else if ("SuccessGroupUpdates" in response) {
            updates.push({
                kind: "group_updates",
                value: groupChatSummaryUpdates(response.SuccessGroupUpdates),
            });
        } else if ("SuccessCommunity" in response) {
            updates.push({
                kind: "community",
                value: communitySummary(response.SuccessCommunity),
            });
        } else if ("SuccessCommunityUpdates" in response) {
            updates.push({
                kind: "community_updates",
                value: communitySummaryUpdates(response.SuccessCommunityUpdates),
            });
        } else if ("Error" in response) {
            // This variant isn't returned any more and can be cleaned up shortly
            continue;
        } else {
            throw new UnsupportedValueError(
                "Unexpected ApiSummaryUpdatesResponse type received",
                response,
            );
        }
    }

    return {
        timestamp: value.Success.timestamp,
        updates,
        excessUpdates: value.Success.excess_updates.map(principalBytesToString),
        errors: value.Success.errors.map(([c, e]) => [principalBytesToString(c), ocError(e)]),
        notFound: value.Success.not_found.map(principalBytesToString),
    };
}

export function chatEventsArgs(eventArgs: ChatEventsArgs): LocalUserIndexChatEventsEventsArgs {
    return {
        context: eventsContext(eventArgs.context),
        args: eventsArgsInner(eventArgs.args),
        latest_known_update: eventArgs.latestKnownUpdate,
    };
}

function eventsContext(context: MessageContext): LocalUserIndexChatEventsEventsContext {
    switch (context.chatId.kind) {
        case "direct_chat":
            return {
                Direct: principalStringToBytes(context.chatId.userId),
            };
        case "group_chat":
            return {
                Group: [
                    principalStringToBytes(context.chatId.groupId),
                    context.threadRootMessageIndex ?? null,
                ],
            };
        case "channel":
            return {
                Channel: [
                    principalStringToBytes(context.chatId.communityId),
                    toBigInt32(context.chatId.channelId),
                    context.threadRootMessageIndex ?? null,
                ],
            };
    }
}

function eventsArgsInner(
    args: ChatEventsArgs["args"],
): LocalUserIndexChatEventsEventsSelectionCriteria {
    switch (args.kind) {
        case "page":
            return {
                Page: {
                    max_messages: MAX_MESSAGES,
                    max_events: MAX_EVENTS,
                    ascending: args.ascending,
                    start_index: args.startIndex,
                },
            };
        case "by_index":
            return {
                ByIndex: {
                    events: args.events,
                },
            };
        case "window": {
            return {
                Window: {
                    mid_point: args.midPoint,
                    max_messages: MAX_MESSAGES,
                    max_events: MAX_EVENTS,
                },
            };
        }
    }
}

export async function chatEventsBatchResponse(
    principal: Principal,
    requests: ChatEventsArgs[],
    value: LocalUserIndexChatEventsResponse,
): Promise<ChatEventsBatchResponse> {
    const responses = [] as ChatEventsResponse[];
    for (let i = 0; i < requests.length; i++) {
        const response = value.Success.responses[i];
        const args = requests[i];
        if ("Success" in response) {
            const result = await getEventsSuccess(
                response.Success,
                principal,
                args.context.chatId,
                true,
            );
            responses.push(
                isSuccessfulEventsResponse(result) ? { kind: "success", result } : result,
            );
        } else {
            responses.push(ocError(response.Error));
        }
    }
    return {
        responses,
        timestamp: value.Success.timestamp,
    };
}

export function activeProposalTalliesResponse(
    chatIds: MultiUserChatIdentifier[],
    value: LocalUserIndexActiveProposalTalliesResponse,
): Map<MultiUserChatIdentifier, [number, Tally][]> {
    const responses = value.Success.responses;
    if (chatIds.length !== responses.length) {
        console.error("Invalid activeProposalTalliesResponse", chatIds, responses.length);
    }

    const results = new Map<MultiUserChatIdentifier, [number, Tally][]>();
    for (let i = 0; i < chatIds.length; i++) {
        const chatId = chatIds[i];
        const response = responses[i];

        if ("Success" in response && response.Success.tallies.length > 0) {
            results.set(chatId, proposalTallies(response.Success.tallies));
        }
    }
    return results;
}

export function joinChannelResponse(
    value: LocalUserIndexJoinChannelResponse,
    communityId: string,
): JoinGroupResponse {
    if (typeof value === "object") {
        if ("Success" in value) {
            return { kind: "success", group: communityChannelSummary(value.Success, communityId) };
        } else if ("AlreadyInChannel" in value) {
            return {
                kind: "success",
                group: communityChannelSummary(value.AlreadyInChannel, communityId),
            };
        } else if ("SuccessJoinedCommunity" in value) {
            return {
                kind: "success_joined_community",
                community: communitySummary(value.SuccessJoinedCommunity),
            };
        } else if ("GateCheckFailed" in value) {
            return {
                kind: "gate_check_failed",
                reason: gateCheckFailedReason(value.GateCheckFailed),
            };
        } else if ("Error" in value) {
            return ocError(value.Error);
        }
    }

    console.warn("Join group failed with: ", value);
    return CommonResponses.failure();
}

export function registerUserResponse(
    value: LocalUserIndexRegisterUserResponse,
): RegisterUserResponse {
    if (value === "UsernameInvalid") {
        return { kind: "username_invalid" };
    }
    if (value === "AlreadyRegistered") {
        return { kind: "already_registered" };
    }
    if (value === "UserLimitReached") {
        return { kind: "user_limit_reached" };
    }
    if (value === "RegistrationInProgress") {
        return { kind: "registration_in_progress" };
    }
    if (value === "CyclesBalanceTooLow") {
        return { kind: "cycles_balance_too_low" };
    }
    if (value === "ReferralCodeInvalid") {
        return { kind: "referral_code_invalid" };
    }
    if (value === "ReferralCodeAlreadyClaimed") {
        return { kind: "referral_code_already_claimed" };
    }
    if (value === "ReferralCodeExpired") {
        return { kind: "referral_code_expired" };
    }
    if ("Success" in value) {
        return {
            kind: "success",
            userId: principalBytesToString(value.Success.user_id),
            icpAccount: bytesToHexString(value.Success.icp_account),
        };
    }
    if ("UsernameTooShort" in value) {
        return { kind: "username_too_short" };
    }
    if ("UsernameTooLong" in value) {
        return { kind: "username_too_long" };
    }
    if ("NotSupported" in value) {
        return { kind: "not_supported" };
    }
    if ("InternalError" in value) {
        return { kind: "internal_error" };
    }
    if ("PublicKeyInvalid" in value) {
        return { kind: "public_key_invalid" };
    }
    if ("Error" in value) {
        return ocError(value.Error);
    }

    throw new UnsupportedValueError("Unexpected ApiRegisterUserResponse type received", value);
}

export function inviteUsersResponse(
    value:
        | LocalUserIndexInviteUsersToGroupResponse
        | LocalUserIndexInviteUsersToChannelResponse
        | LocalUserIndexInviteUsersToCommunityResponse,
): boolean {
    if (value === "Success") {
        return true;
    } else {
        console.warn("InviteUsersResponse was unsuccessful", value);
        return false;
    }
}

export function joinCommunityResponse(
    value: LocalUserIndexJoinCommunityResponse,
): JoinCommunityResponse {
    if (typeof value === "object") {
        if ("Success" in value) {
            return { kind: "success", community: communitySummary(value.Success) };
        } else if ("AlreadyInCommunity" in value) {
            return { kind: "success", community: communitySummary(value.AlreadyInCommunity) };
        } else if ("GateCheckFailed" in value) {
            return {
                kind: "gate_check_failed",
                reason: gateCheckFailedReason(value.GateCheckFailed),
            };
        }
    }

    console.warn("Join community failed with: ", value);
    return CommonResponses.failure();
}

export function apiVerifiedCredentialArgs(
    domain: VerifiedCredentialArgs,
): TVerifiedCredentialGateArgs {
    return {
        user_ii_principal: principalStringToBytes(domain.userIIPrincipal),
        ii_origin: domain.iiOrigin,
        credential_jwts: domain.credentialJwts,
        credential_jwt: domain.credentialJwts[0],
    };
}

export function withdrawFromIcpSwapResponse(value: SuccessOnly): boolean {
    console.log("Withdraw from ICPSwap response", value);
    return value === "Success";
}
