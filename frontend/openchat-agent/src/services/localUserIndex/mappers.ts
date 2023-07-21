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
    ApiInviteUsersToChannelResponse,
    ApiJoinChannelResponse,
    ApiJoinCommunityResponse,
    ApiRegisterUserResponse,
    ApiReportMessageResponse,
} from "./candid/idl";
import { bytesToHexString } from "../../utils/mapping";
import {
    communityChannelSummary,
    communitySummary,
    gateCheckFailedReason,
} from "../common/chatMappers";

export function joinChannelResponse(
    candid: ApiJoinChannelResponse,
    communityId: string
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

export function inviteUsersResponse(
    candid: ApiInviteUsersResponse | ApiInviteUsersToChannelResponse
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
