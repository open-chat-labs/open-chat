<script lang="ts">
    import { AvatarSize, UserStatus } from "../../domain/user/user";
    import { avatarUrl as getAvatarUrl, getUserStatus } from "../../domain/user/user.utils";
    import { mobileWidth } from "../../stores/screenDimensions";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import Pin from "svelte-material-icons/Pin.svelte";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import AccountPlusOutline from "svelte-material-icons/AccountPlusOutline.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import CheckboxMultipleMarked from "svelte-material-icons/CheckboxMultipleMarked.svelte";
    import DeleteAlertOutline from "svelte-material-icons/DeleteAlertOutline.svelte";
    import LocationExit from "svelte-material-icons/LocationExit.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import Bell from "svelte-material-icons/Bell.svelte";
    import Poll from "svelte-material-icons/Poll.svelte";
    import BellOff from "svelte-material-icons/BellOff.svelte";
    import Magnify from "svelte-material-icons/Magnify.svelte";
    import Avatar from "../Avatar.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import MenuIcon from "../MenuIcon.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import { createEventDispatcher } from "svelte";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import type { ChatSummary } from "../../domain/chat/chat";
    import {
        canAddMembers,
        canCreatePolls,
        canDeleteGroup,
        canLeaveGroup,
    } from "../../domain/chat/chat.utils";
    import Typing from "../Typing.svelte";
    import { typing } from "../../stores/typing";
    import { userStore } from "../../stores/user";
    import type { Readable } from "svelte/store";
    import { toastStore } from "../../stores/toast";
    import Link from "../Link.svelte";
    import { supported as notificationsSupported } from "../../utils/notifications";
    import { iconSize } from "../../stores/iconSize";
    import { now } from "../../stores/time";
    import ViewUserProfile from "./profile/ViewUserProfile.svelte";
    import { formatLastOnlineDate } from "../../domain/user/user.utils";

    const dispatch = createEventDispatcher();

    export let selectedChatSummary: Readable<ChatSummary>;
    export let blocked: boolean;
    export let preview: boolean;
    export let unreadMessages: number;
    export let hasPinned: boolean;

    let supportsNotifications = notificationsSupported();
    let viewProfile = false;

    $: userId = $selectedChatSummary.kind === "direct_chat" ? $selectedChatSummary.them : "";
    $: isGroup = $selectedChatSummary.kind === "group_chat";

    function clearSelection() {
        dispatch("clearSelection");
    }

    function toggleMuteNotifications() {
        dispatch("toggleMuteNotifications");
    }

    function searchChat() {
        dispatch("searchChat", "");
    }

    function createPoll() {
        dispatch("createPoll");
    }

    function markAllRead() {
        dispatch("markAllRead");
    }

    function deleteGroup() {
        dispatch("deleteGroup", $selectedChatSummary.chatId);
    }

    function blockUser() {
        if ($selectedChatSummary.kind === "direct_chat") {
            dispatch("blockUser", { userId: $selectedChatSummary.them });
        }
    }

    function unblockUser() {
        if ($selectedChatSummary.kind === "direct_chat") {
            dispatch("unblockUser", { userId: $selectedChatSummary.them });
        }
    }

    function showGroupDetails() {
        dispatch("showGroupDetails");
    }

    function showParticipants() {
        dispatch("showParticipants");
    }

    function addParticipants() {
        dispatch("addParticipants");
    }

    function copyUrl() {
        if ($selectedChatSummary.kind === "group_chat" && $selectedChatSummary.public) {
            navigator.clipboard.writeText(window.location.href).then(
                () => {
                    toastStore.showSuccessToast("urlCopiedToClipboard");
                },
                () => {
                    toastStore.showFailureToast("failedToCopyUrlToClipboard", {
                        values: { url: window.location.href },
                    });
                }
            );
        }
    }

    function leaveGroup() {
        dispatch("leaveGroup", $selectedChatSummary.chatId);
    }

    function normaliseChatSummary(now: number, chatSummary: ChatSummary) {
        if (chatSummary.kind === "direct_chat") {
            return {
                name: $userStore[chatSummary.them]?.username,
                avatarUrl: getAvatarUrl($userStore[chatSummary.them]),
                userStatus: getUserStatus(now, $userStore, chatSummary.them),
                subtext: formatLastOnlineDate(now, $userStore[chatSummary.them]),
                typing: $typing[chatSummary.chatId]?.has(chatSummary.them),
            };
        }
        return {
            name: chatSummary.name,
            userStatus: UserStatus.None,
            avatarUrl: getAvatarUrl(chatSummary, "../assets/group.svg"),
            subtext: chatSummary.public
                ? $_("publicGroupWithN", { values: { number: chatSummary.participantCount } })
                : $_("privateGroupWithN", { values: { number: chatSummary.participantCount } }),
            typing: false,
        };
    }

    function openUserProfile() {
        if (!isGroup) {
            viewProfile = true;
        }
    }

    function closeUserProfile() {
        viewProfile = false;
    }

    function showPinned() {
        dispatch("showPinned");
    }

    $: chat = normaliseChatSummary($now, $selectedChatSummary);
</script>

