import type { UserSummary } from "@client";
import { describe, expect, test } from "vitest";
import {
    accountTransactionUrl,
    counterpartyName,
    counterpartyOf,
    shortAccount,
    transactionCounterparty,
    transactionDirection,
    transactionMemoKey,
} from "./accountTransactions";

const me = { userId: "me-user", cryptoAccount: "me-account" };
const LONG = "a".repeat(30) + "z";

function user(userId: string, username: string): UserSummary {
    return {
        kind: "user",
        userId,
        username,
        displayName: undefined,
        updated: 0n,
        suspended: false,
        diamondStatus: "inactive",
        chitBalance: 0,
        totalChitEarned: 0,
        streak: 0,
        maxStreak: 0,
        isUniquePerson: false,
        hideOnlineStatus: false,
    };
}

describe("a transaction's direction", () => {
    test("invariant 2: between two of the user's own wallets is neither in nor out; from the user is out", () => {
        expect(transactionDirection({ from: "me-user", to: "me-account" }, me)).toBe("own");
        expect(transactionDirection({ from: "me-account", to: "me-user" }, me)).toBe("own");
        expect(transactionDirection({ from: "me-account", to: "them" }, me)).toBe("out");
        expect(transactionDirection({ from: "me-user", to: undefined }, me)).toBe("out");
        expect(transactionDirection({ from: "them", to: "me-account" }, me)).toBe("in");
        // a mint has no sender
        expect(transactionDirection({ from: undefined, to: "me-account" }, me)).toBe("in");
    });
});

describe("a transaction's other side", () => {
    const users = new Map([
        ["them-user", user("them-user", "lucy")],
        ["me-user", user("me-user", "me")],
    ]);
    const saved = [{ name: "Exchange", account: "saved-account" }];

    test("is a user, else a saved account, else the account", () => {
        expect(counterpartyOf("them-user", me, users, saved)).toMatchObject({ kind: "user" });
        // the user's own account is the user
        expect(counterpartyOf("me-account", me, users, saved)).toMatchObject({
            kind: "user",
            user: { userId: "me-user" },
        });
        expect(counterpartyOf("saved-account", me, users, saved)).toEqual({
            kind: "saved",
            name: "Exchange",
            account: "saved-account",
        });
        expect(counterpartyOf(LONG, me, users, saved)).toEqual({ kind: "account", account: LONG });
        expect(counterpartyOf(undefined, me, users, saved)).toEqual({ kind: "unknown" });
    });

    test("is who it went to when it went out, else who it came from", () => {
        expect(
            counterpartyName(
                transactionCounterparty({ from: "me-account", to: "them-user" }, me, users, saved),
            ),
        ).toBe("@lucy");
        expect(
            counterpartyName(
                transactionCounterparty(
                    { from: "saved-account", to: "me-account" },
                    me,
                    users,
                    saved,
                ),
            ),
        ).toBe("Exchange");
    });

    test("an account is cut to its first and last 10 characters", () => {
        expect(shortAccount(LONG)).toBe("aaaaaaaaaa...aaaaaaaaaz");
        expect(shortAccount("short")).toBe("short");
        expect(counterpartyName({ kind: "account", account: LONG })).toBe(shortAccount(LONG));
    });
});

describe("a transaction's link and memo", () => {
    test("the explorer link fills the block index, transaction index and hash", () => {
        expect(
            accountTransactionUrl(
                "https://x/{block_index}/{transaction_index}/{transaction_hash}",
                42n,
            ),
        ).toBe("https://x/42/42/");
    });

    test("an OpenChat memo names what it was for, anything else is unknown", () => {
        expect(transactionMemoKey("OC_TIP").key).toBe("TIP");
        expect(transactionMemoKey("something").key).toBe("cryptoAccount.unknownTransactionType");
        expect(transactionMemoKey(undefined).key).toBe("cryptoAccount.unknownTransactionType");
    });
});
