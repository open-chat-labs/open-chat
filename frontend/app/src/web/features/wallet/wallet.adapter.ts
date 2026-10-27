// The wallet's data in the library's shapes: the tokens WalletPanel and WalletMain list, and a
// token's history as WalletMain's activity rows.
import type {
    AccountTransaction,
    EnhancedTokenDetails,
    NamedAccount,
    TokenExchangeRates,
    UserLookup,
    WalletConfig,
} from "@client";
import type { WalletPanelSettings } from "@openchat/ui/src/features/components/WalletPanel.svelte";
import type { WalletActivity } from "@openchat/ui/src/features/components/WalletMain.svelte";
import { AVATAR_GRADIENTS } from "@openchat/ui/src/lib/components/Avatar.svelte";
import type { WalletToken, WalletTokenAction } from "@openchat/ui/src/lib/types";
import {
    counterpartyName,
    transactionCounterparty,
    transactionDirection,
    type MyWallets,
} from "@src/logic/wallet/accountTransactions";
import {
    tokenActions,
    type TokenAction,
    type TokenActionsContext,
} from "@src/logic/wallet/tokenActions";
import { swatchFor } from "../chats/chatList.adapter";

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
 * The library's actions from the wallet's (tokenActions): Remove is the panel's Hide. Send,
 * Receive and Swap aren't offered until their flows are built (6b, 6c).
 */
export function walletTokenActions(actions: TokenAction[]): WalletTokenAction[] {
    return actions.flatMap((a): WalletTokenAction[] => {
        switch (a) {
            case "refresh":
                return ["refresh"];
            case "remove":
                return ["hide"];
            default:
                return [];
        }
    });
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

/** How many tokens the wallet can receive: the catalogue, one per symbol. */
export function supportedCount(tokens: Pick<WalletToken, "symbol">[]): number {
    return new Set(tokens.map((t) => t.symbol)).size;
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
            id: tx.id.toString(),
            symbol: token.symbol,
            token: token.ledger,
            kind: direction === "own" ? "own" : direction === "out" ? "send" : "receive",
            party: counterpartyName(transactionCounterparty(tx, ctx.me, ctx.users, ctx.saved)),
            timestamp: tx.timestamp.getTime(),
            amount,
            fiat: amount * (price ?? 0),
        };
    });
}
