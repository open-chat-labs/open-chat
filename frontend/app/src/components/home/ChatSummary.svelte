<script lang="ts">
    import { AvatarSize, OpenChat, chatIdentifiersEqual, selectedCommunity } from "openchat-client";
    import CameraTimer from "svelte-material-icons/CameraTimer.svelte";
    import type {
        UserLookup,
        ChatSummary,
        TypersByKey,
        CommunitySummary,
        DiamondMembershipStatus,
        ChatIdentifier,
        Level,
    } from "openchat-client";
    import {
        userStore,
        currentUser as user,
        suspendedUser,
        selectedChatId,
        chatListScopeStore as chatListScope,
        blockedUsers,
        messagesRead,
        byContext as typersByContext,
        favouritesStore,
        communities,
    } from "openchat-client";
    import Delete from "svelte-material-icons/Delete.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import Heart from "svelte-material-icons/Heart.svelte";
    import CheckboxMultipleMarked from "svelte-material-icons/CheckboxMultipleMarked.svelte";
    import LocationExit from "svelte-material-icons/LocationExit.svelte";
    import PinIcon from "svelte-material-icons/Pin.svelte";
    import PinOffIcon from "svelte-material-icons/PinOff.svelte";
    import BellIcon from "svelte-material-icons/Bell.svelte";
    import HeartMinus from "../icons/HeartMinus.svelte";
    import HeartPlus from "../icons/HeartPlus.svelte";
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
    import { getContext, onMount, tick } from "svelte";
    import { now } from "../../stores/time";
    import { iconSize } from "../../stores/iconSize";
    import { mobileWidth } from "../../stores/screenDimensions";
    import MenuIcon from "../MenuIcon.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import { notificationsSupported } from "../../utils/notifications";
    import { toastStore } from "../../stores/toast";
    import { routeForScope, pathParams } from "../../routes";
    import page from "page";
    import { buildDisplayName } from "../../utils/user";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import VideoCallIcon from "./video/VideoCallIcon.svelte";
    import Badges from "./profile/Badges.svelte";
    import WithVerifiedBadge from "../icons/WithVerifiedBadge.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chatSummary: ChatSummary;
        selected: boolean;
        visible: boolean;
        onToggleMuteNotifications: (chatId: ChatIdentifier, mute: boolean) => void;
        onChatSelected: (chat: ChatSummary) => void;
        onUnarchiveChat: (chatId: ChatIdentifier) => void;
        onLeaveGroup: (group: { kind: "leave"; chatId: ChatIdentifier; level: Level }) => void;
    }

    let {
        chatSummary,
        selected,
        visible,
        onToggleMuteNotifications,
        onChatSelected,
        onUnarchiveChat,
        onLeaveGroup,
    }: Props = $props();

    let userId = $derived($user.userId);
    let externalContent = $derived(
        chatSummary.kind === "channel" && chatSummary.externalUrl !== undefined,
    );
    let verified = $derived(chatSummary.kind === "group_chat" && chatSummary.verified);
    let hovering = $state(false);
    let unreadMessages: number = $state(0);
    let unreadMentions: number = $state(0);
    let chat = $derived(normaliseChatSummary($now, chatSummary, $typersByContext));
    let lastMessage = $derived(formatLatestMessage(chatSummary, $userStore));
    let displayDate = $derived(client.getDisplayDate(chatSummary));
    let community = $derived(
        chatSummary.kind === "channel"
            ? $communities.get({ kind: "community", communityId: chatSummary.id.communityId })
            : undefined,
    );
    let blocked = $derived(
        chatSummary.kind === "direct_chat" && $blockedUsers.has(chatSummary.them.userId),
    );
    let readonly = $derived(client.isChatReadOnly(chatSummary.id));
    let canDelete = $derived(getCanDelete(chatSummary, community));
    let pinned = $derived(client.pinned($chatListScope.kind, chatSummary.id));
    let muted = $derived(chatSummary.membership.notificationsMuted);
    const maxDelOffset = -60;
    let delOffset = $state(maxDelOffset);
    let swiped = $state(false);

    $effect(() => updateUnreadCounts(chatSummary));

    onMount(() => {
        return messagesRead.subscribe(() => updateUnreadCounts(chatSummary));
    });

    function normaliseChatSummary(_now: number, chatSummary: ChatSummary, typing: TypersByKey) {
        const fav = $chatListScope.kind !== "favourite" && $favouritesStore.has(chatSummary.id);
        const muted = chatSummary.membership.notificationsMuted;
        const video = chatSummary.videoCallInProgress
            ? { muted: muted ? 1 : 0, unmuted: muted ? 0 : 1 }
            : { muted: 0, unmuted: 0 };
        switch (chatSummary.kind) {
            case "direct_chat":
                const them = $userStore.get(chatSummary.them.userId);
                return {
                    name: client.displayName(them),
                    diamondStatus: them?.diamondStatus ?? "inactive",
                    streak: client.getStreak(chatSummary.them.userId),
                    avatarUrl: client.userAvatarUrl(them),
                    userId: chatSummary.them,
                    typing: client.getTypingString(
                        $_,
                        $userStore,
                        { chatId: chatSummary.id },
                        typing,
                    ),
                    fav,
                    eventsTTL: undefined,
                    video,
                    private: false,
                    uniquePerson: them?.isUniquePerson ?? false,
                    bot: them?.kind === "bot",
                };
            default:
                return {
                    name: chatSummary.name,
                    diamondStatus: "inactive" as DiamondMembershipStatus["kind"],
                    streak: 0,
                    avatarUrl: client.groupAvatarUrl(chatSummary, $selectedCommunity),
                    userId: undefined,
                    typing: client.getTypingString(
                        $_,
                        $userStore,
                        { chatId: chatSummary.id },
                        typing,
                    ),
                    fav,
                    eventsTTL: chatSummary.eventsTTL,
                    video,
                    private: !chatSummary.public,
                    uniquePerson: false,
                    bot: false,
                };
        }
    }

    function getUnreadMentionCount(chat: ChatSummary): number {
        if (chat.kind === "direct_chat") return 0;
        return chat.membership.mentions.filter(
            (m) => !client.isMessageRead({ chatId: chat.id }, m.messageIndex, m.messageId),
        ).length;
    }

    function formatLatestMessage(chatSummary: ChatSummary, users: UserLookup): string {
        if (chatSummary.latestMessageIndex === undefined || externalContent) {
            return "";
        }

        if (
            (chatSummary.latestMessage !== undefined &&
                chatSummary.eventsTtlLastUpdated > chatSummary.latestMessage.timestamp) ||
            (chatSummary.latestMessage === undefined &&
                chatSummary.eventsTTL !== undefined &&
                chatSummary.membership.role !== "none")
        ) {
            return chatSummary.eventsTTL !== undefined
                ? $_("disappearingMessages.timeUpdated", {
                      values: {
                          duration: client.formatDuration(Number(chatSummary.eventsTTL)),
                      },
                  })
                : $_("disappearingMessages.disabled");
        }

        if (chatSummary.latestMessage === undefined) {
            return "";
        }

        const latestMessageText = client.getContentAsText(
            $_,
            chatSummary.latestMessage.event.content,
        );

        if (chatSummary.kind === "direct_chat") {
            return latestMessageText;
        }

        const user = buildDisplayName(
            users,
            chatSummary.latestMessage.event.sender,
            chatSummary.latestMessage.event.sender === userId,
            false,
        );

        return `${user}: ${latestMessageText}`;
    }

    /***
     * This needs to be called both when the chatSummary changes (because that may have changed the latestMessage)
     * and when the internal state of the MessageReadTracker changes. Both are necessary to get the right value
     * at all times.
     */
    function updateUnreadCounts(chatSummary: ChatSummary) {
        unreadMessages = client.unreadMessageCount(
            chatSummary.id,
            chatSummary.latestMessage?.event.messageIndex,
        );
        unreadMentions = getUnreadMentionCount(chatSummary);

        if (chatSummary.membership.archived && unreadMessages > 0) {
            unarchiveChat();
        }
    }

    function deleteDirectChat(e: Event) {
        e.stopPropagation();
        e.preventDefault();
        if (
            $pathParams.kind === "global_chat_selected_route" &&
            chatIdentifiersEqual(chatSummary.id, $pathParams.chatId)
        ) {
            page(routeForScope($chatListScope));
        }
        tick().then(() => client.removeChat(chatSummary.id));
        delOffset = -60;
    }

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
        client.pinChat(chatSummary.id).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("pinChat.failed"));
            }
        });
    }

    function unpinChat() {
        client.unpinChat(chatSummary.id).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("pinChat.unpinFailed"));
            }
        });
    }

    function toggleMuteNotifications(mute: boolean) {
        onToggleMuteNotifications(chatSummary.id, mute);
    }

    function archiveChat() {
        client.markAllRead(chatSummary);
        client.archiveChat(chatSummary.id).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("archiveChatFailed"));
            }
        });
        if (chatSummary.id === $selectedChatId) {
            page(routeForScope($chatListScope));
        }
    }

    function selectChat() {
        onChatSelected(chatSummary);
    }

    function addToFavourites() {
        client.addToFavourites(chatSummary.id);
    }

    function removeFromFavourites() {
        client.removeFromFavourites(chatSummary.id);
    }

    function unarchiveChat() {
        onUnarchiveChat(chatSummary.id);
    }

    function leaveGroup() {
        if (chatSummary.kind === "direct_chat") return;
        onLeaveGroup({
            kind: "leave",
            chatId: chatSummary.id,
            level: chatSummary.level,
        });
    }

    function getCanDelete(chat: ChatSummary, community: CommunitySummary | undefined) {
        switch (chat.kind) {
            case "direct_chat":
                return chat.latestMessage === undefined;
            case "group_chat":
                return chat.membership.role === "none";
            case "channel":
                return (
                    community !== undefined &&
                    community.membership.role !== "none" &&
                    chat.membership.role === "none"
                );
        }
    }
