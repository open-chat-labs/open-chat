import type { AccountTransaction, AccountTransactions } from "@client";
import { describe, expect, it } from "vitest";
import { type TransactionHistory, addTransactionsPage, nextPageStart } from "./transactionHistory";

function transaction(id: bigint, kind: AccountTransaction["kind"]): AccountTransaction {
    return { id, kind, timestamp: new Date(0), amount: 1n };
}

// A wallet's transactions, newest first, which a ledger index serves `pageSize` at a time from
// `start` (inclusive) downwards
function ledgerIndex(all: AccountTransaction[], pageSize: number) {
    return (start: bigint | undefined): AccountTransactions => ({
        transactions: all.filter((t) => start === undefined || t.id <= start).slice(0, pageSize),
        oldestTransactionId: all[all.length - 1]?.id,
    });
}

function shownIds(history: TransactionHistory): bigint[] {
    return history.transactions.map((t) => t.id);
}

describe("transaction history", () => {
    it("pages on from a first page made up only of approvals", () => {
        const fetch = ledgerIndex(
            [
                transaction(9n, "approve"),
                transaction(8n, "approve"),
                transaction(7n, "approve"),
                transaction(6n, "transfer"),
                transaction(5n, "approve"),
            ],
            3,
        );

        const first = addTransactionsPage(undefined, fetch(undefined));
        expect(shownIds(first)).toEqual([]);
        expect(nextPageStart(first)).toBe(6n);

        const second = addTransactionsPage(first, fetch(nextPageStart(first)));
        expect(shownIds(second)).toEqual([6n]);
        expect(nextPageStart(second)).toBeUndefined();
    });

    it("pages past a run of approvals longer than a page", () => {
        const fetch = ledgerIndex(
            [
                transaction(20n, "transfer"),
                ...[19n, 18n, 17n, 16n, 15n, 14n, 13n].map((id) => transaction(id, "approve")),
                transaction(12n, "mint"),
                transaction(11n, "approve"),
                transaction(10n, "burn"),
            ],
            3,
        );

        let history = addTransactionsPage(undefined, fetch(undefined));
        const starts: bigint[] = [];
        // Bounded, so that paging which stalls fails the test rather than hanging it
        for (let start = nextPageStart(history); start !== undefined && starts.length < 10; ) {
            starts.push(start);
            history = addTransactionsPage(history, fetch(start));
            start = nextPageStart(history);
        }

        expect(starts).toEqual([17n, 14n, 11n]);
        expect(shownIds(history)).toEqual([20n, 12n, 10n]);
    });

    it("has no next page for an empty wallet", () => {
        const history = addTransactionsPage(undefined, ledgerIndex([], 3)(undefined));
        expect(shownIds(history)).toEqual([]);
        expect(nextPageStart(history)).toBeUndefined();
    });

    it("has no next page once the oldest transaction is fetched, even if it is an approval", () => {
        const history = addTransactionsPage(
            undefined,
            ledgerIndex([transaction(2n, "transfer"), transaction(1n, "approve")], 3)(undefined),
        );
        expect(shownIds(history)).toEqual([2n]);
        expect(nextPageStart(history)).toBeUndefined();
    });
});
