// The state and logic for tipping a message, so that the components in both trees can be as purely
// presentational as possible. It returns outcomes; each tree shows them.

import {
    exchangeRatesLookupStore,
    formatTokens,
    lastCryptoSent,
    type Message,
    type MessageContext,
    type TipOutcome,
} from "@client";
import { reactiveValue } from "@src/utils/reactiveValue";
import { TransferForm } from "../wallet/transferForm.svelte";

export type TipIncrement = 1 | 10 | 100;
export const TIP_INCREMENTS: TipIncrement[] = [1, 10, 100];

const rates = reactiveValue(exchangeRatesLookupStore);

function to2SigFigs(num: number): number {
    return parseFloat(num.toPrecision(2));
}

export class TipForm extends TransferForm {
    #exchangeRate = $derived.by(() => to2SigFigs(rates().get(this.ledger)?.toUSD ?? 0));

    // Dollars per token, to 2 significant figures, or 0 when there is no rate
    get exchangeRate(): number {
        return this.#exchangeRate;
    }

    // The tip in cents
    get centAmount(): number {
        const tokens = Number(this.tokenState.draftAmount) / Math.pow(10, this.tokenState.decimals);
        return Math.round(tokens * this.#exchangeRate * 100);
    }

    get displayDraftAmount(): string {
        return formatTokens(this.tokenState.draftAmount, this.tokenState.decimals);
    }

    get displayFee(): string {
        return formatTokens(this.tokenState.transferFees, this.tokenState.decimals);
    }

    get valid(): boolean {
        return (
            this.tokenState.draftAmount > 0n &&
            (this.payFromWallet || this.tokenState.remainingBalance >= 0n) &&
            !this.tokenChanging
        );
    }

    // Whether adding `increment` cents would go over what the user can spend
    canAdd(increment: TipIncrement): boolean {
        if (this.#exchangeRate === 0) return false;
        const limit = this.spendingLimit;
        return limit === undefined || this.#amountFor(this.centAmount + increment) <= limit;
    }

    add(increment: TipIncrement) {
        if (this.#exchangeRate === 0) return;
        this.tokenState.draftAmount = this.#amountFor(this.centAmount + increment);
    }

    /**
     * Tips the message, paying `recipient`: its sender, or for a relayed message whoever linked the
     * account it came from (see `tipRecipient`). `fromAccount` is an external wallet which has just
     * approved us taking the tip; without it the tip comes from the user's own OpenChat account.
     */
    tip(
        messageContext: MessageContext,
        message: Message,
        recipient: string,
        fromAccount?: string,
    ): Promise<TipOutcome> {
        const token = this.tokenState.token;
        lastCryptoSent.set(token.ledger);
        return this.client.tipMessage(messageContext, message, {
            kind: "pending",
            ledger: token.ledger,
            token: token.symbol,
            recipient,
            amountE8s: this.tokenState.draftAmount,
            feeE8s: token.transferFee,
            createdAtNanos: BigInt(Date.now()) * 1_000_000n,
            fromAccount,
        });
    }

    #amountFor(cents: number): bigint {
        const e8s = ((cents / 100) * Math.pow(10, this.tokenState.decimals)) / this.#exchangeRate;
        return BigInt(Math.round(e8s));
    }
}
