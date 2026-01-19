<script lang="ts">
    import { Container, Logo, MenuItem, SectionHeader } from "component-lib";
    import { namedAccountsStore, OpenChat, publish } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import Accounts from "./Accounts.svelte";
    import BottomBar from "./BottomBar.svelte";
    import OverallBalance from "./OverallBalance.svelte";
    import TokenToggle from "./TokenToggle.svelte";
    import type { ConversionToken } from "./walletState.svelte";

    const client = getContext<OpenChat>("client");

    let selectedConversion: ConversionToken = $state("usd");
    let conversionOptions = [
        { id: "usd", label: "USD" },
        { id: "icp", label: "ICP" },
        { id: "btc", label: "BTC" },
        { id: "eth", label: "ETH" },
    ];

    let refreshing = $state(false);
    function onRefreshWallet() {
        refreshing = true;
        client.refreshBalancesInSeries().then(() => {
            refreshing = false;
        });
    }

    onMount(async () => {
        const accounts = await client.loadSavedCryptoAccounts();
        namedAccountsStore.set(accounts);
    });
</script>

<SectionHeader>
    {#snippet avatar()}
        <Logo />
    {/snippet}
    {#snippet title()}
        <Translatable resourceKey={i18nKey("wallet")} />
    {/snippet}

    {#snippet menu()}
        <MenuItem onclick={() => publish("manageRecipients")}>
            <Translatable resourceKey={i18nKey("Manage recipients")} />
        </MenuItem>
        <MenuItem onclick={() => publish("walletSettings")}>
            <Translatable resourceKey={i18nKey("Settings")} />
        </MenuItem>
    {/snippet}
</SectionHeader>

<Container height={"fill"} closeMenuOnScroll direction={"vertical"}>
    <Container
        height={"fill"}
        direction={"vertical"}
        gap={"lg"}
        padding={["lg", "zero", "zero"]}
        overflow="auto">
        <TokenToggle options={conversionOptions} bind:selected={selectedConversion} />
        <OverallBalance {onRefreshWallet} refreshingWallet={refreshing} {selectedConversion} />
        <Accounts bind:selectedConversion />
    </Container>
    <BottomBar {selectedConversion} />
</Container>
