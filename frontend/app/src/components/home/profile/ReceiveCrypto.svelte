<script lang="ts">
    import {
        cryptoBalanceStore,
        cryptoLookup,
        mobileWidth,
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
    import { onDestroy, onMount } from "svelte";

    interface Props {
        ledger: string;
        onClose: () => void;
    }

    let { ledger, onClose }: Props = $props();

    let error: string | undefined = $state(undefined);

    let tokenDetails = $derived($cryptoLookup.get(ledger)!);
    let symbol = $derived(tokenDetails.symbol);
    let title = $derived(i18nKey(`cryptoAccount.receiveToken`, { symbol }));

    let balanceWithRefresh: BalanceWithRefresh;
    let timeoutId: number | undefined = undefined;

    onMount(() => runRefreshBalanceJob());
    onDestroy(() => window.clearTimeout(timeoutId));

    // Start a job to refresh the balance every 10 seconds
    function runRefreshBalanceJob() {
        balanceWithRefresh?.refresh().finally(() => timeoutId = window.setTimeout(() => runRefreshBalanceJob(), 10_000));
    }

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
            <BalanceWithRefresh bind:this={balanceWithRefresh}
                {ledger}
                value={$cryptoBalanceStore.get(ledger) ?? 0n}
                label={i18nKey("cryptoAccount.shortBalanceLabel")}
                bold
                onRefreshed={onBalanceRefreshed}
                onError={onBalanceRefreshError} />
        </span>
    {/snippet}
    {#snippet body()}
        <form class="body">
            <AccountInfo qrSize={"larger"} centered {ledger} />
            {#if error}
                <ErrorMessage>{error}</ErrorMessage>
            {/if}
        </form>
    {/snippet}
    {#snippet footer()}
        <span>
            <ButtonGroup>
                <Button tiny={$mobileWidth} onClick={onClose}
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
