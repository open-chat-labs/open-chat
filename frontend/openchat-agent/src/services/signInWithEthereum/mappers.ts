import type {
    ApiGetDelegationResponse,
    ApiLoginResponse,
    ApiPrepareLoginResponse,
} from "./candid/idl";
import {
    type GetDelegationResponse,
    type PrepareDelegationResponse,
    type SiwePrepareLoginResponse,
    UnsupportedValueError,
} from "openchat-shared";
import { signedDelegation } from "../identity/mappers";
import { consolidateBytes } from "../../utils/mapping";

export function prepareLoginResponse(candid: ApiPrepareLoginResponse): SiwePrepareLoginResponse {
    if ("Ok" in candid) {
        return {
            kind: "success",
            siweMessage: candid.Ok,
        };
    }
    if ("Err" in candid) {
        return {
            kind: "error",
            error: candid.Err,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiPrepareLoginResponse type received", candid);
}

export function loginResponse(candid: ApiLoginResponse): PrepareDelegationResponse {
    if ("Ok" in candid) {
        return {
            kind: "success",
            userKey: consolidateBytes(candid.Ok.user_canister_pubkey),
            expiration: candid.Ok.expiration,
        };
    }
    if ("Err" in candid) {
        return { kind: "error", error: candid.Err };
    }
    throw new UnsupportedValueError("Unexpected ApiLoginResponse type received", candid);
}

export function getDelegationResponse(candid: ApiGetDelegationResponse): GetDelegationResponse {
    if ("Ok" in candid) {
        return signedDelegation(candid.Ok);
    }
    if ("Err" in candid) {
        return {
            kind: "error",
            error: candid.Err,
        };
    }
    throw new UnsupportedValueError("Unexpected ApiGetDelegationResponse type received", candid);
}
