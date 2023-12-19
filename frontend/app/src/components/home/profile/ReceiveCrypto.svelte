<script lang="ts">
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext } from "svelte";
    import AccountInfo from "../AccountInfo.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import type { OpenChat } from "openchat-client";

    export let ledger: string;

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let error: string | undefined = undefined;

    $: user = client.user;
    $: cryptoLookup = client.cryptoLookup;
    $: tokenDetails = $cryptoLookup[ledger];
    $: symbol = tokenDetails.symbol;
    $: howToBuyUrl = tokenDetails.howToBuyUrl;
    $: title = $_(`cryptoAccount.receiveToken`, { values: { symbol } });
    $: cryptoBalance = client.cryptoBalance;

    function onBalanceRefreshed() {
        error = undefined;
    }

    function onBalanceRefreshError(ev: CustomEvent<string>) {
        error = $_(ev.detail);
    }
</script>

<ModalContent>
    <span class="header" slot="header">
        <div class="main-title">{title}</div>
        <BalanceWithRefresh
            {ledger}
            value={$cryptoBalance[ledger]}
            label={$_("cryptoAccount.shortBalanceLabel")}
            bold
            on:refreshed={onBalanceRefreshed}
            on:error={onBalanceRefreshError} />
    </span>
    <form class="body" slot="body">
        <AccountInfo qrSize={"larger"} centered {ledger} user={$user} />
        <a rel="noreferrer" class="how-to" href={howToBuyUrl} target="_blank">
            {$_("howToBuyToken", { values: { token: symbol } })}
        </a>
        {#if error}
            <ErrorMessage>{error}</ErrorMessage>
        {/if}
    </form>
    <span slot="footer">
        <ButtonGroup>
            <Button tiny={$mobileWidth} on:click={() => dispatch("close")}>{$_("close")}</Button>
        </ButtonGroup>
    </span>
</ModalContent>

<style lang="scss">
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
        align-items: center;
    }
</style>
