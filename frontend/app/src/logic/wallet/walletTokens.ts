// The wallet's tokens and a token's history in the library's shapes, for both wallets: the web's
// (WalletPanel, WalletMain) and the native one (src/native/features/wallet). Moved here from the
// web's wallet adapter (native N10a) so both trees read the same tokens.
import {
    walletApprovalFee,
    type AccountTransaction,
    type EnhancedTokenDetails,
    type NamedAccount,
    type TokenExchangeRates,
    type UserLookup,
    type WalletConfig,
} from "@client";
import { AVATAR_GRADIENTS } from "@openchat/ui/src/lib/avatarGradients";
import type {
    WalletActivity,
    WalletPanelSettings,
    WalletToken,
    WalletTokenAction,
} from "@openchat/ui/src/lib/types";
import { swatchFor } from "../swatch";
import {
    counterpartyName,
    transactionCounterparty,
    transactionDirection,
    type MyWallets,
} from "./accountTransactions";
import { tokenActions, type TokenAction, type TokenActionsContext } from "./tokenActions";
import type { TransactionHistoryState } from "./transactionHistoryState.svelte";
import { sendNetworks } from "./walletSend";

/** The standard the token page names: ICRC-2 when the ledger has it (approvals), else ICRC-1. */
export function tokenStandard(standards: string[]): string | undefined {
    return ["ICRC-2", "ICRC-1"].find((s) => standards.includes(s));
}

/** A whole-token amount from the ledger's units. */
export function wholeTokens(amount: bigint, decimals: number): number {
    return Number(amount) / 10 ** decimals;
}

/**
 * How many decimal places the wallet shows for a token: 8 (at most its own) for one worth a lot a
 * unit (BTC, ETH), 2 for a dollar-ish one (stablecoins), else 4, as the design's tokens do.
 */
export function displayDecimals(decimals: number, price: number): number {
    const dp = price >= 1000 ? 8 : price > 0.9 && price < 1.1 ? 2 : 4;
    return Math.min(dp, decimals);
}

/**
 * The library's actions from the wallet's (tokenActions): Remove is the panel's Hide.
 */
export function walletTokenActions(actions: TokenAction[]): WalletTokenAction[] {
    return actions.flatMap((a): WalletTokenAction[] => {
        switch (a) {
            case "refresh":
                return ["refresh"];
            case "send":
                return ["send"];
            case "swap":
                return ["swap"];
            case "receive":
                return ["receive"];
            case "remove":
                return ["hide"];
            default:
                return [];
        }
    });
}

/**
 * The networks Send can send a token on, as the library names them: the IC (an ICRC account, or
 * an ICP account identifier for ICP) and, for BTC, Bitcoin's own (`sendNetworks`).
 */
export function sendTokenNets(symbol: string): string[] {
    return [...new Set(sendNetworks(symbol).map((n) => (n === "icrc" ? "icp" : n)))];
}

/**
 * A token as the wallet lists it, identified by its ledger (invariant 1: two tokens can share a
 * symbol). Its face is its logo; its colour (in the bars, and behind a missing logo) the swatch its
 * ledger picks.
 */
export function walletToken(
    token: EnhancedTokenDetails,
    price: number | undefined,
    actions: TokenAction[],
): WalletToken {
    const usd = price ?? 0;
    return {
        id: token.ledger,
        symbol: token.symbol,
        name: token.name,
        mark: token.symbol.slice(0, 1),
        grad: AVATAR_GRADIENTS[swatchFor(token.ledger)],
        logo: token.logo || undefined,
        held: wholeTokens(token.balance, token.decimals),
        price: usd,
        dp: displayDecimals(token.decimals, usd),
        fee: wholeTokens(token.transferFee, token.decimals),
        // a send to a user is a transfer pulled from the wallet once approved: the approval's fee too
        userFee: wholeTokens(
            token.transferFee + walletApprovalFee(token.transferFee),
            token.decimals,
        ),
        nets: sendTokenNets(token.symbol),
        ledger: token.ledger,
        standard: tokenStandard(token.supportedStandards),
        actions: walletTokenActions(actions),
    };
}

