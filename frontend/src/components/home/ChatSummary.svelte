<script lang="ts">
    import { AvatarSize, UserStatus } from "../../domain/user/user";
    import type { UserLookup } from "../../domain/user/user";
    import { fly } from "svelte/transition";
    import { avatarUrl as getAvatarUrl, getUserStatus } from "../../domain/user/user.utils";
    import Delete from "svelte-material-icons/Delete.svelte";
    import { rtlStore } from "../../stores/rtl";
    import Avatar from "../Avatar.svelte";
    import { formatMessageDate } from "../../utils/date";
    import { _ } from "svelte-i18n";
    import {
        getContentAsText,
        getDisplayDate,
        getMinVisibleMessageIndex,
        isPreviewing,
    } from "../../domain/chat/chat.utils";
    import type { ChatSummary } from "../../domain/chat/chat";
    import Markdown from "./Markdown.svelte";
    import { pop } from "../../utils/transition";
    import Typing from "../Typing.svelte";
    import { typing } from "../../stores/typing";
    import { userStore } from "../../stores/user";
    import type { IMessageReadTracker } from "../../stores/markRead";
    import { blockedUsers } from "../../stores/blockedUsers";
    import { createEventDispatcher, onDestroy } from "svelte";
    import { toTitleCase } from "../../utils/string";
    import { now } from "../../stores/time";
    import { iconSize } from "../../stores/iconSize";
    import { mobileWidth } from "../../stores/screenDimensions";

    export let index: number;
    export let chatSummary: ChatSummary;
    export let userId: string;
    export let selected: boolean;
    export let messagesRead: IMessageReadTracker;

    const dispatch = createEventDispatcher();
    let hovering = false;
    let unreadMessages: number;
    let unreadMentions: number;

    function normaliseChatSummary(now: number, chatSummary: ChatSummary) {
        if (chatSummary.kind === "direct_chat") {
            return {
                name: $userStore[chatSummary.them]?.username,
                avatarUrl: getAvatarUrl($userStore[chatSummary.them]),
                userStatus: getUserStatus(now, $userStore, chatSummary.them),
                typing: $typing[chatSummary.chatId]?.has(chatSummary.them),
            };
        }
        return {
            name: chatSummary.name,
            userStatus: UserStatus.None,
            avatarUrl: getAvatarUrl(chatSummary, "../assets/group.svg"),
            typing: false,
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
    }

    $: chat = normaliseChatSummary($now, chatSummary);
    $: lastMessage = formatLatestMessage(chatSummary, $userStore);

    $: {
        // we are passing chatSummary into the function to force a reaction
        updateUnreadCounts(chatSummary);
    }

    const unsub = messagesRead.subscribe(() => updateUnreadCounts(chatSummary));

    onDestroy(unsub);

    $: displayDate = getDisplayDate(chatSummary);
    $: isTyping =
        chatSummary.kind === "direct_chat" && $typing[chatSummary.chatId]?.has(chatSummary.them);
    $: blocked = chatSummary.kind === "direct_chat" && $blockedUsers.has(chatSummary.them);
    $: preview = isPreviewing(chatSummary);
    $: canDelete =
        (chatSummary.kind === "direct_chat" && chatSummary.latestMessage === undefined) ||
        (chatSummary.kind === "group_chat" && chatSummary.myRole === "previewer");
</script>

<a
    role="button"
    class="chat-summary"
    class:first={index === 0}
    class:selected
    class:empty={canDelete}
    class:rtl={$rtlStore}
    on:mouseenter={() => (hovering = true)}
    on:mouseleave={() => (hovering = false)}
    href={`/#/${chatSummary.chatId}`}>
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
        {#if isTyping}
            <Typing />
        {:else}
            <div class="chat-msg">
                <Markdown text={lastMessage} oneLine={true} suppressLinks={true} inline={false} />
            </div>
        {/if}
    </div>
    <!-- this date formatting is OK for now but we might want to use something like this: 
    https://date-fns.org/v2.22.1/docs/formatDistanceToNow -->
    <div class:rtl={$rtlStore} class="chat-date">
        {formatMessageDate(displayDate, $_("today"), $_("yesterday"), true)}
    </div>
    {#if !preview}
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
    {/if}
    {#if canDelete && hovering && !$mobileWidth}
        <div
            title={$_("removeChat")}
            on:click|stopPropagation|preventDefault={deleteDirectChat}
            in:fly={{ x: $rtlStore ? -100 : 100, duration: 200, delay: 200 }}
            out:fly={{ x: $rtlStore ? -100 : 100, duration: 1000 }}
            class:rtl={$rtlStore}
            class="delete-chat">
            <Delete size={$iconSize} color={"#fff"} slot="icon" />
        </div>
    {/if}
</a>

<style type="text/scss">
    .delete-chat {
        background-color: var(--chatSummary-del);
        padding: $sp3;
        position: absolute;
        right: 0;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        width: 50px;
        cursor: pointer;

        &.rtl {
            right: unset;
            left: 0;
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

        &:hover {
            background-color: var(--chatSummary-hv);
        }

        &.selected {
            background-color: var(--chatSummary-bg-selected);
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
            @include font(book, normal, fs-80);
            color: var(--chatSummary-txt2);
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
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: var(--accent);
        text-shadow: 1px 1px 1px var(--accentDarker);
        border-radius: 12px;
        @include font(bold, normal, fs-50);
        color: #ffffff;
        min-width: $sp5;
        padding: 0 $sp2;
        height: $sp5;
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
