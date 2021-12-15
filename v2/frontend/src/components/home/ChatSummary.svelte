<script lang="ts">
    import { AvatarSize, UserStatus } from "../../domain/user/user";
    import type { UserLookup } from "../../domain/user/user";
    import { avatarUrl as getAvatarUrl, getUserStatus } from "../../domain/user/user.utils";
    import { rtlStore } from "../../stores/rtl";
    import Avatar from "../Avatar.svelte";
    import { formatMessageDate } from "../../utils/date";
    import { _ } from "svelte-i18n";
    import {
        getContentAsText,
        getDisplayDate,
        getMinVisibleMessageIndex,
    } from "../../domain/chat/chat.utils";
    import type { ChatSummary } from "../../domain/chat/chat";
    import { pop } from "../../utils/transition";
    import Typing from "../Typing.svelte";
    import { typing } from "../../stores/typing";
    import { userStore } from "../../stores/user";
    import type { IMessageReadTracker } from "../../stores/markRead";
    import { blockedUsers } from "../../stores/blockedUsers";
    import { onDestroy } from "svelte";
    import { toTitleCase } from "../../utils/string";

    export let index: number;
    export let chatSummary: ChatSummary;
    export let userId: string;
    export let selected: boolean;
    export let messagesRead: IMessageReadTracker;

    let hovering = false;
    let unreadMessages: number;

    function normaliseChatSummary(chatSummary: ChatSummary) {
        if (chatSummary.kind === "direct_chat") {
            return {
                name: $userStore[chatSummary.them]?.username,
                avatarUrl: getAvatarUrl($userStore[chatSummary.them]),
                userStatus: getUserStatus($userStore, chatSummary.them),
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

    function formatLatestMessage(chatSummary: ChatSummary, users: UserLookup): string {
        if (chatSummary.latestMessage === undefined) {
            return "";
        }

        const latestMessageText = getContentAsText(chatSummary.latestMessage.event.content);

        if (chatSummary.kind === "direct_chat") {
            return latestMessageText;
        }

        const user = chatSummary.latestMessage.event.sender === userId
            ? toTitleCase($_("you"))
            : users[chatSummary.latestMessage.event.sender]?.username ?? $_("unknownUser");

        return `${user}: ${latestMessageText}`;
    }

    $: chat = normaliseChatSummary(chatSummary);
    $: lastMessage = formatLatestMessage(chatSummary, $userStore);

    let unsub = messagesRead.subscribe((_val) => {
        unreadMessages = messagesRead.unreadMessageCount(
            chatSummary.chatId,
            getMinVisibleMessageIndex(chatSummary),
            chatSummary.latestMessage?.event.messageIndex
        );
    });

    onDestroy(unsub);

    $: displayDate = getDisplayDate(chatSummary);
    $: isTyping =
        chatSummary.kind === "direct_chat" && $typing[chatSummary.chatId]?.has(chatSummary.them);
    $: blocked = chatSummary.kind === "direct_chat" && $blockedUsers.has(chatSummary.them);
</script>

<a
    role="button"
    class="chat-summary"
    class:first={index === 0}
    class:selected
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
            <div class="chat-msg">{lastMessage}</div>
        {/if}
    </div>
    <!-- this date formatting is OK for now but we might want to use something like this: 
    https://date-fns.org/v2.22.1/docs/formatDistanceToNow -->
    <div class:rtl={$rtlStore} class="chat-date">
        {formatMessageDate(new Date(Number(displayDate)))}
    </div>
    {#if unreadMessages > 0}
        <div
            in:pop={{ duration: 1500 }}
            title={$_("chatSummary.unread", { values: { count: unreadMessages.toString() } })}
            class:rtl={$rtlStore}
            class="unread-msgs">
            {unreadMessages > 99 ? "99+" : unreadMessages}
        </div>
    {/if}
</a>

<style type="text/scss">
    .chat-summary {
        position: relative;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: var(--chatSummary-bg);
        color: var(--chatSummary-txt1);
        padding: $sp3;
        margin-bottom: var(--chatSummary-mb);
        cursor: pointer;
        transition: background-color ease-in-out 100ms, border-color ease-in-out 100ms;
        position: relative;
        border-bottom: var(--chatSummary-bd);

        &.selected::before {
            content: "";
            position: absolute;
            height: 100%;
            width: $sp2;
            background-color: var(--chatSummary-bd-selected);
            left: 0;
            &.rtl {
                right: 0;
            }
        }

        &.selected.rtl::before {
            right: 0;
        }

        &:hover,
        &.selected {
            background-color: var(--chatSummary-hv);
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
        height: $sp7;
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
            @include ellipsis();
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

    .unread-msgs {
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: var(--accent);
        text-shadow: 1px 1px 1px var(--accentDarker);
        border-radius: 50%;
        font-weight: bold;
        font-size: 10px;
        color: #ffffff;
        width: $sp5;
        height: $sp5;
        margin-top: 18px;
        margin-left: 2px;

        &:not(.rtl) {
            right: $sp3;
        }

        &.rtl {
            left: $sp3;
        }
    }
</style>
