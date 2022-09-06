<script lang="ts">
    import { AvatarSize, UserStatus } from "../../domain/user/user";
    import type { UserLookup } from "../../domain/user/user";
    import { groupAvatarUrl, userAvatarUrl, getUserStatus } from "../../domain/user/user.utils";
    import Delete from "svelte-material-icons/Delete.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import CheckboxMultipleMarked from "svelte-material-icons/CheckboxMultipleMarked.svelte";
    import PinIcon from "svelte-material-icons/Pin.svelte";
    import PinOffIcon from "svelte-material-icons/PinOff.svelte";
    import BellIcon from "svelte-material-icons/Bell.svelte";
    import MutedIcon from "svelte-material-icons/BellOff.svelte";
    import HideIcon from "svelte-material-icons/EyeOff.svelte";
    import { rtlStore } from "../../stores/rtl";
    import Avatar from "../Avatar.svelte";
    import { clamp, swipe } from "../chatSwipe";
    import { formatMessageDate } from "../../utils/date";
    import { _ } from "svelte-i18n";
    import {
        getContentAsText,
        getDisplayDate,
        getMinVisibleMessageIndex,
        getTypingString,
        markAllRead,
    } from "../../domain/chat/chat.utils";
    import { isPreviewing } from "../../domain/chat/chat.utils.shared";
    import type { ChatSummary } from "../../domain/chat/chat";
    import Markdown from "./Markdown.svelte";
    import { pop } from "../../utils/transition";
    import Typing from "../Typing.svelte";
    import { TypersByKey, byChat } from "../../stores/typing";
    import { userStore } from "../../stores/user";
    import { messagesRead } from "../../stores/markRead";
    import { blockedUsers } from "../../stores/blockedUsers";
    import { pinnedChatsStore } from "../../stores/pinnedChats";
    import { createEventDispatcher, onDestroy } from "svelte";
    import { toTitleCase } from "../../utils/string";
    import { now } from "../../stores/time";
    import { iconSize } from "../../stores/iconSize";
    import { mobileWidth } from "../../stores/screenDimensions";
    import MenuIcon from "../MenuIcon.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import { notificationsSupported } from "../../stores/notifications";

    export let index: number;
    export let chatSummary: ChatSummary;
    export let userId: string;
    export let selected: boolean;

    const dispatch = createEventDispatcher();
    let hovering = false;
    let unreadMessages: number;
    let unreadMentions: number;

    function normaliseChatSummary(now: number, chatSummary: ChatSummary, typing: TypersByKey) {
        if (chatSummary.kind === "direct_chat") {
            return {
                name: $userStore[chatSummary.them]?.username,
                avatarUrl: userAvatarUrl($userStore[chatSummary.them]),
                userStatus: getUserStatus(now, $userStore, chatSummary.them),
                typing: getTypingString($userStore, chatSummary.chatId, typing),
            };
        }
        return {
            name: chatSummary.name,
            userStatus: UserStatus.None,
            avatarUrl: groupAvatarUrl(chatSummary),
            typing: getTypingString($userStore, chatSummary.chatId, typing),
        };
    }

    function getUnreadMentionCount(chat: ChatSummary): number {
        if (chat.kind === "direct_chat") return 0;
        return chat.mentions.filter(
            (m) => !messagesRead.isRead(chat.chatId, m.messageIndex, m.messageId)
        ).length;
    }

    function formatLatestMessage(chatSummary: ChatSummary, users: UserLookup): string {
        if (chatSummary.latestMessage === undefined) {
            return "";
        }

        const latestMessageText = getContentAsText(chatSummary.latestMessage.event.content);

        if (chatSummary.kind === "direct_chat") {
            return latestMessageText;
        }

        const user =
            chatSummary.latestMessage.event.sender === userId
                ? toTitleCase($_("you"))
                : users[chatSummary.latestMessage.event.sender]?.username ?? $_("unknownUser");

        return `${user}: ${latestMessageText}`;
    }

    /***
     * This needs to be called both when the chatSummary changes (because that may have changed the latestMessage)
     * and when the internal state of the MessageReadTracker changes. Both are necessary to get the right value
     * at all times.
     */
    function updateUnreadCounts(chatSummary: ChatSummary) {
        unreadMessages = messagesRead.unreadMessageCount(
            chatSummary.chatId,
            getMinVisibleMessageIndex(chatSummary),
            chatSummary.latestMessage?.event.messageIndex
        );
        unreadMentions = getUnreadMentionCount(chatSummary);
    }

    function deleteDirectChat() {
        dispatch("deleteDirectChat", chatSummary.chatId);
        delOffset = -50;
    }

    $: chat = normaliseChatSummary($now, chatSummary, $byChat);
    $: lastMessage = formatLatestMessage(chatSummary, $userStore);

    $: {
        // we are passing chatSummary into the function to force a reaction
        updateUnreadCounts(chatSummary);
    }

    const unsub = messagesRead.subscribe(() => updateUnreadCounts(chatSummary));

    onDestroy(unsub);

    let maxDelOffset = -50;
    let delOffset = maxDelOffset;
    let swiped = false;

    function leftSwipe() {
        if (swiped) return;
        if (delOffset > maxDelOffset / 2) {
            delOffset = 0;
            swiped = true;
        } else {
            delOffset = maxDelOffset;
            swiped = false;
        }
    }

    function rightSwipe() {
        if (!swiped) return;
        if (delOffset < maxDelOffset / 2) {
            delOffset = maxDelOffset;
            swiped = false;
        } else {
            delOffset = 0;
            swiped = true;
        }
    }

    function swiping({ detail: { diffx } }: CustomEvent<{ diffx: number }>) {
        if (diffx > 0 && !swiped) {
            delOffset = clamp(maxDelOffset, 0, maxDelOffset + diffx);
        }

        if (diffx < 0 && swiped) {
            delOffset = clamp(maxDelOffset, 0, 0 + diffx);
        }
    }

    function onClick() {
        dispatch("chatSelected", chatSummary.chatId);
    }

    function pinChat() {
        dispatch("pinChat", chatSummary.chatId);
    }

    function unpinChat() {
        dispatch("unpinChat", chatSummary.chatId);
    }

    function toggleMuteNotifications(mute: boolean) {
        dispatch("toggleMuteNotifications", { chatId: chatSummary.chatId, mute });
    }

    function archiveChat() {
        dispatch("archiveChat", chatSummary.chatId);
    }

    $: displayDate = getDisplayDate(chatSummary);
    $: blocked = chatSummary.kind === "direct_chat" && $blockedUsers.has(chatSummary.them);
    $: preview = isPreviewing(chatSummary);
    $: canDelete =
        (chatSummary.kind === "direct_chat" && chatSummary.latestMessage === undefined) ||
        (chatSummary.kind === "group_chat" && chatSummary.myRole === "previewer");
    $: pinned = $pinnedChatsStore.includes(chatSummary.chatId);
    $: muted = chatSummary.notificationsMuted;
