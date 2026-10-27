import type { WalletRequest } from "@openchat/ui/src/features/components/WalletMain.svelte";

// The wallet's two screens share one stream of requests for WalletMain: the URL's page (All
// activity, a token) from the main screen, and the panel's own asks (browse the supported tokens,
// copy a ledger ID) that change no URL. One counter numbers them both, so the newest wins.

let counter = 0;

/** A request numbered after every one before it. */
export function numbered(request: Omit<WalletRequest, "nonce">): WalletRequest {
    counter += 1;
    return { ...request, nonce: counter };
}

/** The newer of two requests, by their numbers. */
export function newest(
    a: WalletRequest | undefined,
    b: WalletRequest | undefined,
): WalletRequest | undefined {
    if (a === undefined) return b;
    if (b === undefined) return a;
    return a.nonce >= b.nonce ? a : b;
}

/** What the panel last asked WalletMain for. */
class PanelRequests {
    latest = $state<WalletRequest | undefined>();

    send(request: Omit<WalletRequest, "nonce">): void {
        this.latest = numbered(request);
    }
}

export const panelRequests = new PanelRequests();
