<svelte:options immutable={true} />

<script lang="ts">
    import { createEventDispatcher, getContext, onMount, tick } from "svelte";
    import Avatar from "../Avatar.svelte";
    import ChatEvent from "./ChatEvent.svelte";
    import Robot from "../Robot.svelte";
    import ProposalBot from "../ProposalBot.svelte";
    import { _ } from "svelte-i18n";
    import {
        AvatarSize,
        EventWrapper,
        EnhancedReplyContext,
        ChatEvent as ChatEventType,
        Message,
        Mention,
        ChatSummary,
        OpenChat,
        FilteredProposals,
        MessageReadState,
        FailedMessages,
    } from "openchat-client";
    import InitialGroupMessage from "./InitialGroupMessage.svelte";
    import page from "page";
    import ChatEventList from "./ChatEventList.svelte";

    // todo - these thresholds need to be relative to screen height otherwise things get screwed up on (relatively) tall screens
    const MESSAGE_READ_THRESHOLD = 500;

    const client = getContext<OpenChat>("client");
    const user = client.user;
    const dispatch = createEventDispatcher();

    export let chat: ChatSummary;
    export let unreadMessages: number;
    export let readonly: boolean;
    export let firstUnreadMention: Mention | undefined;
    export let canPin: boolean;
    export let canBlockUser: boolean;
    export let canDelete: boolean;
    export let canSend: boolean;
    export let canReact: boolean;
    export let canInvite: boolean;
    export let footer: boolean;
    export let canReplyInThread: boolean;
    export let events: EventWrapper<ChatEventType>[];
    export let filteredProposals: FilteredProposals | undefined;

    $: isProposalGroup = client.isProposalGroup;
    $: currentChatEditingEvent = client.currentChatEditingEvent;
    $: currentChatPinnedMessages = client.currentChatPinnedMessages;
    $: messagesRead = client.messagesRead;
    $: unconfirmedReadByThem = client.unconfirmedReadByThem;
    $: unconfirmed = client.unconfirmed;
    $: failedMessagesStore = client.failedMessagesStore;
    $: userGroupKeys = client.userGroupKeys;
    $: currentChatDraftMessage = client.currentChatDraftMessage;
    $: focusMessageIndex = client.focusMessageIndex;
    $: chatStateStore = client.chatStateStore;
    $: userStore = client.userStore;
    $: showAvatar = initialised && shouldShowAvatar(chat, events[0]?.index);

    // treat this as if it might be null so we don't get errors when it's unmounted
    let chatEventList: ChatEventList | undefined;
    let messagesDiv: HTMLDivElement | undefined;
    let messagesDivHeight: number;
    let initialised = false;
    let currentChatId = "";
    let observer: IntersectionObserver;
    let messageReadTimers: Record<number, number> = {};

    onMount(() => {
        const options = {
            root: messagesDiv as Element,
            rootMargin: "0px",
            threshold: [0.1, 0.2, 0.3, 0.4, 0.5],
        };

        observer = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
            entries.forEach((entry) => {
                const idxAttrs = entry.target.attributes.getNamedItem("data-index");
                const idAttr = entry.target.attributes.getNamedItem("data-id");
                const idx = idxAttrs
                    ? idxAttrs.value
                          .split(" ")
                          .map((v) => parseInt(v, 10))
                          .pop()
                    : undefined;
                const id = idAttr ? BigInt(idAttr.value) : undefined;
                if (idx !== undefined) {
                    const intersectionRatioRequired =
                        0 < messagesDivHeight && messagesDivHeight < entry.boundingClientRect.height
                            ? (messagesDivHeight * 0.5) / entry.boundingClientRect.height
                            : 0.5;

                    const isIntersecting = entry.intersectionRatio >= intersectionRatioRequired;
                    if (isIntersecting && messageReadTimers[idx] === undefined) {
                        const chatId = chat.chatId;
                        const timer = window.setTimeout(() => {
                            if (chatId === chat.chatId) {
                                client.markMessageRead(chat.chatId, idx, id);
                                if (id !== undefined) {
                                    client.broadcastMessageRead(chat, id);
                                }
                            }
                            delete messageReadTimers[idx];
                        }, MESSAGE_READ_THRESHOLD);
                        messageReadTimers[idx] = timer;
                    }
                    if (!isIntersecting && messageReadTimers[idx] !== undefined) {
                        clearTimeout(messageReadTimers[idx]);
                        delete messageReadTimers[idx];
                    }
                }
            });
        }, options);
    });

    function retrySend(ev: CustomEvent<EventWrapper<Message>>): void {
        client.retrySendMessage(chat.chatId, ev.detail, events, undefined);
    }

    function goToMessageIndex(ev: CustomEvent<{ index: number }>) {
        doGoToMessageIndex(ev.detail.index);
    }

    function doGoToMessageIndex(index: number): void {
        page(`/${chat.chatId}`);
        chatEventList?.scrollToMessageIndex(index, false);
    }

    export function scrollToMessageIndex(index: number, preserveFocus: boolean) {
        chatEventList?.scrollToMessageIndex(index, preserveFocus);
    }

    function replyTo(ev: CustomEvent<EnhancedReplyContext>) {
        if (!canSend) return;
        dispatch("replyTo", ev.detail);
    }

    function onEditEvent(ev: CustomEvent<EventWrapper<Message>>) {
        currentChatDraftMessage.setEditing(chat.chatId, ev.detail);
    }

    function dateGroupKey(group: EventWrapper<ChatEventType>[][]): string {
        const first = group[0] && group[0][0] && group[0][0].timestamp;
        return first ? new Date(Number(first)).toDateString() : "unknown";
    }

    function eventKey(e: EventWrapper<ChatEventType>): string {
        if (e.event.kind === "message") {
            return e.event.messageId.toString();
        } else {
            return e.index.toString();
        }
    }

    export function externalGoToMessage(messageIndex: number): void {
        chatEventList?.onMessageWindowLoaded(messageIndex);
    }

    // Checks if a key already exists for this group, if so, that key will be reused so that Svelte is able to match the
    // new version with the old version, if not, a new key will be created for the group.
    function userGroupKey(group: EventWrapper<ChatEventType>[]): string {
        const first = group[0];
        let prefix = "";
        if (first.event.kind === "message") {
            const sender = first.event.sender;
            prefix = sender + "_";
        }
        for (const evt of group) {
            const key = prefix + (evt.event.kind === "message" ? evt.event.messageId : evt.index);
            if ($userGroupKeys.has(key)) {
                return key;
            }
        }
        const firstKey =
            prefix + (first.event.kind === "message" ? first.event.messageId : first.index);
        chatStateStore.updateProp(chat.chatId, "userGroupKeys", (keys) => {
            keys.add(firstKey);
            return keys;
        });
        return firstKey;
    }

    $: expandedDeletedMessages = client.expandedDeletedMessages;

    $: groupedEvents = client.groupEvents(
        events,
        user.userId,
        $expandedDeletedMessages,
        groupInner(filteredProposals)
    );

    $: {
        if (chat.chatId !== currentChatId) {
            currentChatId = chat.chatId;
            initialised = false;

            // If the chat is empty, there is nothing to initialise, so we can set initialised to true
            const isEmptyChat = chat.latestEventIndex < 0;
            if (isEmptyChat) {
                initialised = true;
            }
        }
    }

    function isMe(evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message") {
            return evt.event.sender === user.userId;
        }
        if (evt.event.kind === "group_chat_created") {
            return evt.event.created_by === user.userId;
        }
        return false;
    }

    function isConfirmed(evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message") {
            return !unconfirmed.contains(chat.chatId, evt.event.messageId);
        }
        return true;
    }

    function isFailed(_failed: FailedMessages, evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message") {
            return failedMessagesStore.contains(chat.chatId, evt.event.messageId);
        }
        return false;
    }

    function isReadByThem(
        chat: ChatSummary,
        readByThem: Set<bigint>,
        evt: EventWrapper<ChatEventType>
    ): boolean {
        if (evt.event.kind === "message") {
            const confirmedRead = client.messageIsReadByThem(chat.chatId, evt.event.messageIndex);
            if (confirmedRead && readByThem.has(evt.event.messageId)) {
                unconfirmedReadByThem.delete(evt.event.messageId);
            }
            return confirmedRead || readByThem.has(evt.event.messageId);
        }
        return true;
    }

    function isReadByMe(_store: MessageReadState, evt: EventWrapper<ChatEventType>): boolean {
        if (readonly) return true;

        if (evt.event.kind === "message" || evt.event.kind === "aggregate_common_events") {
            let messageIndex =
                evt.event.kind === "message"
                    ? evt.event.messageIndex
                    : evt.event.messagesDeleted[evt.event.messagesDeleted.length - 1];
            let messageId = evt.event.kind === "message" ? evt.event.messageId : undefined;
            const isRead = client.isMessageRead(chat.chatId, messageIndex, messageId);
            if (!isRead && evt.event.kind === "message" && evt.event.sender === user.userId) {
                client.markMessageRead(chat.chatId, messageIndex, messageId);
                return true;
            }
            return isRead;
        }
        return true;
    }

    function isPinned(store: Set<number>, evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message") {
            return store.has(evt.event.messageIndex);
        }

        return false;
    }

    function isCollapsed(
        ew: EventWrapper<ChatEventType>,
        filteredProposals: FilteredProposals | undefined
    ): boolean {
        return ew.event.kind === "message" && isCollpasedProposal(ew.event, filteredProposals);
    }

    function toggleMessageExpansion(ew: EventWrapper<ChatEventType>, expand: boolean) {
        if (ew.event.kind === "message" && ew.event.content.kind === "proposal_content") {
            client.toggleProposalFilterMessageExpansion(ew.event.messageId, expand);
        }
    }

    function groupInner(filteredProposals: FilteredProposals | undefined) {
        return (events: EventWrapper<ChatEventType>[]) => {
            return client.groupWhile((a, b) => inSameGroup(a, b, filteredProposals), events);
        };
    }

    // Each expanded proposal should be in a group by itself
    // All collapsed proposals should be grouped together
    // Otherwise group by sender
    function inSameGroup(
        a: EventWrapper<ChatEventType>,
        b: EventWrapper<ChatEventType>,
        filteredProposals: FilteredProposals | undefined
    ): boolean {
        if (a.event.kind === "message" && b.event.kind === "message") {
            const aKind = a.event.content.kind;
            const bKind = b.event.content.kind;
            if (aKind === "proposal_content" || bKind === "proposal_content") {
                return (
                    isCollpasedProposal(a.event, filteredProposals) &&
                    isCollpasedProposal(b.event, filteredProposals)
                );
            } else {
                return client.sameUser(a, b);
            }
        }
        return false;
    }

    function isCollpasedProposal(
        message: Message,
        filteredProposals: FilteredProposals | undefined
    ): boolean {
        if (message.content.kind !== "proposal_content") return false;
        return filteredProposals?.isCollapsed(message.messageId, message.content.proposal) ?? false;
    }

    function shouldShowAvatar(
        chat: ChatSummary,
        earliestLoadedEventIndex: number | undefined
    ): boolean {
        // If this is an empty chat, show the avatar
        const isEmptyChat = chat.latestEventIndex < 0;
        if (isEmptyChat) {
            return true;
        }
        // Otherwise, only show the avatar if we have loaded right back to the earliest available events
        if (earliestLoadedEventIndex === undefined) {
            return false;
        }
        // For new direct chats the first event is the 'DirectChatCreated' event which we only load a short while after
        // sending the first message, so to prevent a short flicker with no avatar, we still show the avatar if the
        // earliest loaded event index is 1, even though event 0 is available
        const indexRequired = Math.max(client.earliestAvailableEventIndex(chat), 1);
        return earliestLoadedEventIndex <= indexRequired;
    }
