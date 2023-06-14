import {
    CommonResponses,
    InviteUsersResponse,
    JoinCommunityResponse,
    JoinGroupResponse,
    RegisterUserResponse,
    ReportMessageResponse,
    UnsupportedValueError,
} from "openchat-shared";
import type {
    ApiInviteUsersResponse,
    ApiJoinCommunityResponse,
    ApiJoinGroupResponse,
    ApiRegisterUserResponse,
    ApiReportMessageResponse,
} from "./candid/idl";
import { bytesToHexString } from "../../utils/mapping";
import { communitySummary, gateCheckFailedReason, groupChatSummary } from "../common/chatMappers";

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
    if ("ReferralCodeAlreadyClaimed" in candid) {
        return { kind: "referral_code_already_claimed" };
    }
    if ("ReferralCodeExpired" in candid) {
        return { kind: "referral_code_expired" };
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
        return "not_authorized";
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

export function joinCommunityResponse(candid: ApiJoinCommunityResponse): JoinCommunityResponse {
    if ("Success" in candid) {
        return { kind: "success", community: communitySummary(candid.Success) };
    } else if ("AlreadyInCommunity" in candid) {
        return { kind: "success", community: communitySummary(candid.AlreadyInCommunity) };
    } else if ("GateCheckFailed" in candid) {
        return { kind: "gate_check_failed", reason: gateCheckFailedReason(candid.GateCheckFailed) };
    } else {
        console.warn("Join community failed with: ", candid);
        return CommonResponses.failure;
    }
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
