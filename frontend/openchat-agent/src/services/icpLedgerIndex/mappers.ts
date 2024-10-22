import { identity, optional } from "../../utils/mapping";
import type {
    ApiGetTransactions,
    ApiGetTransactionsResult,
    ApiTimeStamp,
    ApiTransactionWithId,
} from "./candid/idl";
import {
    type AccountTransaction,
    type AccountTransactionResult,
    CommonResponses,
    UnsupportedValueError,
} from "openchat-shared";

export function accountTransactions(candid: ApiGetTransactionsResult): AccountTransactionResult {
    if ("Err" in candid) {
        return CommonResponses.failure();
    }
    if ("Ok" in candid) {
        return getTransactions(candid.Ok);
    }
    throw new UnsupportedValueError("Unknown ApiGetTransactionsResult type", candid);
}

function getTransactions(candid: ApiGetTransactions): AccountTransactionResult {
    return {
        kind: "success",
        transactions: candid.transactions.map(transaction),
        oldestTransactionId: optional(candid.oldest_tx_id, identity),
    };
}

function timestampToDate(ts: ApiTimeStamp): Date {
    return new Date(Number(ts.timestamp_nanos / 1_000_000n));
}

function transaction(candid: ApiTransactionWithId): AccountTransaction {
    // the candid types are quite fuzzy here - the old "product type when it should be sum type" thing
    const timestamp = optional(candid.transaction.timestamp, timestampToDate) ?? new Date();
    const memo =
        optional(candid.transaction.icrc1_memo, convertMemo) ?? candid.transaction.memo.toString();
    const createdAt = optional(candid.transaction.created_at_time, timestampToDate);

    if ("Transfer" in candid.transaction.operation) {
        const transfer = candid.transaction.operation.Transfer;
        return {
            id: candid.id,
            kind: "transfer",
            timestamp,
            memo,
            createdAt,
            amount: transfer.amount.e8s,
            fee: transfer.fee.e8s,
            to: transfer.to,
            from: transfer.from,
            spender: optional(transfer.spender, identity),
        };
    }
    if ("Burn" in candid.transaction.operation) {
        const burn = candid.transaction.operation.Burn;
        return {
            id: candid.id,
            kind: "burn",
            timestamp,
            memo,
            createdAt,
            amount: burn.amount.e8s,
            from: burn.from,
            spender: optional(burn.spender, identity),
        };
    }
    if ("Mint" in candid.transaction.operation) {
        const mint = candid.transaction.operation.Mint;
        return {
            id: candid.id,
            kind: "mint",
            timestamp,
            memo,
            createdAt,
            amount: mint.amount.e8s,
            to: mint.to,
        };
    }
    if ("Approve" in candid.transaction.operation) {
        const approve = candid.transaction.operation.Approve;
        return {
            id: candid.id,
            kind: "approve",
            timestamp,
            memo,
            createdAt,
            amount: approve.allowance.e8s,
            fee: approve.fee.e8s,
            from: approve.from,
            expectedAllowance: optional(approve.expected_allowance, (a) => a.e8s),
            expiredAt: optional(approve.expires_at, (ts) => ts.timestamp_nanos),
            spender: approve.spender,
        };
    }

    throw new Error(`Unexpected transaction type received: ${candid.transaction}`);
}

function convertMemo(candid: Uint8Array | number[]): string {
    return [...candid].map((n) => String.fromCharCode(n)).join("");
}
