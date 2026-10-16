import { ErrorCode, type WithdrawSolResponse } from "@shared";
import type { ApiWithdrawSolError } from "./candid/idl";

export function withdrawSolResponse(
    candid: { Ok: { block_index: bigint } } | { Err: ApiWithdrawSolError },
): WithdrawSolResponse {
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
