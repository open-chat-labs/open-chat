<!-- The middle column's conversation (region "conversation", phase 3b): the selected chat's header
     and its messages, read only (the composer is 3c). The list is the old UI's (ChatEventList: paging,
     deep links, marking read, keeping the scroll), one row per event, each message in a MessageGroup
     of its own that keeps its place in the sender's run (DATA.md, Conversation). -->
<script lang="ts">
    import {
        allUsersStore,
        byContext as typersByContext,
        chatIdentifiersEqual,
        chatIdentifierToString,
        chatsInitialisedStore,
        currentUserIdStore,
        eventsStore,
        failedMessagesStore,
        favouritesStore,
        messageIndexStore,
        messagesRead,
        ROLE_NONE,
        selectedChatExpandedDeletedMessageStore,
        selectedChatIdStore,
        selectedChatSummaryStore,
        selectedCommunitySummaryStore,
        threadOpenStore,
        TimelineGrouper,
        unconfirmedReadByThem,
        unconfirmedStore,
        type ChatEvent,
        type ChatIdentifier,
        type EventWrapper,
        type Message,
        type OpenChat,
    } from "@client";
    import ConversationHeader from "@openchat/ui/src/features/components/ConversationHeader.svelte";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import IconButton from "@openchat/ui/src/lib/components/IconButton.svelte";
    import MessageGroup from "@openchat/ui/src/lib/components/MessageGroup.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import UnreadDivider from "@openchat/ui/src/lib/components/UnreadDivider.svelte";
    import ChatEventList, { type ChatEventListArgs } from "@shared_components/ChatEventList.svelte";
    import { TimelineFlattener, type FlatChatItem } from "@shared_components/flatChatItems";
    import Markdown from "@shared_components/Markdown.svelte";
    import { isSingleEmoji } from "@src/utils/emojis";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { MiddleRegion, ScreenProps } from "../app/screens";
    import {
        eventLines,
        messageRow,
        messageStatus,
        senderColor,
        type ConversationContext,
        type EventContext,
    } from "./conversation.adapter";

    let { context: screen }: ScreenProps<Extract<MiddleRegion, { kind: "conversation" }>> =
        $props();

    const client = getContext<OpenChat>("client");

    // the route's chat, once the client has selected it (Router: setSelectedChat)
    const chat = $derived($selectedChatSummaryStore);
    const me = $derived($currentUserIdStore);

    const ctx = $derived.by((): ConversationContext => {
        const users = $allUsersStore;
        return {
            me,
            you: $_("you"),
            userName: (userId) => client.displayName(users.get(userId)),
            contentText: (content) => client.getContentAsText($_, content),
            time: (timestamp) => client.toShortTimeString(new Date(Number(timestamp))),
            date: (timestamp) =>
                client.formatMessageDate(timestamp, $_("today"), $_("yesterday"), true, true),
        };
    });

    const eventCtx = $derived.by((): EventContext => {
        const users = $allUsersStore;
        const user = users.get(me);
        return {
            me,
            you: $_("you"),
            userName: ctx.userName,
            members: (userIds) =>
                user === undefined
                    ? userIds.map(ctx.userName).join(", ")
                    : client.getMembersString(
                          user,
                          users,
                          userIds,
                          $_("unknownUser"),
                          $_("you"),
                          client.compareIsNotYouThenUsername(me),
                          false,
                      ),
            t: (key, values) => $_(key, { values }),
            level: $_(`level.${chat?.kind === "channel" ? "channel" : "group"}`).toLowerCase(),
        };
    });

    // ── the header ──

    const title = $derived(
        chat === undefined
            ? ""
            : chat.kind === "direct_chat"
              ? client.displayName($allUsersStore.get(chat.them.userId))
              : chat.name,
    );
    const typingText = $derived(
        chat && client.getTypingString($_, $allUsersStore, { chatId: chat.id }, $typersByContext),
    );
    const favourite = $derived(chat !== undefined && $favouritesStore.has(chat.id));

    // TODO(phase 5): the menu's other items (block, delete, leave, invite) open dialogs, and the
    // search action; calls are phase 8
    function onMenu(id: string) {
        if (chat === undefined) return;
        switch (id) {
            case "favourite":
                client.addToFavourites(chat.id);
                break;
            case "unfavourite":
                client.removeFromFavourites(chat.id);
                break;
            case "mute":
            case "unmute":
                client.toggleMuteNotifications(chat.id, id === "mute", undefined);
                break;
            case "muteEveryone":
            case "unmuteEveryone":
                client.toggleMuteNotifications(chat.id, undefined, id === "muteEveryone");
                break;
            case "copyUrl":
                navigator.clipboard?.writeText(location.origin + location.pathname);
                break;
        }
    }

    // ── what can be shown ──

    // a private chat or community that isn't joined shows no messages (as the old UI)
    const privatePreview = $derived.by(() => {
        if (chat === undefined) return false;
        const community = $selectedCommunitySummaryStore;
        const privateCommunity =
            community !== undefined &&
            (community.membership.role === ROLE_NONE || community.membership.lapsed) &&
            (!community.public || community.gateConfig.gate.kind !== "no_gate");
        return privateCommunity || client.maskChatMessages(chat);
    });
    const readonly = $derived(chat !== undefined && client.isChatReadOnly(chat.id));

    // ── the timeline ──

    const grouper = new TimelineGrouper();
    const flattener = new TimelineFlattener();
    const items = $derived.by((): FlatChatItem[] => {
        if (chat === undefined) return [];
        const timeline = grouper.group(
            $eventsStore,
            me,
            chat.kind === "channel" && chat.public,
            $selectedChatExpandedDeletedMessageStore,
            undefined,
            true,
        );
        return flattener.flatten(timeline);
    });

    // The first unread message when the chat was opened: the unread divider stays above it while
    // the chat is open, as messages are read
    let firstUnread = $state<{ chatId: ChatIdentifier; index: number | undefined }>();
    $effect(() => {
        const current = chat;
        if (current === undefined) return;
        untrack(() => {
            if (
                firstUnread === undefined ||
                !chatIdentifiersEqual(firstUnread.chatId, current.id)
            ) {
                firstUnread = {
                    chatId: current.id,
                    index: messagesRead.getFirstUnreadMessageIndex(
                        current.id,
                        current.latestMessage?.event.messageIndex,
                    ),
                };
            }
        });
    });

    // Go to the route's message (a deep link), as the old list does: when it changes, and when the
    // chat does
    let list: ChatEventList | undefined = $state();
    let initialised = $state(false);

    // A new chat's list starts uninitialised, as the old UI's did, unless the chat has nothing to
    // load
    const chatKey = $derived(chat && chatIdentifierToString(chat.id));
    let initialisedFor: string | undefined;
    $effect.pre(() => {
        const key = chatKey;
        if (key === initialisedFor) return;
        initialisedFor = key;
        initialised = untrack(() => chat !== undefined && chat.latestEventIndex <= 0);
    });
    let previousChatId: ChatIdentifier | undefined;
    let previousMessageIndex: number | undefined;
    $effect(() => {
        void $threadOpenStore;
        const idx = $messageIndexStore;
        const chatId = $selectedChatIdStore;
        const sameChat = chatIdentifiersEqual(chatId, previousChatId);
        if (
            $chatsInitialisedStore &&
            chatId !== undefined &&
            idx !== undefined &&
            (!sameChat || idx !== previousMessageIndex)
        ) {
            untrack(() => list?.scrollToMessageIndex({ chatId }, idx, false));
        }
        previousChatId = chatId;
        previousMessageIndex = idx;
    });

    function status(evt: EventWrapper<Message>, args: ChatEventListArgs) {
        const msg = evt.event;
        return messageStatus({
            failed: args.isFailed($failedMessagesStore, evt),
            confirmed: args.isConfirmed($unconfirmedStore, evt),
            accepted: args.isAccepted($unconfirmedStore, evt),
            readByThem:
                chat?.kind === "direct_chat" &&
                (client.messageIsReadByThem(chat.id, msg.messageIndex) ||
                    $unconfirmedReadByThem.has(msg.messageId)),
        });
    }

    // a row the reader hasn't read is watched until it has been on screen long enough (the list's
    // observer reads data-index / data-id)
    function observeRead(
        node: HTMLElement,
        args: { observer?: IntersectionObserver; read: boolean },
    ) {
        let observer = args.observer;
        if (!args.read) observer?.observe(node);
        return {
            update(next: { observer?: IntersectionObserver; read: boolean }) {
                if (next.read || next.observer !== observer) observer?.unobserve(node);
                observer = next.observer;
                if (!next.read) observer?.observe(node);
            },
            destroy: () => observer?.unobserve(node),
        };
    }

    function isMessage(evt: EventWrapper<ChatEvent>): evt is EventWrapper<Message> {
        return evt.event.kind === "message";
    }
