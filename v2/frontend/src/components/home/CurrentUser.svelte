<script lang="ts">
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import MessagePlus from "svelte-material-icons/MessagePlus.svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
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
    const dispatch = createEventDispatcher();

    export let user: PartialUserSummary;

    function newChat() {
        dispatch("newchat");
    }

    function newGroup() {
        dispatch("newGroup");
    }

    function userAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>): void {
        dispatch("userAvatarSelected", ev.detail);
    }
</script>

<div class="current-user-box">
    <span title="logout" class="logout" on:click={() => dispatch("logout")}>
        <HoverIcon>
            <Logout size={"1.2em"} color={"#aaa"} />
        </HoverIcon>
    </span>
    <div class="current-user">
        {#if $screenWidth !== ScreenWidth.ExtraSmall}
            <EditableAvatar image={avatarUrl(user)} on:imageSelected={userAvatarSelected} />
        {/if}
        <h4 class="name">{user.username}</h4>
    </div>
    <span class="menu">
        <MenuIcon>
            <span slot="icon">
                <HoverIcon>
                    <DotsVertical size={"1.2em"} color={"#aaa"} />
                </HoverIcon>
            </span>
            <span slot="menu">
                <Menu>
                    <MenuItem on:click={newChat}>
                        <MessagePlus size={"1.2em"} color={"#aaa"} slot="icon" />
                        <span slot="text">{$_("newChat")}</span>
                    </MenuItem>
                    <MenuItem on:click={newGroup}>
                        <AccountMultiplePlus size={"1.2em"} color={"#aaa"} slot="icon" />
                        <span slot="text">{$_("newGroup")}</span>
                    </MenuItem>
                    <MenuItem on:click={() => modalStore.showModal(ModalType.ThemeSelection)}>
                        <Palette size={"1.2em"} color={"#aaa"} slot="icon" />
                        <span slot="text">{$_("changeTheme")}</span>
                    </MenuItem>
                </Menu>
            </span>
        </MenuIcon>
    </span>
</div>

<style type="text/scss">
    .current-user-box {
        display: flex;
        flex: 0 0 180px;
        background-color: var(--currentUser-bg);
        border: 1px solid var(--currentUser-bd);
        margin-bottom: $sp3;

        @include size-below(xs) {
            flex: 0 0 60px;
            justify-content: center;
            align-items: center;
        }
    }

    .name {
        color: var(--currentUser-txt);
        margin-top: $sp4;
        @include size-below(xs) {
            margin: 0;
        }
    }

    .current-user {
        position: relative;
        display: flex;
        flex: 1;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }
    .menu {
        flex: 0 0 40px;
        cursor: pointer;
        padding: $sp4;
    }
    .logout {
        flex: 0 0 40px;
        cursor: pointer;
        padding: $sp4;
    }
    @include size-below(xs) {
        .menu,
        .logout {
            padding: $sp3;
        }
    }
</style>
