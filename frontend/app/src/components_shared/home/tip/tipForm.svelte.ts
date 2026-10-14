// The state and logic for tipping a message, so that the components in both trees can be as purely
// presentational as possible. It returns outcomes; each tree shows them.

import {
    enhancedCryptoLookup,
    exchangeRatesLookupStore,
    formatTokens,
    lastCryptoSent,
    LEDGER_CANISTER_ICP,
    walletApprovalFee,
    type EnhancedTokenDetails,
    type Message,
    type MessageContext,
    type OpenChat,
    type SignerWallet,
    type TipOutcome,
} from "@client";
import { reactiveValue } from "@src/utils/reactiveValue";
import { TokenState } from "../wallet/walletState.svelte";

export type TipIncrement = 1 | 10 | 100;
export const TIP_INCREMENTS: TipIncrement[] = [1, 10, 100];

const rates = reactiveValue(exchangeRatesLookupStore);

function to2SigFigs(num: number): number {
    return parseFloat(num.toPrecision(2));
}

export class TipForm {
    #client: OpenChat;
    #refreshBalance: boolean;
    #tokenState: TokenState;
    // True from choosing a token until its balance has been checked
    #tokenChanging = $state(true);
    // The external wallet the tip will come from, or undefined for the user's own OpenChat account.
    // Paying from an external wallet spends that wallet's balance rather than the user's OpenChat
    // one, so none of the limits derived from the latter apply while one is selected.
    sourceWallet = $state<SignerWallet>();

    #payFromWallet = $derived(this.sourceWallet !== undefined);
    #exchangeRate = $derived.by(() => to2SigFigs(rates().get(this.ledger)?.toUSD ?? 0));

    /**
     * The form refreshes the balance whenever a token is chosen, unless `refreshBalance` is false:
     * then whoever refreshes it calls `balanceChecked` when it has.
     */
    constructor(client: OpenChat, ledger: string, { refreshBalance = true } = {}) {
        this.#client = client;
        this.#refreshBalance = refreshBalance;
        this.#tokenState = new TokenState(this.#tokenFor(ledger));
        this.#chooseToken(this.#tokenFor(ledger));
    }

    get tokenState(): TokenState {
        return this.#tokenState;
    }

    get ledger(): string {
        return this.#tokenState.ledger;
    }

    // Choosing another token starts the tip again
    set ledger(ledger: string) {
        const token = this.#tokenFor(ledger);
        if (token.ledger === this.ledger) return;
        this.#chooseToken(token);
    }

    // The balance of the chosen token has been checked
    balanceChecked() {
        this.#tokenChanging = false;
    }

    get tokenChanging(): boolean {
        return this.#tokenChanging;
    }

    get payFromWallet(): boolean {
        return this.#payFromWallet;
    }

    // Dollars per token, to 2 significant figures, or 0 when there is no rate
    get exchangeRate(): number {
        return this.#exchangeRate;
    }

    // The tip in cents
    get centAmount(): number {
        const tokens =
            Number(this.#tokenState.draftAmount) / Math.pow(10, this.#tokenState.decimals);
        return Math.round(tokens * this.#exchangeRate * 100);
    }

    get displayDraftAmount(): string {
        return formatTokens(this.#tokenState.draftAmount, this.#tokenState.decimals);
    }

    get displayFee(): string {
        return formatTokens(this.#tokenState.transferFees, this.#tokenState.decimals);
    }

    // What the user can spend, or undefined when that is the external wallet's business
    get spendingLimit(): bigint | undefined {
        return this.#payFromWallet ? undefined : this.#tokenState.maxAmount;
    }

    get valid(): boolean {
        return (
            this.#tokenState.draftAmount > 0n &&
            (this.#payFromWallet || this.#tokenState.remainingBalance >= 0n) &&
            !this.#tokenChanging
        );
    }

    // An empty OpenChat account is only a dead end while the user is paying from it
    get zero(): boolean {
        return (
            this.#tokenState.cryptoBalance <= this.#tokenState.transferFees &&
            !this.#tokenChanging &&
            !this.#payFromWallet
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
        this.#tokenState.draftAmount = this.#amountFor(this.centAmount + increment);
    }

    /**
     * Tips the message. `fromAccount` is an external wallet which has just approved us taking the
     * tip; without it the tip comes from the user's own OpenChat account.
     */
    tip(
        messageContext: MessageContext,
        message: Message,
        fromAccount?: string,
    ): Promise<TipOutcome> {
        const token = this.#tokenState.token;
        lastCryptoSent.set(token.ledger);
        return this.#client.tipMessage(messageContext, message, {
            kind: "pending",
            ledger: token.ledger,
            token: token.symbol,
            recipient: message.sender,
            amountE8s: this.#tokenState.draftAmount,
            feeE8s: token.transferFee,
            createdAtNanos: BigInt(Date.now()) * 1_000_000n,
            fromAccount,
        });
    }

    // The ledger may have been removed from the registry (eg. if it was uninstalled), in which
    // case fall back to ICP, which is always there
    #tokenFor(ledger: string): EnhancedTokenDetails {
        const lookup = enhancedCryptoLookup.value;
        return lookup.get(ledger) ?? lookup.get(LEDGER_CANISTER_ICP)!;
    }

    #chooseToken(token: EnhancedTokenDetails) {
        this.#tokenState.token = token;
        // What the tip costs in fees includes the approval the wallet makes before the tip is
        // pulled from it
        this.#tokenState.transferFees = token.transferFee + walletApprovalFee(token.transferFee);
        this.#tokenState.draftAmount = 0n;
        this.#tokenChanging = true;
        if (this.#refreshBalance) {
            this.#tokenState.refreshBalance(this.#client).finally(() => this.balanceChecked());
        }
    }

    #amountFor(cents: number): bigint {
        const e8s = ((cents / 100) * Math.pow(10, this.#tokenState.decimals)) / this.#exchangeRate;
        return BigInt(Math.round(e8s));
    }
}