/**
 * The wallet's catalogue as the panel and the token page list it: every token it can receive or
 * holds (`cryptoTokensSorted`), each with its price and what it offers. Never CHIT, which isn't a
 * token.
 */
export function walletTokens(
    catalogue: EnhancedTokenDetails[],
    rates: { get(ledger: string): TokenExchangeRates | undefined },
    actions: TokenActionsContext,
): WalletToken[] {
    return catalogue.map((token) =>
        walletToken(token, rates.get(token.ledger)?.toUSD, tokenActions(token, actions)),
    );
}

/** How many tokens the wallet can receive: the catalogue, one per ledger, as the Supported tokens picker lists it. */
export function supportedCount(tokens: Pick<WalletToken, "id" | "symbol">[]): number {
    return new Set(tokens.map((t) => t.id ?? t.symbol)).size;
}

/**
 * The wallet config as the panel reads it: automatic lists what you own worth at least the
 * minimum (the rest folded into small balances); manual lists the chosen tokens, by ledger.
 */
export function panelSettings(config: WalletConfig): WalletPanelSettings {
    return config.kind === "auto_wallet"
        ? { autoConfig: true, minBalance: String(config.minDollarValue) }
        : { autoConfig: false, tokens: [...config.tokens] };
}

/** Who's on the other side of the user's transactions. */
export type ActivityContext = {
    me: MyWallets;
    users: UserLookup;
    saved: readonly NamedAccount[];
    /** The other side's name when there's none (a mint has no sender, a burn no recipient). */
    unknown: string;
};

/**
 * A token's history as activity rows, newest first: received, sent, or between the user's own
 * wallets (invariant 2), with the other side's name for the library to word the title.
 */
export function tokenActivity(
    transactions: AccountTransaction[],
    token: Pick<EnhancedTokenDetails, "ledger" | "symbol" | "decimals">,
    price: number | undefined,
    ctx: ActivityContext,
): WalletActivity[] {
    return transactions.map((tx) => {
        const direction = transactionDirection(tx, ctx.me);
        const amount = wholeTokens(tx.amount, token.decimals);
        return {
            // a block index is only unique within its ledger, and All activity lists several
            id: activityId(token.ledger, tx.id),
            symbol: token.symbol,
            token: token.ledger,
            kind: direction === "own" ? "own" : direction === "out" ? "send" : "receive",
            party:
                counterpartyName(transactionCounterparty(tx, ctx.me, ctx.users, ctx.saved)) ??
                ctx.unknown,
            timestamp: tx.timestamp.getTime(),
            amount,
            fiat: amount * (price ?? 0),
        };
    });
}

/**
 * Every history loaded so far (WalletHistories' `all`) as activity rows: a token page lists its
 * own, the web's All activity all of them. A history still loading or failed, or a token the app
 * doesn't know, lists nothing.
 */
export function historyActivity(
    histories: [string, Pick<TransactionHistoryState, "state">][],
    tokens: {
        get(
            ledger: string,
        ): Pick<EnhancedTokenDetails, "ledger" | "symbol" | "decimals"> | undefined;
    },
    rates: { get(ledger: string): TokenExchangeRates | undefined },
    ctx: ActivityContext,
): WalletActivity[] {
    return histories.flatMap(([ledger, history]) => {
        const token = tokens.get(ledger);
        if (token === undefined || history.state.kind !== "loaded") return [];
        return tokenActivity(
            history.state.history.transactions,
            token,
            rates.get(token.ledger)?.toUSD,
            ctx,
        );
    });
}

/** An activity row's id: its ledger and the transaction's block index there. */
export function activityId(ledger: string, blockIndex: bigint): string {
    return `${ledger}:${blockIndex}`;
}

/** The ledger and block index an activity row's id names (`activityId`). */
export function parseActivityId(id: string): { ledger: string; blockIndex: bigint } | undefined {
    const at = id.lastIndexOf(":");
    if (at <= 0) return undefined;
    try {
        return { ledger: id.slice(0, at), blockIndex: BigInt(id.slice(at + 1)) };
    } catch {
        return undefined;
    }
}
