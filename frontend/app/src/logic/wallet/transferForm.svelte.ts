// What every form that sends tokens from the user's OpenChat account, or from an external wallet,
// has in common: the chosen token, its balance and fees, and where the funds come from.

import {
    enhancedCryptoLookup,
    LEDGER_CANISTER_ICP,
    walletApprovalFee,
    type EnhancedTokenDetails,
    type OpenChat,
    type ResourceKey,
    type SignerWallet,
} from "@client";
import { TokenState } from "./walletState.svelte";

export type TransferFormOptions = {
    refreshBalance?: boolean;
    onRefreshFailed?: (failure: ResourceKey) => void;
};

export class TransferForm {
    protected client: OpenChat;
    #refreshBalance: boolean;
    #onRefreshFailed: ((failure: ResourceKey) => void) | undefined;
    #tokenState: TokenState;
    // True from choosing a token until its balance has been checked
    #tokenChanging = $state(true);
    // The external wallet the funds will come from, or undefined for the user's own OpenChat
    // account. Paying from an external wallet spends that wallet's balance rather than the user's
    // OpenChat one, so none of the limits derived from the latter apply while one is selected.
    sourceWallet = $state<SignerWallet>();

    #payFromWallet = $derived(this.sourceWallet !== undefined);

    /**
     * The form refreshes the balance whenever a token is chosen, unless `refreshBalance` is false:
     * then whoever refreshes it calls `balanceChecked` when it has. A refresh that fails is
     * reported to `onRefreshFailed`.
     */
    constructor(client: OpenChat, ledger: string, options: TransferFormOptions = {}) {
        this.client = client;
        this.#refreshBalance = options.refreshBalance ?? true;
        this.#onRefreshFailed = options.onRefreshFailed;
        this.#tokenState = new TokenState(this.#tokenFor(ledger));
        this.#chooseToken(this.#tokenFor(ledger));
    }

    get tokenState(): TokenState {
        return this.#tokenState;
    }

    get ledger(): string {
        return this.#tokenState.ledger;
    }

    // Choosing another token starts the amount again
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

    // What the user can spend, or undefined when that is the external wallet's business
    get spendingLimit(): bigint | undefined {
        return this.#payFromWallet ? undefined : this.#tokenState.maxAmount;
    }

    // An empty OpenChat account is only a dead end while the user is paying from it
    get zero(): boolean {
        return (
            this.#tokenState.cryptoBalance <= this.#tokenState.transferFees &&
            !this.#tokenChanging &&
            !this.#payFromWallet
        );
    }

    // The ledger may have been removed from the registry (eg. if it was uninstalled), in which
    // case fall back to ICP, which is always there
    #tokenFor(ledger: string): EnhancedTokenDetails {
        const lookup = enhancedCryptoLookup.value;
        return lookup.get(ledger) ?? lookup.get(LEDGER_CANISTER_ICP)!;
    }

    #chooseToken(token: EnhancedTokenDetails) {
        this.#tokenState.token = token;
        // What it costs in fees includes the approval the wallet makes before the funds are
        // pulled from it
        this.#tokenState.transferFees = token.transferFee + walletApprovalFee(token.transferFee);
        this.#tokenState.draftAmount = 0n;
        this.#tokenChanging = true;
        if (this.#refreshBalance) this.#refreshChosenBalance();
    }

    async #refreshChosenBalance() {
        const failure = await this.#tokenState.refreshBalance(this.client);
        this.balanceChecked();
        if (failure !== undefined) this.#onRefreshFailed?.(failure);
    }
}
