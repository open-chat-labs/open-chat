import { Principal } from "@dfinity/principal";
import type {
    AccessTokenType,
    ChatEventsArgs,
    ChatEventsBatchResponse,
    ChatEventsResponse,
    GroupAndCommunitySummaryUpdatesResponse,
    InviteUsersResponse,
    JoinCommunityResponse,
    JoinGroupResponse,
    MessageContext,
    RegisterUserResponse,
    VerifiedCredentialArgs,
    VideoCallType,
} from "openchat-shared";
import { CommonResponses, MAX_EVENTS, MAX_MESSAGES, UnsupportedValueError } from "openchat-shared";
import type {
    ApiAccessTokenResponse,
    ApiAccessTokenType,
    ApiChatEventsArgsInner,
    ApiChatEventsResponse,
    ApiEventsContext,
    ApiGroupAndCommunitySummaryUpdatesResponse,
    ApiInviteUsersResponse,
    ApiInviteUsersToChannelResponse,
    ApiJoinChannelResponse,
    ApiJoinCommunityResponse,
    ApiRegisterUserResponse,
    ApiVerifiedCredentialGateArgs,
    ApiVideoCallType,
} from "./candid/idl";
import { bytesToHexString, identity } from "../../utils/mapping";
import {
    apiOptional,
    communityChannelSummary,
    communitySummary,
    eventsSuccessResponse,
    gateCheckFailedReason,
} from "../common/chatMappers";
import { groupChatSummary, groupChatSummaryUpdates } from "../group/mappers";
import { communitySummaryUpdates } from "../community/mappers";
import { ensureReplicaIsUpToDate } from "../common/replicaUpToDateChecker";

export function apiAccessTokenType(domain: AccessTokenType): ApiAccessTokenType {
    switch (domain.kind) {
        case "join_video_call":
            return {
                JoinVideoCall: null,
            };
        case "start_video_call":
            return {
                StartVideoCallV2: {
                    call_type: apiCallType(domain.callType),
                },
            };
    }
}

export function apiCallType(domain: VideoCallType): ApiVideoCallType {
    if (domain === "broadcast") return { Broadcast: null };
    if (domain === "default") return { Default: null };
    throw new UnsupportedValueError("Unexpected VideoCallType received", domain);
}

export function accessTokenResponse(candid: ApiAccessTokenResponse): string | undefined {
    if ("Success" in candid) {
        return candid.Success;
    }
    console.warn("Unable to get access token: ", candid);
    return undefined;
}

export function groupAndCommunitySummaryUpdates(
    candid: ApiGroupAndCommunitySummaryUpdatesResponse,
): GroupAndCommunitySummaryUpdatesResponse[] {
    const results: GroupAndCommunitySummaryUpdatesResponse[] = [];
    for (const result of candid.Success) {
        if ("SuccessNoUpdates" in result) {
            results.push({
                kind: "no_updates",
            });
        } else if ("SuccessGroup" in result) {
            results.push({
                kind: "group",
                value: groupChatSummary(result.SuccessGroup),
            });
        } else if ("SuccessGroupUpdates" in result) {
            results.push({
                kind: "group_updates",
                value: groupChatSummaryUpdates(result.SuccessGroupUpdates),
            });
        } else if ("SuccessCommunity" in result) {
            results.push({
                kind: "community",
                value: communitySummary(result.SuccessCommunity),
            });
        } else if ("SuccessCommunityUpdates" in result) {
            results.push({
                kind: "community_updates",
                value: communitySummaryUpdates(result.SuccessCommunityUpdates),
            });
        } else if ("NotFound" in result) {
            results.push({
                kind: "not_found",
            });
        } else if ("InternalError" in result) {
            results.push({
                kind: "error",
                error: result.InternalError,
            });
        } else {
            throw new UnsupportedValueError(
                "Unexpected ApiSummaryUpdatesResponse type received",
                result,
            );
        }
    }

    return results;
}

export function chatEventsArgs(eventArgs: ChatEventsArgs): ApiChatEventsArgsInner {
    return {
        context: eventsContext(eventArgs.context),
        args: eventsArgsInner(eventArgs.args),
        latest_known_update: apiOptional(identity, eventArgs.latestKnownUpdate),
    };
}

function eventsContext(context: MessageContext): ApiEventsContext {
    switch (context.chatId.kind) {
        case "direct_chat":
            return {
                Direct: Principal.fromText(context.chatId.userId),
            };
        case "group_chat":
            return {
                Group: [
                    Principal.fromText(context.chatId.groupId),
                    apiOptional(identity, context.threadRootMessageIndex),
                ],
            };
        case "channel":
            return {
                Channel: [
                    Principal.fromText(context.chatId.communityId),
                    BigInt(context.chatId.channelId),
                    apiOptional(identity, context.threadRootMessageIndex),
                ],
            };
    }
}

