<script lang="ts">
    import { AvatarSize, OpenChat, UserStatus } from "openchat-client";
    import type { UserLookup, ChatSummary, TypersByKey } from "openchat-client";
    import Delete from "svelte-material-icons/Delete.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import CheckboxMultipleMarked from "svelte-material-icons/CheckboxMultipleMarked.svelte";
    import PinIcon from "svelte-material-icons/Pin.svelte";
    import PinOffIcon from "svelte-material-icons/PinOff.svelte";
    import BellIcon from "svelte-material-icons/Bell.svelte";
    import MutedIcon from "svelte-material-icons/BellOff.svelte";
    import ArchiveIcon from "svelte-material-icons/Archive.svelte";
    import ArchiveOffIcon from "./ArchiveOffIcon.svelte";
    import { rtlStore } from "../../stores/rtl";
    import Avatar from "../Avatar.svelte";
    import { clamp, swipe } from "../chatSwipe";
    import { _ } from "svelte-i18n";
    import Markdown from "./Markdown.svelte";
    import { pop } from "../../utils/transition";
    import Typing from "../Typing.svelte";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { now } from "../../stores/time";
    import { iconSize } from "../../stores/iconSize";
    import { mobileWidth } from "../../stores/screenDimensions";
    import MenuIcon from "../MenuIcon.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import { notificationsSupported } from "../../utils/notifications";
    import { usernameAndIcon } from "openchat-shared";

    const client = getContext<OpenChat>("client");
    const userId = client.user.userId;

    export let index: number;
    export let chatSummary: ChatSummary;
    export let selected: boolean;
    export let visible: boolean;

    $: pinnedChatsStore = client.pinnedChatsStore;
    $: blockedUsers = client.blockedUsers;
    $: messagesRead = client.messagesRead;
    $: typingByChat = client.typingByChat;
    $: userStore = client.userStore;

    const dispatch = createEventDispatcher();
    let hovering = false;
    let unreadMessages: number;
    let unreadMentions: number;

    function normaliseChatSummary(now: number, chatSummary: ChatSummary, typing: TypersByKey) {
        if (chatSummary.kind === "direct_chat") {
            const them = $userStore[chatSummary.them];
            return {
                name: usernameAndIcon(them),
                avatarUrl: client.userAvatarUrl(them),
                userId: chatSummary.them,
                typing: client.getTypingString($_, $userStore, chatSummary.chatId, typing),
            };
        }
        return {
            name: chatSummary.name,
            avatarUrl: client.groupAvatarUrl(chatSummary),
            userId: undefined,
            typing: client.getTypingString($_, $userStore, chatSummary.chatId, typing),
        };
    }

    function getUnreadMentionCount(chat: ChatSummary): number {
        if (chat.kind === "direct_chat") return 0;
        return chat.mentions.filter(
            (m) => !client.isMessageRead(chat.chatId, m.messageIndex, m.messageId)
        ).length;
    }

    function formatLatestMessage(chatSummary: ChatSummary, users: UserLookup): string {
        if (chatSummary.latestMessage === undefined) {
            return "";
        }

        const latestMessageText = client.getContentAsText(
            $_,
            chatSummary.latestMessage.event.content
        );

        if (chatSummary.kind === "direct_chat") {
            return latestMessageText;
        }

        const user =
            chatSummary.latestMessage.event.sender === userId
                ? client.toTitleCase($_("you"))
                : users[chatSummary.latestMessage.event.sender]?.username ?? $_("unknownUser");

        return `${user}: ${latestMessageText}`;
    }

    /***
     * This needs to be called both when the chatSummary changes (because that may have changed the latestMessage)
     * and when the internal state of the MessageReadTracker changes. Both are necessary to get the right value
     * at all times.
     */
    function updateUnreadCounts(chatSummary: ChatSummary) {
        unreadMessages = client.unreadMessageCount(
            chatSummary.chatId,
            chatSummary.latestMessage?.event.messageIndex
        );
        unreadMentions = getUnreadMentionCount(chatSummary);

        if (chatSummary.archived && unreadMessages > 0) {
            unarchiveChat();
        }
    }

    function deleteDirectChat() {
        dispatch("deleteDirectChat", chatSummary.chatId);
        delOffset = -60;
    }

    $: chat = normaliseChatSummary($now, chatSummary, $typingByChat);
    $: lastMessage = formatLatestMessage(chatSummary, $userStore);

    $: {
        // we are passing chatSummary into the function to force a reaction
        updateUnreadCounts(chatSummary);
    }

    onMount(() => {
        return messagesRead.subscribe(() => updateUnreadCounts(chatSummary));
    });

    let maxDelOffset = -60;
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
        client.markAllRead(chatSummary);
        dispatch("archiveChat", chatSummary.chatId);
    }

    function selectChat() {
        dispatch("chatSelected", chatSummary.chatId);
    }

    function unarchiveChat() {
        dispatch("unarchiveChat", chatSummary.chatId);
    }

    $: displayDate = client.getDisplayDate(chatSummary);
    $: blocked = chatSummary.kind === "direct_chat" && $blockedUsers.has(chatSummary.them);
    $: readonly = client.isChatReadOnly(chatSummary.chatId);
    $: canDelete =
        (chatSummary.kind === "direct_chat" && chatSummary.latestMessage === undefined) ||
        (chatSummary.kind === "group_chat" && chatSummary.myRole === "previewer");
    $: pinned = $pinnedChatsStore.includes(chatSummary.chatId);
    $: muted = chatSummary.notificationsMuted;
</script>

