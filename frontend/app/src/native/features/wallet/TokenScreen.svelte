<!-- A token's page (native design notes §3.9 Token page; the native plan's 13), pushed over the
     Wallet tab at /wallet/:ledger: the symbol and its price pill in the header, the kebab (Send /
     Receive / Swap, Copy ledger ID), the avatar beside the amount with the symbol in secondary ink,
     the eye, the value, its share of the wallet, Send / Receive / Swap [token] (at zero Receive
     leads and the others wait for funds), and its activity under the filter tabs, by day (its
     history from the index canister: WalletHistories, the web wallet's). Send, Receive and Swap
     open their flows' URLs over this page (N10b's screens). -->
<script lang="ts">
    import {
        allUsersStore,
        conversionLedgers,
        cryptoLookup,
        currentUserStore,
        enhancedCryptoLookup,
        exchangeRatesLookupStore,
        namedAccountsStore,
        walletConfigStore,
        type OpenChat,
    } from "@client";
    import { copyText } from "@openchat/ui/src/lib/clipboard";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import ListSectionLabel from "@openchat/ui/src/lib/components/ListSectionLabel.svelte";
    import SegmentedTabs from "@openchat/ui/src/lib/components/SegmentedTabs.svelte";
    import ShareBar from "@openchat/ui/src/lib/components/ShareBar.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import TokenAvatar from "@openchat/ui/src/lib/components/TokenAvatar.svelte";
    import TransactionRow from "@openchat/ui/src/lib/components/TransactionRow.svelte";
    import type { TokenFlow } from "@openchat/ui/src/lib/wallet";
    import AnchoredMenu from "@openchat/ui/src/native/AnchoredMenu.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import type { NativeMenuItem } from "@openchat/ui/src/native/types";
    import { hasTransactionHistory } from "@src/logic/wallet/tokenActions";
    import { walletCatalogue } from "@src/logic/wallet/walletCatalogue.svelte";
    import { walletHistories } from "@src/logic/wallet/walletSessionHistories";
    import { historyActivity, panelSettings } from "@src/logic/wallet/walletTokens";
    import { hideTokenBalances, walletCurrency } from "@src/stores/settings";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onMount, untrack } from "svelte";
    import { _, locale } from "svelte-i18n";
    import type { NativeScreen } from "../../router/locations";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenProps } from "../app/screens";
    import {
        flowUrl,
        tokenActivityGroups,
        tokenPage,
        walletFigures,
        type ActivityFilter,
    } from "./wallet.adapter";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "token" }>> = $props();

    const client = getContext<OpenChat>("client");
    const overlays = untrack(() => context.overlays);
    // the page keeps its token while it slides out
    const ledger = untrack(() => screen.ledger);

    const figures = $derived(
        walletFigures(
            walletCatalogue.tokens,
            panelSettings($walletConfigStore),
            conversionLedgers,
            $exchangeRatesLookupStore,
            { currency: $walletCurrency, veiled: $hideTokenBalances, locale: $locale ?? "en" },
        ),
    );
    const page = $derived(tokenPage(figures, ledger));

    // ---- its history: loaded as the page opens, and again when its balance changes (a
    // transaction since); the saved accounts name the other side

    const histories = walletHistories(client);
    const token = $derived($cryptoLookup.get(ledger));
    const indexed = $derived(token !== undefined && hasTransactionHistory(token));
    let balanceKnown = $state(false);
    onMount(() => {
        client.loadSavedCryptoAccounts();
        void client.refreshAccountBalance(ledger, true).finally(() => (balanceKnown = true));
    });
    const balance = $derived($enhancedCryptoLookup.get(ledger)?.balance);
    $effect(() => {
        if (token === undefined || !indexed) return;
        const index = token.index;
        // before its balance is in, the lookup says 0: that isn't a balance to fetch against
        const held = balanceKnown ? balance : undefined;
        untrack(() => histories.load(ledger, index, held));
    });
    const history = $derived(histories.get(ledger));

    let filter = $state<ActivityFilter>(0);
    const groups = $derived.by(() => {
        if (page === undefined) return [];
        const activity = historyActivity(histories.all, $cryptoLookup, $exchangeRatesLookupStore, {
            me: { userId: $currentUserStore.userId, cryptoAccount: $currentUserStore.cryptoAccount },
            users: $allUsersStore,
            saved: $namedAccountsStore,
            unknown: $_("unknownUser"),
        });
        const dp = figures.tokens.find((t) => (t.id ?? t.symbol) === ledger)?.dp ?? 4;
        return tokenActivityGroups(activity, { id: ledger, symbol: page.symbol, dp }, filter, figures, {
            receivedFrom: (name) => $_("native.wallet.receivedFrom", { values: { name } }),
            sentTo: (name) => $_("native.wallet.sentTo", { values: { name } }),
            betweenWallets: $_("native.wallet.betweenWallets"),
            todayDay: $_("native.wallet.todayDay"),
            yesterdayDay: $_("native.wallet.yesterday"),
        });
    });

    // the empty list's words, per filter tab (at zero: "No ICP activity yet")
    const EMPTY: Record<ActivityFilter, string> = {
        0: "native.wallet.noActivity",
        1: "native.wallet.noSent",
        2: "native.wallet.noReceived",
        3: "native.wallet.noSwaps",
    };

    // ---- the buttons and the kebab

    const FLOW_LABEL: Record<TokenFlow, string> = {
        send: "native.wallet.sendSymbol",
        receive: "native.wallet.receiveSymbol",
        swap: "native.wallet.swapSymbol",
    };
    const FLOW_ICON: Record<TokenFlow, string> = { send: "send", receive: "receive", swap: "swap" };
    const flowLabel = (flow: TokenFlow) =>
        $_(FLOW_LABEL[flow], { values: { symbol: page?.symbol ?? "" } });

    function open(flow: TokenFlow) {
        navigate(flowUrl(flow, ledger));
    }

    let menuAnchor = $state<HTMLElement | null>(null);
    useOverlay(
        overlays,
        () => menuAnchor !== null,
        () => (menuAnchor = null),
    );

    const menuItems = $derived.by((): NativeMenuItem[] => {
        if (page === undefined) return [];
        const flows = page.menu.map((f) => ({ id: f, label: flowLabel(f), icon: FLOW_ICON[f] }));
        return page.ledger === undefined
            ? flows
            : [
                  ...flows,
                  {
                      id: "ledger",
                      label: $_("native.wallet.copyLedgerId"),
                      icon: "copy",
                      separator: flows.length > 0,
                  },
              ];
    });

    async function pick(id: string) {
        if (id === "send" || id === "receive" || id === "swap") {
            open(id);
        } else if (id === "ledger" && page?.ledger !== undefined) {
            if (await copyText(page.ledger)) {
                context.toast($_("native.wallet.ledgerCopied", { values: { symbol: page.symbol } }));
            }
        }
    }

    function addFundsFirst() {
        context.toast($_("native.wallet.addFundsFirst"));
    }
