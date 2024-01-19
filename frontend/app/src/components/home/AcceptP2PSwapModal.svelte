<script lang="ts">
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import type { OpenChat, UserSummary } from "openchat-client";
    import Overlay from "../Overlay.svelte";
    import AccountInfo from "./AccountInfo.svelte";
    import ModalContent from "../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext } from "svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import BalanceWithRefresh from "./BalanceWithRefresh.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let ledger: string;
    export let amount: bigint;

    let refreshing = false;
    let error: string | undefined = undefined;
    let balanceWithRefresh: BalanceWithRefresh;
    let receiver: UserSummary | undefined = undefined;
    let validAmount: boolean = false;

    $: user = client.user;
    $: cryptoBalanceStore = client.cryptoBalance;
    $: cryptoBalance = $cryptoBalanceStore[ledger] ?? BigInt(0);
    $: cryptoLookup = client.enhancedCryptoLookup;
    $: tokenDetails = $cryptoLookup[ledger];
    $: symbol = tokenDetails.symbol;
    $: howToBuyUrl = tokenDetails.howToBuyUrl;
    $: transferFees = BigInt(2) * tokenDetails.transferFee;
    $: valid = error === undefined && validAmount && receiver !== undefined;
    $: zero = cryptoBalance <= transferFees;
    $: amountText = client.formatTokens(amount, tokenDetails.decimals);

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
            <BalanceWithRefresh
                bind:this={balanceWithRefresh}
                {ledger}
                value={cryptoBalance}
                label={i18nKey("cryptoAccount.shortBalanceLabel")}
                bold />
        </span>
        <form slot="body">
            <div class="body" class:zero>
                {#if zero}
                    <AccountInfo {ledger} user={$user} />
                    {#if zero}
                        <p>
                            <Translatable
                                resourceKey={i18nKey("tokenTransfer.zeroBalance", {
                                    token: symbol,
                                })} />
                        </p>
                    {/if}
                    <p><Translatable resourceKey={i18nKey("tokenTransfer.makeDeposit")} /></p>
                    <a rel="noreferrer" class="how-to" href={howToBuyUrl} target="_blank">
                        <Translatable resourceKey={i18nKey("howToBuyToken", { token: symbol })} />
                    </a>
                {:else}
                    {i18nKey("p2pSwap.confirmAccept", {
                        amount: amountText,
                        token: symbol,
                    })}
                {/if}
            </div>
        </form>
        <span slot="footer">
            <ButtonGroup>
                <Button small={!$mobileWidth} tiny={$mobileWidth} secondary on:click={cancel}
                    ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                {#if zero}
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
</style>
