<script lang="ts">
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import Bell from "svelte-material-icons/Bell.svelte";
    import BellOff from "svelte-material-icons/BellOff.svelte";
    import EditableAvatar from "../EditableAvatar.svelte";
    import Palette from "svelte-material-icons/Palette.svelte";
    import Logout from "svelte-material-icons/Logout.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import { _ } from "svelte-i18n";
    import { modalStore, ModalType } from "../../stores/modal";
    import { avatarUrl } from "../../domain/user/user.utils";
    import { ScreenWidth, screenWidth } from "../../stores/screenWidth";
    import type { PartialUserSummary } from "../../domain/user/user";
    import { createEventDispatcher } from "svelte";
    import { notificationStatus } from "../../stores/notifications";
    import { askForNotificationPermission } from "../../utils/notifications";
    import { rtlStore } from "../../stores/rtl";
    import { supported as notificationsSupported } from "../../utils/notifications";
    import { iconSize } from "../../stores/iconSize";
    const dispatch = createEventDispatcher();

    export let user: PartialUserSummary;

    let supportsNotifications = notificationsSupported();

    function newGroup() {
        dispatch("newGroup");
    }

    function unsubscribeNotifications() {
        dispatch("unsubscribeNotifications");
    }

    function userAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>): void {
        dispatch("userAvatarSelected", ev.detail);
    }

    $: small = $screenWidth === ScreenWidth.ExtraSmall;
</script>

<div class="current-user-box" class:rtl={$rtlStore}>
    <div class="current-user" class:small class:rtl={$rtlStore}>
        <EditableAvatar {small} image={avatarUrl(user)} on:imageSelected={userAvatarSelected} />
        <h4 class="name">{user.username}</h4>
    </div>
    <span class="menu">
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
                    <MenuItem on:click={() => modalStore.showModal(ModalType.ThemeSelection)}>
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
                    <MenuItem on:click={() => dispatch("logout")}>
                        <Logout size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                        <span slot="text">{$_("logout")}</span>
                    </MenuItem>
                </Menu>
            </span>
        </MenuIcon>
    </span>
</div>

<style type="text/scss">
    :global(.current-user .photo-section) {
        @include size-below(xs) {
            flex: 0 0 45px;
            margin-right: $sp4;
        }
    }

    :global(.current-user.rtl .photo-section) {
        @include size-below(xs) {
            margin-left: $sp4;
            margin-right: 0;
        }
    }

    .current-user-box {
        padding: $sp4;
        background-color: var(--currentUser-bg);
        border-bottom: var(--currentUser-bd);
        border-right: var(--currentUser-bd);
        margin-bottom: $sp3;
        position: relative;

        @include size-below(xs) {
            padding: $sp3 $sp3;
            height: 60px;
            border-right: none;
        }

        &.rtl {
            border-right: none;
            border-left: var(--currentUser-bd);

            @include size-below(xs) {
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

        @include size-below(xs) {
            flex-direction: row;
            justify-content: unset;
        }
    }

    .name {
        @include font(bold, normal, fs-120);
        color: var(--currentUser-txt);
        margin-top: $sp4;
        @include size-below(xs) {
            margin: 0;
        }
    }

    .menu {
        position: absolute;
        top: 0;
        right: 0;
        flex: 0 0 40px;
        cursor: pointer;
        padding: $sp3;
        @include size-below(xs) {
            top: 5px;
        }
    }

    .current-user-box.rtl .menu {
        right: unset;
        left: 0;
    }

    @include size-below(xs) {
        .menu {
            padding: $sp3;
        }
    }
</style>
