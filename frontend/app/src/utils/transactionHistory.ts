import type { AccountTransaction, AccountTransactions } from "@client";

/**
 * The transaction history of a wallet loaded so far, a page at a time. Approvals are fetched but
 * not shown, so paging follows the oldest transaction fetched rather than the oldest shown.
 * Otherwise a page made up only of approvals would leave nothing to page from, and a run of a
 * page's worth of approvals would refetch the same page forever.
 */
export type TransactionHistory = {
    // The transactions to show, newest first
    transactions: AccountTransaction[];
    // The oldest transaction fetched so far, including approvals
    oldestFetchedId?: bigint;
    // The oldest transaction in the wallet
    oldestTransactionId?: bigint;
};

export function addTransactionsPage(
    history: TransactionHistory | undefined,
    page: AccountTransactions,
): TransactionHistory {
    const fetched = page.transactions;
    return {
        transactions: [
            ...(history?.transactions ?? []),
            ...fetched.filter((t) => t.kind !== "approve"),
        ],
        oldestFetchedId: fetched[fetched.length - 1]?.id ?? history?.oldestFetchedId,
        oldestTransactionId: page.oldestTransactionId,
    };
}

// The `start` of the next page, just below the oldest transaction fetched, or undefined if there
// are no older transactions
export function nextPageStart({
    oldestFetchedId,
    oldestTransactionId,
}: TransactionHistory): bigint | undefined {
    if (
        oldestFetchedId === undefined ||
        oldestTransactionId === undefined ||
        oldestFetchedId <= oldestTransactionId
    ) {
        return undefined;
    }
    return oldestFetchedId - 1n;
}
