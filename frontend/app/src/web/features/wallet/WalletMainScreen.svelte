<!-- The wallet's page (region "wallet", 6a #10120): WalletMain on /wallet (All activity) and
     /wallet/:ledger (the token's page: summary, facts and its history from the index canister, a
     page at a time, TransactionHistoryState). The URL says which: WalletMain's own moves (a row on
     All activity, Back to All activity) navigate there. There's no history across tokens, so All
     activity says to pick a token (GAPS). Send, Receive, Swap and Recipients aren't built yet
     (6b-6d): their paths show the token's page, or All activity. -->
<script lang="ts">
    import {
        allUsersStore,
        cryptoLookup,
        currentUserStore,
        enhancedCryptoLookup,
        exchangeRatesLookupStore,
        namedAccountsStore,
        swappableTokensStore,
        walletConfigStore,
        type OpenChat,
    } from "@client";
    import WalletMain from "@openchat/ui/src/features/components/WalletMain.svelte";
    import type { ComponentProps } from "svelte";
    import { accountTransactionUrl } from "@src/logic/wallet/accountTransactions";
    import {
        hasTransactionHistory,
        tokenActions,
        tokenActionsContext,
    } from "@src/logic/wallet/tokenActions";
    import { TransactionHistoryState } from "@src/logic/wallet/transactionHistoryState.svelte";
    import { hideTokenBalances } from "@src/stores/settings";
    import { toastStore } from "@src/stores/toast";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onDestroy, onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "@src/i18n/i18n";
    import type { MiddleRegion, ScreenProps } from "../app/screens";
    import { tokenActivity, walletToken } from "./wallet.adapter";
    import { walletCatalogue } from "./walletCatalogue.svelte";
    import { walletRequests } from "./walletRequests.svelte";

    type WalletMainProps = ComponentProps<typeof WalletMain>;

    let { region }: ScreenProps<Extract<MiddleRegion, { kind: "wallet" }>> = $props();

    const client = getContext<OpenChat>("client");

    // the saved account names a transaction's other side can go by (namedAccountsStore)
    onMount(() => client.loadSavedCryptoAccounts());

    // the token whose page shows: /wallet/:ledger, and for now Send / Receive / Swap's ?token
    const ledger = $derived(
        region.view === "all" || region.view === "recipients" ? undefined : region.ledger,
    );

    // the catalogue (a token you don't hold still gets its page, at zero), and the token the URL
    // names if the catalogue leaves it out (a disabled one, at zero) but the app knows it
    const tokens = $derived.by(() => {
        const catalogue = walletCatalogue.tokens;
        const extra = ledger === undefined ? undefined : $enhancedCryptoLookup.get(ledger);
        if (extra === undefined || catalogue.some((t) => t.id === extra.ledger)) return catalogue;
        const ctx = tokenActionsContext($swappableTokensStore, $walletConfigStore);
        const price = $exchangeRatesLookupStore.get(extra.ledger)?.toUSD;
        return [...catalogue, walletToken(extra, price, tokenActions(extra, ctx))];
    });

    // WalletMain follows the URL: a request each time it names another page (the panel's asks
    // share the slot); none is left behind for the next wallet page
    $effect(() => {
        const page = ledger;
        untrack(() =>
            walletRequests.send(
                page === undefined ? { view: "all" } : { view: "token", token: page },
            ),
        );
    });
    onDestroy(() => walletRequests.clear());

    // the shown token's history, loaded when its page opens
    let history = $state<{ ledger: string; state: TransactionHistoryState } | undefined>();
    $effect(() => {
        if (ledger === undefined || history?.ledger === ledger || !indexed) return;
        const state = new TransactionHistoryState(client, $cryptoLookup.get(ledger)?.index);
        history = { ledger, state };
        state.load();
    });

    const shown = $derived(history?.ledger === ledger ? history?.state : undefined);
    const token = $derived(ledger === undefined ? undefined : $cryptoLookup.get(ledger));
    // only a token with an index canister has a history
    const indexed = $derived(token !== undefined && hasTransactionHistory(token));
    const activity = $derived(
        shown?.state.kind === "loaded" && token !== undefined
            ? tokenActivity(
                  shown.state.history.transactions,
                  token,
                  $exchangeRatesLookupStore.get(token.ledger)?.toUSD,
                  {
                      me: {
                          userId: $currentUserStore.userId,
                          cryptoAccount: $currentUserStore.cryptoAccount,
                      },
                      users: $allUsersStore,
                      saved: $namedAccountsStore,
                      unknown: $_("unknownUser"),
                  },
              )
            : [],
    );
    const historyProp = $derived.by((): WalletMainProps["history"] => {
        if (token !== undefined && !indexed) return { state: "unavailable" };
        if (shown === undefined) return undefined;
        const state = shown.state;
        return state.kind === "loaded"
            ? { state: "loaded", more: shown.moreAvailable, loadingMore: state.loadingMore }
            : { state: state.kind };
    });

    async function loadMore(): Promise<void> {
        if ((await shown?.loadMore()) === "failed") {
            toastStore.showFailureToast(i18nKey("cryptoAccount.transactionError"));
        }
    }

    // a transaction opens on the token's explorer
    function openActivity(id: string): void {
        const format = token?.transactionUrlFormat;
        if (format) window.open(accountTransactionUrl(format, BigInt(id)), "_blank");
    }

    // WalletMain's own moves go to their URL
    function viewChanged({ view, token: id }: { view: string; token: string | null }): void {
        const path = view === "token" && id !== null ? `/wallet/${id}` : "/wallet";
        if (path !== window.location.pathname) navigate(path);
    }
</script>

<WalletMain
    {tokens}
    request={walletRequests.current}
    {activity}
    balanceHidden={$hideTokenBalances}
    history={historyProp}
    onMoreHistory={loadMore}
    onRetryHistory={() => shown?.load()}
    onActivity={openActivity}
    onViewChange={viewChanged}
    onBalanceHiddenChange={(hidden) => hideTokenBalances.set(hidden)}
    handle={$currentUserStore.username ? `@${$currentUserStore.username}` : undefined}
    flows={[]}
    allActivityNote={{
        title: "ui.walletMain.allActivityUnavailableTitle",
        body: "ui.walletMain.allActivityUnavailableBody",
    }} />
