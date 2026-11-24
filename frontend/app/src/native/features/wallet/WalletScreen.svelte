<!-- The Wallet tab's root (native design notes §3.9 Root, Below the tokens, Empty wallet; §4; the
     native plan's 13): "Wallet", the total (a tap cycles the display currency, kept on this device
     as the web wallet's), the eye that hides the balances, the "today" pill (worked out on the
     device: logic/wallet/totalSnapshots), Send / Receive / Swap, the tokens (symbol and price pill
     over the name, amount over value, share bar), Small balances (folding open) and Supported
     tokens (its sheet). With nothing held: Receive leads, Send and Swap wait for funds, the welcome
     card, and the first supported tokens under View all. Send, Receive and Swap open their flows'
     URLs (N10b's screens). Never in an app store build: no tab, and /wallet doesn't route here. -->
<script lang="ts">
    import {
        conversionLedgers,
        currentUserIdStore,
        currentUserStore,
        exchangeRatesLookupStore,
        exchangeRatesTriedStore,
        walletConfigStore,
        walletTokensSorted,
        type OpenChat,
    } from "@client";
    import { copyText } from "@openchat/ui/src/lib/clipboard";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import ListSectionLabel from "@openchat/ui/src/lib/components/ListSectionLabel.svelte";
    import Pill from "@openchat/ui/src/lib/components/Pill.svelte";
    import ShareBar from "@openchat/ui/src/lib/components/ShareBar.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import TokenAvatar from "@openchat/ui/src/lib/components/TokenAvatar.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import { BalanceRefresh } from "@src/logic/wallet/balanceRefresh.svelte";
    import { walletCatalogue } from "@src/logic/wallet/walletCatalogue.svelte";
    import {
        changeToday,
        loadSnapshots,
        recordSnapshot,
        saveSnapshots,
        type TotalSnapshot,
    } from "@src/logic/wallet/totalSnapshots";
    import { panelSettings, supportedCount } from "@src/logic/wallet/walletTokens";
    import { hideTokenBalances, walletCurrency } from "@src/stores/settings";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onMount, untrack } from "svelte";
    import { _, locale } from "svelte-i18n";
    import type { NativeScreen } from "../../router/locations";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenProps } from "../app/screens";
    import SupportedTokensSheet from "./SupportedTokensSheet.svelte";
    import {
        flowUrl,
        nextDisplayCurrency,
        tokenUrl,
        walletFigures,
        walletRoot,
        walletTotals,
        type WalletWords,
    } from "./wallet.adapter";

    let { context }: ScreenProps<Extract<NativeScreen, { kind: "wallet" }>> = $props();

    const client = getContext<OpenChat>("client");
    const overlays = untrack(() => context.overlays);

    // which tokens can be swapped, as the web wallet asks when it opens
    onMount(() => client.refreshSwappableTokens());

    // each token's balance, once as the list first shows it (a recent one accepted)
    const balances = new BalanceRefresh(client);
    $effect(() => {
        const ledgers = $walletTokensSorted.map((t) => t.ledger);
        untrack(() => balances.refresh(ledgers));
    });

    const figures = $derived(
        walletFigures(
            walletCatalogue.tokens,
            panelSettings($walletConfigStore),
            conversionLedgers,
            $exchangeRatesLookupStore,
            { currency: $walletCurrency, veiled: $hideTokenBalances, locale: $locale ?? "en" },
        ),
    );

    // the figures are in once the balances and the prices they're worked out with are
    const settled = $derived(!balances.loading && $exchangeRatesTriedStore);

    // ---- "today": a snapshot of the total at most once an hour while the wallet shows, kept on
    // this device for the user; the pill shows once there's one from 24 hours ago

    const storage = (() => {
        try {
            return window.localStorage;
        } catch {
            return undefined;
        }
    })();
    const userId = $derived($currentUserIdStore);
    let snapshots = $state<TotalSnapshot[]>([]);
    $effect(() => {
        const id = userId;
        untrack(() => (snapshots = storage ? loadSnapshots(storage, id) : []));
    });
    $effect(() => {
        if (!settled) return;
        const totals = walletTotals(figures);
        untrack(() => {
            const next = recordSnapshot(snapshots, totals, Date.now());
            if (next === snapshots) return;
            snapshots = next;
            if (storage) saveSnapshots(storage, userId, next);
        });
    });
    const change = $derived.by(() => {
        if (!settled) return undefined;
        const now = walletTotals(figures)[figures.currency];
        return now === undefined
            ? undefined
            : changeToday(snapshots, now, figures.currency, Date.now());
    });

    const words: WalletWords = $derived({
        today: (c) => $_("native.wallet.today", { values: { change: c } }),
        tokens: (count) => $_("native.wallet.tokenCount", { values: { count } }),
        smallBalances: (count) => $_("native.wallet.smallBalances", { values: { count } }),
        smallSub: (floor) => $_("native.wallet.smallSub", { values: { floor } }),
        receivedFrom: (name) => $_("native.wallet.receivedFrom", { values: { name } }),
        sentTo: (name) => $_("native.wallet.sentTo", { values: { name } }),
        betweenWallets: $_("native.wallet.betweenWallets"),
        todayDay: $_("native.wallet.todayDay"),
        yesterdayDay: $_("native.wallet.yesterday"),
    });

    const root = $derived(
        walletRoot(
            figures,
            {
                balancesLoading: balances.loading,
                change,
                supportedCount: supportedCount(figures.tokens),
            },
            words,
        ),
    );

    let smallOpen = $state(false);
    let browsing = $state(false);
    useOverlay(
        overlays,
        () => browsing,
        () => (browsing = false),
    );

    const username = $derived($currentUserStore.username);

    function cycleCurrency() {
        walletCurrency.set(nextDisplayCurrency(figures));
    }

    function addFundsFirst() {
        context.toast($_("native.wallet.addFundsFirst"));
    }

    async function copyHandle() {
        if (await copyText(`@${username}`)) {
            context.toast($_("native.wallet.usernameCopied", { values: { username } }));
        }
    }

    function openToken(id: string) {
        navigate(tokenUrl(id));
    }
