<script lang="ts">
    import { fade } from "svelte/transition";
    import { tweened } from "svelte/motion";
    import { quadOut } from "svelte/easing";
    import Button from "../Button.svelte";
    import TokenInput from "./TokenInput.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import type {
        EnhancedTokenDetails,
        Message,
        OpenChat,
        PendingCryptocurrencyTransfer,
    } from "openchat-client";
    import Overlay from "../Overlay.svelte";
    import AccountInfo from "./AccountInfo.svelte";
    import ModalContent from "../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import BalanceWithRefresh from "./BalanceWithRefresh.svelte";
    import CryptoSelector from "./CryptoSelector.svelte";
    import TipButton from "./TipButton.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();
    const increments: Increment[] = [1, 10, 100];
    type Increment = 1 | 10 | 100;

    export let ledger: string;
    export let msg: Message;

    let refreshing = false;
    let error: string | undefined = undefined;
    let toppingUp = false;
    let tokenChanging = true;
    let balanceWithRefresh: BalanceWithRefresh;
    let dollar: HTMLElement;
    let dollarTop = tweened(-1000);
    let dollarOpacity = tweened(0);
    let dollarScale = tweened(0);
    let centAmount = 0;
    let showCustomTip = false;
    let validAmount: boolean = false;
    let draftAmount = 0n;

    $: user = client.user;
    $: lastCryptoSent = client.lastCryptoSent;
    $: cryptoBalanceStore = client.cryptoBalance;
    $: cryptoLookup = client.cryptoLookup;
    $: exchangeRatesLookup = client.exchangeRatesLookupStore;
    $: tokenDetails = $cryptoLookup[ledger];
    $: cryptoBalance = $cryptoBalanceStore[ledger] ?? 0n;
    $: exchangeRate = to2SigFigs(
        $exchangeRatesLookup[tokenDetails.symbol.toLowerCase()]?.toUSD ?? 0,
    );
    $: displayDraftAmount = client.formatTokens(draftAmount, tokenDetails.decimals);
    $: displayFee = client.formatTokens(tokenDetails.transferFee, tokenDetails.decimals);
    $: remainingBalance =
        draftAmount > 0n ? cryptoBalance - draftAmount - tokenDetails.transferFee : cryptoBalance;
    $: valid =
        exchangeRate > 0 &&
        draftAmount > 0n &&
        remainingBalance >= 0n &&
        error === undefined &&
        !tokenChanging;
    $: zero = cryptoBalance <= tokenDetails.transferFee && !tokenChanging;
    $: transferFees = tokenDetails.transferFee;

    $: {
        if (ledger !== undefined) {
            // reset when ledger changes
            centAmount = 0;
            tokenChanging = true;
            draftAmount = 0n;
        }
    }

    $: {
        centAmount = calculateCentAmount(draftAmount, exchangeRate);
    }

    function amountLabel(n: Increment): string {
        return `$${(n / 100).toFixed(2)}`;
    }

    function calculateCentAmount(e8s: bigint, exchangeRate: number): number {
        const tokens = Number(e8s) / Math.pow(10, tokenDetails.decimals);
        const dollar = tokens * exchangeRate;
        const cents = dollar * 100;
        return Math.round(cents);
    }

    function to2SigFigs(num: number): number {
        return parseFloat(num.toPrecision(2));
    }

    function calculateAmount(centAmount: number, exchangeRate: number): bigint {
        const e8s = ((centAmount / 100) * Math.pow(10, tokenDetails.decimals)) / exchangeRate;
        return BigInt(Math.round(e8s));
    }

    function reset() {
        balanceWithRefresh.refresh();
    }

    function send() {
        const transfer: PendingCryptocurrencyTransfer = {
            kind: "pending",
            ledger,
            token: tokenDetails.symbol,
            recipient: msg.sender,
            amountE8s: draftAmount,
            feeE8s: tokenDetails.transferFee,
            createdAtNanos: BigInt(Date.now()) * 1_000_000n,
        };
        dispatch("send", transfer);
        lastCryptoSent.set(ledger);
    }

    function cancel() {
        toppingUp = false;
        dispatch("close");
    }

    function onBalanceRefreshed() {
        onBalanceRefreshFinished();
        error = undefined;
    }

    function onBalanceRefreshError(ev: CustomEvent<string>) {
        onBalanceRefreshFinished();
        error = ev.detail;
    }

    function onBalanceRefreshFinished() {
        toppingUp = false;
        tokenChanging = false;
        if (remainingBalance < 0) {
            remainingBalance = 0n;
            draftAmount = cryptoBalance - tokenDetails.transferFee;
            if (draftAmount < 0) {
                draftAmount = 0n;
            }
        }
    }

    $: {
        if (dollar) {
            dollar.style.setProperty("top", `${$dollarTop}px`);
            dollar.style.setProperty("opacity", `${$dollarOpacity}`);
            dollar.style.setProperty(
                "transform",
                `scale(${$dollarScale}) rotate(${$dollarScale}turn)`,
            );
        }
    }

    function bounceMoneyMouthFrom(target: HTMLElement) {
        const buttonRect = target.getBoundingClientRect();
        const hDiff = buttonRect.height - dollar.clientHeight;
        const wDiff = buttonRect.width - dollar.clientWidth;
        const top = buttonRect.top + hDiff / 2;
        const left = buttonRect.left + wDiff / 2;

        dollarTop = tweened(top, {
            duration: 800,
            easing: quadOut,
        });
        dollarOpacity = tweened(1, {
            duration: 800,
            easing: quadOut,
        });
        dollarScale = tweened(0, {
            duration: 800,
            easing: quadOut,
        });
        dollarTop.set(top - 300);
        dollarOpacity.set(0);
        dollarScale.set(2);
        dollar.style.left = `${left}px`;
    }

    function clickAmount(e: MouseEvent, increment: Increment) {
        bounceMoneyMouthFrom(e.target as HTMLElement);
        centAmount += increment;
        draftAmount = calculateAmount(centAmount, exchangeRate);
    }

    function hasExchangeRate(token: EnhancedTokenDetails): boolean {
        return $exchangeRatesLookup[token.symbol.toLowerCase()] !== undefined;
    }

    function maxAmount(balance: bigint): bigint {
        return balance - transferFees;
    }

    onMount(() => {
        let d = document.getElementById("tip-dollar");
        if (!d) {
            d = document.createElement("div");
            d.id = "tip-dollar";
            d.className = "tip-dollar";
            const t = document.createTextNode("🤑");
            d.appendChild(t);
            document.body.appendChild(d);
        }
        dollar = d;
    });