</script>

<ChatEventList
    bind:this={chatEventList}
    rootSelector={"chat-messages"}
    selectedThreadKey={undefined}
    threadRootEvent={undefined}
    {readonly}
    {unreadMessages}
    {firstUnreadMention}
    {footer}
    setFocusMessageIndex={(idx) => client.setFocusMessageIndex(chat.chatId, idx)}
    {events}
    {chat}
    bind:initialised
    bind:messagesDiv
    bind:messagesDivHeight>
    {#if showAvatar}
        {#if $isProposalGroup}
            <ProposalBot />
        {:else if chat.kind === "group_chat"}
            <InitialGroupMessage group={chat} noVisibleEvents={events.length === 0} />
        {:else if client.isOpenChatBot(chat.them)}
            <Robot />
        {:else}
            <div class="big-avatar">
                <Avatar
                    url={client.userAvatarUrl($userStore[chat.them])}
                    userId={chat.them}
                    size={AvatarSize.Large} />
            </div>
        {/if}
    {/if}
    {#each groupedEvents as dayGroup, _di (dateGroupKey(dayGroup))}
        <div class="day-group">
            <div class="date-label">
                {client.formatMessageDate(dayGroup[0][0]?.timestamp, $_("today"), $_("yesterday"))}
            </div>
            {#each dayGroup as innerGroup, _ui (userGroupKey(innerGroup))}
                {#each innerGroup as evt, i (eventKey(evt))}
                    <ChatEvent
                        {observer}
                        focused={evt.event.kind === "message" &&
                            evt.event.messageIndex === $focusMessageIndex &&
                            !isFailed($failedMessagesStore, evt)}
                        confirmed={isConfirmed(evt)}
                        failed={isFailed($failedMessagesStore, evt)}
                        readByThem={isReadByThem(chat, $unconfirmedReadByThem, evt)}
                        readByMe={isReadByMe($messagesRead, evt)}
                        chatId={chat.chatId}
                        chatType={chat.kind}
                        {user}
                        me={isMe(evt)}
                        first={i === 0}
                        last={i + 1 === innerGroup.length}
                        {readonly}
                        {canPin}
                        {canBlockUser}
                        {canDelete}
                        {canSend}
                        {canReact}
                        {canInvite}
                        {canReplyInThread}
                        collapsed={isCollapsed(evt, filteredProposals)}
                        supportsEdit={true}
                        supportsReply={true}
                        threadRootMessage={undefined}
                        publicGroup={chat.kind === "group_chat" && chat.public}
                        pinned={isPinned($currentChatPinnedMessages, evt)}
                        editing={$currentChatEditingEvent === evt}
                        on:chatWith
                        on:replyTo={replyTo}
                        on:replyPrivatelyTo
                        on:editEvent={onEditEvent}
                        on:goToMessageIndex={goToMessageIndex}
                        on:expandMessage={() => toggleMessageExpansion(evt, true)}
                        on:collapseMessage={() => toggleMessageExpansion(evt, false)}
                        on:upgrade
                        on:forward
                        on:retrySend={retrySend}
                        event={evt} />
                {/each}
            {/each}
        </div>
    {/each}
</ChatEventList>

<style type="text/scss">
    .day-group {
        position: relative;

        .date-label {
            padding: $sp2 10px;
            background-color: var(--currentChat-date-bg);
            position: sticky;
            top: 0;
            width: fit-content;
            min-width: 100px;
            margin: auto;
            border-radius: 12px;
            @include z-index("date-label");
            @include font(book, normal, fs-70);
            text-align: center;
            margin-bottom: $sp4;
        }
    }

    .big-avatar {
        margin: 16px auto;
    }
</style>
