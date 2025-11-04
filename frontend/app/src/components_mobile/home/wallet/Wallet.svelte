<script lang="ts">
    import type { PinOperation } from "@src/stores/pinNumber";
    import { Container, Logo, MenuItem, SectionHeader, Sheet } from "component-lib";
    import { pinNumberRequiredStore } from "openchat-client";
    import Book from "svelte-material-icons/BookOpenOutline.svelte";
    import Cog from "svelte-material-icons/CogOutline.svelte";
    import ShieldPlusIcon from "svelte-material-icons/ShieldPlusOutline.svelte";
    import ShieldRefreshIcon from "svelte-material-icons/ShieldRefreshOutline.svelte";
    import ShieldRemoveIcon from "svelte-material-icons/ShieldRemoveOutline.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import ManageAccounts from "../profile/ManageAccounts.svelte";
    import SetPinNumberModal from "../profile/SetPinNumberModal.svelte";
    import Accounts from "./Accounts.svelte";
    import BottomBar from "./BottomBar.svelte";
    import OverallBalance from "./OverallBalance.svelte";
    import TokenToggle from "./TokenToggle.svelte";
    import type { ConversionToken } from "./walletState.svelte";

    let pinAction: PinOperation | undefined = $state(undefined);
    let managing = $state(false);
    let selectedConversion: ConversionToken = $state("usd");
    let conversionOptions = [
        { id: "usd", label: "USD" },
        { id: "icp", label: "ICP" },
        { id: "btc", label: "BTC" },
        { id: "eth", label: "ETH" },
    ];

    function onRefreshWallet() {
        console.log("Not sure what this does yet");
    }
</script>

<SectionHeader>
    {#snippet avatar()}
        <Logo />
    {/snippet}
    {#snippet title()}
        <Translatable resourceKey={i18nKey("wallet")} />
    {/snippet}

    {#snippet menu()}
        {#if !$pinNumberRequiredStore}
            <MenuItem onclick={() => (pinAction = { kind: "set" })}>
                {#snippet icon(color, size)}
                    <ShieldPlusIcon {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("pinNumber.setPin")} />
            </MenuItem>
        {:else}
            <MenuItem onclick={() => (pinAction = { kind: "change" })}>
                {#snippet icon(color, size)}
                    <ShieldRefreshIcon {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("pinNumber.changePin")} />
            </MenuItem>
            <MenuItem onclick={() => (pinAction = { kind: "clear" })}>
                {#snippet icon(color, size)}
                    <ShieldRemoveIcon {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("pinNumber.clearPin")} />
            </MenuItem>
        {/if}
        <MenuItem onclick={() => console.log("TODO - Manage addresses")}>
            {#snippet icon(color, size)}
                <Book {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("Manage addresses")} />
        </MenuItem>
        <MenuItem onclick={() => (managing = true)}>
            {#snippet icon(color, size)}
                <Cog {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("cryptoAccount.manage")} />
        </MenuItem>
    {/snippet}
</SectionHeader>

<Container
    gap={"lg"}
    height={{ kind: "fill" }}
    padding={"lg"}
    closeMenuOnScroll
    direction={"vertical"}>
    <TokenToggle options={conversionOptions} bind:selected={selectedConversion} />
    <OverallBalance {onRefreshWallet} {selectedConversion} />
    <Accounts bind:selectedConversion />
    <BottomBar {selectedConversion} />
</Container>

{#if pinAction !== undefined}
    <Sheet>
        <SetPinNumberModal type={pinAction} onClose={() => (pinAction = undefined)} />
    </Sheet>
{/if}

{#if managing}
    <Sheet onDismiss={() => (managing = false)}>
        <ManageAccounts bind:selectedConversion {conversionOptions} />
    </Sheet>
{/if}
