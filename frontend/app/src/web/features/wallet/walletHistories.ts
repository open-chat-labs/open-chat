import { currentUserIdStore, type OpenChat } from "@client";
import { WalletHistories } from "@src/logic/wallet/walletHistories.svelte";

let session: { userId: string; histories: WalletHistories } | undefined;

/**
 * The wallet's histories for the session (WalletHistories), kept across visits to the wallet so
 * coming back fetches only what changed. A different signed-in user starts afresh.
 */
export function walletHistories(client: Pick<OpenChat, "getAccountTransactions">): WalletHistories {
    const userId = currentUserIdStore.value;
    if (session?.userId !== userId) session = { userId, histories: new WalletHistories(client) };
    return session.histories;
}