function eventsArgsInner(args: ChatEventsArgs["args"]): ApiChatEventsArgsInner["args"] {
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
    candid: ApiChatEventsResponse,
): Promise<ChatEventsBatchResponse> {
    const responses = [] as ChatEventsResponse[];
    for (let i = 0; i < requests.length; i++) {
        const response = candid.Success.responses[i];
        const args = requests[i];

        if ("Success" in response) {
            const error = await ensureReplicaIsUpToDate(
                principal,
                args.context.chatId,
                response.Success.chat_last_updated,
                true,
            );

            responses.push(
                error ?? {
                    kind: "success",
                    result: eventsSuccessResponse(response.Success),
                },
            );
        } else if ("ReplicaNotUpToDate" in response) {
            responses.push({
                kind: "replica_not_up_to_date",
                replicaTimestamp: response.ReplicaNotUpToDate,
                clientTimestamp: args.latestKnownUpdate ?? BigInt(-1),
            });
        } else if ("NotFound" in response) {
            responses.push({
                kind: "not_found",
            });
        } else {
            responses.push({
                kind: "internal_error",
                error: response.InternalError,
            });
        }
    }
    return {
        responses,
        timestamp: candid.Success.timestamp,
    };
}

export function joinChannelResponse(
    candid: ApiJoinChannelResponse,
    communityId: string,
): JoinGroupResponse {
    if ("Success" in candid) {
        return { kind: "success", group: communityChannelSummary(candid.Success, communityId) };
    } else if ("AlreadyInChannel" in candid) {
        return {
            kind: "success",
            group: communityChannelSummary(candid.AlreadyInChannel, communityId),
        };
    } else if ("SuccessJoinedCommunity" in candid) {
        return {
            kind: "success_joined_community",
            community: communitySummary(candid.SuccessJoinedCommunity),
        };
    } else if ("UserBlocked" in candid) {
        return CommonResponses.userBlocked();
    } else if ("GateCheckFailed" in candid) {
        return { kind: "gate_check_failed", reason: gateCheckFailedReason(candid.GateCheckFailed) };
    } else {
        console.warn("Join group failed with: ", candid);
        return CommonResponses.failure();
    }
}

export function registerUserResponse(candid: ApiRegisterUserResponse): RegisterUserResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            userId: candid.Success.user_id.toString(),
            icpAccount: bytesToHexString(candid.Success.icp_account),
        };
    }

    if ("UsernameTaken" in candid) {
        return { kind: "username_taken" };
    }
    if ("UsernameTooShort" in candid) {
        return { kind: "username_too_short" };
    }
    if ("UsernameTooLong" in candid) {
        return { kind: "username_too_long" };
    }
    if ("UsernameInvalid" in candid) {
        return { kind: "username_invalid" };
    }
    if ("AlreadyRegistered" in candid) {
        return { kind: "already_registered" };
    }
    if ("UserLimitReached" in candid) {
        return { kind: "user_limit_reached" };
    }
    if ("NotSupported" in candid) {
        return { kind: "not_supported" };
    }
    if ("InternalError" in candid) {
        return { kind: "internal_error" };
    }
    if ("CyclesBalanceTooLow" in candid) {
        return { kind: "cycles_balance_too_low" };
    }
    if ("PublicKeyInvalid" in candid) {
        return { kind: "public_key_invalid" };
    }
    if ("ReferralCodeInvalid" in candid) {
        return { kind: "referral_code_invalid" };
    }
    if ("ReferralCodeAlreadyClaimed" in candid) {
        return { kind: "referral_code_already_claimed" };
    }
    if ("ReferralCodeExpired" in candid) {
        return { kind: "referral_code_expired" };
    }
    if ("RegistrationInProgress" in candid) {
        return { kind: "registration_in_progress" };
    }

    throw new UnsupportedValueError("Unexpected ApiRegisterUserResponse type received", candid);
}

export function inviteUsersResponse(
    candid: ApiInviteUsersResponse | ApiInviteUsersToChannelResponse,
): InviteUsersResponse {
    if ("Success" in candid) {
        return "success";
    } else {
        console.warn("InviteUsersResponse was unsuccessful", candid);
        return "failure";
    }
}

export function joinCommunityResponse(candid: ApiJoinCommunityResponse): JoinCommunityResponse {
    if ("Success" in candid) {
        return { kind: "success", community: communitySummary(candid.Success) };
    } else if ("AlreadyInCommunity" in candid) {
        return { kind: "success", community: communitySummary(candid.AlreadyInCommunity) };
    } else if ("GateCheckFailed" in candid) {
        return { kind: "gate_check_failed", reason: gateCheckFailedReason(candid.GateCheckFailed) };
    } else {
        console.warn("Join community failed with: ", candid);
        return CommonResponses.failure();
    }
}

export function apiVerifiedCredentialArgs(
    domain: VerifiedCredentialArgs,
): ApiVerifiedCredentialGateArgs {
    return {
        user_ii_principal: Principal.fromText(domain.userIIPrincipal),
        ii_origin: domain.iiOrigin,
        credential_jwts: domain.credentialJwts,
        credential_jwt: domain.credentialJwts[0],
    };
}
