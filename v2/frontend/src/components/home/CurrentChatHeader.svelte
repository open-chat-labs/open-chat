<script lang="ts">
    import { AvatarSize, UserStatus } from "../../domain/user/user";
    import type { UserSummary } from "../../domain/user/user";
    import { avatarUrl as getAvatarUrl, getUserStatus } from "../../domain/user/user.utils";
    import { ScreenWidth, screenWidth } from "../../stores/screenWidth";
    import type { UserLookup } from "../../domain/user/user";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import AccountPlusOutline from "svelte-material-icons/AccountPlusOutline.svelte";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import LocationExit from "svelte-material-icons/LocationExit.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import Avatar from "../Avatar.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import { toastStore } from "../../stores/toast";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import { createEventDispatcher } from "svelte";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import type { ChatSummary, GroupChatSummary } from "../../domain/chat/chat";
    import { getParticipantsString } from "../../domain/chat/chat.utils";
    const dispatch = createEventDispatcher();

    export let selectedChatSummary: ChatSummary;
    export let users: UserLookup;
    export let user: UserSummary | undefined;
    export let blocked: boolean;

    function clearSelection() {
        dispatch("clearSelection");
    }

    function blockUser() {
        if (selectedChatSummary.kind === "direct_chat") {
            dispatch("blockUser", { userId: selectedChatSummary.them });
        }
    }

    function unblockUser() {
        if (selectedChatSummary.kind === "direct_chat") {
            dispatch("unblockUser", { userId: selectedChatSummary.them });
        }
    }

    function showGroupDetails() {
        if (selectedChatSummary.kind === "group_chat") {
            dispatch("showGroupDetails");
        }
    }

    function showParticipants() {
        if (selectedChatSummary.kind === "group_chat") {
            dispatch("showParticipants");
        }
    }

    function addParticipants() {
        if (selectedChatSummary.kind === "group_chat") {
            dispatch("addParticipants");
        }
    }

    function copyCode() {
        if (selectedChatSummary.kind === "group_chat") {
            console.log("copy the group chat invite code to the clipboard");
            toastStore.showSuccessToast("inviteCodeCopied");
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
        const participantIds = chatSummary.participants.map((p) => p.userId);
        return {
            name: chatSummary.name,
            userStatus: UserStatus.None,
            avatarUrl: "assets/group.svg",
            subtext: getParticipantsString(
                user!,
                users,
                participantIds,
                $_("unknownUser"),
                $_("you")
            ),
        };
    }

    function canAdminister(chat: GroupChatSummary): boolean {
        return chat.participants.find((p) => p.userId === user!.userId)?.role === "admin";
    }

    $: chat = normaliseChatSummary(selectedChatSummary);

    // for direct chats we want to either show when the user was last online or if they are typing
    // for group chats we also show if any participants are typing (they all get listed)
    // if no one is typing we check how many users there are. If > 5 we just say n members (m online)
    // if 5 or fewer, we list the usernames sorted by online status
</script>

<SectionHeader flush={true}>
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
                    {#if blocked}
                        <Menu>
                            <MenuItem on:click={unblockUser}>
                                <Cancel size={"1.2em"} color={"#aaa"} slot="icon" />
                                <div slot="text">{$_("unblockUser")}</div>
                            </MenuItem>
                        </Menu>
                    {:else}
                        <Menu>
                            <MenuItem on:click={blockUser}>
                                <Cancel size={"1.2em"} color={"#aaa"} slot="icon" />
                                <div slot="text">{$_("blockUser")}</div>
                            </MenuItem>
                        </Menu>
                    {/if}
                {:else if selectedChatSummary.kind === "group_chat"}
                    <Menu>
                        <MenuItem on:click={showGroupDetails}>
                            <AccountMultiplePlus size={"1.2em"} color={"#aaa"} slot="icon" />
                            <div slot="text">{$_("groupDetails")}</div>
                        </MenuItem>
                        <MenuItem on:click={leaveGroup}>
                            <LocationExit size={"1.2em"} color={"#aaa"} slot="icon" />
                            <div slot="text">{$_("leaveGroup")}</div>
                        </MenuItem>
                        <MenuItem on:click={copyCode}>
                            <ContentCopy size={"1.2em"} color={"#aaa"} slot="icon" />
                            <div slot="text">{$_("copyInviteCode")}</div>
                        </MenuItem>
                        <MenuItem on:click={showParticipants}>
                            <AccountMultiplePlus size={"1.2em"} color={"#aaa"} slot="icon" />
                            <div slot="text">{$_("participants")}</div>
                        </MenuItem>
                        {#if canAdminister(selectedChatSummary)}
                            <MenuItem on:click={addParticipants}>
                                <AccountPlusOutline size={"1.2em"} color={"#aaa"} slot="icon" />
                                <div slot="text">{$_("addParticipants")}</div>
                            </MenuItem>
                        {/if}
                    </Menu>
                {/if}
            </div>
        </MenuIcon>
    </div>
</SectionHeader>

<style type="text/scss">
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
