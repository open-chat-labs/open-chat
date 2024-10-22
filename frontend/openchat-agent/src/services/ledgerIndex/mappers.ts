import { identity, optional } from "../../utils/mapping";
import type {
    ApiAccount,
    ApiGetTransactions,
    ApiGetTransactionsResult,
    ApiTransactionWithId,
} from "./candid/idl";
import {
    CommonResponses,
    type AccountTransactionResult,
    type AccountTransaction,
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

function nanosToDate(n: bigint): Date {
    return new Date(Number(n / 1_000_000n));
}

function transaction(candid: ApiTransactionWithId): AccountTransaction {
    // the candid types are quite fuzzy here - the old "product type when it should be sum type" thing
    if (candid.transaction.burn[0] !== undefined) {
        const burn = candid.transaction.burn[0];
        return {
            id: candid.id,
            kind: "burn",
            timestamp: nanosToDate(candid.transaction.timestamp),
            memo: optional(burn.memo, memo),
            createdAt: optional(burn.created_at_time, nanosToDate),
            amount: burn.amount,
            from: account(burn.from),
            spender: optional(burn.spender, account),
        };
    }

    if (candid.transaction.mint[0] !== undefined) {
        const mint = candid.transaction.mint[0];
        return {
            id: candid.id,
            kind: "mint",
            timestamp: nanosToDate(candid.transaction.timestamp),
            memo: optional(mint.memo, memo),
            createdAt: optional(mint.created_at_time, nanosToDate),
            amount: mint.amount,
            to: account(mint.to),
        };
    }

    if (candid.transaction.approve[0] !== undefined) {
        const approve = candid.transaction.approve[0];
        return {
            id: candid.id,
            kind: "approve",
            timestamp: nanosToDate(candid.transaction.timestamp),
            memo: optional(approve.memo, memo),
            createdAt: optional(approve.created_at_time, nanosToDate),
            amount: approve.amount,
            fee: optional(approve.fee, identity),
            from: account(approve.from),
            expectedAllowance: optional(approve.expected_allowance, identity),
            expiredAt: optional(approve.expires_at, identity),
            spender: optional(approve.spender, account),
        };
    }

    if (candid.transaction.transfer[0] !== undefined) {
        const transfer = candid.transaction.transfer[0];
        return {
            id: candid.id,
            kind: "transfer",
            timestamp: nanosToDate(candid.transaction.timestamp),
            memo: optional(transfer.memo, memo),
            createdAt: optional(transfer.created_at_time, nanosToDate),
            amount: transfer.amount,
            fee: optional(transfer.fee, identity),
            to: account(transfer.to),
            from: account(transfer.from),
            spender: optional(transfer.spender, account),
        };
    }

    throw new Error(`Unexpected transaction type received: ${candid.transaction}`);
}

function memo(candid: Uint8Array | number[]): string {
    return [...candid].map((n) => String.fromCharCode(n)).join("");
}

function account(candid: ApiAccount): string {
    return candid.owner.toString();
}
