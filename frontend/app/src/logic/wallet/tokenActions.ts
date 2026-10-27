// What the wallet offers for a token (its menu, its page's buttons), the same in every tree.

/** An action on one token. */
export type TokenAction = "send" | "receive" | "swap" | "refresh" | "remove";

export type TokenActionsToken = {
    ledger: string;
    /** Whether the token is enabled: a disabled one can still be sent away, but not received or swapped. */
    enabled: boolean;
};

export type TokenActionsContext = {
    /** Ledgers that can be swapped (`swappableTokensStore`). */
    swappable: { has(ledger: string): boolean };
    /** The user picks the wallet's tokens themselves (a manual wallet config). */
    manualWallet: boolean;
    /** Actions the build turns off (an app store build: `utils/features`). */
    disabled: { send: boolean; receive: boolean; swap: boolean };
};

/**
 * Which actions a token offers (invariant 4): Send always, Receive only for an enabled token, Swap
 * only for an enabled token that can be swapped, Remove only in a manual wallet, and Refresh its
 * balance always. An action the build turns off is never offered.
 */
export function tokenActions(token: TokenActionsToken, ctx: TokenActionsContext): TokenAction[] {
    const actions: TokenAction[] = [];
    if (!ctx.disabled.send) actions.push("send");
    if (token.enabled && !ctx.disabled.receive) actions.push("receive");
    if (token.enabled && ctx.swappable.has(token.ledger) && !ctx.disabled.swap)
        actions.push("swap");
    actions.push("refresh");
    if (ctx.manualWallet) actions.push("remove");
    return actions;
}

/** Whether a token has a transaction history: only one with an index canister has. */
export function hasTransactionHistory(token: { index: string | undefined }): boolean {
    return token.index !== undefined;
}
