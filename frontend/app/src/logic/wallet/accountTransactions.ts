// One transaction in a token's history, read the same way in every tree: which way it went, who
// the other side is, its memo and its link on the token's explorer.
import type {
    AccountTransaction,
    NamedAccount,
    ResourceKey,
    UserLookup,
    UserSummary,
} from "@client";
import { i18nKey } from "@src/i18n/i18n";

/** The user's own wallets: their user id and their account. */
export type MyWallets = { userId: string; cryptoAccount: string };

/** In, out, or between two of the user's own wallets (neither). */
export type TransactionDirection = "in" | "out" | "own";

/** The other side of a transaction: one of the app's users, a saved account, or a bare account. */
export type Counterparty =
    | { kind: "user"; user: UserSummary }
    | { kind: "saved"; name: string; account: string }
    | { kind: "account"; account: string }
    | { kind: "unknown" };

function isMine(address: string | undefined, me: MyWallets): boolean {
    return address === me.userId || address === me.cryptoAccount;
}

/**
 * Which way a transaction went (invariant 2). A transfer between two of the user's own wallets (such
 * as their funds moving when they were migrated to a new canister) neither adds to nor takes from
 * what they hold; one from the user is out; anything else (a mint included) is in.
 */
export function transactionDirection(
    { from, to }: Pick<AccountTransaction, "from" | "to">,
    me: MyWallets,
): TransactionDirection {
    if (isMine(from, me) && isMine(to, me)) return "own";
    return isMine(from, me) ? "out" : "in";
}

/**
 * Who an address is: the app's user it belongs to (the user's own account is the user), else the
 * name it's saved under, else the account itself.
 */
export function counterpartyOf(
    address: string | undefined,
    me: MyWallets,
    users: UserLookup,
    saved: readonly NamedAccount[],
): Counterparty {
    if (address === undefined) return { kind: "unknown" };
    const user = users.get(address === me.cryptoAccount ? me.userId : address);
    if (user !== undefined) return { kind: "user", user };
    const named = saved.find((a) => a.account === address);
    if (named !== undefined) return { kind: "saved", name: named.name, account: address };
    return { kind: "account", account: address };
}

/** The other side of a transaction: who it went to if it went out, else who it came from. */
export function transactionCounterparty(
    transaction: Pick<AccountTransaction, "from" | "to">,
    me: MyWallets,
    users: UserLookup,
    saved: readonly NamedAccount[],
): Counterparty {
    const out = transactionDirection(transaction, me) === "out";
    return counterpartyOf(out ? transaction.to : transaction.from, me, users, saved);
}

/** A long account cut to its first and last 10 characters. */
export function shortAccount(account: string): string {
    return account.length > 23 ? `${account.slice(0, 10)}...${account.slice(-10)}` : account;
}

/** A counterparty in a line of text: "@username", its saved name, or its account shortened. */
export function counterpartyName(c: Counterparty): string | undefined {
    switch (c.kind) {
        case "user":
            return `@${c.user.username}`;
        case "saved":
            return c.name;
        case "account":
            return shortAccount(c.account);
        case "unknown":
            return undefined;
    }
}

/** A transaction's page on the token's explorer, from its `transactionUrlFormat`. */
export function accountTransactionUrl(urlFormat: string, id: bigint): string {
    return urlFormat
        .replace("{block_index}", id.toString())
        .replace("{transaction_index}", id.toString())
        .replace("{transaction_hash}", "");
}

/** What a transaction was for, from the memo OpenChat gives its own transfers. */
export function transactionMemoKey(memo: string | undefined): ResourceKey {
    switch (memo) {
        case "OC_MSG":
            return i18nKey("MESSAGE");
        case "OC_SEND":
            return i18nKey("TRANSFER");
        case "OC_TIP":
            return i18nKey("TIP");
        case "OC_PRZ":
            return i18nKey("PRIZE");
        case "OC_PRZCL":
            return i18nKey("PRIZE CLAIM");
        case "OC_PRZRF":
            return i18nKey("PRIZE REFUND");
        case "OC_INS":
            return i18nKey("STREAK INSURANCE");
        default:
            return i18nKey("cryptoAccount.unknownTransactionType");
    }
}