</script>

<div class="token-page">
    <NativePageHeader
        title={page?.symbol ?? ""}
        titleTag={page?.price}
        onBack={context.back}
        onMore={page !== undefined && menuItems.length > 0 ? (anchor) => (menuAnchor = anchor) : undefined}
        moreLabel={$_("native.wallet.tokenOptions")} />

    <div class="scroll">
        {#if page === undefined}
            <p class="note">{$_("native.wallet.notFound")}</p>
        {:else}
            <div class="hero">
                <div class="balance">
                    <TokenAvatar size={52} symbol={page.symbol} mark={page.mark} gradient={page.grad} logo={page.logo} />
                    <div class="balance-text">
                        <div class="amount-line">
                            <span class="amount" class:veiled={$hideTokenBalances}
                                >{page.amount}<span class="amount-symbol">{page.symbol}</span></span>
                            <button
                                type="button"
                                class="eye"
                                aria-label={$_($hideTokenBalances ? "native.wallet.showBalances" : "native.wallet.hideBalances")}
                                onclick={() => hideTokenBalances.set(!$hideTokenBalances)}>
                                <span class="eye-icon" class:off={$hideTokenBalances}></span>
                            </button>
                        </div>
                        <span class="value" class:veiled={$hideTokenBalances}>{page.value}</span>
                    </div>
                </div>
                {#if page.share}
                    <div class="share">
                        <span class="share-label">{$_("native.wallet.shareOfWallet", { values: { share: page.share.label } })}</span>
                        <ShareBar share={page.share.percent} veiled={$hideTokenBalances} gradient={page.grad} thickness={2} />
                    </div>
                {/if}
            </div>

            <div class="actions">
                {#each page.actions as a (a.flow)}
                    {@const iconOnly = a.flow === "swap"}
                    {#if a.disabled}
                        <button
                            type="button"
                            class="waits"
                            aria-disabled="true"
                            aria-label={flowLabel(a.flow)}
                            onclick={page.held ? undefined : addFundsFirst}>
                            <span aria-hidden="true"
                                ><Button
                                    label={iconOnly ? "" : flowLabel(a.flow)}
                                    ariaLabel={iconOnly ? flowLabel(a.flow) : undefined}
                                    icon={FLOW_ICON[a.flow]}
                                    variant="secondary"
                                    size="lg"
                                    fullWidth
                                    disabled /></span>
                        </button>
                    {:else}
                        <Button
                            label={iconOnly ? "" : flowLabel(a.flow)}
                            ariaLabel={iconOnly ? flowLabel(a.flow) : undefined}
                            icon={FLOW_ICON[a.flow]}
                            variant={a.primary ? "primary" : "secondary"}
                            size="lg"
                            fullWidth
                            onClick={() => open(a.flow)} />
                    {/if}
                {/each}
            </div>

            <SegmentedTabs
                size="sm"
                labels={[
                    $_("native.wallet.filterAll"),
                    $_("native.wallet.filterSent"),
                    $_("native.wallet.filterReceived"),
                    $_("native.wallet.filterSwaps"),
                ]}
                selectedIndex={filter}
                dotOnLast={false}
                onSelect={(i) => (filter = i as ActivityFilter)} />

            <div class="activity">
                {#each groups as g (g.label)}
                    <div class="day">
                        <div class="day-label"><ListSectionLabel label={g.label} /></div>
                        {#each g.rows as x (x.id)}
                            <TransactionRow
                                title={x.title}
                                sub={x.sub}
                                amount={x.amount}
                                fiat={x.fiat}
                                kind={x.kind}
                                positive={x.positive}
                                hidden={$hideTokenBalances}
                                divider={x.divider} />
                        {/each}
                    </div>
                {/each}
                {#if token !== undefined && !indexed}
                    <p class="note">{$_("native.wallet.noHistory", { values: { symbol: page.symbol } })}</p>
                {:else if history === undefined || history.state.kind === "loading"}
                    <div class="loading"><Spinner size={20} delay={300} /></div>
                {:else if history.state.kind === "failed"}
                    <div class="note">
                        <p>{$_("native.wallet.historyFailed", { values: { symbol: page.symbol } })}</p>
                        <Button label={$_("native.wallet.tryAgain")} variant="secondary" onClick={() => history?.load()} />
                    </div>
                {:else if groups.length === 0 && !history.moreAvailable}
                    <p class="note">{$_(EMPTY[filter], { values: { symbol: page.symbol } })}</p>
                {/if}
                {#if history?.state.kind === "loaded" && history.moreAvailable}
                    <div class="more">
                        <Button
                            label={$_("native.wallet.loadOlder")}
                            variant="secondary"
                            busy={history.state.loadingMore}
                            onClick={() => history?.loadMore()} />
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>

<AnchoredMenu
    anchor={menuAnchor}
    items={menuItems}
    label={$_("native.wallet.tokenOptions")}
    onSelect={pick}
    onClose={() => (menuAnchor = null)} />

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .token-page {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    // 30px from the header to the balance (notes §3.9)
    .scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        gap: 18px;
        padding: 30px var(--space-16) var(--scroll-end);
    }

    .hero {
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
        padding: 0 var(--space-4);
    }

    .balance {
        display: flex;
        align-items: center;
        gap: 14px;
    }

    .balance-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
    }

    .amount-line {
        display: flex;
        align-items: center;
        gap: var(--space-6);
    }

    .amount {
        display: flex;
        align-items: baseline;
        gap: var(--space-6);
        min-width: 0;
        font: 800 text-size(28px) / 1.05 var(--font-sans);
        letter-spacing: -0.02em;
        white-space: nowrap;
        color: var(--ink);
    }

    .amount-symbol {
        color: var(--ink-4);
    }

    .veiled {
        filter: blur(8px);
    }

    .amount,
    .value {
        transition: filter var(--duration-base) var(--ease-out);

        @include reduced-motion {
            transition: none;
        }
    }

    .eye {
        flex: none;
        width: var(--touch-target);
        height: var(--touch-target);
        margin: -4px 0;
        @include flex-center;
        padding: 0;
        border: 0;
        background: none;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
    }

    .eye-icon {
        @include icon(eye, 20px, var(--ink-3));

        &.off {
            mask: var(--icon-eye-off) center/contain no-repeat;
        }
    }

    .value {
        padding-left: 2px;
        font: var(--weight-medium) text-size(13px) / 1 var(--font-mono);
        color: var(--ink-3);
    }

    .share {
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
        padding-left: 2px;
    }

    .share-label {
        align-self: flex-end;
        font: var(--weight-medium) text-size(12.5px) / 1 var(--font-sans);
        color: var(--ink-3);
    }

    .actions {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 52px;
        gap: var(--space-8);
        margin-top: var(--space-8);
    }

    // a disabled button that says why when tapped
    .waits {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        padding: 0;
        border: 0;
        background: none;
        -webkit-tap-highlight-color: transparent;
    }

    .activity {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        margin-top: var(--space-4);
    }

    .day {
        display: flex;
        flex-direction: column;
    }

    .day-label {
        padding: var(--space-8) 0 var(--space-4) 2px;
    }

    .note {
        margin: 0;
        padding: 28px var(--space-8);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-12);
        text-align: center;
        font: var(--weight-regular) text-size(13.5px) / 1.5 var(--font-sans);
        color: var(--ink-4);

        p {
            margin: 0;
        }
    }

    .loading {
        display: flex;
        justify-content: center;
        padding: var(--space-24) 0;
    }

    .more {
        display: flex;
        justify-content: center;
        padding-top: var(--space-12);
    }
</style>
