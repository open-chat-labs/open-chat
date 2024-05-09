import type { ApiGenerateMagicLinkResponse, ApiHandleMagicLinkResponse } from "./candid/idl";
import { type GenerateMagicLinkResponse, UnsupportedValueError, type HandleMagicLinkResponse } from "openchat-shared";
import { consolidateBytes } from "../../utils/mapping";

export function generateMagicLinkResponse(
    candid: ApiGenerateMagicLinkResponse,
): GenerateMagicLinkResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            userKey: consolidateBytes(candid.Success.user_key),
            expiration: candid.Success.expiration,
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
            duration: Number(candid.Blocked),
        };
    }
    if ("FailedToSendEmail" in candid) {
        return {
            kind: "failed_to_send_email",
            error: candid.FailedToSendEmail,
        };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiGenerateMagicLinkResponse type received",
        candid,
    );
}

export function handleMagicLinkResponse(
    candid: ApiHandleMagicLinkResponse,
): HandleMagicLinkResponse {
    if ("Success" in candid) {
        return { kind: "success" };
    }
    if ("LinkInvalid" in candid) {
        return {
            kind: "link_invalid",
        };
    }
    if ("LinkExpired" in candid) {
        return {
            kind: "link_expired",
        };
    }
    throw new UnsupportedValueError(
        "Unexpected ApiHandleMagicLinkResponse type received",
        candid,
    );
}
