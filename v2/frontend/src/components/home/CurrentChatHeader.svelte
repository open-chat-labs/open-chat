<script lang="ts">
    import { AvatarSize, UserStatus } from "../../domain/user";
    import { avatarUrl as getAvatarUrl, getUserStatus } from "../../domain/user.utils";
    import { ScreenWidth, screenWidth } from "../../stores/screenWidth";
    import type { UserLookup } from "../../domain/user";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import Avatar from "../Avatar.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import { createEventDispatcher } from "svelte";
    import { rtlStore } from "../../stores/rtl";
    import { navStore } from "../../stores/nav";
    import type { ChatSummary } from "../../domain/chat";
    const dispatch = createEventDispatcher();

    export let selectedChatSummary: ChatSummary;
    export let users: UserLookup;

    function clearSelection() {
        dispatch("clearSelection");
    }

    function normaliseChatSummary(chatSummary: ChatSummary) {
        if (chatSummary.kind === "direct_chat") {
            return {
                name: users[chatSummary.them]?.username,
                avatarUrl: getAvatarUrl(chatSummary.them),
                userStatus: getUserStatus(users, chatSummary.them),
            };
        }
        return {
            name: chatSummary.subject,
            userStatus: UserStatus.None,
            avatarUrl: "assets/group.svg",
        };
    }

    $: chat = normaliseChatSummary(selectedChatSummary);

    // for direct chats we want to either show when the user was last online or if they are typing
    // for group chats we also show if any participants are typing (they all get listed)
    // if no one is typing we check how many users there are. If > 5 we just say n members (m online)
    // if 5 or fewer, we list the usernames sorted by online status
</script>

<div class="chat-header">
    {#if $screenWidth === ScreenWidth.ExtraSmall}
        <span class="back" class:rtl={$rtlStore} on:click={clearSelection}>
            <HoverIcon>
                {#if $rtlStore}
                    <ArrowRight size={"1.2em"} color={"#aaa"} />
                {:else}
                    <ArrowLeft size={"1.2em"} color={"#aaa"} />
                {/if}
            </HoverIcon>
        </span>
    {/if}
    <span class="avatar">
        <Avatar status={chat.userStatus} url={chat.avatarUrl} size={AvatarSize.Small} />
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
                    <MenuItem on:click={() => console.log("one")}>
                        <AccountMultiplePlus size={"1.2em"} color={"#aaa"} slot="icon" />
                        <span slot="text">Participants</span>
                    </MenuItem>
                </Menu>
            </span>
        </MenuIcon>
    </span>
</div>

<style type="text/scss">
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
        flex: 0 0 55px;
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
