import { ErrorCode, type WithdrawBtcResponse } from "@shared";
import type { ApiRetrieveBtcWithApprovalError } from "./candid/idl";

export function retrieveBtcWithApprovalResponse(
    candid: { Ok: { block_index: bigint } } | { Err: ApiRetrieveBtcWithApprovalError },
): WithdrawBtcResponse {
    if ("Ok" in candid) {
        return { kind: "success" };
    }
    const error = candid.Err;
    if ("InsufficientFunds" in error) {
        return { kind: "error", code: ErrorCode.InsufficientFunds, message: undefined };
    }
    const details = JSON.stringify(error, (_, v) => (typeof v === "bigint" ? v.toString() : v));
    return { kind: "error", code: ErrorCode.Unknown, message: details };
}