</script>

{#snippet eye()}
    <button
        type="button"
        class="eye"
        aria-label={$_($hideTokenBalances ? "native.wallet.showBalances" : "native.wallet.hideBalances")}
        onclick={() => hideTokenBalances.set(!$hideTokenBalances)}>
        <span class="eye-icon" class:off={$hideTokenBalances}></span>
    </button>
{/snippet}

<div class="wallet">
    <NativePageHeader title={$_("native.wallet.title")} size="lg" />

    <div class="scroll">
        <div class="total-block">
            <span class="label">
                {$_("native.wallet.totalBalance")}
                {#if !settled}<Spinner size={11} delay={400} />{/if}
            </span>
            <div class="total-line">
                <button
                    type="button"
                    class="total"
                    class:veiled={$hideTokenBalances}
                    aria-label={$_("native.wallet.switchCurrency")}
                    onclick={cycleCurrency}>{root.total}</button>
                {@render eye()}
            </div>
            {#if root.kind === "funded"}
                <span class="today">
                    {#if root.today}<Pill size="md" label={root.today.label} tone={root.today.tone} />{/if}
                    {root.count}
                </span>
            {/if}
        </div>

        <div class="actions">
            {#if root.kind === "funded"}
                <Button label={$_("native.wallet.send")} icon="send" size="lg" fullWidth onClick={() => navigate(flowUrl("send"))} />
                <Button
                    label={$_("native.wallet.receive")}
                    icon="receive"
                    variant="secondary"
                    size="lg"
                    fullWidth
                    onClick={() => navigate(flowUrl("receive"))} />
                <Button
                    label=""
                    ariaLabel={$_("native.wallet.swap")}
                    icon="swap"
                    variant="secondary"
                    size="lg"
                    fullWidth
                    onClick={() => navigate(flowUrl("swap"))} />
            {:else}
                <Button label={$_("native.wallet.receive")} icon="receive" size="lg" fullWidth onClick={() => navigate(flowUrl("receive"))} />
                <!-- disabled, and a tap says why (the prototype's "Add funds first") -->
                <button type="button" class="waits" aria-disabled="true" aria-label={$_("native.wallet.send")} onclick={addFundsFirst}>
                    <span aria-hidden="true"><Button label={$_("native.wallet.send")} icon="send" variant="secondary" size="lg" fullWidth disabled /></span>
                </button>
                <button type="button" class="waits" aria-disabled="true" aria-label={$_("native.wallet.swap")} onclick={addFundsFirst}>
                    <span aria-hidden="true"><Button label="" ariaLabel={$_("native.wallet.swap")} icon="swap" variant="secondary" size="lg" fullWidth disabled /></span>
                </button>
            {/if}
        </div>

        {#if root.kind === "empty"}
            <div class="welcome">
                <span class="welcome-title">{$_("native.wallet.welcomeTitle")}</span>
                <span class="welcome-body">{$_("native.wallet.welcomeBody")}</span>
                {#if username}
                    <button type="button" class="handle" onclick={copyHandle}>
                        <span class="handle-icon"></span>
                        <span class="handle-text">{$_("native.wallet.getPaid", { values: { username } })}</span>
                        <span class="handle-copy">{$_("native.wallet.copy")}</span>
                    </button>
                {/if}
            </div>

            <section class="list">
                <div class="head">
                    <span class="head-label"><ListSectionLabel label={$_("native.wallet.supportedTokens")} /></span>
                    <button type="button" class="view-all" onclick={() => (browsing = true)}>
                        {$_("native.wallet.viewAll", { values: { count: root.supportedCount } })}
                    </button>
                </div>
                <div class="rows">
                    {#each root.supported as t (t.id)}
                        <button type="button" class="row" onclick={() => openToken(t.id)}>
                            <TokenAvatar size={40} symbol={t.symbol} mark={t.mark} gradient={t.grad} logo={t.logo} />
                            <span class="names">
                                <span class="symbol">{t.symbol}</span>
                                <span class="name">{t.name}</span>
                            </span>
                            <span class="price-right">{t.price}</span>
                        </button>
                    {/each}
                </div>
            </section>
        {:else}
            <section class="list">
                <div class="head"><ListSectionLabel label={$_("native.wallet.tokens")} /></div>
                <div class="rows">
                    {#each root.tokens as t (t.id)}
                        <button type="button" class="row token" onclick={() => openToken(t.id)}>
                            <span class="token-line">
                                <TokenAvatar size={40} symbol={t.symbol} mark={t.mark} gradient={t.grad} logo={t.logo} />
                                <span class="names">
                                    <span class="symbol-line">
                                        <span class="symbol">{t.symbol}</span>
                                        {#if t.price !== undefined}<span class="price">{t.price}</span>{/if}
                                    </span>
                                    <span class="name">{t.name}</span>
                                </span>
                                <span class="figures">
                                    <span class="amount">{t.amount}</span>
                                    <span class="value">{t.value}</span>
                                </span>
                            </span>
                            <ShareBar share={t.share} veiled={$hideTokenBalances} gradient={t.grad} thickness={2} />
                        </button>
                    {/each}
                </div>

                {#if root.small}
                    <button type="button" class="row fold" aria-expanded={smallOpen} onclick={() => (smallOpen = !smallOpen)}>
                        <span class="badge"><span class="badge-icon coins"></span></span>
                        <span class="names">
                            <span class="symbol">{root.small.title}</span>
                            <span class="name">{root.small.sub}</span>
                        </span>
                        <span class="fold-sum">{root.small.total}</span>
                        <span class="chevron" class:open={smallOpen}></span>
                    </button>
                    {#if smallOpen}
                        <div class="small-list">
                            {#each root.small.rows as t (t.id)}
                                <button type="button" class="small-row" onclick={() => openToken(t.id)}>
                                    <TokenAvatar size={24} symbol={t.symbol} mark={t.mark} gradient={t.grad} logo={t.logo} />
                                    <span class="small-symbol">{t.symbol}</span>
                                    <span class="small-amount">{t.amount}</span>
                                    <span class="small-value">{t.value}</span>
                                </button>
                            {/each}
                        </div>
                    {/if}
                {/if}
                <button type="button" class="row fold supported" onclick={() => (browsing = true)}>
                    <span class="badge"><span class="badge-icon search"></span></span>
                    <span class="names">
                        <span class="symbol">{$_("native.wallet.supportedTokens")}</span>
                        <span class="name">{$_("native.wallet.canReceive", { values: { count: root.supportedCount } })}</span>
                    </span>
                    <span class="chevron forward"></span>
                </button>
            </section>
        {/if}
    </div>
</div>

<SupportedTokensSheet
    open={browsing}
    {figures}
    onClose={() => (browsing = false)}
    onPick={(id) => {
        browsing = false;
        openToken(id);
    }} />

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .wallet {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    // 48px end padding above the tab bar (notes §1 Spacing)
    .scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        gap: 18px;
        padding: 18px var(--space-16) 48px;
    }

    .total-block {
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
        padding: 0 var(--space-4);
    }

    .label {
        display: flex;
        align-items: center;
        gap: var(--space-6);
        font: var(--weight-semibold) text-size(11.5px) / 1 var(--font-mono);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-4);
    }

    .total-line {
        display: flex;
        align-items: center;
        gap: var(--space-6);
    }

    .total {
        padding: 0;
        border: 0;
        background: none;
        color: var(--ink);
        font: 800 text-size(36px) / 1.05 var(--font-sans);
        letter-spacing: -0.02em;
        cursor: pointer;
        user-select: none;
        transition: filter var(--duration-base) var(--ease-out);
        -webkit-tap-highlight-color: transparent;

        &.veiled {
            filter: blur(8px);
        }

        @include reduced-motion {
            transition: none;
        }
    }

    .eye {
        flex: none;
        width: var(--touch-target);
        height: var(--touch-target);
        @include flex-center;
        padding: 0;
        border: 0;
        background: none;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
    }

    .eye-icon {
        @include icon(eye, 20px);
        background: var(--ink-3);

        &.off {
            mask: var(--icon-eye-off) center/contain no-repeat;
        }
    }

    .today {
        display: flex;
        align-items: center;
        gap: var(--space-8);
        padding-left: 2px;
        font: var(--weight-medium) text-size(13px) / 1 var(--font-sans);
        color: var(--ink-3);
    }

    // 26px from the total to the buttons (the block's 18px gap and these 8px)
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

        :global(.button) {
            pointer-events: none;
        }
    }

    .welcome {
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
        margin-top: var(--space-8);
        padding: 18px;
        border-radius: var(--radius-xl);
        background: linear-gradient(
            150deg,
            color-mix(in oklch, var(--accent) 22%, var(--hero-base)) 0%,
            var(--hero-base) 75%
        );
        box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 26%, transparent);
    }

    .welcome-title {
        font: 800 text-size(18px) / 1.2 var(--font-sans);
        color: var(--ink);
    }

    .welcome-body {
        font: var(--weight-regular) text-size(13.5px) / 1.5 var(--font-sans);
        color: var(--ink-2);
        text-wrap: pretty;
    }

    .handle {
        display: flex;
        align-items: center;
        gap: var(--space-10);
        margin-top: var(--space-4);
        min-height: var(--touch-target);
        padding: 0 14px;
        border: 0;
        border-radius: var(--radius-md);
        background: var(--tint-row);
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
    }

    .handle-icon {
        @include icon(share, 18px);
        background: var(--ink-2);
    }

    .handle-text {
        flex: 1;
        min-width: 0;
        font: var(--weight-semibold) text-size(14px) / 1.2 var(--font-sans);
        @include truncate;
    }

    .handle-copy {
        font: var(--weight-bold) text-size(13.5px) / 1 var(--font-sans);
        color: var(--accent-bright);
    }

    // 34px from the buttons to the tokens (the gap and these 16px)
    .list {
        display: flex;
        flex-direction: column;
        gap: var(--space-10);
        margin-top: var(--space-16);
    }

    .head {
        display: flex;
        align-items: center;
        padding-left: 2px;
    }

    .head-label {
        flex: 1;
        min-width: 0;
    }

    .view-all {
        height: var(--touch-target);
        margin: -14px -6px -14px 0;
        padding: 0 var(--space-12);
        border: 0;
        background: none;
        font: var(--weight-semibold) text-size(13.5px) / 1 var(--font-sans);
        color: var(--accent-bright);
        cursor: pointer;
    }

    .rows {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
    }

    // rows without a background (notes §3.9), the press's highlight only
    .row {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: var(--space-12) var(--space-4);
        border: 0;
        border-radius: 14px;
        background: none;
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--overlay-1);
        }

        &:focus-visible {
            @include focus-ring;
        }

        &.token {
            flex-direction: column;
            align-items: stretch;
            gap: var(--space-10);
        }
    }

    .token-line {
        display: flex;
        align-items: center;
        gap: 14px;
    }

    .names {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .symbol-line {
        display: flex;
        align-items: center;
        gap: var(--space-8);
        min-width: 0;
    }

    .symbol {
        font: var(--weight-bold) text-size(15px) / 1.2 var(--font-sans);
        white-space: nowrap;
        @include truncate;
    }

    .price {
        flex: none;
        height: 20px;
        padding: 0 7px;
        border-radius: var(--radius-pill);
        display: inline-flex;
        align-items: center;
        background: var(--overlay-2);
        font: var(--weight-medium) text-size(11.5px) / 1 var(--font-mono);
        color: var(--ink-3);
    }

    .name {
        font: var(--weight-medium) text-size(12.5px) / 1 var(--font-sans);
        color: var(--ink-4);
        @include truncate;
    }

    .figures {
        flex: none;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 5px;
    }

    .amount {
        font: var(--weight-bold) text-size(15px) / 1.2 var(--font-mono);
    }

    .value,
    .price-right {
        font: var(--weight-medium) text-size(12.5px) / 1 var(--font-mono);
        color: var(--ink-4);
    }

    .price-right {
        flex: none;
        font-size: text-size(13px);
        color: var(--ink-3);
    }

    .badge {
        flex: none;
        width: 40px;
        height: 40px;
        border-radius: var(--radius-circle);
        background: var(--overlay-1);
        @include flex-center;
    }

    .badge-icon {
        width: 18px;
        height: 18px;
        background: var(--ink-3);

        &.coins {
            mask: var(--icon-coins) center/contain no-repeat;
        }

        &.search {
            mask: var(--icon-search) center/contain no-repeat;
        }
    }

    .fold-sum {
        flex: none;
        font: var(--weight-bold) text-size(15px) / 1.2 var(--font-mono);
        color: var(--ink-2);
    }

    .chevron {
        @include icon(chevron-down, 13px);
        background: var(--ink-4);
        transition: transform var(--duration-base) var(--ease-out);

        &.open {
            transform: rotate(180deg);
        }

        &.forward {
            width: 14px;
            height: 14px;
            mask: var(--icon-chevron-right) center/contain no-repeat;

            &:dir(rtl) {
                transform: scaleX(-1);
            }
        }

        @include reduced-motion {
            transition: none;
        }
    }

    .small-list {
        display: flex;
        flex-direction: column;
        padding-inline-start: 58px;
    }

    .small-row {
        display: flex;
        align-items: center;
        gap: var(--space-10);
        min-height: var(--touch-target);
        padding: 0 var(--space-4) 0 0;
        border: 0;
        background: none;
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
    }

    .small-symbol {
        flex: 1;
        min-width: 0;
        font: var(--weight-semibold) text-size(14px) / 1.2 var(--font-sans);
    }

    .small-amount {
        font: var(--weight-semibold) text-size(13.5px) / 1 var(--font-mono);
        color: var(--ink-2);
    }

    .small-value {
        width: 56px;
        text-align: end;
        font: var(--weight-medium) text-size(12px) / 1 var(--font-mono);
        color: var(--ink-4);
    }

    // Supported tokens: no divider above it (the user's call, testing on Android, against the
    // prototype's line), the space the divider took kept so it doesn't crowd the row above
    .supported {
        margin-top: var(--space-12);
    }
</style>
