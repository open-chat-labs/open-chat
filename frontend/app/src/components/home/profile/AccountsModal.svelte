<script lang="ts">
    import Hamburger from "svelte-material-icons/Menu.svelte";
    import TuneVertical from "svelte-material-icons/TuneVertical.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import ModalContent from "../../ModalContent.svelte";
    import ShieldPlusIcon from "svelte-material-icons/ShieldPlus.svelte";
    import ShieldRemoveIcon from "svelte-material-icons/ShieldRemove.svelte";
    import ShieldRefreshIcon from "svelte-material-icons/ShieldRefresh.svelte";
    import WalletIcon from "svelte-material-icons/WalletOutline.svelte";
    import Accounts from "./Accounts.svelte";
    import Button from "../../Button.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import MenuIcon from "../../MenuIcon.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../../stores/iconSize";
    import Overlay from "../../Overlay.svelte";
    import SetPinNumberModal from "./SetPinNumberModal.svelte";
    import ManageAccounts from "./ManageAccounts.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import type { PinOperation } from "../../../stores/pinNumber";
    import { pinNumberRequiredStore } from "openchat-client";

    interface Props {
        onClose: () => void;
    }
    let { onClose }: Props = $props();
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

<ModalContent {onClose}>
    {#snippet header()}
        <div class="header">
            <div class="title">
                <WalletIcon size={"1.2em"} color={"var(--txt)"} />
                <Translatable resourceKey={i18nKey("wallet")} />
            </div>
            <div class="menu">
                <MenuIcon position={"bottom"} align={"end"}>
                    {#snippet menuIcon()}
                        <div>
                            <HoverIcon title={$_("chatMenu")}>
                                <Hamburger color={"var(--icon-txt)"} />
                            </HoverIcon>
                        </div>
                    {/snippet}
                    {#snippet menuItems()}
                        <div>
                            <Menu>
                                {#if !$pinNumberRequiredStore}
                                    <MenuItem onclick={() => (pinAction = { kind: "set" })}>
                                        {#snippet icon()}
                                            <ShieldPlusIcon
                                                size={$iconSize}
                                                color={"var(--icon-inverted-txt)"} />
                                        {/snippet}
                                        {#snippet text()}
                                            <div>
                                                <Translatable
                                                    resourceKey={i18nKey("pinNumber.setPin")} />
                                            </div>
                                        {/snippet}
                                    </MenuItem>
                                {:else}
                                    <MenuItem onclick={() => (pinAction = { kind: "change" })}>
                                        {#snippet icon()}
                                            <ShieldRefreshIcon
                                                size={$iconSize}
                                                color={"var(--icon-inverted-txt)"} />
                                        {/snippet}
                                        {#snippet text()}
                                            <div>
                                                <Translatable
                                                    resourceKey={i18nKey("pinNumber.changePin")} />
                                            </div>
                                        {/snippet}
                                    </MenuItem>
                                    <MenuItem onclick={() => (pinAction = { kind: "clear" })}>
                                        {#snippet icon()}
                                            <ShieldRemoveIcon
                                                size={$iconSize}
                                                color={"var(--icon-inverted-txt)"} />
                                        {/snippet}
                                        {#snippet text()}
                                            <div>
                                                <Translatable
                                                    resourceKey={i18nKey("pinNumber.clearPin")} />
                                            </div>
                                        {/snippet}
                                    </MenuItem>
                                {/if}
                                <MenuItem onclick={() => (managing = true)}>
                                    {#snippet icon()}
                                        <TuneVertical
                                            size={$iconSize}
                                            color={"var(--icon-inverted-txt)"} />
                                    {/snippet}
                                    {#snippet text()}
                                        <div>
                                            <Translatable
                                                resourceKey={i18nKey("cryptoAccount.manage")} />
                                        </div>
                                    {/snippet}
                                </MenuItem>
                            </Menu>
                        </div>
                    {/snippet}
                </MenuIcon>
            </div>
        </div>
    {/snippet}
    {#snippet body()}
        <div>
            <Accounts bind:selectedConversion {conversionOptions} />
        </div>
    {/snippet}
    {#snippet footer()}
        <div>
            <ButtonGroup>
                <Button
                    secondary
                    on:click={() => (managing = true)}
                    small={!$mobileWidth}
                    tiny={$mobileWidth}>
                    <Translatable resourceKey={i18nKey("cryptoAccount.manage")} />
                </Button>

                <Button on:click={onClose} small={!$mobileWidth} tiny={$mobileWidth}>
                    <Translatable resourceKey={i18nKey("close")} />
                </Button>
            </ButtonGroup>
        </div>
    {/snippet}
</ModalContent>

{#if pinAction !== undefined}
    <Overlay>
        <SetPinNumberModal type={pinAction} onClose={() => (pinAction = undefined)} />
    </Overlay>
{/if}

{#if managing}
    <ManageAccounts
        bind:selectedConversion
        {conversionOptions}
        onClose={() => (managing = false)} />
{/if}

<style lang="scss">
    .header {
        display: flex;
        justify-content: space-between;
        gap: $sp3;

        .title {
            display: flex;
            align-items: center;
            gap: $sp3;
        }
    }
</style>
