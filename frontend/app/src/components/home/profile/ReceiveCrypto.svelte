<script lang="ts">
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import ModalContent from "../../ModalContentLegacy.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    import AccountInfo from "../AccountInfo.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import { BTC_SYMBOL, currentUser as user, cryptoLookup, cryptoBalance } from "openchat-client";
    import BitcoinAccountInfo from "@components/home/BitcoinAccountInfo.svelte";

    export let ledger: string;

    const dispatch = createEventDispatcher();

    let error: string | undefined = undefined;

    $: tokenDetails = $cryptoLookup[ledger];
    $: symbol = tokenDetails.symbol;
    $: title = i18nKey(`cryptoAccount.receiveToken`, { symbol });
    $: userId = $user.userId;

    function onBalanceRefreshed() {
        error = undefined;
    }

    function onBalanceRefreshError(ev: CustomEvent<string>) {
        error = $_(ev.detail);
    }
</script>

<ModalContent>
    <span class="header" slot="header">
        <div class="main-title"><Translatable resourceKey={title} /></div>
        <BalanceWithRefresh
            {ledger}
            value={$cryptoBalance[ledger]}
            label={i18nKey("cryptoAccount.shortBalanceLabel")}
            bold
            on:refreshed={onBalanceRefreshed}
            on:error={onBalanceRefreshError} />
    </span>
    <form class="body" slot="body">
        {#if symbol === BTC_SYMBOL}
            <BitcoinAccountInfo qrSize={"larger"} centered {userId} />
        {:else}
            <AccountInfo qrSize={"larger"} centered {ledger} user={$user} />
        {/if}
        {#if error}
            <ErrorMessage>{error}</ErrorMessage>
        {/if}
    </form>
    <span slot="footer">
        <ButtonGroup>
            <Button tiny={$mobileWidth} on:click={() => dispatch("close")}
                ><Translatable resourceKey={i18nKey("close")} /></Button>
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
