// Making a P2P swap offer: what it costs, the least it can offer, how long it can stay open and the
// content it's sent as. Shared by every tree's swap offer builder.
import {
    i18nKey,
    ONE_DAY,
    P2P_SWAP_MAX_EXPIRY_DAYS,
    walletApprovalFee,
    type P2PSwapContentInitial,
    type ResourceKey,
    type TokenInfo,
} from "@shared";
import { formatTokens } from "./cryptoFormatter";

/** What an offer of a token costs on top of the amount offered, and the least it can offer. */
export type SwapOfferCosts = {
    /** The offer is deposited in the escrow canister with the fee for paying it out: two fees. */
    depositFees: bigint;
    /** The approval the wallet makes before the deposit is pulled from it. */
    approvalFee: bigint;
    totalFees: bigint;
    /** 10 transfer fees. */
    minAmount: bigint;
};

export function swapOfferCosts(transferFee: bigint): SwapOfferCosts {
    const depositFees = transferFee * 2n;
    const approvalFee = walletApprovalFee(transferFee);
    return {
        depositFees,
        approvalFee,
        totalFees: depositFees + approvalFee,
        minAmount: transferFee * 10n,
    };
}

/** The most a balance can offer, with the fees it then costs (never below 0). */
export function swapOfferMaximum(balance: bigint, transferFee: bigint): bigint {
    const max = balance - swapOfferCosts(transferFee).totalFees;
    return max > 0n ? max : 0n;
}

/** The longest an offer stays open: 90 days. */
export const MAX_SWAP_OFFER_EXPIRY_MS = P2P_SWAP_MAX_EXPIRY_DAYS * ONE_DAY;

/** How long an offer stays open: what was picked, never past 90 days. */
export function swapOfferExpiry(ms: number): bigint {
    return BigInt(Math.max(0, Math.min(Math.round(ms), MAX_SWAP_OFFER_EXPIRY_MS)));
}

/** What making an offer does next: only a Diamond member can make one; then only a valid one is
 * confirmed (it locks the user's funds for as long as it's open). */
export type SwapOfferStep = "upgrade" | "invalid" | "confirm";

export function swapOfferStep(diamond: boolean, valid: boolean): SwapOfferStep {
    if (!diamond) return "upgrade";
    return valid ? "confirm" : "invalid";
}

/** What confirming an offer of `amount` says it takes from the wallet: the amount and its fees. */
export function swapOfferConfirmation(
    amount: bigint,
    token: Pick<TokenInfo, "symbol" | "decimals" | "fee">,
): ResourceKey {
    const { totalFees, approvalFee } = swapOfferCosts(token.fee);
    return i18nKey("p2pSwap.confirmSend", {
        amount: formatTokens(amount + totalFees, token.decimals),
        token: token.symbol,
        fees: approvalFee > 0n ? 3 : 2,
    });
}

/** An offer as a builder holds it. */
export type NewSwapOffer = {
    token0: TokenInfo;
    token1: TokenInfo;
    /** What's offered and what's asked for, in each token's smallest unit. */
    amount0: bigint;
    amount1: bigint;
    expiresInMs: number;
    caption?: string;
    /** Where the offer is funded from: an external wallet that has approved it (`fromAccount`),
     * one a draft will ask (`fromWallet`), or neither for the user's OpenChat account. */
    from?: { fromAccount?: string; fromWallet?: string };
};

/** The offer to send, open for at most 90 days; none for two of the same token. */
export function newSwapOfferContent(offer: NewSwapOffer): P2PSwapContentInitial | undefined {
    if (offer.token0.ledger === offer.token1.ledger) return undefined;
    return {
        kind: "p2p_swap_content_initial",
        token0: offer.token0,
        token1: offer.token1,
        token0Amount: offer.amount0,
        token1Amount: offer.amount1,
        caption: offer.caption,
        expiresIn: swapOfferExpiry(offer.expiresInMs),
        ...offer.from,
    };
}
