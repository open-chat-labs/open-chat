<script lang="ts">
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import type { OpenChat } from "openchat-client";
    import Overlay from "../Overlay.svelte";
    import AccountInfo from "./AccountInfo.svelte";
    import ModalContent from "../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
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

    interface Props {
        ledger0: string;
        ledger1: string;
        amount0: bigint;
        amount1: bigint;
        onClose: () => void;
        onAccept: () => void;
    }

    let { ledger0, ledger1, amount0, amount1, onClose, onAccept }: Props = $props();

    let refreshing = false;
    let error: string | undefined = undefined;
    //@ts-ignore
    let balanceWithRefresh: BalanceWithRefresh;

    function reset() {
        balanceWithRefresh.refresh();
    }

    let cryptoBalance = $derived($cryptoBalanceStore[ledger1] ?? BigInt(0));
    let tokenDetails0 = $derived($cryptoLookup[ledger0]);
    let tokenDetails1 = $derived($cryptoLookup[ledger1]);
    let symbol0 = $derived(tokenDetails0.symbol);
    let symbol1 = $derived(tokenDetails1.symbol);
    let transferFees = $derived(BigInt(2) * tokenDetails1.transferFee);
    let insufficient = $derived(cryptoBalance <= amount1 + transferFees);
    let valid = $derived(error === undefined && !insufficient);
    let amount0Text = $derived(client.formatTokens(amount0, tokenDetails0.decimals));
    let amount1Text = $derived(client.formatTokens(amount1 + transferFees, tokenDetails1.decimals));
</script>

<Overlay dismissible>
    <ModalContent>
        {#snippet header()}
            <span class="header">
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
        {/snippet}
        {#snippet body()}
            <form>
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
        {/snippet}
        {#snippet footer()}
            <span>
                <ButtonGroup>
                    <Button small={!$mobileWidth} tiny={$mobileWidth} secondary on:click={onClose}
                        ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                    {#if insufficient}
                        <Button
                            small={!$mobileWidth}
                            disabled={refreshing}
                            loading={refreshing}
                            tiny={$mobileWidth}
                            on:click={reset}
                            ><Translatable resourceKey={i18nKey("refresh")} /></Button>
                    {:else}
                        <Button
                            small={!$mobileWidth}
                            disabled={!valid}
                            tiny={$mobileWidth}
                            on:click={onAccept}
                            ><Translatable resourceKey={i18nKey("yes")} /></Button>
                    {/if}
                </ButtonGroup>
            </span>
        {/snippet}
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