</script>

{#if chat === undefined}
    <div class="state"><Spinner /></div>
{:else}
    <div class="conversation">
        <ConversationHeader
            {title}
            kind={chat.kind === "direct_chat"
                ? "user"
                : chat.kind === "group_chat"
                  ? "group"
                  : "channel"}
            color={senderColor(chat.kind === "direct_chat" ? chat.them.userId : title)}
            verified={chat.kind === "group_chat" && chat.verified}
            presence={typingText ?? ""}
            visibility={chat.kind === "direct_chat"
                ? undefined
                : chat.public
                  ? "Public"
                  : "Private"}
            memberCount={chat.kind === "direct_chat" ? 0 : chat.memberCount}
            statusFav={favourite}
            statusMuted={chat.membership.notificationsMuted}
            statusEveryone={chat.membership.atEveryoneMuted}
            isFavourite={favourite}
            showMenu={!readonly}
            showCall={false}
            actions={[]}
            {onMenu}
            onTogglePanel={() => screen.rightColumn.toggle()}
            panelOpen={screen.rightColumn.open} />

        {#if privatePreview}
            <div class="state">
                <EmptyState
                    preset="no-conversations"
                    title={$_("group.privateGroup", { values: { level: eventCtx.level } })}
                    body={$_("group.privateGroupInfo", { values: { level: eventCtx.level } })}
                    actionLabel="" />
            </div>
        {:else}
            <div class="messages">
                <ChatEventList
                    bind:this={list}
                    rootSelector="conversation"
                    {chat}
                    threadRootEvent={undefined}
                    {items}
                    {readonly}
                    maintainScroll
                    visible
                    bind:initialised
                    viewportClass="conversation-list">
                    {#snippet row(item, args)}
                        {#if item.kind === "timeline_date"}
                            <div class="date">
                                <UnreadDivider
                                    tone="neutral"
                                    label={client.formatMessageDate(
                                        item.timestamp,
                                        $_("today"),
                                        $_("yesterday"),
                                    )} />
                            </div>
                        {:else if item.kind === "event"}
                            {@const evt = item.event}
                            {#if isMessage(evt)}
                                {@const msg = evt.event}
                                {@const row = messageRow(evt, status(evt, args), ctx)}
                                {@const failed = args.isFailed($failedMessagesStore, evt)}
                                {@const content = msg.content}
                                <!-- a text message's text as the old UI renders it: markdown, mentions,
                                     links, custom emoji (a lone emoji is the bubble's own, large) -->
                                {#snippet body()}
                                    {#if content.kind === "text_content"}
                                        <Markdown
                                            text={content.text}
                                            inline={!msg.blockLevelMarkdown} />
                                    {/if}
                                {/snippet}
                                <div
                                    class="row"
                                    class:starts={item.first}
                                    data-index={failed ? "" : msg.messageIndex}
                                    data-id={failed ? "" : msg.messageId}
                                    use:observeRead={{
                                        observer: args.messageObserver,
                                        read: args.isReadByMe($messagesRead, evt),
                                    }}>
                                    {#if firstUnread?.index === msg.messageIndex && msg.sender !== me}
                                        <div class="unread"><UnreadDivider /></div>
                                    {/if}
                                    <MessageGroup
                                        side={row.side}
                                        senderName={row.senderName}
                                        color={row.color}
                                        showAvatar={item.first}
                                        showName={item.first &&
                                            row.side === "received" &&
                                            chat.kind !== "direct_chat"}
                                        avatarSpace
                                        endsRun={item.last}
                                        marked={args.focusIndex === msg.messageIndex ? 0 : -1}
                                        messages={[
                                            content.kind === "text_content" &&
                                            !isSingleEmoji(content.text)
                                                ? { ...row.message, body }
                                                : row.message,
                                        ]} />
                                </div>
                            {:else}
                                {@const lines = eventLines(evt.event, eventCtx)}
                                {#if lines.length > 0}
                                    <div
                                        class="event"
                                        data-index={evt.event.kind === "aggregate_common_events" &&
                                        evt.event.messagesDeleted.length > 0
                                            ? evt.event.messagesDeleted.join(" ")
                                            : undefined}
                                        use:observeRead={{
                                            observer: args.messageObserver,
                                            read:
                                                evt.event.kind !== "aggregate_common_events" ||
                                                evt.event.messagesDeleted.length === 0 ||
                                                args.isReadByMe($messagesRead, evt),
                                        }}>
                                        <!-- TODO(design): no event line in the design; the old UI's wording -->
                                        {#each lines as line}
                                            <p class="event-line">
                                                <Markdown oneLine suppressLinks text={line} />
                                            </p>
                                        {/each}
                                    </div>
                                {/if}
                            {/if}
                        {/if}
                    {/snippet}
                    {#snippet fabs({ showGoToBottom, scrollToLast })}
                        {#if showGoToBottom}
                            <div class="to-bottom">
                                <IconButton
                                    icon="arrow-down"
                                    label={$_("goToLatestMessage")}
                                    onClick={scrollToLast} />
                            </div>
                        {/if}
                    {/snippet}
                </ChatEventList>
            </div>
        {/if}
    </div>
{/if}

<style>
    .conversation {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .state {
        flex: 1;
        display: grid;
        place-items: center;
        height: 100%;
    }

    .messages {
        position: relative;
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
    }

    :global(.vcl-viewport.conversation-list) {
        flex: auto;
        padding: 0 var(--space-24);
        overflow-x: hidden;
        overscroll-behavior-y: contain;
        scrollbar-width: thin;
    }

    /* a message continuing its sender's run sits close under the one before it; a new run, a
       date or an event line stands apart */
    .row {
        padding-block-start: var(--space-6);
    }

    .row.starts,
    .event,
    .date {
        padding-block-start: var(--space-16);
    }

    /* the old UI's markdown, inside the bubble's own text: no outer spacing */
    .row :global(.markdown-wrapper > p:first-child),
    .row :global(.markdown-wrapper > ul:first-child),
    .row :global(.markdown-wrapper > ol:first-child) {
        margin-block-start: 0;
    }

    .row :global(.markdown-wrapper > :last-child) {
        margin-block-end: 0;
    }

    .unread {
        padding-block-end: var(--space-12);
    }

    .event-line {
        margin: 0;
        text-align: center;
        font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
        color: var(--ink-3);
    }

    .to-bottom {
        position: absolute;
        inset-block-end: var(--space-16);
        inset-inline-end: var(--space-24);
    }
</style>