</script>

<Overlay dismissible>
    <ModalContent fill>
        <span class="header" slot="header">
            <div class="left">
                <div class="main-title">
                    <div><Translatable resourceKey={i18nKey("tip.title")} /></div>
                    <div>
                        <CryptoSelector bind:ledger filter={hasExchangeRate} />
                    </div>
                </div>
            </div>
            <BalanceWithRefresh
                bind:toppingUp
                bind:this={balanceWithRefresh}
                {ledger}
                value={remainingBalance}
                label={i18nKey("cryptoAccount.shortBalanceLabel")}
                bold
                showTopUp
                bind:refreshing
                on:refreshed={onBalanceRefreshed}
                on:error={onBalanceRefreshError} />
        </span>
        <form slot="body">
            <div class="body" class:zero={zero || toppingUp}>
                {#if zero || toppingUp}
                    <AccountInfo {ledger} user={$user} />
                    {#if zero}
                        <p>
                            <Translatable
                                resourceKey={i18nKey("tokenTransfer.zeroBalance", {
                                    token: tokenDetails.symbol,
                                })} />
                        </p>
                    {/if}
                    <p><Translatable resourceKey={i18nKey("tokenTransfer.makeDeposit")} /></p>
                    <a
                        rel="noreferrer"
                        class="how-to"
                        href={tokenDetails.howToBuyUrl}
                        target="_blank">
                        <Translatable
                            resourceKey={i18nKey("howToBuyToken", {
                                token: tokenDetails.symbol,
                            })} />
                    </a>
                {:else}
                    <div class="amounts">
                        {#each increments as increment}
                            <TipButton
                                label={i18nKey(amountLabel(increment))}
                                on:click={(e) => clickAmount(e, increment)}
                                disabled={exchangeRate === 0 ||
                                    calculateAmount(centAmount + increment, exchangeRate) >
                                        cryptoBalance - tokenDetails.transferFee} />
                        {/each}
                    </div>
                    <div in:fade|local={{ duration: 300 }} class="message">
                        {#if exchangeRate > 0}
                            {#if draftAmount > 0}
                                <div class="summary">
                                    <div class="dollar-amount">
                                        ${(centAmount / 100).toFixed(2)}
                                    </div>
                                    <div class="token-amount">
                                        {displayDraftAmount}
                                        {tokenDetails.symbol}
                                    </div>
                                    <div class="fee">
                                        <Translatable
                                            resourceKey={i18nKey("tip.plusFee", {
                                                fee: displayFee,
                                                token: tokenDetails.symbol,
                                            })} />
                                    </div>
                                </div>
                            {:else}
                                <div class="summary">
                                    <Translatable resourceKey={i18nKey("tip.advice")} />
                                </div>
                            {/if}
                        {:else}
                            <ErrorMessage
                                ><Translatable
                                    resourceKey={i18nKey("tip.noExchangeRate", {
                                        token: tokenDetails.symbol,
                                    })} /></ErrorMessage>
                        {/if}
                        {#if error}
                            <ErrorMessage>{$_(error)}</ErrorMessage>
                        {/if}
                    </div>
                    <div class="custom-tip">
                        {#if !showCustomTip}
                            <a
                                role="button"
                                tabindex="0"
                                on:click={() => (showCustomTip = true)}
                                class="options"
                                in:fade|local={{ duration: 500 }}
                                class:expanded={showCustomTip}>
                                <Translatable resourceKey={i18nKey("tip.showCustom")} />
                            </a>
                        {/if}

                        {#if showCustomTip}
                            <div in:fade|local={{ duration: 500 }} class="custom-tip-amount">
                                <TokenInput
                                    {ledger}
                                    {transferFees}
                                    bind:valid={validAmount}
                                    maxAmount={maxAmount(cryptoBalance)}
                                    bind:amount={draftAmount} />
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
        </form>
        <span slot="footer">
            <ButtonGroup>
                <Button small={!$mobileWidth} tiny={$mobileWidth} secondary on:click={cancel}
                    ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                {#if toppingUp || zero}
                    <Button
                        small={!$mobileWidth}
                        disabled={refreshing}
                        loading={refreshing}
                        tiny={$mobileWidth}
                        on:click={reset}><Translatable resourceKey={i18nKey("refresh")} /></Button>
                {:else}
                    <Button
                        small={!$mobileWidth}
                        disabled={!valid}
                        tiny={$mobileWidth}
                        on:click={send}
                        ><Translatable resourceKey={i18nKey("tokenTransfer.send")} /></Button>
                {/if}
            </ButtonGroup>
        </span>
    </ModalContent>
</Overlay>

<style lang="scss">
    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: $sp2;

        .left {
            flex: auto;
            display: flex;
            align-items: center;
            gap: $sp4;

            .main-title {
                flex: auto;
                display: flex;
                align-items: baseline;
                gap: 10px;
                @include font(bold, normal, fs-120);
            }
        }
    }

    .body {
        transition: background-color 100ms ease-in-out;
        @include font(book, normal, fs-100, 28);
        position: relative;

        &.zero {
            padding: 0 $sp4;
        }
    }

    .message {
        text-align: center;
        margin-bottom: $sp4;
    }

    .summary {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--txt);

        .dollar-amount,
        .fee,
        .token-amount {
            padding: 0 $sp4;
        }

        .dollar-amount,
        .token-amount {
            border-right: 1px solid var(--txt-light);
        }

        .fee {
            color: var(--txt-light);
            @include font(light, normal, fs-70);
        }
    }

    .amounts {
        display: flex;
        justify-content: space-evenly;
        gap: $sp2;
        padding: $sp6 0;
    }

    .how-to {
        margin-top: $sp4;
    }

    .custom-tip {
        text-align: center;
        margin-bottom: $sp3;
        @include font(light, normal, fs-80);

        .custom-tip-amount {
            padding: $sp3 $sp4;
        }
    }
</style>
