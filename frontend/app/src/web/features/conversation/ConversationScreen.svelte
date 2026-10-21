<!-- The middle column's conversation (region "conversation", phase 3b): the selected chat's header
     and its messages, read only (the composer is 3c). The list is the old UI's (ChatEventList: paging,
     deep links, marking read, keeping the scroll), one row per event, each message in a MessageGroup
     of its own that keeps its place in the sender's run (DATA.md, Conversation). -->
<script lang="ts">
    import {
        allUsersStore,
        anonUserStore,
        blockedUsersStore,
        botState,
        byContext as typersByContext,
        chatIdentifiersEqual,
        chatIdentifierToString,
        chatsInitialisedStore,
        currentUserIdStore,
        eventsStore,
        failedMessagesStore,
        favouritesStore,
        isPrivateCommunityPreview,
        localUpdates,
        messageIndexStore,
        messagesRead,
        muteNotificationsFailureMessage,
        selectedChatDraftMessageStore,
        selectedChatExpandedDeletedMessageStore,
        selectedChatIdStore,
        selectedChatSummaryStore,
        selectedCommunitySummaryStore,
        suspendedUserStore,
        threadOpenStore,
        throttleDeadline,
        TimelineGrouper,
        unconfirmedReadByThem,
        unconfirmedStore,
        type ChatEvent,
        type ChatIdentifier,
        type ChatSummary,
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
    import ChatEventList, { type ChatEventListArgs } from "@src/core/ChatEventList.svelte";
    import { TimelineFlattener, type FlatChatItem } from "@src/core/flatChatItems";
    import Markdown from "@src/core/Markdown.svelte";
    import type { GroupMessage } from "@openchat/ui/src/lib/types";
    import {
        entryBlock,
        expandMentions,
        throttleCountdown,
    } from "@src/logic/composer/composer";
    import { enterSend } from "@src/stores/settings";
    import { now500 } from "@src/stores/time";
    import { toastStore } from "@src/stores/toast";
    import { detectMarkdown } from "@src/utils/detectMarkdown";
    import { copyPageUrl } from "@src/utils/urls";
    import { isSingleEmoji } from "@src/utils/emojis";
    import { buildDisplayName } from "@src/utils/user";
    import {
        aggregateEventText,
        isTextEvent,
        timelineEventText,
        type EventTextContext,
    } from "@src/logic/conversation/timelineEventText";
    import { getContext, untrack, type Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import type { MiddleRegion, ScreenProps } from "../app/screens";
    import Composer from "./Composer.svelte";
    import {
        messageStatus,
        senderColor,
        untilNextDay,
        type ConversationContext,
        type MessageRow,
    } from "./conversation.adapter";
    import { RowCache } from "./rowCache";

    let { context: screen }: ScreenProps<Extract<MiddleRegion, { kind: "conversation" }>> =
        $props();

    const client = getContext<OpenChat>("client");

    // the route's chat, once the client has selected it (Router: setSelectedChat)
    const chat = $derived($selectedChatSummaryStore);
    const me = $derived($currentUserIdStore);

    // the day, which changes at midnight, so "Today" and "Yesterday" are worked out again then
    let day = $state(new Date().toDateString());
    $effect(() => {
        void day;
        const timer = setTimeout(
            () => (day = new Date().toDateString()),
            untilNextDay(new Date()) + 1000,
        );
        return () => clearTimeout(timer);
    });

    const ctx = $derived.by((): ConversationContext => {
        void day;
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

    const level = $derived(chat?.kind === "channel" ? "channel" : "group");
    const eventCtx = $derived.by((): EventTextContext => {
        const users = $allUsersStore;
        return {
            formatter: $_,
            me,
            users,
            displayName: (userId, kind) => buildDisplayName(users, userId, kind),
            level,
            canInvite: chat !== undefined && client.canInviteUsers(chat.id),
            botName: (botId) => botState.externalBots.get(botId)?.name,
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
    const favourite = $derived(chat !== undefined && $favouritesStore.has(chat.id));

    async function toggleMute(
        chatId: ChatIdentifier,
        mute: boolean | undefined,
        muteAtEveryone: boolean | undefined,
    ) {
        const success = await client.toggleMuteNotifications(chatId, mute, muteAtEveryone);
        if (!success) {
            toastStore.showFailureToast(muteNotificationsFailureMessage(mute, muteAtEveryone, $_));
        }
    }

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
                toggleMute(chat.id, id === "mute", undefined);
                break;
            case "muteEveryone":
            case "unmuteEveryone":
                toggleMute(chat.id, undefined, id === "muteEveryone");
                break;
            case "copyUrl":
                copyPageUrl(client);
                break;
        }
    }

    // ── the composer ──

    const block = $derived(
        chat === undefined
            ? undefined
            : entryBlock({
                  suspended: $suspendedUserStore,
                  frozen: client.isChatOrCommunityFrozen(chat, $selectedCommunitySummaryStore),
                  blocked: chat.kind === "direct_chat" && $blockedUsersStore.has(chat.them.userId),
                  previewing: chat.kind !== "direct_chat" && client.isPreviewing(chat.id),
                  lapsed: client.isLapsed(chat.id),
                  direct: chat.kind === "direct_chat",
                  externalContent: chat.kind === "channel" && chat.externalUrl !== undefined,
                  anonymous: $anonUserStore,
                  canSend: client.canSendMessage(chat.id, "message", "text"),
                  thread: false,
              }),
    );

    // the others in this chat who are typing
    const typingNames = $derived(
        chat === undefined
            ? []
            : [...($typersByContext.get({ chatId: chat.id }) ?? [])]
                  .filter((userId) => userId !== me)
                  .map((userId) => client.displayName($allUsersStore.get(userId))),
    );

    // too many messages a minute: a countdown until sending resumes (the old ThrottleCountdown);
    // the clock only ticks once there's a deadline
    const countdown = $derived(
        $throttleDeadline > 0 ? throttleCountdown($throttleDeadline, $now500) : undefined,
    );
    const throttled = $derived(
        countdown !== undefined
            ? $_("throttleMessage", { values: { time: countdown.seconds } })
            : "",
    );

    // done once the message shows in the chat; refused (throttled, the rules or the PIN turned
    // down, a send already on its way, a bot that takes no direct messages), it rejects
    async function send(chat: ChatSummary, text: string): Promise<void> {
        const context = { chatId: chat.id };
        // a direct chat with a bot sends what was typed as the bot's direct-message command
        // TODO(design): the old UI's command selector ("/") and its warning when the bot takes no
        // direct messages (GAPS.md)
        if (client.directChatWithBot(chat) !== undefined) {
            const outcome = client.sendDirectBotMessage(context, text, detectMarkdown(text));
            if (outcome.kind !== "sent") throw new Error(outcome.kind);
            return;
        }
        const { text: expanded, mentioned } = expandMentions(text, (username) =>
            client.lookupUserForMention(username, false),
        );
        const outcome = await client.sendMessage(
            context,
            expanded,
            detectMarkdown(text),
            undefined,
            mentioned,
        );
        if (outcome.kind !== "posted") throw new Error(outcome.kind);
    }

    // ── what can be shown ──

    // a private chat or community that isn't joined shows no messages (as the old UI)
    const privatePreview = $derived.by(() => {
        if (chat === undefined) return false;
        return (
            isPrivateCommunityPreview($selectedCommunitySummaryStore) ||
            client.maskChatMessages(chat)
        );
    });
    const readonly = $derived(chat !== undefined && client.isChatReadOnly(chat.id));
    const levelText = $derived($_(`level.${level}`).toLowerCase());

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
    // the chat is open, as messages are read. Worked out with the chat, so a new chat never shows
    // the last one's
    let firstUnreadFor: { key: string; index: number | undefined } | undefined;
    const firstUnread = $derived.by(() => {
        const current = chat;
        if (current === undefined) return undefined;
        const key = chatIdentifierToString(current.id);
        if (firstUnreadFor?.key !== key) {
            firstUnreadFor = {
                key,
                index: untrack(() =>
                    messagesRead.getFirstUnreadMessageIndex(
                        current.id,
                        current.latestMessage?.event.messageIndex,
                    ),
                ),
            };
        }
        return firstUnreadFor.index;
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
        // until the list is there (the chat loading, a private preview), the link waits for it
        const current = list;
        if (current === undefined) return;
        const sameChat = chatIdentifiersEqual(chatId, previousChatId);
        if (
            $chatsInitialisedStore &&
            chatId !== undefined &&
            idx !== undefined &&
            (!sameChat || idx !== previousMessageIndex)
        ) {
            untrack(() => current.scrollToMessageIndex({ chatId }, idx, false));
        }
        previousChatId = chatId;
        previousMessageIndex = idx;
    });

    function status(evt: EventWrapper<Message>, args: ChatEventListArgs, failed: boolean) {
        const msg = evt.event;
        return messageStatus({
            failed,
            accepted: args.isAccepted($unconfirmedStore, evt),
            readByThem:
                chat?.kind === "direct_chat" &&
                (client.messageIsReadByThem(chat.id, msg.messageIndex) ||
                    $unconfirmedReadByThem.has(msg.messageId)),
        });
    }

    // rows kept per event (RowCache), and their messages with them, so user and other chat
    // updates don't redo every bubble; started again for a new chat, wording or day
    const rows = new RowCache();
    const groupMessages = new WeakMap<MessageRow, GroupMessage[]>();
    $effect.pre(() => {
        void chatKey;
        void $_;
        void day;
        rows.clear();
    });

    // a date pill's label, worked out again when the day changes
    function dateLabel(timestamp: bigint): string {
        void day;
        return client.formatMessageDate(timestamp, $_("today"), $_("yesterday"));
    }

    function messagesFor(row: MessageRow, body: Snippet, withBody: boolean): GroupMessage[] {
        let messages = groupMessages.get(row);
        if (messages === undefined) {
            messages = [withBody ? { ...row.message, body } : row.message];
            groupMessages.set(row, messages);
        }
        return messages;
    }

    // a lone native emoji shows as the bubble's own, large; anything else (a custom emoji too)
    // goes through the markdown
    function withMarkdown(text: string): boolean {
        return !isSingleEmoji(text) || /^!emoji\(/.test(text);
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
            color={senderColor(
                chat.kind === "direct_chat" ? chat.them.userId : chatIdentifierToString(chat.id),
            )}
            verified={chat.kind === "group_chat" && chat.verified}
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
                    title={$_("group.privateGroup", { values: { level: levelText } })}
                    body={$_("group.privateGroupInfo", { values: { level: levelText } })}
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
                                <UnreadDivider tone="neutral" label={dateLabel(item.timestamp)} />
                            </div>
                        {:else if item.kind === "event"}
                            {@const evt = item.event}
                            {#if isMessage(evt)}
                                {@const msg = evt.event}
                                {@const failed = args.isFailed($failedMessagesStore, evt)}
                                {@const row = rows.row(
                                    item.key,
                                    evt,
                                    status(evt, args, failed),
                                    ctx,
                                )}
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
                                    {#if firstUnread === msg.messageIndex && msg.sender !== me}
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
                                        marked={args.focusIndex === msg.messageIndex && !failed
                                            ? 0
                                            : -1}
                                        messages={messagesFor(
                                            row,
                                            body,
                                            content.kind === "text_content" &&
                                                withMarkdown(content.text),
                                        )} />
                                </div>
                            {:else if evt.event.kind === "aggregate_common_events"}
                                {@const text = aggregateEventText(evt.event, eventCtx)}
                                {@const deleted = evt.event.messagesDeleted}
                                {#if text.joined !== undefined || text.deleted !== undefined || text.rolesChanged.length > 0}
                                    <!-- TODO(design): no event line in the design; the old UI's -->
                                    <div
                                        class="event"
                                        data-index={deleted.length > 0
                                            ? deleted.join(" ")
                                            : undefined}
                                        use:observeRead={{
                                            observer: args.messageObserver,
                                            read:
                                                deleted.length === 0 ||
                                                args.isReadByMe($messagesRead, evt),
                                        }}>
                                        {#if text.joined !== undefined}
                                            <p class="event-line">
                                                <Markdown
                                                    oneLine
                                                    suppressLinks
                                                    text={text.joined} />
                                            </p>
                                        {/if}
                                        {#if text.deleted !== undefined}
                                            <p class="event-line">
                                                <button
                                                    class="expand"
                                                    title={$_("expandDeletedMessages")}
                                                    onclick={() =>
                                                        client.expandDeletedMessages(
                                                            new Set(deleted),
                                                        )}>
                                                    {text.deleted}
                                                </button>
                                            </p>
                                        {/if}
                                        {#each text.rolesChanged as line}
                                            <p class="event-line">
                                                <Markdown suppressLinks text={line} />
                                            </p>
                                        {/each}
                                    </div>
                                {/if}
                            {:else if isTextEvent(evt.event)}
                                {@const text = timelineEventText(evt.event, eventCtx)}
                                {#if text !== undefined}
                                    <div class="event">
                                        <p class="event-line">
                                            <Markdown suppressLinks {text} />
                                        </p>
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

        <!-- one composer per chat: it starts from that chat's draft -->
        {#key chatIdentifierToString(chat.id)}
            <Composer
                {block}
                draft={$selectedChatDraftMessageStore?.textContent ?? ""}
                {typingNames}
                {throttled}
                enterSends={$enterSend}
                onDraft={(text) =>
                    localUpdates.draftMessages.setTextContent({ chatId: chat.id }, text)}
                onStartTyping={() => client.startTyping(chat.id, me)}
                onStopTyping={() => client.stopTyping(chat.id, me)}
                onSend={(text) => send(chat, text)} />
        {/key}
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

    /* the deleted messages' line, which shows them */
    .expand {
        all: unset;
        cursor: pointer;
    }

    .expand:hover {
        text-decoration: underline;
    }

    .to-bottom {
        position: absolute;
        inset-block-end: var(--space-16);
        inset-inline-end: var(--space-24);
    }
</style>
