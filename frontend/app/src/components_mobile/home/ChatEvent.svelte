<script lang="ts">
    import {
        aggregateEventText,
        isTextEvent,
        timelineEventText,
        type EventTextContext,
    } from "@src/logic/conversation/timelineEventText";
    import { buildDisplayName, findUser } from "@src/utils/user";
    import {
        allUsersStore,
        botState,
        currentUserIdStore,
        selectedChatWebhooksStore,
        typing,
        type ChatEvent,
        type ChatIdentifier,
        type ChatType,
        type EnhancedReplyContext,
        type EventWrapper,
        type Level,
        type Message,
        type OpenChat,
    } from "@client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import AggregateCommonEvents from "./AggregateCommonEvents.svelte";
    import ChatMessage from "./ChatMessage.svelte";
    import NonMessageEvent from "./NonMessageEvent.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chatId: ChatIdentifier;
        chatType: ChatType;
        event: EventWrapper<ChatEvent>;
        first: boolean;
        last: boolean;
        me: boolean;
        accepted: boolean;
        confirmed: boolean;
        failed: boolean;
        readByMe: boolean;
        observer?: IntersectionObserver;
        focused: boolean;
        readonly: boolean;
        pinned: boolean;
        canPin: boolean;
        canBlockUsers: boolean;
        canDelete: boolean;
        canSendAny: boolean;
        canReact: boolean;
        canTipMessages: boolean;
        canInvite: boolean;
        canReplyInThread: boolean;
        publicGroup: boolean;
        editing: boolean;
        supportsEdit: boolean;
        supportsReply: boolean;
        collapsed: boolean;
        threadRootMessage: Message | undefined;
        onExpandMessage?: (() => void) | undefined;
        onReplyTo: (replyContext: EnhancedReplyContext) => void;
        onCollapseMessage: () => void;
        onGoToMessageIndex: (args: { index: number }) => void;
        onEditEvent: (ev: EventWrapper<Message>) => void;
        onRemovePreview: (event: EventWrapper<Message>, url: string) => void;
    }

    let {
        chatId,
        chatType,
        event,
        first,
        last,
        me,
        accepted,
        confirmed,
        failed,
        readByMe,
        observer,
        focused,
        readonly,
        pinned,
        canPin,
        canBlockUsers,
        canDelete,
        canSendAny,
        canReact,
        canTipMessages,
        canInvite,
        canReplyInThread,
        publicGroup,
        supportsEdit,
        supportsReply,
        collapsed,
        threadRootMessage,
        onExpandMessage = undefined,
        onReplyTo,
        onCollapseMessage,
        onGoToMessageIndex,
        onEditEvent,
        onRemovePreview,
    }: Props = $props();

    let levelType = $derived((chatType === "channel" ? "channel" : "group") as Level);
    let eventText = $derived<EventTextContext>({
        formatter: $_,
        me: $currentUserIdStore,
        users: $allUsersStore,
        displayName: (userId, kind) => buildDisplayName($allUsersStore, userId, kind),
        level: levelType,
        canInvite,
        botName: (botId) => botState.externalBots.get(botId)?.name,
    });
    let messageContext = $derived({
        chatId,
        threadRootMessageIndex: threadRootMessage?.messageIndex,
    });
    let hidden = $derived(
        event.event.kind === "message" &&
            event.event.content.kind === "message_reminder_created_content" &&
            event.event.content.hidden,
    );

    function editEvent() {
        onEditEvent(event as EventWrapper<Message>);
    }

    function deleteFailedMessage() {
        if (event.event.kind === "message") {
            client.deleteFailedMessage(
                chatId,
                event.event.messageId,
                threadRootMessage?.messageIndex,
            );
        }
    }

    function retrySend() {
        const message = event as EventWrapper<Message>;
        client.sendMessageWithContent(
            messageContext,
            message.event.content,
            message.event.blockLevelMarkdown,
            [],
            message.event.forwarded,
            message.event.messageId,
        );
    }

    let sender = $derived(
        event.event.kind === "message"
            ? findUser(event.event.sender, $allUsersStore, $selectedChatWebhooksStore)
            : undefined,
    );
</script>

{#if event.event.kind === "message"}
    {#if !hidden}
        <ChatMessage
            {sender}
            senderTyping={client.isTyping($typing, event.event.sender, messageContext)}
            {focused}
            {observer}
            {accepted}
            {confirmed}
            {failed}
            {readByMe}
            {chatId}
            {chatType}
            {me}
            {first}
            {last}
            {readonly}
            {pinned}
            {canPin}
            {canBlockUsers}
            {canDelete}
            canQuoteReply={canSendAny}
            {canReact}
            {canTipMessages}
            canStartThread={canReplyInThread}
            {publicGroup}
            {threadRootMessage}
            {supportsEdit}
            {supportsReply}
            {collapsed}
            senderContext={event.event.senderContext}
            {onGoToMessageIndex}
            {onReplyTo}
            onRetrySend={retrySend}
            onEditMessage={editEvent}
            {onExpandMessage}
            {onCollapseMessage}
            onRemovePreview={(url) => onRemovePreview(event as EventWrapper<Message>, url)}
            onDeleteFailedMessage={deleteFailedMessage}
            eventIndex={event.index}
            timestamp={event.timestamp}
            expiresAt={event.expiresAt}
            msg={event.event} />
    {/if}
{:else if event.event.kind === "aggregate_common_events"}
    <AggregateCommonEvents
        {observer}
        {readByMe}
        text={aggregateEventText(event.event, eventText)}
        messagesDeleted={event.event.messagesDeleted} />
{:else if isTextEvent(event.event)}
    {@const text = timelineEventText(event.event, eventText)}
    {#if text !== undefined}
        <NonMessageEvent {text} timestamp={event.timestamp} />
    {/if}
{:else if !client.isEventKindHidden(event.event.kind, publicGroup && chatType === "channel")}
    <div>Unexpected event type: {event.event.kind}</div>
{/if}
