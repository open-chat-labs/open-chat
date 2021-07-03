<script lang="ts">
    import type { ChatDetails } from "../services/chats";
    import { AvatarSize, UserStatus } from "../services/user";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import Avatar from "./Avatar.svelte";
    import HoverIcon from "./HoverIcon.svelte";
    import MenuIcon from "./MenuIcon.svelte";
    import MediaQuery from "./MediaQuery.svelte";
    import Menu from "./Menu.svelte";
    import MenuItem from "./MenuItem.svelte";
    import { createEventDispatcher } from "svelte";
    import { rtlStore } from "../stores/rtl";
    import { navStore } from "../stores/nav";
    const dispatch = createEventDispatcher();

    export let chat: ChatDetails;

    function back() {
        dispatch("goback");
    }
</script>

<div class="chat-header">
    <MediaQuery query="(max-width: 576px)" let:matches>
        {#if matches}
            <span class="back" class:rtl={$rtlStore} on:click={back}>
                <HoverIcon>
                    {#if $rtlStore}
                        <ArrowRight size={"1.2em"} color={"#aaa"} />
                    {:else}
                        <ArrowLeft size={"1.2em"} color={"#aaa"} />
                    {/if}
                </HoverIcon>
            </span>
        {/if}
    </MediaQuery>
    <span class="avatar">
        <Avatar
            status={UserStatus.Online}
            url={chat.avatar}
            size={AvatarSize.Small}
        />
    </span>
    <span class="chat-details">{chat.name}</span>
    <span class="menu">
        <MenuIcon>
            <span slot="icon">
                <HoverIcon>
                    <DotsVertical size={"1.2em"} color={"#aaa"} />
                </HoverIcon>
            </span>
            <span slot="menu">
                <Menu>
                    <MenuItem
                        text="Leave group"
                        on:click={() => console.log("one")}
                    />
                    <MenuItem
                        text="Participants"
                        on:click={navStore.showRight}
                    />
                </Menu>
            </span>
        </MenuIcon>
    </span>
</div>

<style type="text/scss">
    @import "../styles/mixins";

    .chat-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        padding: 10px;
        background-color: var(--currentChat-header-bg);
        color: var(--currentChat-header-txt);
        border: 1px solid var(--currentChat-header-bd);
    }

    .avatar {
        flex: 0 0 50px;
    }

    .chat-details {
        flex: 1;
    }

    .menu {
        flex: 0 0 20px;
    }

    .back {
        flex: 0 0 20px;
        margin-right: 10px;

        &.rtl {
            margin-right: 0;
            margin-left: 10px;
        }
    }
</style>
