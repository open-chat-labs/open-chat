<script lang="ts">
    import { tweened } from "svelte/motion";
    import { quadOut } from "svelte/easing";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import type {
        OpenChat,
        CryptocurrencyDetails,
        Message,
        MessageContext,
        PendingCryptocurrencyTransfer,
    } from "openchat-client";
    import { E8S_PER_TOKEN, dollarExchangeRates } from "openchat-client";
    import Overlay from "../Overlay.svelte";
    import AccountInfo from "./AccountInfo.svelte";
    import ModalContent from "../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import BalanceWithRefresh from "./BalanceWithRefresh.svelte";
    import CryptoSelector from "./CryptoSelector.svelte";
    import { toastStore } from "../../stores/toast";

    const client = getContext<OpenChat>("client");
    const user = client.user;
    const dispatch = createEventDispatcher();

    export let ledger: string;
    export let messageContext: MessageContext;
    export let msg: Message;

    let refreshing = false;
    let error: string | undefined = undefined;
    let toppingUp = false;
    let tokenChanging = true;
    let balanceWithRefresh: BalanceWithRefresh;
    let selectedIncrement: Increment = 10; // TODO - remember this so we can re-use the last value
    let dollar: HTMLElement;
    let dollarTop = tweened(-1000);
    let dollarOpacity = tweened(0);
    let dollarScale = tweened(0);
    let busy = false;

    const increments: Increment[] = [10, 50, 100];
    type Increment = 10 | 50 | 100;

    let multipliers: Record<Increment, number> = {
        10: 1,
        50: 1,
        100: 1,
    };

    function amountLabel(n: Increment, multiplier: number): string {
        return `$${((n * multiplier) / 100).toFixed(2)}`;
    }

    $: lastCryptoSent = client.lastCryptoSent;
    $: cryptoBalanceStore = client.cryptoBalance;
    $: cryptoBalance = $cryptoBalanceStore[ledger] ?? BigInt(0);
    $: draftAmount = calculateAmount(
        selectedIncrement,
        tokenDetails,
        multipliers[selectedIncrement]
    );

    $: cryptoLookup = client.cryptoLookup;
    $: tokenDetails = $cryptoLookup[ledger];
    $: symbol = tokenDetails.symbol;
    $: howToBuyUrl = tokenDetails.howToBuyUrl;
    $: transferFees = tokenDetails.transferFee;
    $: remainingBalance =
        draftAmount > BigInt(0) ? cryptoBalance - draftAmount - transferFees : cryptoBalance;
    $: valid = error === undefined && !tokenChanging;
    $: zero = cryptoBalance <= transferFees && !tokenChanging;

    function calculateAmount(
        cents: Increment,
        token: CryptocurrencyDetails,
        multiplier: number
    ): bigint {
        const rate = dollarExchangeRates[token.symbol.toLowerCase()];
        if (rate === undefined) {
            throw new Error(`we don't have an exchange rate for the token: ${token.symbol}`);
        }
        const multiplied = cents * multiplier;
        const e8s = (multiplied / 100 / rate) * E8S_PER_TOKEN;
        return BigInt(Math.round(e8s));
    }

    function reset() {
        balanceWithRefresh.refresh();
    }

    function send() {
        busy = true;
        const transfer: PendingCryptocurrencyTransfer = {
            kind: "pending",
            ledger,
            token: symbol,
            recipient: msg.sender,
            amountE8s: draftAmount,
            feeE8s: transferFees,
            createdAtNanos: BigInt(Date.now()) * BigInt(1_000_000),
        };
        client
            .tipMessage(messageContext, msg.messageId, transfer)
            .then((resp) => {
                if (resp.kind === "success") {
                    toastStore.showSuccessToast("Fuck yeah");
                    lastCryptoSent.set(ledger);
                    dispatch("close");
                } else {
                    toastStore.showFailureToast("Fuck no");
                }
            })
            .finally(() => (busy = false));
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
            remainingBalance = BigInt(0);
            draftAmount = cryptoBalance - transferFees;
            if (draftAmount < 0) {
                draftAmount = BigInt(0);
            }
        }
    }

    $: {
        if (dollar) {
            dollar.style.setProperty("top", `${$dollarTop}px`);
            dollar.style.setProperty("opacity", `${$dollarOpacity}`);
            dollar.style.setProperty(
                "transform",
                `scale(${$dollarScale}) rotate(${$dollarScale}turn)`
            );
        }
    }

    function clickAmount(e: MouseEvent, increment: Increment) {
        const buttonRect = (e.target as HTMLElement).getBoundingClientRect();
        const hDiff = buttonRect.height - dollar.clientHeight;
        const wDiff = buttonRect.width - dollar.clientWidth;
        const relTop = buttonRect.top + hDiff / 2;
        const relLeft = buttonRect.left + wDiff / 2;
        dollarTop = tweened(relTop, {
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
        dollarTop.set(relTop - 300);
        dollarOpacity.set(0);
        dollarScale.set(2);
        dollar.style.left = `${relLeft}px`;

        if (increment !== selectedIncrement) {
            multipliers = {
                10: 1,
                50: 1,
                100: 1,
            };
        } else {
            multipliers[increment] += 1;
        }
        selectedIncrement = increment;
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
    <ModalContent>
        <span class="header" slot="header">
            <div class="left">
                <div class="main-title">
                    <div>{$_("tip.title")}</div>
                    <div>
                        <CryptoSelector bind:ledger />
                    </div>
                </div>
            </div>
            <BalanceWithRefresh
                bind:toppingUp
                bind:this={balanceWithRefresh}
                {ledger}
                value={remainingBalance}
                label={$_("cryptoAccount.shortBalanceLabel")}
                bold
                showTopUp
                on:refreshed={onBalanceRefreshed}
                on:error={onBalanceRefreshError} />
        </span>
        <form slot="body">
            <div class="body" class:zero={zero || toppingUp}>
                {#if zero || toppingUp}
                    <AccountInfo {ledger} {user} />
                    {#if zero}
                        <p>{$_("tokenTransfer.zeroBalance", { values: { token: symbol } })}</p>
                    {/if}
                    <p>{$_("tokenTransfer.makeDeposit")}</p>
                    <a rel="noreferrer" class="how-to" href={howToBuyUrl} target="_blank">
                        {$_("howToBuyToken", { values: { token: symbol } })}
                    </a>
                {:else}
                    <div class="amounts">
                        {#each increments as increment}
                            <button
                                class:disabled={calculateAmount(
                                    increment,
                                    tokenDetails,
                                    multipliers[increment]
                                ) >
                                    cryptoBalance - transferFees}
                                class:selected={selectedIncrement === increment}
                                on:click|preventDefault={(e) => clickAmount(e, increment)}
                                class="amount">
                                {$_(amountLabel(increment, multipliers[increment]))}
                            </button>
                        {/each}
                    </div>
                    {#if error}
                        <ErrorMessage>{$_(error)}</ErrorMessage>
                    {/if}
                {/if}
            </div>
        </form>
        <span slot="footer">
            <ButtonGroup>
                <Button small={!$mobileWidth} tiny={$mobileWidth} secondary on:click={cancel}
                    >{$_("cancel")}</Button>
                {#if toppingUp || zero}
                    <Button
                        small={!$mobileWidth}
                        disabled={refreshing}
                        loading={refreshing}
                        tiny={$mobileWidth}
                        on:click={reset}>{$_("refresh")}</Button>
                {:else}
                    <Button
                        small={!$mobileWidth}
                        disabled={!valid || busy}
                        loading={busy}
                        tiny={$mobileWidth}
                        on:click={send}>{$_("tokenTransfer.send")}</Button>
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
    }

    .amounts {
        display: flex;
        justify-content: space-evenly;
        gap: $sp2;
        padding: $sp5 0;

        .amount {
            $size: 100px;
            border-radius: $sp3;
            padding: $sp4;
            border: 1px solid var(--bd);
            transition: background 250ms ease-in-out, color 250ms ease-in-out;
            text-align: center;
            cursor: pointer;
            height: $size;
            width: $size;
            border-radius: 50%;
            display: grid;
            align-content: center;

            @include font(book, normal, fs-120);

            @include mobile() {
                $size: 100px;
                height: $size;
                width: $size;
            }

            &.selected {
                color: var(--button-txt);
                background: var(--button-bg);
                &:hover {
                    background: var(--button-hv);
                }
            }

            &.disabled {
                color: var(--txt-light);
                cursor: not-allowed;
            }
        }
    }

    .how-to {
        margin-top: $sp4;
    }
</style>
