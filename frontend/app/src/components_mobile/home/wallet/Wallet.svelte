<script lang="ts">
    import type { PinOperation } from "@src/stores/pinNumber";
    import { hideTokenBalances } from "@src/stores/settings";
    import { Container, Logo, MenuItem, SectionHeader, Sheet } from "component-lib";
    import { pinNumberRequiredStore } from "openchat-client";
    import { _ } from "svelte-i18n";
    import EyeOff from "svelte-material-icons/EyeOffOutline.svelte";
    import Eye from "svelte-material-icons/EyeOutline.svelte";
    import ShieldPlusIcon from "svelte-material-icons/ShieldPlus.svelte";
    import ShieldRefreshIcon from "svelte-material-icons/ShieldRefresh.svelte";
    import ShieldRemoveIcon from "svelte-material-icons/ShieldRemove.svelte";
    import TuneVertical from "svelte-material-icons/TuneVertical.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import Accounts from "../profile/Accounts.svelte";
    import ManageAccounts from "../profile/ManageAccounts.svelte";
    import SetPinNumberModal from "../profile/SetPinNumberModal.svelte";

    let pinAction: PinOperation | undefined = $state(undefined);
    let managing = $state(false);
    let selectedConversion: "none" | "usd" | "icp" | "btc" | "eth" = $state("none");
    let conversionOptions = [
        { id: "none", label: $_("cryptoAccount.tokens") },
        { id: "usd", label: "USD" },
        { id: "icp", label: "ICP" },
        { id: "btc", label: "BTC" },
        { id: "eth", label: "ETH" },
    ];
</script>

<SectionHeader onAction={() => hideTokenBalances.toggle()}>
    {#snippet avatar()}
        <Logo />
    {/snippet}
    {#snippet title()}
        <Translatable resourceKey={i18nKey("wallet")} />
    {/snippet}

    {#snippet action()}
        {#if $hideTokenBalances}
            <Eye color={"var(--icon-txt)"} />
        {:else}
            <EyeOff color={"var(--icon-txt)"} />
        {/if}
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
        <MenuItem onclick={() => (managing = true)}>
            {#snippet icon(color, size)}
                <TuneVertical {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("cryptoAccount.manage")} />
        </MenuItem>
    {/snippet}
</SectionHeader>

<Container height={{ kind: "fill" }} padding={"lg"} closeMenuOnScroll direction={"vertical"}>
    <Accounts bind:selectedConversion {conversionOptions} hideTokenBalances={$hideTokenBalances} />
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
