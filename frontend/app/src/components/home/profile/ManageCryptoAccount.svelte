<script lang="ts">
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext } from "svelte";
    import AccountInfo from "../AccountInfo.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import type { InterpolationValues, OpenChat } from "openchat-client";
    import SendCrypto from "./SendCrypto.svelte";
    import SwapCrypto from "./SwapCrypto.svelte";

    export let ledger: string;
    export let mode: "send" | "receive" | "swap";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let sendCrypto: SendCrypto;
    let swapCrypto: SwapCrypto;
    let error: string | undefined = undefined;
    let amountToSend = BigInt(0);
    let balanceWithRefresh: BalanceWithRefresh;
    let busy = false;
    let capturingAccount = false;
    let valid = false;
    let swapStep: "quote" | "swap";

    $: user = client.user;
    $: cryptoLookup = client.cryptoLookup;
    $: tokenDetails = $cryptoLookup[ledger];
    $: transferFees = tokenDetails.transferFee;
    $: symbol = tokenDetails.symbol;
    $: howToBuyUrl = tokenDetails.howToBuyUrl;
    $: title = $_(`cryptoAccount.${mode}Token`, { values: { symbol } });
    $: cryptoBalance = client.cryptoBalance;
    $: secondaryButtonText = $_(
        capturingAccount ? "noThanks" : mode !== "receive" ? "close" : "cancel",
    );
    $: primaryButtonText = $_(
        mode === "swap" && swapStep === "quote"
            ? "tokenSwap.quote"
            : mode === "swap"
              ? "tokenSwap.title"
              : capturingAccount
                ? "tokenTransfer.saveAccount"
                : "tokenTransfer.send",
    );

    $: remainingBalance =
        amountToSend > BigInt(0)
            ? $cryptoBalance[ledger] - amountToSend - transferFees
            : $cryptoBalance[ledger];

    function onBalanceRefreshed() {
        error = undefined;
    }

    function onBalanceRefreshError(ev: CustomEvent<string>) {
        error = $_(ev.detail);
    }

    function onError(ev: CustomEvent<{ error: string; values?: InterpolationValues } | undefined>) {
        if (ev.detail === undefined) {
            error = undefined;
        } else {
            error = $_(ev.detail.error, ev.detail.values);
        }
    }

    function onPrimaryClick() {
        busy = true;
        if (sendCrypto) {
            if (capturingAccount) {
                sendCrypto.saveAccount();
            } else {
                sendCrypto.send();
            }
        } else if (swapCrypto) {
            if (swapStep === "quote") {
                swapCrypto.quote();
            } else {
                swapCrypto.swap();
            }
        }
    }

    function onSecondaryClick() {
        dispatch("close");
    }
</script>

<Overlay on:close dismissible>
    <ModalContent>
        <span class="header" slot="header">
            <div class="main-title">{title}</div>
            <BalanceWithRefresh
                bind:this={balanceWithRefresh}
                {ledger}
                value={remainingBalance}
                label={$_("cryptoAccount.shortBalanceLabel")}
                minDecimals={2}
                bold
                on:refreshed={onBalanceRefreshed}
                on:error={onBalanceRefreshError} />
        </span>
        <form class={`body ${mode}`} slot="body">
            {#if mode === "receive"}
                <AccountInfo qrSize={"larger"} centered {ledger} user={$user} />
                <a rel="noreferrer" class="how-to" href={howToBuyUrl} target="_blank">
                    {$_("howToBuyToken", { values: { token: symbol } })}
                </a>
            {:else if mode === "send"}
                <SendCrypto
                    bind:this={sendCrypto}
                    bind:busy
                    bind:capturingAccount
                    bind:valid
                    on:close
                    on:error={onError}
                    on:refreshBalance={() => balanceWithRefresh.refresh()}
                    {ledger}
                    bind:amountToSend />
            {:else if mode === "swap"}
                <SwapCrypto
                    bind:this={swapCrypto}
                    bind:busy
                    bind:valid
                    bind:swapStep
                    on:close
                    on:error={onError}
                    ledgerIn={ledger}
                    bind:amountIn={amountToSend} />
            {/if}
            {#if error}
                <ErrorMessage>{error}</ErrorMessage>
            {/if}
        </form>
        <span slot="footer">
            <ButtonGroup>
                <Button
                    secondary={mode !== "receive"}
                    tiny={$mobileWidth}
                    on:click={onSecondaryClick}>{secondaryButtonText}</Button>
                {#if mode !== "receive"}
                    <Button
                        disabled={busy || !valid}
                        loading={busy}
                        tiny={$mobileWidth}
                        on:click={onPrimaryClick}>{primaryButtonText}</Button>
                {/if}
            </ButtonGroup>
        </span>
    </ModalContent>
</Overlay>

<style lang="scss">
    .title {
        @include font(bold, normal, fs-120);
        margin-bottom: $sp4;
    }

    .header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: $sp2;

        .main-title {
            flex: auto;
        }
    }
    .how-to {
        margin-top: $sp3;
    }

    .body {
        display: flex;
        flex-direction: column;

        &.receive {
            align-items: center;
        }
    }
</style>