</script>

{#if visible}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        role="button"
        class="chat-summary"
        class:selected
        tabindex="0"
        use:swipe={{ threshold: 20 }}
        onswiping={swiping}
        onleftswipe={leftSwipe}
        onrightswipe={rightSwipe}
        class:empty={canDelete}
        class:rtl={$rtlStore}
        onmouseenter={() => (hovering = true)}
        onmouseleave={() => (hovering = false)}
        onclick={selectChat}>
        <div class="avatar">
            <Avatar
                statusBorder={selected || hovering ? "var(--chatSummary-hv)" : "transparent"}
                {blocked}
                bot={chat.bot}
                url={chat.avatarUrl}
                showStatus
                userId={chat.userId?.userId}
                size={AvatarSize.Default} />
            {#if chat.eventsTTL}
                <div class="expires">
                    <CameraTimer size={"1em"} color={"var(--txt)"} />
                </div>
            {/if}
            <VideoCallIcon video={chat.video} />
        </div>
        <div class="details" class:rtl={$rtlStore}>
            <div class="name-date">
                <div class="chat-name">
                    {#if chat.private}
                        <div class="private"></div>
                    {/if}
                    <WithVerifiedBadge {verified} size={"small"}>
                        <h4>
                            {#if community !== undefined && $chatListScope.kind === "favourite"}
                                <span>{community.name}</span>
                                <span>{">"}</span>
                            {/if}
                            <span>{chat.name}</span>
                        </h4>
                        <Badges
                            uniquePerson={chat.uniquePerson}
                            diamondStatus={chat.diamondStatus}
                            streak={chat.streak} />
                    </WithVerifiedBadge>
                </div>
            </div>
            <div class="chat-msg">
                {#if chat.typing !== undefined}
                    {chat.typing} <Typing />
                {:else}
                    <Markdown text={lastMessage} oneLine suppressLinks />
                {/if}
            </div>
        </div>
        {#if !externalContent}
            <!-- this date formatting is OK for now but we might want to use something like this:
            https://date-fns.org/v2.22.1/docs/formatDistanceToNow -->
            <div class:rtl={$rtlStore} class="chat-date">
                {#if muted && notificationsSupported}
                    <div class="mute icon" class:rtl={$rtlStore}>
                        <MutedIcon size={"1em"} color={"var(--icon-txt)"} />
                    </div>
                {/if}
                {#if pinned}
                    <div class="pin icon">
                        <PinIcon size={"1em"} color={"var(--icon-txt)"} />
                    </div>
                {/if}
                {#if chat.fav}
                    <div class="fav icon">
                        <Heart size={"1em"} color={"var(--icon-txt)"} />
                    </div>
                {/if}
                {client.formatMessageDate(displayDate, $_("today"), $_("yesterday"), true, true)}
            </div>
            {#if !readonly}
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
                        class:muted
                        class="notification">
                        {unreadMessages > 999 ? "999+" : unreadMessages}
                    </div>
                {/if}
                {#if !$suspendedUser}
                    <div class="menu">
                        <MenuIcon position={"bottom"} align={"end"}>
                            {#snippet menuIcon()}
                                <div class="menu-icon" class:rtl={$rtlStore}>
                                    <DotsVertical
                                        viewBox="0 -3 24 24"
                                        size="1.6em"
                                        color={"var(--icon-txt)"} />
                                </div>
                            {/snippet}
                            {#snippet menuItems()}
                                <Menu>
                                    {#if !$favouritesStore.has(chatSummary.id)}
                                        <MenuItem onclick={addToFavourites}>
                                            {#snippet icon()}
                                                <HeartPlus
                                                    size={$iconSize}
                                                    color={"var(--menu-warn)"} />
                                            {/snippet}
                                            {#snippet text()}
                                                <Translatable
                                                    resourceKey={i18nKey(
                                                        "communities.addToFavourites",
                                                    )} />
                                            {/snippet}
                                        </MenuItem>
                                    {:else}
                                        <MenuItem onclick={removeFromFavourites}>
                                            {#snippet icon()}
                                                <HeartMinus
                                                    size={$iconSize}
                                                    color={"var(--menu-warn)"} />
                                            {/snippet}
                                            {#snippet text()}
                                                <Translatable
                                                    resourceKey={i18nKey(
                                                        "communities.removeFromFavourites",
                                                    )} />
                                            {/snippet}
                                        </MenuItem>
                                    {/if}
                                    {#if !pinned}
                                        <MenuItem onclick={pinChat}>
                                            {#snippet icon()}
                                                <PinIcon
                                                    size={$iconSize}
                                                    color={"var(--icon-inverted-txt)"} />
                                            {/snippet}
                                            {#snippet text()}
                                                <Translatable
                                                    resourceKey={i18nKey("pinChat.menuItem")} />
                                            {/snippet}
                                        </MenuItem>
                                    {:else}
                                        <MenuItem onclick={unpinChat}>
                                            {#snippet icon()}
                                                <PinOffIcon
                                                    size={$iconSize}
                                                    color={"var(--icon-inverted-txt)"} />
                                            {/snippet}
                                            {#snippet text()}
                                                <Translatable
                                                    resourceKey={i18nKey(
                                                        "pinChat.unpinMenuItem",
                                                    )} />
                                            {/snippet}
                                        </MenuItem>
                                    {/if}
                                    {#if notificationsSupported && !externalContent}
                                        {#if muted}
                                            <MenuItem
                                                onclick={() => toggleMuteNotifications(false)}>
                                                {#snippet icon()}
                                                    <BellIcon
                                                        size={$iconSize}
                                                        color={"var(--icon-inverted-txt)"} />
                                                {/snippet}
                                                {#snippet text()}
                                                    <Translatable
                                                        resourceKey={i18nKey(
                                                            "unmuteNotifications",
                                                        )} />
                                                {/snippet}
                                            </MenuItem>
                                        {:else}
                                            <MenuItem onclick={() => toggleMuteNotifications(true)}>
                                                {#snippet icon()}
                                                    <MutedIcon
                                                        size={$iconSize}
                                                        color={"var(--icon-inverted-txt)"} />
                                                {/snippet}
                                                {#snippet text()}
                                                    <Translatable
                                                        resourceKey={i18nKey(
                                                            "muteNotifications",
                                                        )} />
                                                {/snippet}
                                            </MenuItem>
                                        {/if}
                                    {/if}
                                    {#if !externalContent}
                                        <MenuItem
                                            disabled={unreadMessages === 0}
                                            onclick={() => client.markAllRead(chatSummary)}>
                                            {#snippet icon()}
                                                <CheckboxMultipleMarked
                                                    size={$iconSize}
                                                    color={"var(--icon-inverted-txt)"} />
                                            {/snippet}
                                            {#snippet text()}
                                                <Translatable
                                                    resourceKey={i18nKey("markAllRead")} />
                                            {/snippet}
                                        </MenuItem>
                                    {/if}
                                    {#if chatSummary.membership.archived}
                                        <MenuItem onclick={selectChat}>
                                            {#snippet icon()}
                                                <ArchiveOffIcon
                                                    size={$iconSize}
                                                    color={"var(--icon-inverted-txt)"} />
                                            {/snippet}
                                            {#snippet text()}
                                                <Translatable
                                                    resourceKey={i18nKey("unarchiveChat")} />
                                            {/snippet}
                                        </MenuItem>
                                    {:else}
                                        <MenuItem onclick={archiveChat}>
                                            {#snippet icon()}
                                                <ArchiveIcon
                                                    size={$iconSize}
                                                    color={"var(--icon-inverted-txt)"} />
                                            {/snippet}
                                            {#snippet text()}
                                                <Translatable
                                                    resourceKey={i18nKey("archiveChat")} />
                                            {/snippet}
                                        </MenuItem>
                                    {/if}
                                    {#if chatSummary.kind !== "direct_chat" && client.canLeaveGroup(chatSummary.id)}
                                        <MenuItem warning onclick={leaveGroup}>
                                            {#snippet icon()}
                                                <LocationExit
                                                    size={$iconSize}
                                                    color={"var(--menu-warn)"} />
                                            {/snippet}
                                            {#snippet text()}
                                                {interpolate(
                                                    $_,
                                                    i18nKey(
                                                        "leaveGroup",
                                                        undefined,
                                                        chatSummary.level,
                                                        true,
                                                    ),
                                                )}
                                            {/snippet}
                                        </MenuItem>
                                    {/if}
                                </Menu>
                            {/snippet}
                        </MenuIcon>
                    </div>
                {/if}
            {/if}
        {/if}
        {#if canDelete}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                title={$_("removeChat")}
                style={$mobileWidth
                    ? $rtlStore
                        ? `left: ${delOffset}px`
                        : `right: ${delOffset}px`
                    : ""}
                onclick={deleteDirectChat}
                class:rtl={$rtlStore}
                class="delete-chat">
                <Delete size={$iconSize} color={"#fff"} />
            </div>
        {/if}
    </div>
{/if}

<style lang="scss">
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
        transition:
            background-color ease-in-out 100ms,
            border-color ease-in-out 100ms;
        user-select: none;

        @include mobile() {
            padding: $sp3 toRem(10);
        }

        @media (hover: hover) {
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
        }

        &.selected {
            background-color: var(--chatSummary-bg-selected);
        }

        .menu {
            flex: 0;
        }

        .menu-icon {
            width: 0;
            transition:
                width 200ms ease-in-out,
                opacity 200ms;
            height: 0;
            opacity: 0;
            position: relative;
            bottom: 0.4em;

            @include mobile() {
                width: 18px;
                opacity: 0.4;
                margin-left: 6px;

                &.rtl {
                    margin-left: unset;
                    margin-right: 6px;
                }
            }
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

        @media (hover) {
            &:hover {
                .menu-icon {
                    transition-delay: 200ms;
                    width: $sp4;
                    opacity: 1;
                }
            }
        }
    }
    .avatar {
        flex: 0 0 40px;
        position: relative;
    }

    .expires {
        @include disappearing();
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
                h4 {
                    @include font(medium, normal, fs-100);
                    display: flex;
                    flex-direction: row;
                    gap: $sp2;
                }

                display: flex;
                align-items: center;
                gap: $sp2;

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
        display: flex;
        gap: $sp2;
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

        &.muted {
            background-color: var(--unread-mute);
            color: var(--unread-mute-txt);
            text-shadow: none;
        }
    }

    .mention {
        margin-right: 2px;
        &.rtl {
            margin-left: 2px;
        }
    }
    .private {
        background-repeat: no-repeat;
        $size: 12px;
        flex: 0 0 $size;
        width: $size;
        height: $size;
        background-image: url("/assets/locked.svg");
    }
</style>
