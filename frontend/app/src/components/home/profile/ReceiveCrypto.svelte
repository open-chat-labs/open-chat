<script lang="ts">
    import BitcoinAccountInfo from "@components/home/BitcoinAccountInfo.svelte";
    import {
        BTC_SYMBOL,
        cryptoBalance,
        cryptoLookup,
        ui,
        currentUser as user,
    } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../../i18n/i18n";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Translatable from "../../Translatable.svelte";
    import AccountInfo from "../AccountInfo.svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";

    interface Props {
        ledger: string;
        onClose: () => void;
    }

    let { ledger, onClose }: Props = $props();

    let error: string | undefined = $state(undefined);

    let tokenDetails = $derived($cryptoLookup[ledger]);
    let symbol = $derived(tokenDetails.symbol);
    let title = $derived(i18nKey(`cryptoAccount.receiveToken`, { symbol }));
    let userId = $derived($user.userId);

    function onBalanceRefreshed() {
        error = undefined;
    }

    function onBalanceRefreshError(err: string) {
        error = $_(err);
    }
</script>

<ModalContent>
    {#snippet header()}
        <span class="header">
            <div class="main-title"><Translatable resourceKey={title} /></div>
            <BalanceWithRefresh
                {ledger}
                value={$cryptoBalance[ledger]}
                label={i18nKey("cryptoAccount.shortBalanceLabel")}
                bold
                onRefreshed={onBalanceRefreshed}
                onError={onBalanceRefreshError} />
        </span>
    {/snippet}
    {#snippet body()}
        <form class="body">
            {#if symbol === BTC_SYMBOL}
                <BitcoinAccountInfo qrSize={"larger"} centered {userId} />
            {:else}
                <AccountInfo qrSize={"larger"} centered {ledger} />
            {/if}
            {#if error}
                <ErrorMessage>{error}</ErrorMessage>
            {/if}
        </form>
    {/snippet}
    {#snippet footer()}
        <span>
            <ButtonGroup>
                <Button tiny={ui.mobileWidth} onClick={onClose}
                    ><Translatable resourceKey={i18nKey("close")} /></Button>
            </ButtonGroup>
        </span>
    {/snippet}
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
