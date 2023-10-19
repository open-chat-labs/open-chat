import { identity, optional } from "../../utils/mapping";
import type {
    ApiAccount,
    ApiGetTransactions,
    ApiGetTransationsResult,
    ApiTransactionWithId,
} from "./candid/idl";
import {
    CommonResponses,
    type AccountTransactionResult,
    type AccountTransaction,
    UnsupportedValueError,
} from "openchat-shared";

export function accountTransactions(candid: ApiGetTransationsResult): AccountTransactionResult {
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

function transaction(candid: ApiTransactionWithId): AccountTransaction {
    return {
        id: candid.id,
        kind: candid.transaction.kind,
        timestamp: candid.transaction.timestamp,
        burn: optional(candid.transaction.burn, (candid) => {
            return {
                memo: optional(candid.memo, memo),
                createdAt: optional(candid.created_at_time, identity),
                amount: candid.amount,
                from: account(candid.from),
                spender: optional(candid.spender, account),
            };
        }),
        mint: optional(candid.transaction.mint, (candid) => {
            return {
                memo: optional(candid.memo, memo),
                createdAt: optional(candid.created_at_time, identity),
                amount: candid.amount,
                to: account(candid.to),
            };
        }),
        approve: optional(candid.transaction.approve, (candid) => {
            return {
                memo: optional(candid.memo, memo),
                createdAt: optional(candid.created_at_time, identity),
                amount: candid.amount,
                fee: optional(candid.fee, identity),
                from: account(candid.from),
                expectedAllowance: optional(candid.expected_allowance, identity),
                expiredAt: optional(candid.expires_at, identity),
                spender: optional(candid.spender, account),
            };
        }),
        transfer: optional(candid.transaction.transfer, (candid) => {
            return {
                memo: optional(candid.memo, memo),
                createdAt: optional(candid.created_at_time, identity),
                amount: candid.amount,
                fee: optional(candid.fee, identity),
                to: account(candid.to),
                from: account(candid.from),
                spender: optional(candid.spender, account),
            };
        }),
    };
}

function memo(candid: Uint8Array | number[]): string {
    return candid.toString(); //TODO - decode this properly
}

function account(candid: ApiAccount): string {
    return candid.owner.toString();
}
