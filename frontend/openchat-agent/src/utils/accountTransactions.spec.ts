import type { AccountTransaction, AccountTransactionResult } from "@shared";
import { describe, expect, test } from "vitest";
import { mergeAccountTransactions } from "./accountTransactions";

function tx(id: bigint): AccountTransaction {
    return { id, kind: "transfer", timestamp: new Date(0), amount: 1n };
}

// A page of a wallet's history, as a ledger index returns it: newest first, from `start` (inclusive)
// back, along with the id of the wallet's oldest transaction
function page(history: bigint[], start: bigint | undefined, max: number): AccountTransactionResult {
    const ids = history
        .filter((id) => start === undefined || id <= start)
        .sort((a, b) => (a > b ? -1 : 1))
        .slice(0, max);
    return {
        kind: "success",
        transactions: ids.map(tx),
        oldestTransactionId:
            history.length > 0 ? history.reduce((a, b) => (a < b ? a : b)) : undefined,
    };
}

function ids(result: AccountTransactionResult): bigint[] {
    if (result.kind !== "success") throw new Error("Expected success");
    return result.transactions.map((t) => t.id);
}

// Pages through the merged history of `histories` as the wallet UI does, each page from just before
// the oldest transaction of the last, until there are none older
function listAll(histories: bigint[][], max: number): bigint[] {
    const listed: bigint[] = [];
    let start: bigint | undefined = undefined;
    for (;;) {
        const result = mergeAccountTransactions(histories.map((h) => page(h, start, max)));
        if (result.kind !== "success") throw new Error("Expected success");
        listed.push(...ids(result));
        const last = result.transactions[result.transactions.length - 1];
        if (
            last === undefined ||
            result.oldestTransactionId === undefined ||
            last.id <= result.oldestTransactionId
        ) {
            return listed;
        }
        start = last.id - 1n;
    }
}

describe("mergeAccountTransactions", () => {
    test("one wallet's page is listed as it is", () => {
        const result = mergeAccountTransactions([page([9n, 6n, 4n, 1n], undefined, 3)]);

        expect(ids(result)).toEqual([9n, 6n, 4n]);
        expect(result.kind === "success" && result.oldestTransactionId).toBe(1n);
    });

    test("the wallets' transactions are listed together, newest first", () => {
        const result = mergeAccountTransactions([
            page([9n, 5n, 2n], undefined, 10),
            page([8n, 7n, 3n], undefined, 10),
        ]);

        expect(ids(result)).toEqual([9n, 8n, 7n, 5n, 3n, 2n]);
        expect(result.kind === "success" && result.oldestTransactionId).toBe(2n);
    });

    test("the page stops where a wallet's next page could hold transactions newer than those left", () => {
        // The first wallet has older transactions still to fetch, any of which could be newer
        // than 3, which the second wallet's page goes back to
        const result = mergeAccountTransactions([
            page([10n, 8n, 6n, 4n, 2n], undefined, 3),
            page([9n, 7n, 3n], undefined, 3),
        ]);

        expect(ids(result)).toEqual([10n, 9n, 8n, 7n, 6n]);
        expect(result.kind === "success" && result.oldestTransactionId).toBe(2n);
    });

    test("a transaction between two of the wallets is listed once", () => {
        const result = mergeAccountTransactions([
            page([9n, 5n], undefined, 10),
            page([5n, 3n], undefined, 10),
        ]);

        expect(ids(result)).toEqual([9n, 5n, 3n]);
    });

    test("a wallet with no transactions is ignored", () => {
        const result = mergeAccountTransactions([
            page([], undefined, 10),
            page([4n, 1n], undefined, 10),
        ]);

        expect(ids(result)).toEqual([4n, 1n]);
        expect(result.kind === "success" && result.oldestTransactionId).toBe(1n);
    });

    test("a wallet which fails to load fails the whole page", () => {
        const result = mergeAccountTransactions([
            page([4n, 1n], undefined, 10),
            { kind: "failure" },
        ]);

        expect(result.kind).toBe("failure");
    });

    test("paging through the merged history lists each transaction once, in order", () => {
        const histories = [
            [30n, 29n, 21n, 20n, 19n, 18n, 17n, 12n, 5n, 4n, 1n],
            [28n, 27n, 26n, 25n, 24n, 22n, 17n, 16n, 3n],
            [23n, 11n, 10n],
        ];
        const all = [...new Set(histories.flat())].sort((a, b) => (a > b ? -1 : 1));

        for (const max of [1, 2, 3, 5, 100]) {
            expect(listAll(histories, max)).toEqual(all);
        }
    });
});
