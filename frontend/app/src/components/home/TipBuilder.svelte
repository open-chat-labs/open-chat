<script lang="ts">
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import type { OpenChat } from "openchat-client";
    import {
        E8S_PER_TOKEN,
        type CryptocurrencyDetails,
        type Message,
        type MessageContext,
        type Tip,
    } from "openchat-shared";
    import Overlay from "../Overlay.svelte";
    import AccountInfo from "./AccountInfo.svelte";
    import ModalContent from "../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext } from "svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import BalanceWithRefresh from "./BalanceWithRefresh.svelte";
    import CryptoSelector from "./CryptoSelector.svelte";

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
    let selectedMagnitude: Magnitude = 10; // TODO - remember this so we can re-use the last value

    const magnitudes: Magnitude[] = [10, 50, 100];
    type Magnitude = 10 | 50 | 100;

    function amountLabel(n: Magnitude): string {
        return `$${(n / 100).toFixed(2)}`;
    }

    $: lastCryptoSent = client.lastCryptoSent;
    $: cryptoBalanceStore = client.cryptoBalance;
    $: cryptoBalance = $cryptoBalanceStore[ledger] ?? BigInt(0);
    $: draftAmount = calculateAmount(selectedMagnitude, tokenDetails);

    $: cryptoLookup = client.cryptoLookup;
    $: tokenDetails = $cryptoLookup[ledger];
    $: symbol = tokenDetails.symbol;
    $: howToBuyUrl = tokenDetails.howToBuyUrl;
    $: transferFees = tokenDetails.transferFee;
    $: remainingBalance =
        draftAmount > BigInt(0) ? cryptoBalance - draftAmount - transferFees : cryptoBalance;
    $: valid = error === undefined && !tokenChanging;
    $: zero = cryptoBalance <= transferFees && !tokenChanging;

    const exchangeRates: Record<string, number> = {
        icp: 3,
    };

    function calculateAmount(cents: Magnitude, token: CryptocurrencyDetails): bigint {
        const rate = exchangeRates[token.symbol.toLowerCase()];
        if (rate === undefined) {
            throw new Error(`we don't have an exchange rate for the token: ${token.symbol}`);
        }
        const e8s = (cents / 100) * rate * E8S_PER_TOKEN;
        return BigInt(Math.round(e8s));
    }

    function reset() {
        balanceWithRefresh.refresh();
    }

    function send() {
        const tip: Tip = {
            messageId: msg.messageId,
            ledger,
            token: symbol,
            amountE8s: draftAmount,
            feeE8s: transferFees,
        };
        client.tipMessage(messageContext, tip);
        lastCryptoSent.set(ledger);
        dispatch("close");
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
</script>

<Overlay dismissible>
    <ModalContent>
        <span class="header" slot="header">
            <div class="left">
                <div class="main-title">
                    <div>{$_("tokenTransfer.send")}</div>
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
                        {#each magnitudes as magnitude}
                            <div
                                role="button"
                                tabindex="0"
                                class:disabled={calculateAmount(magnitude, tokenDetails) >
                                    cryptoBalance - transferFees}
                                class:selected={selectedMagnitude === magnitude}
                                on:click={() => (selectedMagnitude = magnitude)}
                                class="amount">
                                {$_(amountLabel(magnitude))}
                            </div>
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
                        disabled={!valid}
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
