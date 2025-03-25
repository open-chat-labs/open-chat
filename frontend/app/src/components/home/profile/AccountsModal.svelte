<script lang="ts">
    import Hamburger from "svelte-material-icons/Menu.svelte";
    import TuneVertical from "svelte-material-icons/TuneVertical.svelte";
    import { createEventDispatcher } from "svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import ModalContent from "../../ModalContentLegacy.svelte";
    import ShieldPlusIcon from "svelte-material-icons/ShieldPlus.svelte";
    import ShieldRemoveIcon from "svelte-material-icons/ShieldRemove.svelte";
    import ShieldRefreshIcon from "svelte-material-icons/ShieldRefresh.svelte";
    import WalletIcon from "svelte-material-icons/WalletOutline.svelte";
    import Accounts from "./Accounts.svelte";
    import Button from "../../Button.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import MenuIcon from "../../MenuIconLegacy.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItemLegacy.svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../../stores/iconSize";
    import Overlay from "../../Overlay.svelte";
    import SetPinNumberModal from "./SetPinNumberModal.svelte";
    import ManageAccounts from "./ManageAccounts.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import type { PinOperation } from "../../../stores/pinNumber";
    import { pinNumberRequiredStore } from "openchat-client";

    const dispatch = createEventDispatcher();

    let pinAction: PinOperation | undefined = undefined;
    let managing = false;
    let selectedConversion: "none" | "usd" | "icp" | "btc" | "eth" = "none";
    let conversionOptions = [
        { id: "none", label: $_("cryptoAccount.tokens") },
        { id: "usd", label: "USD" },
        { id: "icp", label: "ICP" },
        { id: "btc", label: "BTC" },
        { id: "eth", label: "ETH" },
    ];
</script>

<ModalContent on:close>
    <div class="header" slot="header">
        <div class="title">
            <WalletIcon size={"1.2em"} color={"var(--txt)"} />
            <Translatable resourceKey={i18nKey("wallet")} />
        </div>
        <div class="menu">
            <MenuIcon position={"bottom"} align={"end"}>
                <div slot="icon">
                    <HoverIcon title={$_("chatMenu")}>
                        <Hamburger color={"var(--icon-txt)"} />
                    </HoverIcon>
                </div>
                <div slot="menu">
                    <Menu>
                        {#if !$pinNumberRequiredStore}
                            <MenuItem onclick={() => (pinAction = { kind: "set" })}>
                                <ShieldPlusIcon
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">
                                    <Translatable resourceKey={i18nKey("pinNumber.setPin")} />
                                </div>
                            </MenuItem>
                        {:else}
                            <MenuItem onclick={() => (pinAction = { kind: "change" })}>
                                <ShieldRefreshIcon
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">
                                    <Translatable resourceKey={i18nKey("pinNumber.changePin")} />
                                </div>
                            </MenuItem>
                            <MenuItem onclick={() => (pinAction = { kind: "clear" })}>
                                <ShieldRemoveIcon
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">
                                    <Translatable resourceKey={i18nKey("pinNumber.clearPin")} />
                                </div>
                            </MenuItem>
                        {/if}
                        <MenuItem onclick={() => (managing = true)}>
                            <TuneVertical
                                size={$iconSize}
                                color={"var(--icon-inverted-txt)"}
                                slot="icon" />
                            <div slot="text">
                                <Translatable resourceKey={i18nKey("cryptoAccount.manage")} />
                            </div>
                        </MenuItem>
                    </Menu>
                </div>
            </MenuIcon>
        </div>
    </div>
    <div slot="body">
        <Accounts bind:selectedConversion {conversionOptions} />
    </div>
    <div slot="footer">
        <ButtonGroup>
            <Button
                secondary
                on:click={() => (managing = true)}
                small={!$mobileWidth}
                tiny={$mobileWidth}>
                <Translatable resourceKey={i18nKey("cryptoAccount.manage")} />
            </Button>

            <Button on:click={() => dispatch("close")} small={!$mobileWidth} tiny={$mobileWidth}>
                <Translatable resourceKey={i18nKey("close")} />
            </Button>
        </ButtonGroup>
    </div>
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
