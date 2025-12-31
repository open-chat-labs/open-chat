<script lang="ts">
    import { trackedEffect } from "@src/utils/effects.svelte";
    import {
        Avatar,
        Body,
        BodySmall,
        ColourVars,
        Container,
        CountBadge,
        MenuItem,
        MenuTrigger,
        Row,
        Subtitle,
    } from "component-lib";
    import type {
        ChatSummary,
        DiamondMembershipStatus,
        MessageContent,
        TypersByKey,
        UserLookup,
    } from "openchat-client";
    import {
        allUsersStore,
        chatIdentifiersEqual,
        chatListScopeStore,
        communitiesStore,
        currentUserIdStore,
        favouritesStore,
        messagesRead,
        notificationsSupported,
        OpenChat,
        pinnedChatsStore,
        publish,
        ROLE_NONE,
        routeForScope,
        selectedChatIdStore,
        selectedCommunitySummaryStore,
        suspendedUserStore,
        translationsStore,
        byContext as typersByContext,
    } from "openchat-client";
    import page from "page";
    import { getContext, onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import ArchiveIcon from "svelte-material-icons/Archive.svelte";
    import BellIcon from "svelte-material-icons/Bell.svelte";
    import MutedIcon from "svelte-material-icons/BellOff.svelte";
    import CameraTimer from "svelte-material-icons/CameraTimer.svelte";
    import CheckboxMultipleMarked from "svelte-material-icons/CheckboxMultipleMarked.svelte";
    import Heart from "svelte-material-icons/Heart.svelte";
    import Image from "svelte-material-icons/ImageOutline.svelte";
    import LocationExit from "svelte-material-icons/LocationExit.svelte";
    import LockOutline from "svelte-material-icons/LockOutline.svelte";
    import Phone from "svelte-material-icons/Phone.svelte";
    import PinIcon from "svelte-material-icons/Pin.svelte";
    import PinOffIcon from "svelte-material-icons/PinOff.svelte";
    import Sticker from "svelte-material-icons/StickerEmoji.svelte";
    import Swap from "svelte-material-icons/SwapHorizontal.svelte";
    import Video from "svelte-material-icons/VideoOutline.svelte";
    import Waveform from "svelte-material-icons/Waveform.svelte";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import { rtlStore } from "../../stores/rtl";
    import { now } from "../../stores/time";
    import { toastStore } from "../../stores/toast";
    import { buildDisplayName } from "../../utils/user";
    import Bitcoin from "../icons/Bitcoin.svelte";
    import HeartMinus from "../icons/HeartMinus.svelte";
    import HeartPlus from "../icons/HeartPlus.svelte";
    import MemeFighter from "../icons/MemeFighter.svelte";
    import WithVerifiedBadge from "../icons/WithVerifiedBadge.svelte";
    import Translatable from "../Translatable.svelte";
    import Typing from "../Typing.svelte";
    import ArchiveOffIcon from "./ArchiveOffIcon.svelte";
    import Markdown from "./Markdown.svelte";
    import BotBadge from "./profile/BotBadge.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chatSummary: ChatSummary;
        selected: boolean;
        visible: boolean;
        onChatSelected: (chat: ChatSummary) => void;
    }

    let { chatSummary, visible, onChatSelected }: Props = $props();

    let externalContent = $derived(
        chatSummary.kind === "channel" && chatSummary.externalUrl !== undefined,
    );
    let verified = $derived(chatSummary.kind === "group_chat" && chatSummary.verified);
    let unreadMessages = $state<number>(0);
    let chat = $derived(normaliseChatSummary($now, chatSummary, $typersByContext));
    let lastMessage = $derived(formatLatestMessage(chatSummary, $allUsersStore));
    let displayDate = $derived(client.getDisplayDate(chatSummary));
    let community = $derived(
        chatSummary.kind === "channel"
            ? $communitiesStore.get({ kind: "community", communityId: chatSummary.id.communityId })
            : undefined,
    );
    let readonly = $derived(client.isChatReadOnly(chatSummary.id));
    let pinned = $derived(
        $pinnedChatsStore
            .get($chatListScopeStore.kind)
            ?.find((id) => chatIdentifiersEqual(id, chatSummary.id)) !== undefined,
    );
    let muted = $derived(chatSummary.membership.notificationsMuted);
    let atEveryoneMuted = $derived(chatSummary.membership.atEveryoneMuted);
    let LastMessageIcon = $derived(getLastMessageIcon());

    $effect(() => updateUnreadCounts(chatSummary));

    onMount(() => {
        return messagesRead.subscribe(() => updateUnreadCounts(chatSummary));
    });

    trackedEffect("unarchive-chat", () => {
        if (chatSummary.membership.archived && unreadMessages > 0 && !chat.bot) {
            unarchiveChat();
        }
    });

    /***
     * This needs to be called both when the chatSummary changes (because that may have changed the latestMessage)
     * and when the internal state of the MessageReadTracker changes. Both are necessary to get the right value
     * at all times.
     */
    function updateUnreadCounts(chatSummary: ChatSummary) {
        untrack(() => {
            unreadMessages = client.unreadMessageCount(
                chatSummary.id,
                chatSummary.latestMessage?.event.messageIndex,
            );

            if (chatSummary.membership.archived && unreadMessages > 0 && !chat.bot) {
                unarchiveChat();
            }
        });
    }

    function getLastMessageIcon() {
        switch (chatSummary.latestMessage?.event?.content?.kind) {
            case "audio_content":
                return Waveform;
            case "giphy_content":
                return Sticker;
            case "p2p_swap_content":
            case "p2p_swap_content_initial":
                return Swap;
            case "crypto_content":
                return Bitcoin;
            case "image_content":
                return Image;
            case "meme_fighter_content":
                return MemeFighter;
            case "video_call_content":
                return Phone;
            case "video_content":
                return Video;
            default:
                return undefined;
        }
    }

    function normaliseChatSummary(_now: number, chatSummary: ChatSummary, typing: TypersByKey) {
        const fav =
            $chatListScopeStore.kind !== "favourite" && $favouritesStore.has(chatSummary.id);
        const muted = chatSummary.membership.notificationsMuted;
        const video = chatSummary.videoCallInProgress
            ? { muted: muted ? 1 : 0, unmuted: muted ? 0 : 1 }
            : { muted: 0, unmuted: 0 };
        switch (chatSummary.kind) {
            case "direct_chat":
                const them = $allUsersStore.get(chatSummary.them.userId);
                return {
                    name: client.displayName(them),
                    diamondStatus: them?.diamondStatus ?? "inactive",
                    streak: them?.streak ?? 0,
                    chitEarned: them?.totalChitEarned,
                    hasAchievedMaxStreak: (them?.maxStreak ?? 0) >= 365,
                    avatarUrl: client.userAvatarUrl(them),
                    userId: chatSummary.them,
                    typing: client.getTypingString(
                        $_,
                        $allUsersStore,
                        { chatId: chatSummary.id },
                        typing,
                    ),
                    fav,
                    eventsTTL: chatSummary.eventsTTL,
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
                    chitEarned: undefined,
                    hasAchievedMaxStreak: false,
                    avatarUrl: client.groupAvatarUrl(chatSummary, $selectedCommunitySummaryStore),
                    userId: undefined,
                    typing: client.getTypingString(
                        $_,
                        $allUsersStore,
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

    function translateMessage(messageId: bigint, content: MessageContent): MessageContent {
        const translation = $translationsStore.get(messageId);
        return translation ? client.applyTranslation(content, translation) : content;
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
                chatSummary.membership.role !== ROLE_NONE)
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
            translateMessage(
                chatSummary.latestMessage.event.messageId,
                chatSummary.latestMessage.event.content,
            ),
        );

        if (chatSummary.kind === "direct_chat") {
            return latestMessageText;
        }

        let userType: "user" | "me" | "webhook" = "user";
        if (chatSummary.latestMessage.event.senderContext?.kind === "webhook") {
            userType = "webhook";
        } else if (chatSummary.latestMessage.event.sender === $currentUserIdStore) {
            userType = "me";
        }

        const user = buildDisplayName(
            users,
            chatSummary.latestMessage.event.sender,
            userType,
            false,
        );

        return `${user}: ${latestMessageText}`;
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

    function toggleMuteNotifications(
        mute: boolean | undefined,
        muteAtEveryone: boolean | undefined,
    ) {
        publish("toggleMuteNotifications", { chatId: chatSummary.id, mute, muteAtEveryone });
    }

    function archiveChat() {
        client.markAllRead(chatSummary);
        client.archiveChat(chatSummary.id).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("archiveChatFailed"));
            }
        });
        if (chatSummary.id === $selectedChatIdStore) {
            page(routeForScope($chatListScopeStore));
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
        publish("unarchiveChat", chatSummary.id);
    }

    function leaveGroup() {
        if (chatSummary.kind === "direct_chat") return;
        publish("leaveGroup", {
            kind: "leave",
            chatId: chatSummary.id,
            level: chatSummary.level,
        });
    }
