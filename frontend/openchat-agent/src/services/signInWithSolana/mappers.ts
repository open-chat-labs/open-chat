import type { ApiPrepareLoginResponse } from "./candid/idl";
import { type SiwsPrepareLoginResponse, UnsupportedValueError } from "openchat-shared";

export function prepareLoginResponse(candid: ApiPrepareLoginResponse): SiwsPrepareLoginResponse {
    if ("Ok" in candid) {
        return {
            kind: "success",
            siwsMessage: {
                uri: candid.Ok.uri,
                issuedAt: candid.Ok.issued_at,
                domain: candid.Ok.domain,
                statement: candid.Ok.statement,
                version: candid.Ok.version,
                chainId: candid.Ok.chain_id,
                address: candid.Ok.address,
                nonce: candid.Ok.nonce,
                expirationTime: candid.Ok.expiration_time,
            },
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
