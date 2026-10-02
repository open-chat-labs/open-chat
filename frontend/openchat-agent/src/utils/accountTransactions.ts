import { bigIntMax, bigIntMin, type AccountTransactionResult } from "@shared";

// Merges a page of the transactions of each of a user's wallets, each fetched from the same ledger
// index from the same transaction onwards, into one page of their history, newest first. A user who
// has been migrated to a MultiUser canister has had more than one wallet (see `userWalletAccount`),
// and a transaction's id, its index in the ledger, orders it among those of every wallet.
//
// Each wallet's page reaches back only as far as the oldest of its transactions it holds, so before
// the latest of those, among the wallets with older transactions still to fetch, are transactions not
// yet fetched. The page is cut there, leaving the rest to the next page, which, as with one wallet,
// is fetched from just before the oldest transaction in this one.
//
// A transaction between two of the wallets, such as the transfer of the user's funds when they were
// migrated, is in the history of each, and is listed once.
export function mergeAccountTransactions(
    results: AccountTransactionResult[],
): AccountTransactionResult {
    const pages = [];
    for (const result of results) {
        if (result.kind !== "success") return result;
        pages.push(result);
    }

    const oldestIds = pages.flatMap((p) =>
        p.oldestTransactionId === undefined ? [] : [p.oldestTransactionId],
    );
    const cutoffs = pages.flatMap(({ transactions, oldestTransactionId }) => {
        if (transactions.length === 0 || oldestTransactionId === undefined) return [];
        const oldestFetched = bigIntMin(...transactions.map((t) => t.id));
        return oldestFetched > oldestTransactionId ? [oldestFetched] : [];
    });
    const cutoff = cutoffs.length > 0 ? bigIntMax(...cutoffs) : undefined;

    // Keyed by id, since a transaction between two of the wallets is fetched from each
    const transactions = new Map(
        pages
            .flatMap((p) => p.transactions)
            .filter((t) => cutoff === undefined || t.id >= cutoff)
            .map((t) => [t.id, t]),
    );

    return {
        kind: "success",
        transactions: [...transactions.values()].sort((a, b) =>
            a.id > b.id ? -1 : a.id < b.id ? 1 : 0,
        ),
        oldestTransactionId: oldestIds.length > 0 ? bigIntMin(...oldestIds) : undefined,
    };
}
