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
    import { Cryptocurrency, cryptoLookup } from "openchat-client";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import type { OpenChat } from "openchat-client";
    import SendCrypto from "./SendCrypto.svelte";

    export let token: Cryptocurrency;
    export let mode: "send" | "deposit";

    const client = getContext<OpenChat>("client");
    const user = client.user;
    const dispatch = createEventDispatcher();

    $: title =
        mode === "deposit"
            ? $_("cryptoAccount.depositToken", { values: { symbol: token.toUpperCase() } })
            : $_("cryptoAccount.sendToken", { values: { symbol: token.toUpperCase() } });
    $: cryptoBalance = client.cryptoBalance;

    let sendCrypto: SendCrypto;
    let error: string | undefined = undefined;
    let amountToWithdrawE8s = BigInt(0);
    let balanceWithRefresh: BalanceWithRefresh;

    $: transferFees = cryptoLookup[token].transferFeesE8s;
    $: symbol = cryptoLookup[token].symbol;
    $: howToBuyUrl = cryptoLookup[token].howToBuyUrl;

    $: remainingBalanceE8s =
        amountToWithdrawE8s > BigInt(0)
            ? $cryptoBalance[token] - amountToWithdrawE8s - transferFees
            : $cryptoBalance[token];

    function onBalanceRefreshed() {
        error = undefined;
    }

    function onBalanceRefreshError(ev: CustomEvent<string>) {
        error = ev.detail;
    }
</script>

<Overlay on:close dismissible={true}>
    <ModalContent>
        <span class="header" slot="header">
            <div class="main-title">{title}</div>
            <BalanceWithRefresh
                bind:this={balanceWithRefresh}
                {token}
                value={remainingBalanceE8s}
                label={$_("cryptoAccount.shortBalanceLabel")}
                minDecimals={2}
                bold
                on:refreshed={onBalanceRefreshed}
                on:error={onBalanceRefreshError} />
        </span>
        <form class={`body ${mode}`} slot="body">
            {#if mode === "deposit"}
                <AccountInfo qrSize={"larger"} centered {token} {user} />
                <a rel="noreferrer" class="how-to" href={howToBuyUrl} target="_blank">
                    {$_("howToBuyToken", { values: { token: symbol.toUpperCase() } })}
                </a>
            {/if}

            {#if mode === "send"}
                <SendCrypto
                    bind:this={sendCrypto}
                    on:error={(ev) => (error = ev.detail)}
                    on:refreshBalance={() => balanceWithRefresh.refresh()}
                    {token}
                    bind:amountToWithdrawE8s />
            {/if}
            {#if error}
                <ErrorMessage>{$_(error)}</ErrorMessage>
            {/if}
        </form>
        <span slot="footer">
            <ButtonGroup>
                {#if mode === "send"}
                    <Button secondary tiny={$mobileWidth} on:click={() => sendCrypto?.scan()}
                        >{$_("cryptoAccount.scan")}</Button>
                {/if}
                <Button tiny={$mobileWidth} on:click={() => dispatch("close")}
                    >{$_("close")}</Button>
            </ButtonGroup>
        </span>
    </ModalContent>
</Overlay>

<style type="text/scss">
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

        &.deposit {
            align-items: center;
        }
    }
</style>
