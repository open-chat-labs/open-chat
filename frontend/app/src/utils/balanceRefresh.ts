import type { OpenChat } from "@client";
import type { TokenState } from "@src/logic/wallet/walletState.svelte";
import { toastStore } from "@src/stores/toast";

/** Refreshes a token's balance, and shows a failure toast if it couldn't. */
export async function refreshBalanceOrToast(
    tokenState: TokenState,
    client: OpenChat,
): Promise<void> {
    const failure = await tokenState.refreshBalance(client);
    if (failure !== undefined) toastStore.showFailureToast(failure);
}
