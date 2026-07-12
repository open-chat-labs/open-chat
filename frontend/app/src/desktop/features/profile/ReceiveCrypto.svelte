<script lang="ts">
    import {
        cryptoBalanceStore,
        cryptoLookup,
        mobileWidth,
        Poller,
    } from "@client";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "@src/i18n/i18n";
    import Button from "@src/ui/Button.svelte";
    import ButtonGroup from "@src/ui/ButtonGroup.svelte";
    import ErrorMessage from "@src/desktop/shared/ErrorMessage.svelte";
    import ModalContent from "@src/ui/ModalContent.svelte";
    import Translatable from "@src/ui/Translatable.svelte";
    import AccountInfo from "@src/desktop/shared/AccountInfo.svelte";
    import BalanceWithRefresh from "@src/desktop/shared/BalanceWithRefresh.svelte";
    import { onDestroy } from "svelte";

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

    const refreshBalancePoller = new Poller(() => balanceWithRefresh?.refresh(), 10_000);

    onDestroy(() => refreshBalancePoller.stop());

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
                bind:this={balanceWithRefresh}
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
