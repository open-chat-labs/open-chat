<!-- The wallet's page (region "wallet", 6a #10120): WalletMain on /wallet (All activity) and
     /wallet/:ledger (the token's page: summary, facts and its history from the index canister, a
     page at a time, TransactionHistoryState). The URL says which: WalletMain's own moves (a row on
     All activity, Back to All activity) navigate there. There's no history across tokens, so All
     activity says to pick a token (GAPS). Receive (6b) is /wallet/receive?token=<ledger>: the
     token's networks and address (ReceiveAccount), its QR, Share to chat, the balance refreshed
     every 10 s while it's open. Send, Swap and Recipients aren't built yet (6b-6d): their paths
     show the token's page, or All activity. -->
<script lang="ts">
    import {
        allUsersStore,
        cryptoLookup,
        currentUserIdStore,
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
    import { ReceiveAccount, type ReceiveToken } from "@src/logic/wallet/receiveAccount.svelte";
    import QRCode from "@src/core/QRCode.svelte";
    import type { ShareChat } from "@openchat/ui/src/features/components/WalletReceive.svelte";
    import { sharedLinkText } from "../share/share.adapter";
    import { SharePicker } from "../share/sharePicker.svelte";
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
    import { receiveNetworks, tokenActivity, walletToken } from "./wallet.adapter";
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
    // share the slot); none is left behind for the next wallet page. A page WalletMain moved to
    // itself (and reported) isn't asked for again, which would reopen a flow already open
    let reported: { view: string; token: string | null } | undefined;
    $effect(() => {
        const view = region.view === "receive" ? "receive" : ledger === undefined ? "all" : "token";
        const page = ledger;
        untrack(() => {
            if (reported?.view === view && reported.token === (page ?? null)) return;
            walletRequests.send(page === undefined ? { view } : { view, token: page });
        });
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
        // Receive opens on its token's first network each time: a network picked lasts only while
        // it stays open (WalletMain reports every page it moves to, never a network picked)
        const stillReceiving =
            view === "receive" && reported?.view === "receive" && reported.token === id;
        if (!stillReceiving) receiveAccount.selectedNetwork = undefined;
        reported = { view, token: id };
        const path =
            view === "receive"
                ? `/wallet/receive${id !== null ? `?token=${id}` : ""}`
                : view === "token" && id !== null
                  ? `/wallet/${id}`
                  : "/wallet";
        // the page is its path and ?token=: the URL's other params (a dialog's ?diamond …) stay
        // unless the page changes
        const here = window.location;
        const token = new URLSearchParams(here.search).get("token");
        const current = `${here.pathname}${token !== null ? `?token=${token}` : ""}`;
        if (path !== current) navigate(path);
    }

    // Receive: the token's networks, the address on the chosen one and what depositing costs
    const receiving = $derived(region.view === "receive" ? region.ledger : undefined);
    const NO_TOKEN: ReceiveToken = {
        ledger: "",
        symbol: "",
        decimals: 8,
        oneSecEnabled: false,
        evmContractAddresses: [],
    };
    const receiveAccount = new ReceiveAccount(
        client,
        () => (receiving === undefined ? undefined : $cryptoLookup.get(receiving)) ?? NO_TOKEN,
        () => ({
            cryptoAccount: $currentUserStore.cryptoAccount,
            userId: $currentUserIdStore,
            principal: () => client.OcIdentityPrincipal,
        }),
    );
    const receiveToken = $derived(
        receiving === undefined ? undefined : $cryptoLookup.get(receiving),
    );
    const networks = $derived(
        receiveToken === undefined
            ? undefined
            : receiveNetworks(receiveAccount, receiveToken.symbol, (key, values) =>
                  $_(key, { values }),
              ),
    );

    // deposits arrive while Receive is open: its token's balance is refreshed every 10 s
    $effect(() => {
        const ledger = receiving;
        if (ledger === undefined) return;
        const timer = setInterval(() => client.refreshAccountBalance(ledger, false), 10_000);
        return () => clearInterval(timer);
    });

    // Share to chat: the address (and the user's message) posted to any of their chats
    // svelte-ignore state_referenced_locally
    const sharePicker = new SharePicker(client, $_, () => undefined);
    // only built while Receive is open: it follows every chat and user
    const shareChats = $derived(
        receiving === undefined
            ? []
            : sharePicker.chats().map(
                  (c): ShareChat => ({
                      id: c.id,
                      name: c.name,
                      kind: c.sub,
                      grad: c.grad,
                      radius: c.radius,
                  }),
              ),
    );

    async function share({
        chatId,
        message,
        address,
    }: {
        chatId: string;
        message: string;
        address: string;
    }): Promise<void> {
        const id = sharePicker.chatId(chatId);
        if (id === undefined) throw new Error("not a chat to share to");
        const outcome = await client.sendMessage(
            { chatId: id },
            sharedLinkText(message, address),
            false,
            undefined,
        );
        if (outcome.kind !== "posted") throw new Error(`address not shared: ${outcome.kind}`);
    }
</script>

<WalletMain
    {tokens}
    request={walletRequests.current}
    tokensLoading={$cryptoLookup.size === 0}
    {activity}
    balanceHidden={$hideTokenBalances}
    history={historyProp}
    onMoreHistory={loadMore}
    onRetryHistory={() => shown?.load()}
    onActivity={openActivity}
    onViewChange={viewChanged}
    onBalanceHiddenChange={(hidden) => hideTokenBalances.set(hidden)}
    handle={$currentUserStore.username ? `@${$currentUserStore.username}` : undefined}
    flows={["receive"]}
    receiveNetworks={networks}
    receiveNetwork={receiveAccount.selectedNetwork}
    onReceiveNetwork={(id) => (receiveAccount.selectedNetwork = id)}
    chats={shareChats}
    onShare={share}
    {qr}
    allActivityNote={{
        title: "ui.walletMain.allActivityUnavailableTitle",
        body: "ui.walletMain.allActivityUnavailableBody",
    }} />

{#snippet qr(address: string)}
    <QRCode text={address} logo={receiveToken?.logo || undefined} />
{/snippet}
