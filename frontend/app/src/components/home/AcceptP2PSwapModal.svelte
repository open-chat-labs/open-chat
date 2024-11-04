<script lang="ts">
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import type { OpenChat } from "openchat-client";
    import Overlay from "../Overlay.svelte";
    import AccountInfo from "./AccountInfo.svelte";
    import ModalContent from "../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext } from "svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import BalanceWithRefresh from "./BalanceWithRefresh.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import {
        currentUser as user,
        cryptoBalance as cryptoBalanceStore,
        enhancedCryptoLookup as cryptoLookup,
    } from "openchat-client";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let ledger0: string;
    export let ledger1: string;
    export let amount0: bigint;
    export let amount1: bigint;

    let refreshing = false;
    let error: string | undefined = undefined;
    let balanceWithRefresh: BalanceWithRefresh;

    $: cryptoBalance = $cryptoBalanceStore[ledger1] ?? BigInt(0);
    $: tokenDetails0 = $cryptoLookup[ledger0];
    $: tokenDetails1 = $cryptoLookup[ledger1];
    $: symbol0 = tokenDetails0.symbol;
    $: symbol1 = tokenDetails1.symbol;
    $: howToBuyUrl = tokenDetails1.howToBuyUrl;
    $: transferFees = BigInt(2) * tokenDetails1.transferFee;
    $: valid = error === undefined && !insufficient;
    $: insufficient = cryptoBalance <= amount1 + transferFees;
    $: amount0Text = client.formatTokens(amount0, tokenDetails0.decimals);
    $: amount1Text = client.formatTokens(amount1 + transferFees, tokenDetails1.decimals);

    function reset() {
        balanceWithRefresh.refresh();
    }

    function cancel() {
        dispatch("close");
    }

    function accept() {
        dispatch("accept");
    }
</script>

<Overlay dismissible>
    <ModalContent>
        <span class="header" slot="header">
            <div>
                <Translatable
                    resourceKey={i18nKey(
                        insufficient ? "p2pSwap.insufficientBalance" : "areYouSure",
                    )} />
            </div>
            <BalanceWithRefresh
                bind:this={balanceWithRefresh}
                ledger={ledger1}
                value={cryptoBalance}
                label={i18nKey("p2pSwap.tokenBalance", { token: symbol1 })}
                bold />
        </span>
        <form slot="body">
            <div class="body" class:insufficient>
                {#if insufficient}
                    <p class="info">
                        <Translatable
                            resourceKey={i18nKey("p2pSwap.insufficientBalanceMessage", {
                                amount: amount1Text,
                                token: symbol1,
                            })} />
                    </p>
                    <AccountInfo ledger={ledger1} user={$user} />
                    <p><Translatable resourceKey={i18nKey("tokenTransfer.makeDeposit")} /></p>
                    <a rel="noreferrer" class="how-to" href={howToBuyUrl} target="_blank">
                        <Translatable resourceKey={i18nKey("howToBuyToken", { token: symbol1 })} />
                    </a>
                {:else}
                    <Translatable
                        resourceKey={i18nKey("p2pSwap.confirmAccept", {
                            amount: amount1Text,
                            token: symbol1,
                            amountOther: amount0Text,
                            tokenOther: symbol0,
                        })} />
                {/if}
            </div>
        </form>
        <span slot="footer">
            <ButtonGroup>
                <Button small={!$mobileWidth} tiny={$mobileWidth} secondary on:click={cancel}
                    ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                {#if insufficient}
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
                        on:click={accept}><Translatable resourceKey={i18nKey("yes")} /></Button>
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
    }

    .body {
        transition: background-color 100ms ease-in-out;
        @include font(book, normal, fs-100, 28);
    }

    .how-to {
        margin-top: $sp4;
    }

    .info {
        margin-bottom: $sp3;
    }
</style>