{#if visible}
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
        on:click={selectChat}>
        <div class="avatar">
            <Avatar
                statusBorder={selected || hovering ? "var(--chatSummary-hv)" : "transparent"}
                {blocked}
                url={chat.avatarUrl}
                showStatus={true}
                userId={chat.userId}
                size={AvatarSize.Default} />
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
            {client.formatMessageDate(displayDate, $_("today"), $_("yesterday"), true, true)}
        </div>
        {#if !readonly}
            {#if muted && notificationsSupported}
                <div class="mute icon" class:rtl={$rtlStore}>
                    <MutedIcon size={$iconSize} color={"var(--icon-txt)"} />
                </div>
            {/if}
            {#if pinned}
                <div class="pin icon">
                    <PinIcon size={$iconSize} color={"var(--icon-txt)"} />
                </div>
            {/if}
            {#if unreadMentions > 0}
                <div
                    in:pop={{ duration: 1500 }}
                    title={$_("chatSummary.mentions", {
                        values: { count: unreadMentions.toString() },
                    })}
                    class:rtl={$rtlStore}
                    class="notification mention">
                    @
                </div>
            {/if}
            {#if unreadMessages > 0}
                <div
                    in:pop={{ duration: 1500 }}
                    title={$_("chatSummary.unread", {
                        values: { count: unreadMessages.toString() },
                    })}
                    class:rtl={$rtlStore}
                    class="notification">
                    {unreadMessages > 999 ? "999+" : unreadMessages}
                </div>
            {/if}
            {#if !client.isReadOnly()}
                <div class="menu">
                    <MenuIcon>
                        <div class="menu-icon" slot="icon">
                            <ChevronDown viewBox="0 -3 24 24" size="1.6em" color="var(--icon-txt" />
                        </div>
                        <div slot="menu">
                            <Menu>
                                {#if !pinned}
                                    <MenuItem on:click={pinChat}>
                                        <PinIcon
                                            size={$iconSize}
                                            color={"var(--icon-inverted-txt)"}
                                            slot="icon" />
                                        <div slot="text">{$_("pinChat.menuItem")}</div>
                                    </MenuItem>
                                {:else}
                                    <MenuItem on:click={unpinChat}>
                                        <PinOffIcon
                                            size={$iconSize}
                                            color={"var(--icon-inverted-txt)"}
                                            slot="icon" />
                                        <div slot="text">{$_("pinChat.unpinMenuItem")}</div>
                                    </MenuItem>
                                {/if}
                                {#if notificationsSupported}
                                    {#if muted}
                                        <MenuItem on:click={() => toggleMuteNotifications(false)}>
                                            <BellIcon
                                                size={$iconSize}
                                                color={"var(--icon-inverted-txt)"}
                                                slot="icon" />
                                            <div slot="text">{$_("unmuteNotifications")}</div>
                                        </MenuItem>
                                    {:else}
                                        <MenuItem on:click={() => toggleMuteNotifications(true)}>
                                            <MutedIcon
                                                size={$iconSize}
                                                color={"var(--icon-inverted-txt)"}
                                                slot="icon" />
                                            <div slot="text">{$_("muteNotifications")}</div>
                                        </MenuItem>
                                    {/if}
                                {/if}
                                {#if chatSummary.archived}
                                    <MenuItem on:click={selectChat}>
                                        <ArchiveOffIcon
                                            size={$iconSize}
                                            color={"var(--icon-inverted-txt)"}
                                            slot="icon" />
                                        <div slot="text">{$_("unarchiveChat")}</div>
                                    </MenuItem>
                                {:else}
                                    <MenuItem on:click={archiveChat}>
                                        <ArchiveIcon
                                            size={$iconSize}
                                            color={"var(--icon-inverted-txt)"}
                                            slot="icon" />
                                        <div slot="text">{$_("archiveChat")}</div>
                                    </MenuItem>
                                {/if}
                                <MenuItem
                                    disabled={unreadMessages === 0}
                                    on:click={() => client.markAllRead(chatSummary)}>
                                    <CheckboxMultipleMarked
                                        size={$iconSize}
                                        color={"var(--icon-inverted-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("markAllRead")}</div>
                                </MenuItem>
                            </Menu>
                        </div>
                    </MenuIcon>
                </div>
            {/if}
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
                <Delete size={$iconSize} color={"#fff"} />
            </div>
        {/if}
    </div>
{/if}

<style type="text/scss">
    .delete-chat {
        background-color: var(--chatSummary-del);
        padding: $sp3;
        position: absolute;
        right: -60px;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        width: 60px;
        cursor: pointer;

        @include size-above(sm) {
            transition: right 200ms ease-in-out;
            transition-delay: 200ms;
        }

        &.rtl {
            right: unset;
            left: -60px;
        }
    }

    .chat-summary {
        position: relative;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: $sp4;
        margin-bottom: 0;
        cursor: pointer;
        transition: background-color ease-in-out 100ms, border-color ease-in-out 100ms;
        user-select: none;

        @include mobile() {
            padding: $sp3 $sp4;
        }

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
                @include font(medium, normal, fs-100);

                @include ellipsis();
                flex: auto;
            }
        }

        .chat-msg {
            color: var(--txt-light);
            @include font(book, normal, fs-80);
        }
    }

    .chat-date {
        position: absolute;
        color: var(--txt-light);
        @include font(book, normal, fs-60);
        top: $sp3;
        &:not(.rtl) {
            right: $sp4;
        }
        &.rtl {
            left: $sp4;
        }

        @include mobile() {
            &:not(.rtl) {
                right: $sp3;
            }
            &.rtl {
                left: $sp3;
            }
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