</script>

{#if visible}
    <!-- svelte-ignore a11y_click_events_have_key_events -->

    <MenuTrigger
        fill
        maskUI
        classString={"chat_summary_menu_trigger"}
        disabled={$suspendedUserStore || readonly}
        position={"top"}
        align={"end"}
        mobileMode={"longpress"}>
        {#snippet menuItems()}
            {#if !$favouritesStore.has(chatSummary.id)}
                <MenuItem onclick={addToFavourites}>
                    {#snippet icon(_, size)}
                        <HeartPlus color={"var(--error)"} {size} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("communities.addToFavourites")} />
                </MenuItem>
            {:else}
                <MenuItem onclick={removeFromFavourites}>
                    {#snippet icon(_, size)}
                        <HeartMinus color={"var(--error)"} {size} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("communities.removeFromFavourites")} />
                </MenuItem>
            {/if}
            {#if !pinned}
                <MenuItem onclick={pinChat}>
                    {#snippet icon(color, size)}
                        <PinIcon {color} {size} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("pinChat.menuItem")} />
                </MenuItem>
            {:else}
                <MenuItem onclick={unpinChat}>
                    {#snippet icon(color, size)}
                        <PinOffIcon {color} {size} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("pinChat.unpinMenuItem")} />
                </MenuItem>
            {/if}
            {#if notificationsSupported && !externalContent}
                {#if muted}
                    <MenuItem onclick={() => toggleMuteNotifications(false, undefined)}>
                        {#snippet icon(color, size)}
                            <BellIcon {color} {size} />
                        {/snippet}
                        <Translatable resourceKey={i18nKey("unmuteNotifications")} />
                    </MenuItem>
                {:else}
                    <MenuItem onclick={() => toggleMuteNotifications(true, undefined)}>
                        {#snippet icon(color, size)}
                            <MutedIcon {color} {size} />
                        {/snippet}
                        <Translatable resourceKey={i18nKey("muteNotifications")} />
                    </MenuItem>
                {/if}
                {#if atEveryoneMuted}
                    <MenuItem onclick={() => toggleMuteNotifications(undefined, false)}>
                        {#snippet icon(color, size)}
                            <MutedIcon {color} {size} />
                        {/snippet}
                        <Translatable resourceKey={i18nKey("unmuteAtEveryone")} />
                    </MenuItem>
                {:else}
                    <MenuItem onclick={() => toggleMuteNotifications(undefined, true)}>
                        {#snippet icon(color, size)}
                            <MutedIcon {color} {size} />
                        {/snippet}
                        <Translatable resourceKey={i18nKey("muteAtEveryone")} />
                    </MenuItem>
                {/if}
            {/if}
            {#if !externalContent}
                <MenuItem
                    disabled={unreadMessages === 0}
                    onclick={() => client.markAllRead(chatSummary)}>
                    {#snippet icon(color, size)}
                        <CheckboxMultipleMarked {size} {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("markAllRead")} />
                </MenuItem>
            {/if}
            {#if !chat.bot}
                {#if chatSummary.membership.archived}
                    <MenuItem onclick={selectChat}>
                        {#snippet icon(color, size)}
                            <ArchiveOffIcon {color} {size} />
                        {/snippet}
                        <Translatable resourceKey={i18nKey("unarchiveChat")} />
                    </MenuItem>
                {:else}
                    <MenuItem onclick={archiveChat}>
                        {#snippet icon(color, size)}
                            <ArchiveIcon {color} {size} />
                        {/snippet}
                        <Translatable resourceKey={i18nKey("archiveChat")} />
                    </MenuItem>
                {/if}
            {/if}
            {#if chatSummary.kind !== "direct_chat" && client.canLeaveGroup(chatSummary.id)}
                <MenuItem danger onclick={leaveGroup}>
                    {#snippet icon(color, size)}
                        <LocationExit {color} {size} />
                    {/snippet}
                    {interpolate($_, i18nKey("leaveGroup", undefined, chatSummary.level, true))}
                </MenuItem>
            {/if}
        {/snippet}
        <Container
            onClick={selectChat}
            supplementalClass={"chat_summary"}
            padding={["sm", "lg"]}
            mainAxisAlignment={"spaceBetween"}
            crossAxisAlignment={"center"}
            gap={"lg"}>
            <div class="avatar">
                <Avatar size={"lg"} url={chat.avatarUrl} name={chat.name} />
                {#if chat.eventsTTL}
                    <div class="expires">
                        <CameraTimer size={"1em"} color={"var(--txt)"} />
                    </div>
                {/if}
                <!-- TODO video call info should be the displayed instead of the last message if tehre are active calls  -->
                <!-- <VideoCallIcon video={chat.video} /> -->
                {#if chat.private}
                    <div class="private">
                        <LockOutline size="0.85rem" color={ColourVars.error} />
                    </div>
                {/if}
            </div>
            <Container width={"fill"} direction={"vertical"}>
                <Container
                    gap={"lg"}
                    width={"fill"}
                    mainAxisAlignment={"spaceBetween"}
                    crossAxisAlignment={"center"}>
                    <Container crossAxisAlignment={"center"} gap={"sm"} width={"fill"}>
                        <WithVerifiedBadge {verified} size={"small"}>
                            <Subtitle ellipsisTruncate fontWeight={"semi-bold"}>
                                {#if community !== undefined && $chatListScopeStore.kind === "favourite"}
                                    <span>{community.name}</span>
                                    <span>{">"}</span>
                                {/if}
                                <span>{chat.name}</span>
                            </Subtitle>
                        </WithVerifiedBadge>
                        <BotBadge bot={chat.bot} />
                    </Container>
                    <Container
                        supplementalClass={"chat-date"}
                        width={"hug"}
                        gap={"xs"}
                        crossAxisAlignment={"center"}
                        mainAxisAlignment={"end"}>
                        {#if muted && notificationsSupported}
                            <div class="icon" class:rtl={$rtlStore}>
                                <MutedIcon size={"1em"} color={"var(--icon-txt)"} />
                            </div>
                        {/if}
                        {#if pinned}
                            <div class="icon">
                                <PinIcon size={"1em"} color={"var(--icon-txt)"} />
                            </div>
                        {/if}
                        {#if chat.fav}
                            <div class="icon">
                                <Heart size={"1em"} color={"var(--primary)"} />
                            </div>
                        {/if}
                        <BodySmall colour={"textSecondary"} fontWeight={"semi-bold"}>
                            {client.formatMessageDate(
                                displayDate,
                                $_("today"),
                                $_("yesterday"),
                                true,
                                true,
                            )}
                        </BodySmall>
                    </Container>
                </Container>
                <Container gap={"xs"} mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"end"}>
                    <Row gap={"xs"} crossAxisAlignment={"center"}>
                        {#if LastMessageIcon}
                            <LastMessageIcon color={ColourVars.textSecondary} />
                        {/if}
                        <Body ellipsisTruncate colour={"textSecondary"}>
                            {#if chat.typing !== undefined}
                                {chat.typing} <Typing />
                            {:else}
                                <Markdown text={lastMessage} oneLine suppressLinks />
                            {/if}
                        </Body>
                    </Row>
                    {#if unreadMessages > 0}
                        <CountBadge {muted}
                            >{unreadMessages > 999 ? "999+" : unreadMessages}
                        </CountBadge>
                    {/if}
                    <!-- TODO add read/received receipt -->
                </Container>
            </Container>
        </Container>
    </MenuTrigger>
{/if}

<style lang="scss">
    :global(.chat-name .with_verified) {
        gap: $sp2;
    }

    :global(.menu_trigger_clone > .chat_summary) {
        margin: 0 var(--sp-sm);
        padding: var(--sp-sm) var(--sp-sm) !important;
        border-radius: var(--rad-md) !important;
        background-color: var(--background-1) !important;
        box-shadow: var(--menu-sh);
        opacity: 1 !important;
    }

    :global(.chat_summary .chat-date) {
        color: var(--txt-light);
        @include font(book, normal, fs-60);
        .icon {
            display: flex;
        }
    }

    .avatar {
        display: flex;
        position: relative;
    }

    .expires {
        @include disappearing();
        bottom: 0;
        right: 0;
    }

    .private {
        $size: 1.35rem;
        position: absolute;
        right: -0.5rem;
        bottom: -0.05rem;
        display: flex;
        flex: 0 0 $size;
        align-items: center;
        justify-content: center;
        align-content: center;
        width: $size;
        height: $size;
        background-color: var(--background-0);
        border-radius: var(--rad-circle);
    }
</style>
