<script lang="ts">
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import EditableAvatar from "../EditableAvatar.svelte";
    import Cogs from "svelte-material-icons/Cogs.svelte";
    import Logout from "svelte-material-icons/Logout.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import HelpCircleOutline from "svelte-material-icons/HelpCircleOutline.svelte";
    import InformationOutline from "svelte-material-icons/InformationOutline.svelte";
    import Map from "svelte-material-icons/Map.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import { _ } from "svelte-i18n";
    import { avatarUrl } from "../../domain/user/user.utils";
    import { mobileWidth, ScreenHeight, screenHeight } from "../../stores/screenDimensions";
    import type { PartialUserSummary } from "../../domain/user/user";
    import { createEventDispatcher } from "svelte";
    import { rtlStore } from "../../stores/rtl";
    import { iconSize } from "../../stores/iconSize";
    import AlertsButton from "./AlertsButton.svelte";
    import { alertsStore } from "stores/alerts";

    const dispatch = createEventDispatcher();

    export let user: PartialUserSummary;

    function newGroup() {
        dispatch("newGroup");
    }

    function userAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>): void {
        dispatch("userAvatarSelected", ev.detail);
    }

    $: small = $mobileWidth || $screenHeight === ScreenHeight.Small;
</script>

<div class="current-user-box" class:small class:rtl={$rtlStore}>
    <div class="current-user" class:rtl={$rtlStore} class:small>
        <EditableAvatar {small} image={avatarUrl(user)} on:imageSelected={userAvatarSelected} />
        <h4 class="name" class:small>{user.username}</h4>
    </div>
    <span class="alerts" class:small>
        <AlertsButton on:click={() => dispatch("showAlerts")} />
    </span>
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
                    <MenuItem on:click={() => dispatch("whatsHot")}>
                        <span class="flame" slot="icon">🔥</span>
                        <span slot="text">{$_("whatsHot")}</span>
                    </MenuItem>
                    <MenuItem on:click={() => dispatch("profile")}>
                        <Cogs size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                        <span slot="text">{$_("profile")}</span>
                    </MenuItem>
                    <MenuItem on:click={() => dispatch("showFaq")}>
                        <HelpCircleOutline size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                        <span slot="text">{$_("faq.menu")}</span>
                    </MenuItem>
                    <MenuItem on:click={() => dispatch("showRoadmap")}>
                        <Map size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                        <span slot="text">{$_("roadmap")}</span>
                    </MenuItem>
                    <MenuItem on:click={() => dispatch("showAbout")}>
                        <InformationOutline
                            size={$iconSize}
                            color={"var(--icon-txt)"}
                            slot="icon" />
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

    .menu,
    .alerts {
        position: absolute;
        top: 0;
        right: 1px;
        margin-top: 2px;
        flex: 0 0 40px;
        cursor: pointer;
        padding: $sp3;
        &.small {
            padding: $sp3;
        }
    }

    .alerts {
        right: 45px;
    }

    .current-user-box.rtl .menu {
        right: unset;
        left: 0;
    }

    .current-user-box.rtl .alerts {
        right: unset;
        left: 45px;
    }
</style>
