<script lang="ts">
    import { trackedEffect } from "@src/utils/effects.svelte";
    import {
        type ChatEvent as ChatEventType,
        type ChatIdentifier,
        type ChatSummary,
        type EnhancedReplyContext,
        type EventWrapper,
        type Mention,
        type Message,
        type OpenChat,
        type ReadonlySet,
        allUsersStore,
        chatIdentifiersEqual,
        chatListScopeStore,
        chatsInitialisedStore,
        currentUserIdStore,
        eventsStore,
        failedMessagesStore,
        FilteredProposals,
        localUpdates,
        messageIndexStore,
        messagesRead,
        ROLE_NONE,
        routeForChatIdentifier,
        selectedChatDraftMessageStore,
        selectedChatExpandedDeletedMessageStore,
        selectedChatIdStore,
        selectedChatPinnedMessagesStore,
        selectedCommunitySummaryStore,
        showMiddle,
        stripSuspendedGate,
        subscribe,
        threadOpenStore,
        unconfirmedStore,
        type ImageContent,
        type MemeFighterContent,
        type VideoContent,
        chatIdentifierToString,
    } from "@client";
    import { navigate } from "@utils/navigation";
    import { getContext, untrack, setContext, onMount } from "svelte";
    import Witch from "@shared_components/Witch.svelte";
    import {
        chatStartItem,
        flattenTimeline,
        type FlatChatItem,
    } from "@shared_components/flatChatItems";
    import ChatEvent from "./ChatEvent.svelte";
    import ChatEventList from "./ChatEventList.svelte";
    import InitialChatMessage from "./InitialChatMessage.svelte";
    import PrivatePreview from "./PrivatePreview.svelte";
    import TimelineDate from "./TimelineDate.svelte";
    import ZoomedImage from "./ZoomedImage.svelte";
    import ZoomedVideo from "./ZoomedVideo.svelte";

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
    let imageContent: ImageContent | MemeFighterContent | undefined = $state();
    let videoContent: VideoContent | undefined = $state();

    onMount(() => {
        const unsubs = [
            subscribe("focusImage", (data) => {
                if (data !== imageContent) {
                    imageContent = data;
                    videoContent = undefined;
                }
            }),
            subscribe("playVideo", (data) => {
                if (data !== videoContent) {
                    imageContent = undefined;
                    videoContent = data;
                }
            }),
        ];

        return () => {
            unsubs.forEach((u) => u());
        };
    });

    // Allows child nodes, like IntersectionObserver to access the root scrollable node to allow rootMargin to be used.
    let scrollState = $state<{ node: HTMLElement | undefined }>({ node: undefined });
    setContext("scrollable-messages-div", scrollState);
    $effect(() => {
        if (messagesDiv) {
            scrollState.node = messagesDiv;
        }
    });

    function onGoToMessageIndex(detail: { index: number }) {
        doGoToMessageIndex(detail.index);
    }

    function doGoToMessageIndex(index: number): void {
        navigate(routeForChatIdentifier($chatListScopeStore.kind, chat.id));
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
        localUpdates.draftMessages.setEditing({ chatId: chat.id }, ev, $allUsersStore);
    }

    export function externalGoToMessage(messageIndex: number): void {
        chatEventList?.onMessageWindowLoaded({
            context: messageContext,
            messageIndex,
            initialLoad: false,
        });
    }

    function isMe(evt: EventWrapper<ChatEventType>): boolean {
        if (evt.event.kind === "message") {
            return evt.event.sender === $currentUserIdStore;
        }
        if (evt.event.kind === "group_chat_created") {
            return evt.event.created_by === $currentUserIdStore;
        }
        return false;
    }

    function isPinned(store: ReadonlySet<number>, evt: EventWrapper<ChatEventType>): boolean {
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
        $selectedCommunitySummaryStore !== undefined &&
            ($selectedCommunitySummaryStore.membership.role === ROLE_NONE ||
                $selectedCommunitySummaryStore.membership.lapsed) &&
            (!$selectedCommunitySummaryStore.public ||
                stripSuspendedGate($selectedCommunitySummaryStore.gateConfig.gate).kind !==
                    "no_gate"),
    );
    let privatePreview = $derived(privateCommunityPreview || privateChatPreview);
    let isEmptyChat = $derived(chat.latestEventIndex <= 0 || privatePreview);

    trackedEffect("current-chat-messages", () => {
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
    let messageContext = $derived({ chatId: chat?.id, threadRootMessageIndex: undefined });
    let timeline = $derived(
        client.groupEvents(
            [...$eventsStore].reverse(),
            $currentUserIdStore,
            chat.kind === "channel" && chat.public,
            $selectedChatExpandedDeletedMessageStore,
            groupInner(filteredProposals),
        ),
    );
    let items = $derived.by<FlatChatItem[]>(() => {
        const flat: FlatChatItem[] = flattenTimeline(timeline);
        if (showAvatar) {
            // rendered at the oldest end of the list (the visual top)
            flat.push(chatStartItem(chatIdentifierToString(chat.id)));
        }
        return flat;
    });

    // Scroll to the route's message index when it changes — and also on the
    // effect's FIRST run: panels/modal pages can unmount the chat view, so a
    // pinned-message tap navigates while the old instance is being destroyed
    // (where it is silently swallowed) and the remounted instance must pick
    // the navigation up from the route. Only when the thread is not open.
    let previousChatId: ChatIdentifier | undefined = undefined;
    let previousMessageIndex: number | undefined = undefined;
    $effect(() => {
        const idx = $messageIndexStore;
        const sameChat = chatIdentifiersEqual($selectedChatIdStore, previousChatId);
        if (
            !$threadOpenStore &&
            $chatsInitialisedStore &&
            idx !== undefined &&
            (!sameChat || idx !== previousMessageIndex)
        ) {
            untrack(() => {
                scrollToMessageIndex(idx, false);
            });
        }
        previousChatId = $selectedChatIdStore;
        previousMessageIndex = idx;
    });
</script>

<Witch />

<div class="chat_messages_wrapper">
    {#if privatePreview}
        <div class="private-preview">
            <PrivatePreview />
            {#if showAvatar}
                <InitialChatMessage {chat} />
            {/if}
        </div>
    {:else}
        <ChatEventList
            bind:this={chatEventList}
            rootSelector={"chat-messages"}
            threadRootEvent={undefined}
            maintainScroll
            visible={$showMiddle}
            {readonly}
            {unreadMessages}
            {firstUnreadMention}
            {footer}
            {items}
            {chat}
            bind:initialised
            bind:messagesDiv
            bind:messagesDivHeight>
            {#snippet row(
                item,
                { isAccepted, isConfirmed, isFailed, isReadByMe, messageObserver, focusIndex },
            )}
                {#if item.kind === "timeline_date"}
                    <TimelineDate timestamp={item.timestamp} />
                {:else if item.kind === "chat_start"}
                    <InitialChatMessage {chat} />
                {:else}
                    {@const evt = item.event}
                    <ChatEvent
                        observer={messageObserver}
                        focused={evt.event.kind === "message" &&
                            evt.event.messageIndex === focusIndex &&
                            !isFailed($failedMessagesStore, evt)}
                        accepted={isAccepted($unconfirmedStore, evt)}
                        confirmed={isConfirmed($unconfirmedStore, evt)}
                        failed={isFailed($failedMessagesStore, evt)}
                        readByMe={isReadByMe($messagesRead, evt)}
                        chatId={chat.id}
                        chatType={chat.kind}
                        me={isMe(evt)}
                        first={item.first}
                        last={item.last}
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
                        publicGroup={(chat.kind === "group_chat" || chat.kind === "channel") &&
                            chat.public}
                        pinned={isPinned($selectedChatPinnedMessagesStore, evt)}
                        editing={$selectedChatDraftMessageStore?.editingEvent === evt}
                        onReplyTo={replyTo}
                        {onRemovePreview}
                        {onEditEvent}
                        {onGoToMessageIndex}
                        onExpandMessage={() => toggleMessageExpansion(evt, true)}
                        onCollapseMessage={() => toggleMessageExpansion(evt, false)}
                        event={evt} />
                {/if}
            {/snippet}
        </ChatEventList>
    {/if}
    {#if imageContent}
        <ZoomedImage onClose={() => (imageContent = undefined)} {imageContent} />
    {/if}
    {#if videoContent}
        <ZoomedVideo onClose={() => (videoContent = undefined)} {videoContent} />
    {/if}
</div>

<style lang="scss">
    .chat_messages_wrapper {
        position: relative;
        display: flex;
        flex: 1;
        width: 100%;
        overflow: auto;
    }

    .private-preview {
        flex: 1 1 0;
        display: flex;
        flex-direction: column-reverse;
        overflow-y: auto;
        padding: var(--sp-md) var(--sp-lg) 0 var(--sp-lg);
        gap: var(--sp-xs);
    }
</style>
