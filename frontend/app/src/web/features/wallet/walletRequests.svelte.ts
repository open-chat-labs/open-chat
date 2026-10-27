import type { WalletRequest } from "@openchat/ui/src/features/components/WalletMain.svelte";

/**
 * What WalletMain is asked for, from either wallet screen: the main screen asks for the URL's page
 * (All activity, a token) as it changes, the panel for what changes no URL (browse the supported
 * tokens, copy a ledger ID). One slot, so the latest ask is the one WalletMain applies.
 */
class WalletRequests {
    #nonce = 0;
    current = $state<WalletRequest | undefined>();

    send(request: Omit<WalletRequest, "nonce">): void {
        this.#nonce += 1;
        this.current = { ...request, nonce: this.#nonce };
    }

    /** As the main screen goes: nothing left for the next one to apply. */
    clear(): void {
        this.current = undefined;
    }
}

export const walletRequests = new WalletRequests();
