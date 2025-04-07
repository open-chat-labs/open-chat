<script lang="ts">
    import { getContext } from "svelte";
    import ChatEvent from "./ChatEvent.svelte";
    import {
        type EventWrapper,
        type EnhancedReplyContext,
        type ChatEvent as ChatEventType,
        type Message,
        type Mention,
        type ChatSummary,
        type OpenChat,
        FilteredProposals,
        chatIdentifiersEqual,
        type ChatIdentifier,
        routeForChatIdentifier,
        currentUser as user,
        currentChatEditingEvent,
        currentChatPinnedMessages,
        messagesRead,
        unconfirmedReadByThem,
        unconfirmed,
        failedMessagesStore,
        userGroupKeys,
        draftMessagesStore,
        focusMessageIndex,
        chatStateStore,
        chatListScopeStore as chatListScope,
        selectedCommunity,
        expandedDeletedMessages,
        eventsStore,
    } from "openchat-client";
    import InitialChatMessage from "./InitialChatMessage.svelte";
    import page from "page";
    import ChatEventList from "./ChatEventList.svelte";
    import PrivatePreview from "./PrivatePreview.svelte";
    import TimelineDate from "./TimelineDate.svelte";
    import Witch from "../Witch.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: ChatSummary;
        unreadMessages: number;
        readonly: boolean;
        firstUnreadMention: Mention | undefined;
        canPin: boolean;
        canBlockUsers: boolean;
        canDelete: boolean;
        canSendAny: boolean;
        canReact: boolean;
        canInvite: boolean;
        footer: boolean;
        canReplyInThread: boolean;
        filteredProposals: FilteredProposals | undefined;
        privateChatPreview: boolean;
        onRemovePreview: (event: EventWrapper<Message>, url: string) => void;
        onReplyTo: (ctx: EnhancedReplyContext) => void;
    }

    let {
        chat,
        unreadMessages,
        readonly,
        firstUnreadMention,
        canPin,
        canBlockUsers,
        canDelete,
        canSendAny,
        canReact,
        canInvite,
        footer,
        canReplyInThread,
        filteredProposals,
        privateChatPreview,
        onRemovePreview,
        onReplyTo,
    }: Props = $props();

    // treat this as if it might be null so we don't get errors when it's unmounted
    let chatEventList: ChatEventList | undefined = $state();
    let messagesDiv: HTMLDivElement | undefined = $state();
    let messagesDivHeight: number = $state(0);
    let initialised = $state(false);
    let currentChatId: ChatIdentifier | undefined = $state();

    function onGoToMessageIndex(detail: { index: number }) {
        doGoToMessageIndex(detail.index);
    }

    function doGoToMessageIndex(index: number): void {
        page(routeForChatIdentifier($chatListScope.kind, chat.id));
        chatEventList?.scrollToMessageIndex(messageContext, index, false);
    }

    export function scrollToMessageIndex(index: number, preserveFocus: boolean) {
        chatEventList?.scrollToMessageIndex(messageContext, index, preserveFocus);
    }

    function replyTo(replyContext: EnhancedReplyContext) {
        if (!canSendAny) return;
        onReplyTo(replyContext);
    }

    function onEditEvent(ev: EventWrapper<Message>) {
        draftMessagesStore.setEditing({ chatId: chat.id }, ev);
    }

    function eventKey(e: EventWrapper<ChatEventType>): string {
        if (e.event.kind === "message") {
            return `${e.index}_${e.event.messageId}`;
        } else {
            return e.index.toString();
        }
    }

    export function externalGoToMessage(messageIndex: number): void {
        chatEventList?.onMessageWindowLoaded({
            context: messageContext,
            messageIndex,
            initialLoad: false,
        });
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
            const key =
                prefix +
                (evt.event.kind === "message" ? `${evt.index}_${evt.event.messageId}` : evt.index);
            if ($userGroupKeys.has(key)) {
                return key;
            }
        }
        const firstKey =
            prefix +
            (first.event.kind === "message"
                ? `${first.index}_${first.event.messageId}`
                : first.index);
        chatStateStore.updateProp(chat.id, "userGroupKeys", (keys) => {
            keys.add(firstKey);
            return keys;
        });
        return firstKey;
    }

    function isMe(evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message") {
            return evt.event.sender === $user.userId;
        }
        if (evt.event.kind === "group_chat_created") {
            return evt.event.created_by === $user.userId;
        }
        return false;
    }

    function isReadByThem(
        chat: ChatSummary,
        readByThem: Set<bigint>,
        evt: EventWrapper<ChatEventType>,
    ): boolean {
        if (evt.event.kind === "message") {
            const confirmedRead = client.messageIsReadByThem(chat.id, evt.event.messageIndex);
            if (confirmedRead && readByThem.has(evt.event.messageId)) {
                unconfirmedReadByThem.delete(evt.event.messageId);
            }
            return confirmedRead || readByThem.has(evt.event.messageId);
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
        filteredProposals: FilteredProposals | undefined,
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
        filteredProposals: FilteredProposals | undefined,
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
        filteredProposals: FilteredProposals | undefined,
    ): boolean {
        if (message.content.kind !== "proposal_content") return false;
        return filteredProposals?.isCollapsed(message.messageId, message.content.proposal) ?? false;
    }

    function shouldShowAvatar(
        chat: ChatSummary,
        earliestLoadedEventIndex: number | undefined,
    ): boolean {
        // If this is an empty chat, show the avatar
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
    let privateCommunityPreview = $derived(
        $selectedCommunity !== undefined &&
            ($selectedCommunity.membership.role === "none" ||
                $selectedCommunity.membership.lapsed) &&
            (!$selectedCommunity.public || $selectedCommunity.gateConfig.gate.kind !== "no_gate"),
    );
    let privatePreview = $derived(privateCommunityPreview || privateChatPreview);
    let isEmptyChat = $derived(chat.latestEventIndex <= 0 || privatePreview);

    $effect(() => {
        if (currentChatId === undefined || !chatIdentifiersEqual(chat.id, currentChatId)) {
            currentChatId = chat.id;
            initialised = false;

            // If the chat is empty, there is nothing to initialise, so we can set initialised to true
            if (isEmptyChat) {
                initialised = true;
            }
        }
    });
    let showAvatar = $derived(initialised && shouldShowAvatar(chat, $eventsStore[0]?.index));
    let messageContext = $derived({ chatId: chat.id, threadRootMessageIndex: undefined });
    let timeline = $derived(
        client.groupEvents(
            [...$eventsStore].reverse(),
            $user.userId,
            $expandedDeletedMessages,
            groupInner(filteredProposals),
        ),
    );
</script>

<Witch />

<ChatEventList
    bind:this={chatEventList}
    rootSelector={"chat-messages"}
    threadRootEvent={undefined}
    maintainScroll
    {readonly}
    {unreadMessages}
    {firstUnreadMention}
    {footer}
    events={$eventsStore}
    {chat}
    bind:initialised
    bind:messagesDiv
    bind:messagesDivHeight>
    {#snippet children({
        isAccepted,
        isConfirmed,
        isFailed,
        isReadByMe,
        messageObserver,
        labelObserver,
    })}
        {#if !privatePreview}
            {#each timeline as timelineItem}
                {#if timelineItem.kind === "timeline_date"}
                    <TimelineDate observer={labelObserver} timestamp={timelineItem.timestamp} />
                {:else}
                    {#each timelineItem.group as innerGroup (userGroupKey(innerGroup))}
                        {#each innerGroup as evt, i (eventKey(evt))}
                            <ChatEvent
                                observer={messageObserver}
                                focused={evt.event.kind === "message" &&
                                    evt.event.messageIndex === $focusMessageIndex &&
                                    !isFailed($failedMessagesStore, evt)}
                                accepted={isAccepted($unconfirmed, evt)}
                                confirmed={isConfirmed($unconfirmed, evt)}
                                failed={isFailed($failedMessagesStore, evt)}
                                readByThem={isReadByThem(chat, $unconfirmedReadByThem, evt)}
                                readByMe={isReadByMe($messagesRead, evt)}
                                chatId={chat.id}
                                chatType={chat.kind}
                                me={isMe(evt)}
                                first={i + 1 === innerGroup.length}
                                last={i === 0}
                                {readonly}
                                {canPin}
                                {canBlockUsers}
                                {canDelete}
                                {canSendAny}
                                {canReact}
                                {canInvite}
                                {canReplyInThread}
                                collapsed={isCollapsed(evt, filteredProposals)}
                                supportsEdit
                                supportsReply
                                threadRootMessage={undefined}
                                publicGroup={(chat.kind === "group_chat" ||
                                    chat.kind === "channel") &&
                                    chat.public}
                                pinned={isPinned($currentChatPinnedMessages, evt)}
                                editing={$currentChatEditingEvent === evt}
                                onReplyTo={replyTo}
                                {onRemovePreview}
                                {onEditEvent}
                                {onGoToMessageIndex}
                                onExpandMessage={() => toggleMessageExpansion(evt, true)}
                                onCollapseMessage={() => toggleMessageExpansion(evt, false)}
                                event={evt} />
                        {/each}
                    {/each}
                {/if}
            {/each}
        {/if}
        {#if privatePreview}
            <PrivatePreview />
        {/if}
        {#if showAvatar}
            <InitialChatMessage {chat} />
        {/if}
    {/snippet}
</ChatEventList>
