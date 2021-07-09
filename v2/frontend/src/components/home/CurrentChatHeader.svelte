<script lang="ts">
    import { AvatarSize, UserStatus } from "../../domain/user/user";
    import { avatarUrl as getAvatarUrl, getUserStatus } from "../../domain/user/user.utils";
    import { ScreenWidth, screenWidth } from "../../stores/screenWidth";
    import type { UserLookup } from "../../domain/user/user";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import LocationExit from "svelte-material-icons/LocationExit.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import Avatar from "../Avatar.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import { createEventDispatcher } from "svelte";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import type { ChatSummary } from "../../domain/chat/chat";
    import { getParticipantsString } from "../../domain/chat/chat.utils";
    const dispatch = createEventDispatcher();

    export let selectedChatSummary: ChatSummary;
    export let users: UserLookup;

    function clearSelection() {
        dispatch("clearSelection");
    }

    function blockUser() {
        if (selectedChatSummary.kind === "direct_chat") {
            dispatch("blockUser", { userId: selectedChatSummary.them });
        }
    }

    function showParticipants() {
        if (selectedChatSummary.kind === "group_chat") {
            dispatch("showParticipants");
        }
    }

    function leaveGroup() {
        if (selectedChatSummary.kind === "group_chat") {
            dispatch("leaveGroup", selectedChatSummary.chatId);
        }
    }

    function normaliseChatSummary(chatSummary: ChatSummary) {
        if (chatSummary.kind === "direct_chat") {
            return {
                name: users[chatSummary.them]?.username,
                avatarUrl: getAvatarUrl(chatSummary.them),
                userStatus: getUserStatus(users, chatSummary.them),
                subtext: "When user was last online | typing",
            };
        }
        return {
            name: chatSummary.subject,
            userStatus: UserStatus.None,
            avatarUrl: "assets/group.svg",
            subtext: getParticipantsString(users, chatSummary, $_("unknownUser"), $_("you")),
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
        <div class="back" class:rtl={$rtlStore} on:click={clearSelection}>
            <HoverIcon>
                {#if $rtlStore}
                    <ArrowRight size={"1.2em"} color={"#aaa"} />
                {:else}
                    <ArrowLeft size={"1.2em"} color={"#aaa"} />
                {/if}
            </HoverIcon>
        </div>
    {/if}
    <div class="avatar">
        <Avatar status={chat.userStatus} url={chat.avatarUrl} size={AvatarSize.Small} />
    </div>
    <div class="chat-details">
        <div class="chat-name" title={chat.name}>
            {chat.name}
        </div>
        <div class="chat-subtext" title={chat.subtext}>
            {chat.subtext}
        </div>
    </div>
    <div class="menu">
        <MenuIcon>
            <div slot="icon">
                <HoverIcon>
                    <DotsVertical size={"1.2em"} color={"#aaa"} />
                </HoverIcon>
            </div>
            <div slot="menu">
                {#if selectedChatSummary.kind === "direct_chat"}
                    <Menu>
                        <MenuItem on:click={blockUser}>
                            <Cancel size={"1.2em"} color={"#aaa"} slot="icon" />
                            <div slot="text">{$_("blockUser")}</div>
                        </MenuItem>
                    </Menu>
                {:else if selectedChatSummary.kind === "group_chat"}
                    <Menu>
                        <MenuItem on:click={showParticipants}>
                            <AccountMultiplePlus size={"1.2em"} color={"#aaa"} slot="icon" />
                            <div slot="text">{$_("participants")}</div>
                        </MenuItem>
                        <MenuItem on:click={leaveGroup}>
                            <LocationExit size={"1.2em"} color={"#aaa"} slot="icon" />
                            <div slot="text">{$_("leaveGroup")}</div>
                        </MenuItem>
                    </Menu>
                {/if}
            </div>
        </MenuIcon>
    </div>
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
        height: 65px;
    }

    .chat-name {
        @include font(bold, normal, fs-120);
        @include ellipsis();
        margin-bottom: $sp2;
    }

    .chat-subtext {
        @include font(light, normal, fs-100);
        @include ellipsis();
    }

    .avatar {
        flex: 0 0 55px;
    }

    .chat-details {
        flex: 1;
        overflow: auto;
    }

    .menu {
        flex: 0 0 20px;
    }

    .back {
        flex: 0 0 10px;
        margin-right: 5px;

        &.rtl {
            margin-right: 0;
            margin-left: 5px;
        }
    }
</style>
