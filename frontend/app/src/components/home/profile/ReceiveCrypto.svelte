<script lang="ts">
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    import AccountInfo from "../AccountInfo.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import { currentUser as user, cryptoLookup, cryptoBalance } from "openchat-client";

    export let ledger: string;

    const dispatch = createEventDispatcher();

    let error: string | undefined = undefined;

    $: tokenDetails = $cryptoLookup[ledger];
    $: symbol = tokenDetails.symbol;
    $: howToBuyUrl = tokenDetails.howToBuyUrl;
    $: title = i18nKey(`cryptoAccount.receiveToken`, { symbol });

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
        <AccountInfo qrSize={"larger"} centered {ledger} user={$user} />
        <a rel="noreferrer" class="how-to" href={howToBuyUrl} target="_blank">
            <Translatable resourceKey={i18nKey("howToBuyToken", { token: symbol })} />
        </a>
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