<SectionHeader shadow={true} flush={true}>
    {#if $mobileWidth}
        <div class="back" class:rtl={$rtlStore} on:click={clearSelection}>
            <HoverIcon>
                {#if $rtlStore}
                    <ArrowRight size={$iconSize} color={"var(--icon-txt)"} />
                {:else}
                    <ArrowLeft size={$iconSize} color={"var(--icon-txt)"} />
                {/if}
            </HoverIcon>
        </div>
    {/if}
    {#if viewProfile}
        <ViewUserProfile {userId} chatButton={false} on:close={closeUserProfile} />
    {/if}

    <div class="avatar" class:is-direct={!isGroup} on:click={openUserProfile}>
        <Avatar
            statusBorder={"var(--section-bg)"}
            {blocked}
            status={chat.userStatus}
            url={chat.avatarUrl}
            size={AvatarSize.Small} />
    </div>
    <div class="chat-details">
        <div class="chat-name" title={chat.name}>
            {#if isGroup && !preview}
                <span on:click={showGroupDetails} class="group-details">
                    {chat.name}
                </span>
            {:else if !isGroup}
                <span on:click={openUserProfile} class="user-link">
                    {chat.name}
                </span>
            {:else}
                {chat.name}
            {/if}
        </div>
        <div class="chat-subtext" title={chat.subtext}>
            {#if blocked}
                {$_("blocked")}
            {:else if preview}
                {chat.subtext}
            {:else if chat.typing}
                <Typing />
            {:else if isGroup}
                <Link on:click={showParticipants}>
                    {chat.subtext}
                </Link>
            {:else}
                {chat.subtext}
            {/if}
        </div>
    </div>
    {#if hasPinned}
        <div title={$_("showPinned")} class="pinned" on:click={showPinned}>
            <HoverIcon>
                <Pin size={$iconSize} color={"var(--accent)"} />
            </HoverIcon>
        </div>
    {/if}
    {#if !preview}
        <div class="menu">
            <MenuIcon>
                <div slot="icon">
                    <HoverIcon>
                        <DotsVertical size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                </div>
                <div slot="menu">
                    <Menu>
                        {#if $selectedChatSummary.kind === "direct_chat"}
                            {#if blocked}
                                <MenuItem on:click={unblockUser}>
                                    <Cancel
                                        size={$iconSize}
                                        color={"var(--icon-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("unblockUser")}</div>
                                </MenuItem>
                            {:else}
                                <MenuItem on:click={blockUser}>
                                    <Cancel
                                        size={$iconSize}
                                        color={"var(--icon-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("blockUser")}</div>
                                </MenuItem>
                            {/if}
                        {:else if $selectedChatSummary.kind === "group_chat"}
                            <MenuItem on:click={showGroupDetails}>
                                <AccountMultiplePlus
                                    size={$iconSize}
                                    color={"var(--icon-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("groupDetails")}</div>
                            </MenuItem>
                            {#if canLeaveGroup($selectedChatSummary)}
                                <MenuItem on:click={leaveGroup}>
                                    <LocationExit
                                        size={$iconSize}
                                        color={"var(--icon-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("leaveGroup")}</div>
                                </MenuItem>
                            {/if}
                            <MenuItem on:click={showParticipants}>
                                <AccountMultiple
                                    size={$iconSize}
                                    color={"var(--icon-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("participants")}</div>
                            </MenuItem>
                            {#if canAddMembers($selectedChatSummary)}
                                <MenuItem on:click={addParticipants}>
                                    <AccountPlusOutline
                                        size={$iconSize}
                                        color={"var(--icon-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("addParticipants")}</div>
                                </MenuItem>
                            {/if}
                            {#if $selectedChatSummary.public}
                                <MenuItem on:click={copyUrl}>
                                    <ContentCopy
                                        size={$iconSize}
                                        color={"var(--icon-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("copyGroupUrl")}</div>
                                </MenuItem>
                            {/if}
                        {/if}
                        <MenuItem on:click={searchChat}>
                            <Magnify size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                            <div slot="text">{$_("searchChat")}</div>
                        </MenuItem>
                        {#if supportsNotifications}
                            {#if $selectedChatSummary.notificationsMuted === true}
                                <MenuItem on:click={toggleMuteNotifications}>
                                    <Bell size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                                    <div slot="text">{$_("unmuteNotifications")}</div>
                                </MenuItem>
                            {:else}
                                <MenuItem on:click={toggleMuteNotifications}>
                                    <BellOff
                                        size={$iconSize}
                                        color={"var(--icon-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("muteNotifications")}</div>
                                </MenuItem>
                            {/if}
                        {/if}
                        {#if canCreatePolls($selectedChatSummary)}
                            <MenuItem on:click={createPoll}>
                                <Poll size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                                <div slot="text">{$_("poll.create")}</div>
                            </MenuItem>
                        {/if}
                        {#if unreadMessages > 0}
                            <MenuItem on:click={markAllRead}>
                                <CheckboxMultipleMarked
                                    size={$iconSize}
                                    color={"var(--icon-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("markAllRead")}</div>
                            </MenuItem>
                        {:else}
                            <MenuItem disabled={true}>
                                <CheckboxMultipleMarked
                                    size={$iconSize}
                                    color={"var(--icon-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("markAllRead")}</div>
                            </MenuItem>
                        {/if}
                        {#if canDeleteGroup($selectedChatSummary)}
                            <MenuItem on:click={deleteGroup}>
                                <DeleteAlertOutline
                                    size={$iconSize}
                                    color={"var(--icon-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("deleteGroup")}</div>
                            </MenuItem>
                        {/if}
                    </Menu>
                </div>
            </MenuIcon>
        </div>
    {/if}
</SectionHeader>

<style type="text/scss">
    .chat-name {
        @include font(book, normal, fs-120);
        @include ellipsis();
        margin-bottom: $sp1;
    }

    .chat-subtext {
        @include font(book, normal, fs-80);
        @include ellipsis();
        color: var(--chatSummary-txt2);
    }

    .avatar {
        flex: 0 0 55px;

        &.is-direct {
            cursor: pointer;
        }
    }

    .group-details {
        cursor: pointer;
    }

    .user-link {
        cursor: pointer;
        &:hover {
            text-decoration: underline;
        }
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
