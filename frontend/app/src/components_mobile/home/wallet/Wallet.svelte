<script lang="ts">
    import type { PinOperation } from "@src/stores/pinNumber";
    import { Container, Logo, MenuItem, SectionHeader, Sheet } from "component-lib";
    import { pinNumberRequiredStore } from "openchat-client";
    import Cog from "svelte-material-icons/CogOutline.svelte";
    import ShieldPlusIcon from "svelte-material-icons/ShieldPlusOutline.svelte";
    import ShieldRefreshIcon from "svelte-material-icons/ShieldRefreshOutline.svelte";
    import ShieldRemoveIcon from "svelte-material-icons/ShieldRemoveOutline.svelte";
    import SwapVertical from "svelte-material-icons/SwapVertical.svelte";
    import TrayArrowDown from "svelte-material-icons/TrayArrowDown.svelte";
    import TrayArrowUp from "svelte-material-icons/TrayArrowUp.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import ManageAccounts from "../profile/ManageAccounts.svelte";
    import SetPinNumberModal from "../profile/SetPinNumberModal.svelte";
    import Accounts from "./Accounts.svelte";
    import BottomBar from "./BottomBar.svelte";
    import OverallBalance from "./OverallBalance.svelte";
    import TokenToggle from "./TokenToggle.svelte";
    import type { ConversionToken } from "./wallet";

    let pinAction: PinOperation | undefined = $state(undefined);
    let managing = $state(false);
    let selectedConversion: ConversionToken = $state("usd");
    let conversionOptions = [
        { id: "usd", label: "USD" },
        { id: "icp", label: "ICP" },
        { id: "btc", label: "BTC" },
        { id: "eth", label: "ETH" },
    ];

    function receive() {}
    function send() {}
    function swap() {}

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
        <MenuItem onclick={() => (pinAction = { kind: "set" })}>
            {#snippet icon(color, size)}
                <TrayArrowDown {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("cryptoAccount.receive")} />
        </MenuItem>
        <MenuItem onclick={receive}>
            {#snippet icon(color, size)}
                <TrayArrowUp {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("cryptoAccount.send")} />
        </MenuItem>
        <MenuItem onclick={send}>
            {#snippet icon(color, size)}
                <SwapVertical {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("cryptoAccount.swap")} />
        </MenuItem>
        {#if !$pinNumberRequiredStore}
            <MenuItem onclick={swap}>
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
    <BottomBar />
</Container>

{#if pinAction !== undefined}
    <Sheet>
        <SetPinNumberModal type={pinAction} onClose={() => (pinAction = undefined)} />
    </Sheet>
{/if}

{#if managing}
    <Sheet onDismiss={() => (managing = false)}>
        <ManageAccounts
            bind:selectedConversion
            {conversionOptions}
            onClose={() => (managing = false)} />
    </Sheet>
{/if}
