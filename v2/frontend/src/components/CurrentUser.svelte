<script lang="ts">
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import Logout from "svelte-material-icons/Logout.svelte";
    import Avatar from "./Avatar.svelte";
    import HoverIcon from "./HoverIcon.svelte";
    import MenuIcon from "./MenuIcon.svelte";
    import Menu from "./Menu.svelte";
    import MenuItem from "./MenuItem.svelte";
    import MediaQuery from "./MediaQuery.svelte";
    import { modalStore, ModalType } from "../stores/modal";
    import { identityService } from "../fsm/identity.machine";
    import { avatarUrl, AvatarSize, UserStatus } from "../domain/user";
    import type { User } from "../domain/user";
    const { send } = identityService;

    export let user: User;
</script>

<div class="current-user-box">
    <span title="logout" class="logout" on:click={() => send({ type: "LOGOUT" })}>
        <HoverIcon>
            <Logout size={"1.2em"} color={"#aaa"} />
        </HoverIcon>
    </span>
    <div class="current-user">
        <MediaQuery query="(min-width: 576px)" let:matches>
            {#if matches}
                <Avatar url={avatarUrl(user)} status={UserStatus.Online} size={AvatarSize.Large} />
            {/if}
        </MediaQuery>
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
                    <MenuItem text="New chat" on:click={() => console.log("one")} />
                    <MenuItem text="New group" on:click={() => console.log("two")} />
                    <MenuItem
                        text="Change theme"
                        on:click={() => modalStore.showModal(ModalType.ThemeSelection)} />
                    <MenuItem text="Internet identity" on:click={() => console.log("two")} />
                    <MenuItem
                        text="Test mode"
                        on:click={() => modalStore.showModal(ModalType.TestMode)} />
                    <MenuItem
                        text="Settings"
                        on:click={() => console.log("launch settings modal")} />
                </Menu>
            </span>
        </MenuIcon>
    </span>
</div>

<style type="text/scss">
    @import "../styles/mixins";

    .current-user-box {
        display: flex;
        flex: 0 0 180px;
        background-color: var(--currentUser-bg);
        border: 1px solid var(--currentUser-bd);
        margin-bottom: $sp4;

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
