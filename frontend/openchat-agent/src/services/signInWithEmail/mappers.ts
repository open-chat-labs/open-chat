import type {
    ApiGenerateVerificationCodeResponse,
    ApiSubmitVerificationCodeResponse,
} from "./candid/idl";
import {
    type GenerateEmailVerificationCodeResponse,
    type SubmitEmailVerificationCodeResponse,
    UnsupportedValueError,
} from "openchat-shared";
import { consolidateBytes, identity, optional } from "../../utils/mapping";

export function generateVerificationCodeResponse(
    candid: ApiGenerateVerificationCodeResponse,
): GenerateEmailVerificationCodeResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
        };
    }
    if ("EmailInvalid" in candid) {
        return {
            kind: "email_invalid",
        };
    }
    if ("Blocked" in candid) {
        return {
            kind: "blocked",
            until: candid.Blocked,
        };
    }
    if ("FailedToSendEmail" in candid) {
        return {
            kind: "failed_to_send_email",
            error: candid.FailedToSendEmail,
        };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiGenerateVerificationCodeResponse type received",
        candid,
    );
}

export function submitVerificationCodeResponse(
    candid: ApiSubmitVerificationCodeResponse,
): SubmitEmailVerificationCodeResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            userKey: consolidateBytes(candid.Success.user_key),
            expiration: candid.Success.expiration,
        };
    }
    if ("IncorrectCode" in candid) {
        return {
            kind: "incorrect_code",
            blockedUntil: optional(candid.IncorrectCode.blocked_until, identity),
            attemptsRemaining: candid.IncorrectCode.attempts_remaining,
        };
    }
    if ("NotFound" in candid) {
        return {
            kind: "not_found",
        };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiSubmitVerificationCodeResponse type received",
        candid,
    );
}
