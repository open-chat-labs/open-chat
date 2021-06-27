import type { ClaimResponse, RegisterResponse } from "../../domain/phone";
import type { ApiClaimResponse, ApiRegisterResponse } from "api-canisters/phone_index/canister";

export function registerResponse(candid: ApiRegisterResponse): RegisterResponse {
    if ("Success" in candid) return "success";
    if ("Taken" in candid) return "taken";
    if ("TooManyAttempts" in candid) return "too_many_attempts";

    throw new Error(`Unknown PhoneIndex.RegisterResponse of ${candid}`);
}

export function claimResponse(candid: ApiClaimResponse): ClaimResponse {
    if ("Success" in candid)
        return {
            kind: "success",
            canisterId: candid.Success.canister,
        };
    if ("Invalid" in candid)
        return {
            kind: "invalid",
        };
    if ("Expired" in candid)
        return {
            kind: "expired",
        };

    throw new Error(`Unknown PhoneIndex.ClaimResponse of ${candid}`);
}
