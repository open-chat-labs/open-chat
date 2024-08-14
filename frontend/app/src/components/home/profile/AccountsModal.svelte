<script lang="ts">
    import Hamburger from "svelte-material-icons/Menu.svelte";
    import TuneVertical from "svelte-material-icons/TuneVertical.svelte";
    import { createEventDispatcher, getContext } from "svelte";
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
    import type { OpenChat } from "openchat-client";
    import MenuIcon from "../../MenuIcon.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../../stores/iconSize";
    import Overlay from "../../Overlay.svelte";
    import SetPinNumberModal from "./SetPinNumberModal.svelte";
    import { pinEnabledStore } from "../../../stores/settings";
    import ManageAccounts from "./ManageAccounts.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let pinAction: "set" | "clear" | "change" | undefined = undefined;
    let managing = false;

    $: pinNumberRequiredStore = client.pinNumberRequiredStore;
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
                        {#if $pinEnabledStore}
                            {#if !$pinNumberRequiredStore}
                                <MenuItem on:click={() => (pinAction = "set")}>
                                    <ShieldPlusIcon
                                        size={$iconSize}
                                        color={"var(--icon-inverted-txt)"}
                                        slot="icon" />
                                    <div slot="text">
                                        <Translatable resourceKey={i18nKey("pinNumber.setPin")} />
                                    </div>
                                </MenuItem>
                            {:else}
                                <MenuItem on:click={() => (pinAction = "change")}>
                                    <ShieldRefreshIcon
                                        size={$iconSize}
                                        color={"var(--icon-inverted-txt)"}
                                        slot="icon" />
                                    <div slot="text">
                                        <Translatable
                                            resourceKey={i18nKey("pinNumber.changePin")} />
                                    </div>
                                </MenuItem>
                                <MenuItem on:click={() => (pinAction = "clear")}>
                                    <ShieldRemoveIcon
                                        size={$iconSize}
                                        color={"var(--icon-inverted-txt)"}
                                        slot="icon" />
                                    <div slot="text">
                                        <Translatable resourceKey={i18nKey("pinNumber.clearPin")} />
                                    </div>
                                </MenuItem>
                            {/if}
                        {/if}
                        <MenuItem on:click={() => (managing = true)}>
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
        <Accounts />
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
        <SetPinNumberModal type={pinAction} on:close={() => (pinAction = undefined)} />
    </Overlay>
{/if}

{#if managing}
    <ManageAccounts on:close={() => (managing = false)} />
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
