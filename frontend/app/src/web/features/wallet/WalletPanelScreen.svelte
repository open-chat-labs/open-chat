<!-- The wallet's left column (region "wallet", 6a #10120): WalletPanel over the wallet's catalogue
     (cryptoTokensSorted): the tokens you own, those under the wallet's minimum value folded into
     small balances, and the supported tokens; with nothing owned, the first few supported tokens.
     Each token's menu is tokenActions', plus Copy ledger ID; "View all" and Copy ledger ID are asks
     of WalletMain (walletRequests). A token opens its page (/wallet/:ledger), All activity /wallet.
     The wallet's balances refresh as the list first shows them (a recent one is kept), Refresh all
     one ledger at a time. Send and Receive open in WalletMain; the card's Swap does nothing until
     its flow is built (6c). The ⋯ menu's Settings opens the settings dialog and Manage recipients
     the saved recipients (6d); the display currency is kept on this device (walletCurrency). -->
<script lang="ts">
    import {
        conversionLedgers,
        exchangeRatesLookupStore,
        exchangeRatesTriedStore,
        routeStore,
        walletConfigStore,
        walletTokensSorted,
        type OpenChat,
    } from "@client";
    import WalletPanel from "@openchat/ui/src/features/components/WalletPanel.svelte";
    import { hideTokenBalances, walletCurrency } from "@src/stores/settings";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onMount, untrack } from "svelte";
    import { SvelteSet } from "svelte/reactivity";
    import type { LeftRegion, ScreenProps } from "../app/screens";
    import { panelSettings, supportedCount } from "./wallet.adapter";
    import { walletCatalogue } from "./walletCatalogue.svelte";
    import { walletRequests } from "./walletRequests.svelte";

    // the region says only that it's the wallet: the selected token is the URL's
    let { context }: ScreenProps<Extract<LeftRegion, { kind: "wallet" }>> = $props();

    const client = getContext<OpenChat>("client");

    const tokens = $derived(walletCatalogue.tokens);

    // the display currencies' USD prices from the app's exchange rates, as the old wallets convert.
    // The panel's total is what it lists (your tokens and small balances), which differs from the
    // old wallets' (walletTokensSorted) when there's a minimum value (GAPS.md)
    const rates = $derived({
        ICP: $exchangeRatesLookupStore.get(conversionLedgers.icp)?.toUSD,
        BTC: $exchangeRatesLookupStore.get(conversionLedgers.btc)?.toUSD,
        ETH: $exchangeRatesLookupStore.get(conversionLedgers.eth)?.toUSD,
    });

    const page = $derived($routeStore.kind === "wallet_route" ? $routeStore : undefined);

    // which tokens can be swapped, as both old wallets ask when they open
    onMount(() => client.refreshSwappableTokens());

    // each token's balance, once as the list first shows it, a recent one accepted
    // (the total shows a small spinner while those first ones are coming, and until the client's
    // first try at the exchange rates it's priced with has finished, whether or not they came)
    const refreshed = new Set<string>();
    const loadingBalances = new SvelteSet<string>();
    $effect(() => {
        for (const token of $walletTokensSorted) {
            if (refreshed.has(token.ledger)) continue;
            refreshed.add(token.ledger);
            const ledger = token.ledger;
            untrack(() => loadingBalances.add(ledger));
            client
                .refreshAccountBalance(ledger, true)
                .finally(() => loadingBalances.delete(ledger));
        }
    });

    // "View all" and Copy ledger ID are WalletMain's to do
    function action(kind: string): void {
        if (kind === "browse") walletRequests.send({ view: "browse" });
        // the ⋯ menu: the settings dialog, and the saved recipients in the wallet's middle (6d)
        else if (kind === "settings") context.dialogs.open({ kind: "wallet_settings" });
        else if (kind === "recipients") navigate("/wallet/recipients");
        // Send and Receive: the token's, or the picker first (the balance card's)
        else if (kind === "send" || kind === "receive") walletRequests.send({ view: kind });
        else if (kind.startsWith("send:")) {
            walletRequests.send({ view: "send", token: kind.slice("send:".length) });
        } else if (kind.startsWith("receive:")) {
            walletRequests.send({ view: "receive", token: kind.slice("receive:".length) });
        } else if (kind.startsWith("ledger:")) {
            walletRequests.send({ view: "ledger", token: kind.slice("ledger:".length) });
        }
    }

    async function refresh(ledger?: string): Promise<void> {
        if (ledger === undefined) await client.refreshBalancesInSeries();
        else await client.refreshAccountBalance(ledger, false);
    }
</script>

<WalletPanel
    {tokens}
    {rates}
    settings={{ ...panelSettings($walletConfigStore), currency: $walletCurrency }}
    onSettingsChange={(s) => {
        if (s.currency !== undefined) walletCurrency.set(s.currency);
    }}
    supportedCount={supportedCount(tokens)}
    onAction={action}
    balanceHidden={$hideTokenBalances}
    onBalanceHiddenChange={(hidden) => hideTokenBalances.set(hidden)}
    onRefresh={refresh}
    balancesLoading={loadingBalances.size > 0}
    ratesLoading={!$exchangeRatesTriedStore}
    onRemoveToken={(ledger) => client.removeTokenFromWallet(ledger)}
    onToken={(ledger) => navigate(`/wallet/${ledger}`)}
    selectedToken={page?.view === "token" ? page.ledger : undefined}
    onHome={() => navigate("/wallet")}
    homeSelected={page?.view === "all"} />
