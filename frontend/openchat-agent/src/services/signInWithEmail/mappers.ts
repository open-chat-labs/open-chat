import type { ApiGenerateMagicLinkResponse } from "./candid/idl";
import { type GenerateMagicLinkResponse, UnsupportedValueError } from "openchat-shared";
import { consolidateBytes } from "../../utils/mapping";

export function generateMagicLinkResponse(
    candid: ApiGenerateMagicLinkResponse,
): GenerateMagicLinkResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            userKey: consolidateBytes(candid.Success.user_key),
            code: candid.Success.code,
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

// function durationToTimestamp(duration: bigint): bigint {
//     return BigInt(Date.now() + Number(duration));
// }
