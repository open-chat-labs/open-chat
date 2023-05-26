import {
    GateCheckFailedReason,
    GroupChatSummary,
    InviteUsersResponse,
    JoinGroupResponse,
    RegisterUserResponse,
    ReportMessageResponse,
    UnsupportedValueError,
} from "openchat-shared";
import type {
    ApiGateCheckFailedReason,
    ApiGroupCanisterGroupChatSummary,
    ApiInviteUsersResponse,
    ApiJoinGroupResponse,
    ApiRegisterUserResponse,
    ApiReportMessageResponse,
} from "./candid/idl";
import { bytesToHexString, identity, optional } from "../../utils/mapping";
import {
    apiGroupSubtype,
    chatMetrics,
    groupGate,
    groupPermissions,
    memberRole,
    message,
} from "../common/chatMappers";

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
    if ("UsernameInvalid" in candid) {
        return { kind: "username_invalid" };
    }
    if ("AlreadyRegistered" in candid) {
        return { kind: "already_registered" };
    }
    if ("UserLimitReached" in candid) {
        return { kind: "user_limit_reached" };
    }
    if ("UsernameTooLong" in candid) {
        return { kind: "username_too_long" };
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

    throw new UnsupportedValueError("Unexpected ApiRegisterUserResponse type received", candid);
}

export function reportMessageResponse(candid: ApiReportMessageResponse): ReportMessageResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("InternalError" in candid) {
        return "failure";
    }
    throw new UnsupportedValueError("Unexpected ApiReportMessageResponse type received", candid);
}

export function inviteUsersResponse(candid: ApiInviteUsersResponse): InviteUsersResponse {
    if ("Success" in candid) {
        return "success";
    }
    if ("NotAuthorized" in candid) {
        return "not_authorised";
    }
    if ("InternalError" in candid) {
        return "internal_error";
    }
    if ("CallerNotInGroup" in candid) {
        return "caller_not_in_group";
    }
    if ("GroupNotFound" in candid) {
        return "group_not_found";
    }
    if ("TooManyInvites" in candid) {
        return "too_many_invites";
    }
    if ("ChatFrozen" in candid) {
        return "chat_frozen";
    }
    throw new UnsupportedValueError("Unexpected ApiInviteUsersResponse type received", candid);
}

export function joinGroupResponse(candid: ApiJoinGroupResponse): JoinGroupResponse {
    if ("Success" in candid) {
        return groupChatSummary(candid.Success);
    }
    if ("AlreadyInGroupV2" in candid) {
        return groupChatSummary(candid.AlreadyInGroupV2);
    }
    if ("Blocked" in candid) {
        return { kind: "blocked" };
    }
    if ("AlreadyInGroup" in candid) {
        return { kind: "already_in_group" };
    }
    if ("GroupNotPublic" in candid) {
        return { kind: "group_not_public" };
    }
    if ("NotInvited" in candid) {
        return { kind: "not_invited" };
    }
    if ("InternalError" in candid) {
        return { kind: "internal_error" };
    }
    if ("ParticipantLimitReached" in candid) {
        // todo - check if we need to deal with this in the UI
        return { kind: "member_limit_reached" };
    }
    if ("GroupNotFound" in candid) {
        return { kind: "group_not_found" };
    }
    if ("UserSuspended" in candid) {
        return { kind: "user_suspended" };
    }
    if ("ChatFrozen" in candid) {
        return { kind: "chat_frozen" };
    }
    if ("GateCheckFailed" in candid) {
        return { kind: "gate_check_failed", reason: gateCheckFailedReason(candid.GateCheckFailed) };
    }
    throw new UnsupportedValueError("Unexpected ApiJoinGroupResponse type received", candid);
}

function gateCheckFailedReason(candid: ApiGateCheckFailedReason): GateCheckFailedReason {
    if ("NotDiamondMember" in candid) {
        return "not_diamond";
    }
    if ("NoSnsNeuronsFound" in candid) {
        return "no_sns_neuron_found";
    }
    if ("NoSnsNeuronsWithRequiredDissolveDelayFound" in candid) {
        return "dissolve_delay_not_met";
    }
    if ("NoSnsNeuronsWithRequiredStakeFound" in candid) {
        return "min_stake_not_met";
    }
    throw new UnsupportedValueError("Unexpected ApiJoinGroupResponse type received", candid);
}

function groupChatSummary(candid: ApiGroupCanisterGroupChatSummary): GroupChatSummary {
    const latestMessage = optional(candid.latest_message, (ev) => ({
        index: ev.index,
        timestamp: ev.timestamp,
        event: message(ev.event),
    }));
    return {
        kind: "group_chat",
        chatId: candid.chat_id.toString(),
        latestMessage,
        readByMeUpTo: latestMessage?.event.messageIndex,
        name: candid.name,
        description: candid.description,
        public: candid.is_public,
        historyVisibleToNewJoiners: candid.history_visible_to_new_joiners,
        joined: candid.joined,
        minVisibleEventIndex: candid.min_visible_event_index,
        minVisibleMessageIndex: candid.min_visible_message_index,
        latestEventIndex: candid.latest_event_index,
        lastUpdated: candid.last_updated,
        blobReference: optional(candid.avatar_id, (blobId) => ({
            blobId,
            canisterId: candid.chat_id.toString(),
        })),
        notificationsMuted: candid.notifications_muted,
        memberCount: candid.participant_count,
        myRole: memberRole(candid.role),
        mentions: [],
        permissions: groupPermissions(candid.permissions),
        metrics: chatMetrics(candid.metrics),
        myMetrics: chatMetrics(candid.my_metrics),
        latestThreads: [],
        subtype: optional(candid.subtype, apiGroupSubtype),
        archived: false,
        previewed: false,
        frozen: candid.frozen.length > 0,
        dateLastPinned: optional(candid.date_last_pinned, identity),
        dateReadPinned: undefined,
        gate: optional(candid.gate, groupGate) ?? { kind: "no_gate" },
    };
}
