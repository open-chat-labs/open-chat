// Making a P2P swap offer in a builder that keeps its own form (the new UI's `SwapOfferDialog`):
// what was typed is read and checked, then confirmed (the offer locks the user's funds for as long
// as it's open, so it's asked about first, as the old builders ask), then attached to the message
// being written. What it costs and the content it's sent as are @client's (`swapOfferCosts`,
// `newSwapOfferContent`), as in the old builders.

import {
    localUpdates,
    newSwapOfferContent,
    swapOfferConfirmation,
    swapOfferCosts,
    swapOfferMaximum,
    swapOfferStep,
    validateTokenInput,
    type MessageContext,
    type P2PSwapContentInitial,
    type ResourceKey,
    type SwapOfferStep,
    type TokenInfo,
} from "@client";

/** What the builder asks for, as typed. */
export type TypedSwapOffer = {
    give: TokenInfo;
    get: TokenInfo;
    /** What the OpenChat account holds of `give`. */
    balance: bigint;
    amountText: string;
    wantText: string;
    expiresInMs: number;
};

/**
 * Where the builder is: filling in the offer, or asked to confirm it, holding what to show again
 * (`draft`, the builder's own form state) if the user goes back.
 */
export type SwapOfferStage<D> =
    | { kind: "editing"; draft: D | undefined }
    | {
          kind: "confirming";
          content: P2PSwapContentInitial;
          confirmation: ResourceKey;
          draft: D;
      };

export class SwapOfferForm<D> {
    stage = $state<SwapOfferStage<D>>({ kind: "editing", draft: undefined });

    /**
     * The offer asked for: `upgrade` for someone who isn't a Diamond member (only they can make
     * one), `invalid` where it isn't one this account can make (at least 10 fees, within the
     * balance less the deposit's and approval's fees, asking for something of another token),
     * else it's to be confirmed: amounts read exactly as typed (`validateTokenInput`), open for at
     * most 90 days.
     */
    review(offer: TypedSwapOffer, diamond: boolean, draft: D): SwapOfferStep {
        const amount0 = validateTokenInput(offer.amountText, offer.give.decimals).amount;
        const amount1 = validateTokenInput(offer.wantText, offer.get.decimals).amount;
        const { minAmount } = swapOfferCosts(offer.give.fee);
        const valid =
            offer.give.ledger !== offer.get.ledger &&
            amount0 >= minAmount &&
            amount0 <= swapOfferMaximum(offer.balance, offer.give.fee) &&
            amount1 > 0n;
        const step = swapOfferStep(diamond, valid);
        if (step !== "confirm") return step;
        const content = newSwapOfferContent({
            token0: offer.give,
            token1: offer.get,
            amount0,
            amount1,
            expiresInMs: offer.expiresInMs,
        });
        if (content === undefined) return "invalid";
        this.stage = {
            kind: "confirming",
            content,
            confirmation: swapOfferConfirmation(amount0, offer.give),
            draft,
        };
        return "confirm";
    }

    /** Back to the offer, as it was filled in. */
    back(): void {
        if (this.stage.kind === "confirming") {
            this.stage = { kind: "editing", draft: this.stage.draft };
        }
    }

    /**
     * Attaches the confirmed offer to the message being written; it's funded when the message is
     * sent. False when there's nothing confirmed.
     */
    confirm(messageContext: MessageContext): boolean {
        if (this.stage.kind !== "confirming") return false;
        localUpdates.draftMessages.setAttachment(messageContext, this.stage.content);
        return true;
    }
}
