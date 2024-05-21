<script lang="ts">
    import { createEventDispatcher, getContext } from "svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import ModalContent from "../../ModalContent.svelte";
    import SecurityIcon from "svelte-material-icons/Security.svelte";
    import ShieldPlusIcon from "svelte-material-icons/ShieldPlus.svelte";
    import ShieldRemoveIcon from "svelte-material-icons/ShieldRemove.svelte";
    import ShieldRefreshIcon from "svelte-material-icons/ShieldRefresh.svelte";
    import WalletIcon from "svelte-material-icons/WalletOutline.svelte";
    import Accounts from "./Accounts.svelte";
    import Button from "../../Button.svelte";
    import LinkButton from "../../LinkButton.svelte";
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

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let showZeroBalance = false;
    let zeroCount = 0;
    let pinAction: "set" | "clear" | "change" | undefined = undefined;

    $: pinNumberRequiredStore = client.pinNumberRequiredStore;
</script>

<ModalContent closeIcon={!$pinEnabledStore} on:close>
    <div class="header" slot="header">
        <div class="title">
            <WalletIcon size={"1.2em"} color={"var(--txt)"} />
            <Translatable resourceKey={i18nKey("wallet")} />
        </div>
        {#if $pinEnabledStore}
            <div class="menu">
                <MenuIcon position={"bottom"} align={"end"}>
                    <div slot="icon">
                        <HoverIcon title={$_("chatMenu")}>
                            <SecurityIcon color={"var(--icon-txt)"} />
                        </HoverIcon>
                    </div>
                    <div slot="menu">
                        <Menu>
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
                        </Menu>
                    </div>
                </MenuIcon>
            </div>
        {/if}
    </div>
    <div slot="body">
        <Accounts bind:showZeroBalance bind:zeroCount />
    </div>
    <div slot="footer">
        <div class="footer">
            <div class="show-more">
                {#if zeroCount > 0}
                    <LinkButton
                        light
                        underline={"hover"}
                        on:click={() => (showZeroBalance = !showZeroBalance)}
                        ><Translatable
                            resourceKey={i18nKey(
                                showZeroBalance
                                    ? "cryptoAccount.hideZeroBalance"
                                    : "cryptoAccount.showZeroBalance",
                            )} /></LinkButton>
                {/if}
            </div>
            <Button on:click={() => dispatch("close")} small={!$mobileWidth} tiny={$mobileWidth}>
                <Translatable resourceKey={i18nKey("close")} />
            </Button>
        </div>
    </div>
</ModalContent>

{#if pinAction !== undefined}
    <Overlay>
        <SetPinNumberModal type={pinAction} on:close={() => (pinAction = undefined)} />
    </Overlay>
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

    .footer {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;

        .show-more {
            @include font(light, normal, fs-70);
        }
    }
</style>
