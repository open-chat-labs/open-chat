<script lang="ts">
    import { AvatarSize, UserStatus } from "../../domain/user/user";
    import { groupAvatarUrl, userAvatarUrl, getUserStatus } from "../../domain/user/user.utils";
    import { mobileWidth } from "../../stores/screenDimensions";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import Pin from "svelte-material-icons/Pin.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import AccountPlusOutline from "svelte-material-icons/AccountPlusOutline.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import CheckboxMultipleMarked from "svelte-material-icons/CheckboxMultipleMarked.svelte";
    import LocationExit from "svelte-material-icons/LocationExit.svelte";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import Bell from "svelte-material-icons/Bell.svelte";
    import Poll from "svelte-material-icons/Poll.svelte";
    import BellOff from "svelte-material-icons/BellOff.svelte";
    import Magnify from "svelte-material-icons/Magnify.svelte";
    import FilterOutline from "svelte-material-icons/FilterOutline.svelte";
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
        canLeaveGroup,
        getTypingString,
    } from "../../domain/chat/chat.utils";
    import Typing from "../Typing.svelte";
    import { byChat, TypersByKey } from "../../stores/typing";
    import { userStore } from "../../stores/user";
    import type { Readable } from "svelte/store";
    import Link from "../Link.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { now } from "../../stores/time";
    import ViewUserProfile from "./profile/ViewUserProfile.svelte";
    import { formatLastOnlineDate } from "../../domain/user/user.utils";
    import { isProposalGroup } from "../../stores/chat";
    import { notificationsSupported } from "../../utils/notifications";

    const dispatch = createEventDispatcher();

    export let selectedChatSummary: Readable<ChatSummary>;
    export let blocked: boolean;
    export let preview: boolean;
    export let unreadMessages: number;
    export let hasPinned: boolean;

    let viewProfile = false;

    $: userId = $selectedChatSummary.kind === "direct_chat" ? $selectedChatSummary.them : "";
    $: isGroup = $selectedChatSummary.kind === "group_chat";
    $: isBot = $userStore[userId]?.kind === "bot";
    $: hasUserProfile = !isGroup && !isBot;
    $: pollsAllowed = isGroup && !isBot && canCreatePolls($selectedChatSummary);

    function clearSelection() {
        dispatch("clearSelection");
    }

    function toggleMuteNotifications(mute: boolean) {
        dispatch("toggleMuteNotifications", { chatId: $selectedChatSummary.chatId, mute });
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

    function showProposalFilters() {
        dispatch("showProposalFilters");
    }

    function showMembers() {
        dispatch("showMembers");
    }

    function addMembers() {
        dispatch("addMembers");
    }

    function leaveGroup() {
        dispatch("leaveGroup", { kind: "leave", chatId: $selectedChatSummary.chatId });
    }

    function normaliseChatSummary(now: number, chatSummary: ChatSummary, typing: TypersByKey) {
        if (chatSummary.kind === "direct_chat") {
            return {
                name: $userStore[chatSummary.them]?.username,
                avatarUrl: userAvatarUrl($userStore[chatSummary.them]),
                userStatus: getUserStatus(now, $userStore, chatSummary.them),
                subtext: isBot ? "" : formatLastOnlineDate(now, $userStore[chatSummary.them]),
                typing: getTypingString($userStore, chatSummary.chatId, typing),
            };
        }
        return {
            name: chatSummary.name,
            userStatus: UserStatus.None,
            avatarUrl: groupAvatarUrl(chatSummary),
            subtext: chatSummary.public
                ? $_("publicGroupWithN", { values: { number: chatSummary.memberCount } })
                : $_("privateGroupWithN", { values: { number: chatSummary.memberCount } }),
            typing: getTypingString($userStore, chatSummary.chatId, typing),
        };
    }

    function openUserProfile() {
        if (hasUserProfile) {
            viewProfile = true;
        }
    }

    function closeUserProfile() {
        viewProfile = false;
    }

    function showPinned() {
        dispatch("showPinned");
    }

    $: chat = normaliseChatSummary($now, $selectedChatSummary, $byChat);
</script>

<SectionHeader shadow flush>
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

    <div class="avatar" class:has-user-profile={hasUserProfile} on:click={openUserProfile}>
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
            {:else if hasUserProfile}
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
            {:else if chat.typing !== undefined}
                {chat.typing} <Typing />
            {:else if isGroup}
                <Link on:click={showMembers}>
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
        {#if !$mobileWidth}
            {#if $isProposalGroup}
                <div class="icon" class:rtl={$rtlStore} on:click={showProposalFilters}>
                    <HoverIcon>
                        <FilterOutline size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                </div>
            {/if}
            <div class="icon" class:rtl={$rtlStore} on:click={searchChat}>
                <HoverIcon>
                    <Magnify size={$iconSize} color={"var(--icon-txt)"} />
                </HoverIcon>
            </div>
        {/if}
        <div class="menu">
            <MenuIcon>
                <div slot="icon">
                    <HoverIcon>
                        <DotsVertical size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                </div>
                <div slot="menu">
                    <Menu>
                        {#if $selectedChatSummary.kind === "direct_chat" && !isBot}
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
                            <MenuItem on:click={showMembers}>
                                <AccountMultiple
                                    size={$iconSize}
                                    color={"var(--icon-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("members")}</div>
                            </MenuItem>
                            {#if canAddMembers($selectedChatSummary)}
                                <MenuItem on:click={addMembers}>
                                    <AccountPlusOutline
                                        size={$iconSize}
                                        color={"var(--icon-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("addMembers")}</div>
                                </MenuItem>
                            {/if}
                            {#if $isProposalGroup}
                                <MenuItem on:click={showProposalFilters}>
                                    <FilterOutline
                                        size={$iconSize}
                                        color={"var(--icon-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("proposal.filter")}</div>
                                </MenuItem>
                            {/if}
                        {/if}
                        <MenuItem on:click={searchChat}>
                            <Magnify size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                            <div slot="text">{$_("searchChat")}</div>
                        </MenuItem>
                        {#if hasPinned}
                            <MenuItem on:click={showPinned}>
                                <Pin size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                                <div slot="text">{$_("showPinned")}</div>
                            </MenuItem>
                        {/if}
                        {#if notificationsSupported}
                            {#if $selectedChatSummary.notificationsMuted === true}
                                <MenuItem on:click={() => toggleMuteNotifications(false)}>
                                    <Bell size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                                    <div slot="text">{$_("unmuteNotifications")}</div>
                                </MenuItem>
                            {:else}
                                <MenuItem on:click={() => toggleMuteNotifications(true)}>
                                    <BellOff
                                        size={$iconSize}
                                        color={"var(--icon-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("muteNotifications")}</div>
                                </MenuItem>
                            {/if}
                        {/if}
                        {#if pollsAllowed}
                            <MenuItem on:click={createPoll}>
                                <Poll size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                                <div slot="text">{$_("poll.create")}</div>
                            </MenuItem>
                        {/if}
                        <MenuItem disabled={unreadMessages === 0} on:click={markAllRead}>
                            <CheckboxMultipleMarked
                                size={$iconSize}
                                color={"var(--icon-txt)"}
                                slot="icon" />
                            <div slot="text">{$_("markAllRead")}</div>
                        </MenuItem>
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

        &.has-user-profile {
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

    .icon {
        margin-left: $sp2;
        &.rtl {
            margin-right: $sp2;
        }
    }

    .chat-details {
        flex: 1;
        overflow: auto;
        padding: 0 $sp2;
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
