<script lang="ts">
    import { CommonButton, Container, Title } from "component-lib";
    import { cryptoBalanceStore, cryptoLookup, Poller } from "openchat-client";
    import { onDestroy } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../../i18n/i18n";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Translatable from "../../Translatable.svelte";
    import AccountInfo from "../AccountInfo.svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";

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

<Container gap={"lg"} padding={"xl"} direction={"vertical"}>
    <Container crossAxisAlignment={"center"}>
        <Title fontWeight={"bold"}>
            <Translatable resourceKey={title} />
        </Title>
        <BalanceWithRefresh
            bind:this={balanceWithRefresh}
            {ledger}
            value={$cryptoBalanceStore.get(ledger) ?? 0n}
            label={i18nKey("cryptoAccount.shortBalanceLabel")}
            bold
            onRefreshed={onBalanceRefreshed}
            onError={onBalanceRefreshError} />
    </Container>
    <Container mainAxisAlignment={"center"}>
        <AccountInfo qrSize={"larger"} centered {ledger} />
        {#if error}
            <ErrorMessage>{error}</ErrorMessage>
        {/if}
    </Container>
    <Container mainAxisAlignment={"end"}>
        <CommonButton mode={"active"} size={"medium"} onClick={onClose}>
            <Translatable resourceKey={i18nKey("close")} />
        </CommonButton>
    </Container>
</Container>