</script>

<div
    role="button"
    class="chat-summary"
    class:first={index === 0}
    class:selected
    use:swipe
    on:swiping={swiping}
    on:leftswipe={leftSwipe}
    on:rightswipe={rightSwipe}
    class:empty={canDelete}
    class:rtl={$rtlStore}
    on:mouseenter={() => (hovering = true)}
    on:mouseleave={() => (hovering = false)}
    on:click={onClick}>
    <div class="avatar">
        <Avatar
            statusBorder={selected || hovering ? "var(--chatSummary-hv)" : "var(--chatSummary-bg)"}
            {blocked}
            url={chat.avatarUrl}
            status={chat.userStatus}
            size={AvatarSize.Small} />
    </div>
    <div class="details" class:rtl={$rtlStore}>
        <div class="name-date">
            <h4 class="chat-name">{chat.name}</h4>
        </div>
        <div class="chat-msg">
            {#if chat.typing !== undefined}
                {chat.typing} <Typing />
            {:else}
                <Markdown text={lastMessage} oneLine={true} suppressLinks={true} />
            {/if}
        </div>
    </div>
    <!-- this date formatting is OK for now but we might want to use something like this: 
    https://date-fns.org/v2.22.1/docs/formatDistanceToNow -->
    <div class:rtl={$rtlStore} class="chat-date">
        {formatMessageDate(displayDate, $_("today"), $_("yesterday"), true, true)}
    </div>
    {#if !preview}
        {#if muted && $notificationsSupported}
            <div class="mute icon" class:rtl={$rtlStore}>
                <MutedIcon size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
            </div>
        {/if}
        {#if pinned}
            <div class="pin icon">
                <PinIcon size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
            </div>
        {/if}
        {#if unreadMentions > 0}
            <div
                in:pop={{ duration: 1500 }}
                title={$_("chatSummary.mentions", { values: { count: unreadMentions.toString() } })}
                class:rtl={$rtlStore}
                class="notification mention">
                @
            </div>
        {/if}
        {#if unreadMessages > 0}
            <div
                in:pop={{ duration: 1500 }}
                title={$_("chatSummary.unread", { values: { count: unreadMessages.toString() } })}
                class:rtl={$rtlStore}
                class="notification">
                {unreadMessages > 999 ? "999+" : unreadMessages}
            </div>
        {/if}
        <div class="menu">
            <MenuIcon>
                <div class="menu-icon" slot="icon">
                    <ChevronDown viewBox="0 -3 24 24" size="1.6em" color="var(--icon-txt" />
                </div>
                <div slot="menu">
                    <Menu>
                        {#if !pinned}
                            <MenuItem on:click={archiveChat}>
                                <HideIcon size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                                <div slot="text">{$_("archiveChat")}</div>
                            </MenuItem>
                        {/if}
                        {#if !pinned}
                            <MenuItem on:click={pinChat}>
                                <PinIcon size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                                <div slot="text">{$_("pinChat.menuItem")}</div>
                            </MenuItem>
                        {:else}
                            <MenuItem on:click={unpinChat}>
                                <PinOffIcon
                                    size={$iconSize}
                                    color={"var(--icon-txt)"}
                                    slot="icon" />
                                <div slot="text">{$_("pinChat.unpinMenuItem")}</div>
                            </MenuItem>
                        {/if}
                        {#if $notificationsSupported}
                            {#if muted}
                                <MenuItem on:click={() => toggleMuteNotifications(false)}>
                                    <BellIcon
                                        size={$iconSize}
                                        color={"var(--icon-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("unmuteNotifications")}</div>
                                </MenuItem>
                            {:else}
                                <MenuItem on:click={() => toggleMuteNotifications(true)}>
                                    <MutedIcon
                                        size={$iconSize}
                                        color={"var(--icon-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("muteNotifications")}</div>
                                </MenuItem>
                            {/if}
                        {/if}
                        <MenuItem
                            disabled={unreadMessages === 0}
                            on:click={() => markAllRead(chatSummary)}>
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
    {#if canDelete}
        <div
            title={$_("removeChat")}
            style={$mobileWidth
                ? $rtlStore
                    ? `left: ${delOffset}px`
                    : `right: ${delOffset}px`
                : ""}
            on:click|stopPropagation|preventDefault={deleteDirectChat}
            class:rtl={$rtlStore}
            class="delete-chat">
            <Delete size={$iconSize} color={"#fff"} slot="icon" />
        </div>
    {/if}
</div>

<style type="text/scss">
    .delete-chat {
        background-color: var(--chatSummary-del);
        padding: $sp3;
        position: absolute;
        right: -50px;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        width: 50px;
        cursor: pointer;

        @include size-above(sm) {
            transition: right 200ms ease-in-out;
            transition-delay: 200ms;
        }

        &.rtl {
            right: unset;
            left: -50px;
        }
    }

    .chat-summary {
        position: relative;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: var(--chatSummary-bg);
        color: var(--chatSummary-txt1);
        padding: $sp3;
        margin-bottom: 0;
        cursor: pointer;
        transition: background-color ease-in-out 100ms, border-color ease-in-out 100ms;
        border-bottom: var(--chatSummary-bd);
        user-select: none;

        &:hover {
            background-color: var(--chatSummary-hv);

            @include size-above(sm) {
                .delete-chat {
                    right: 0px;
                    &.rtl {
                        right: unset;
                        left: 0px;
                    }
                }
            }
        }

        &.selected {
            background-color: var(--chatSummary-bg-selected);
        }

        .menu {
            flex: 0;
        }

        .menu-icon {
            width: 0;
            transition: width 200ms ease-in-out, opacity 200ms;
            height: 0;
            opacity: 0;
            position: relative;
            bottom: 0.4em;
        }

        .icon {
            height: 0;
            &.mute {
                margin-left: 2px;
                @include font-size(fs-70);
                &.rtl {
                    margin-left: 0;
                    margin-right: 2px;
                }
            }
            &.pin {
                @include font-size(fs-80);
            }
        }

        &:hover {
            .menu-icon {
                transition-delay: 200ms;
                width: 1.2em;
                opacity: 1;
            }
        }
    }
    .avatar {
        flex: 0 0 40px;
    }
    .details {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        height: toRem(48);
        overflow: hidden;

        &:not(.rtl) {
            padding: 0 0 0 12px;
        }
        &.rtl {
            padding: 0 12px 0 0;
        }

        .name-date {
            display: flex;
            margin-bottom: $sp1;

            .chat-name {
                @include font(book, normal, fs-100);
                color: var(--chatSummary-txt1);
                @include ellipsis();
                flex: auto;
            }
        }

        .chat-msg {
            color: var(--chatSummary-txt2);
            @include font(book, normal, fs-80);
        }
    }

    .chat-date {
        position: absolute;
        @include font(book, normal, fs-60);
        color: var(--chatSummary-txt2);
        top: $sp3;
        &:not(.rtl) {
            right: $sp3;
        }
        &.rtl {
            left: $sp3;
        }
    }

    .notification {
        @include unread();
        margin-top: 18px;
        margin-left: 2px;
        &:not(.rtl) {
            right: $sp3;
        }

        &.rtl {
            left: $sp3;
            margin-right: 2px;
            margin-left: 0;
        }
    }

    .mention {
        margin-right: 2px;
        &.rtl {
            margin-left: 2px;
        }
    }
</style>
