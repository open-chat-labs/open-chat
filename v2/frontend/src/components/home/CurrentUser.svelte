<script lang="ts">
    import AboutModal from "../AboutModal.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import Bell from "svelte-material-icons/Bell.svelte";
    import BellOff from "svelte-material-icons/BellOff.svelte";
    import EditableAvatar from "../EditableAvatar.svelte";
    import Palette from "svelte-material-icons/Palette.svelte";
    import Cogs from "svelte-material-icons/Cogs.svelte";
    import Logout from "svelte-material-icons/Logout.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import Information from "svelte-material-icons/Information.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import Overlay from "../Overlay.svelte";
    import ThemePicker from "../ThemePicker.svelte";
    import { _ } from "svelte-i18n";
    import { avatarUrl } from "../../domain/user/user.utils";
    import {
        ScreenHeight,
        screenHeight,
        ScreenWidth,
        screenWidth,
    } from "../../stores/screenDimensions";
    import type { PartialUserSummary } from "../../domain/user/user";
    import { createEventDispatcher } from "svelte";
    import { notificationStatus } from "../../stores/notifications";
    import { askForNotificationPermission } from "../../utils/notifications";
    import { rtlStore } from "../../stores/rtl";
    import { supported as notificationsSupported } from "../../utils/notifications";
    import { iconSize } from "../../stores/iconSize";
    import type { Version } from "../../domain/version";
    const dispatch = createEventDispatcher();

    export let user: PartialUserSummary;

    enum ModalType {
        NoModal,
        About,
        ThemeSelection,
    }

    export let wasmVersion: Version;

    let supportsNotifications = notificationsSupported();
    let modal = ModalType.NoModal;

    function newGroup() {
        dispatch("newGroup");
    }

    function unsubscribeNotifications() {
        dispatch("unsubscribeNotifications");
    }

    function userAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>): void {
        dispatch("userAvatarSelected", ev.detail);
    }

    function onCloseModal() {
        modal = ModalType.NoModal;
    }

    $: small = $screenWidth === ScreenWidth.ExtraSmall || $screenHeight === ScreenHeight.Small;
</script>

<div class="current-user-box" class:small class:rtl={$rtlStore}>
    <div class="current-user" class:rtl={$rtlStore} class:small>
        <EditableAvatar {small} image={avatarUrl(user)} on:imageSelected={userAvatarSelected} />
        <h4 class="name" class:small>{user.username}</h4>
    </div>
    <span class="menu" class:small>
        <MenuIcon>
            <span slot="icon">
                <HoverIcon>
                    <DotsVertical size={$iconSize} color={"var(--icon-txt)"} />
                </HoverIcon>
            </span>
            <span slot="menu">
                <Menu>
                    <MenuItem on:click={newGroup}>
                        <AccountMultiplePlus
                            size={$iconSize}
                            color={"var(--icon-txt)"}
                            slot="icon" />
                        <span slot="text">{$_("newGroup")}</span>
                    </MenuItem>
                    <MenuItem on:click={() => (modal = ModalType.ThemeSelection)}>
                        <Palette size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                        <span slot="text">{$_("changeTheme")}</span>
                    </MenuItem>
                    {#if supportsNotifications}
                        {#if $notificationStatus !== "granted"}
                            {#if $notificationStatus === "hard-denied"}
                                <MenuItem>
                                    <BellOff
                                        size={$iconSize}
                                        color={"var(--icon-txt)"}
                                        slot="icon" />
                                    <span slot="text">{$_("notificationsDisabled")}</span>
                                </MenuItem>
                            {:else}
                                <MenuItem on:click={askForNotificationPermission}>
                                    <Bell size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                                    <span slot="text">{$_("enableNotificationsMenu")}</span>
                                </MenuItem>
                            {/if}
                        {:else}
                            <MenuItem on:click={unsubscribeNotifications}>
                                <BellOff size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                                <span slot="text">{$_("disableNotificationsMenu")}</span>
                            </MenuItem>
                        {/if}
                    {/if}
                    <MenuItem on:click={() => dispatch("whatsHot")}>
                        <span class="flame" slot="icon">🔥</span>
                        <span slot="text">{$_("whatsHot")}</span>
                    </MenuItem>
                    <MenuItem on:click={() => dispatch("profile")}>
                        <Cogs size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                        <span slot="text">{$_("profile")}</span>
                    </MenuItem>
                    <MenuItem on:click={() => dispatch("logout")}>
                        <Logout size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                        <span slot="text">{$_("logout")}</span>
                    </MenuItem>
                    <MenuItem on:click={() => (modal = ModalType.About)}>
                        <Information size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                        <span slot="text">{$_("aboutOpenChat")}</span>
                    </MenuItem>
                    <MenuItem on:click={() => dispatch("logout")}>
                        <Logout size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                        <span slot="text">{$_("logout")}</span>
                    </MenuItem>
                </Menu>
            </span>
        </MenuIcon>
    </span>
</div>

<Overlay dismissible={true} active={modal !== ModalType.NoModal} on:close={onCloseModal}>
    {#if modal === ModalType.About}
        <AboutModal canister={{ id: user.userId, wasmVersion }} on:close={onCloseModal} />
    {:else if modal === ModalType.ThemeSelection}
        <ThemePicker on:close={onCloseModal} />
    {/if}
</Overlay>

<style type="text/scss">
    :global(.current-user.small .photo-section) {
        flex: 0 0 45px;
        margin-right: $sp4;
    }

    :global(.current-user.small.rtl .photo-section) {
        margin-left: $sp4;
        margin-right: 0;
    }

    .flame {
        @include font(bold, normal, fs-110);
    }

    .current-user-box {
        padding: $sp4;
        background-color: var(--currentUser-bg);
        border-bottom: var(--currentUser-bd);
        border-right: var(--currentUser-bd);
        margin-bottom: $sp3;
        position: relative;

        &.small {
            padding: $sp3 $sp3;
            height: 60px;
            border-right: none;
        }

        &.rtl {
            border-right: none;
            border-left: var(--currentUser-bd);

            &.small {
                border-left: none;
            }
        }
    }

    .current-user {
        display: flex;
        flex: 1;
        flex-direction: column;
        justify-content: center;
        align-items: center;

        &.small {
            flex-direction: row;
            justify-content: unset;
        }
    }

    .name {
        @include font(mediumBold, normal, fs-120);
        color: var(--currentUser-txt);
        margin-top: $sp4;
        &.small {
            margin: 0;
        }
    }

    .menu {
        position: absolute;
        top: 0;
        right: 0;
        margin-top: 2px;
        flex: 0 0 40px;
        cursor: pointer;
        padding: $sp3;
        &.small {
            padding: $sp3;
        }
    }

    .current-user-box.rtl .menu {
        right: unset;
        left: 0;
    }
</style>
