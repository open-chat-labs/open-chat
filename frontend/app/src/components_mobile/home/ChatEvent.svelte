<script lang="ts">
    import { findUser } from "@src/utils/user";
    import {
        allUsersStore,
        currentUserIdStore,
        currentUserStore,
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
        type UserSummary,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import AggregateCommonEvents from "./AggregateCommonEvents.svelte";
    import BotChangedEvent from "./BotChangedEvent.svelte";
    import ChatFrozenEvent from "./ChatFrozenEvent.svelte";
    import ChatMessage from "./ChatMessage.svelte";
    import ChatUnfrozenEvent from "./ChatUnfrozenEvent.svelte";
    import DirectChatCreatedEvent from "./DirectChatCreatedEvent.svelte";
    import DisappearingMessageTimeUpdated from "./DisappearingMessageTimeUpdated.svelte";
    import GroupChangedEvent from "./GroupChangedEvent.svelte";
    import GroupChatCreatedEvent from "./GroupChatCreatedEvent.svelte";
    import GroupInviteCodeChangedEvent from "./GroupInviteCodeChangedEvent.svelte";
    import GroupRulesChangedEvent from "./GroupRulesChangedEvent.svelte";
    import GroupVisibilityChangedEvent from "./GroupVisibilityChangedEvent.svelte";
    import MembersChangedEvent from "./MembersChangedEvent.svelte";
    import PermissionsChangedEvent from "./PermissionsChangedEvent.svelte";

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

    let userSummary = $derived<UserSummary>({
        kind: "user",
        userId: $currentUserStore.userId,
        username: $currentUserStore.username,
        displayName: $currentUserStore.displayName,
        updated: BigInt(0),
        suspended: false,
        diamondStatus: "inactive",
        chitBalance: 0,
        streak: 0,
        maxStreak: 0,
        isUniquePerson: $currentUserStore.isUniquePerson,
        totalChitEarned: 0,
    });

    let levelType = $derived((chatType === "channel" ? "channel" : "group") as Level);
    let level = $derived($_(`level.${levelType}`).toLowerCase());
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
{:else if event.event.kind === "group_chat_created"}
    <GroupChatCreatedEvent {chatType} event={event.event} {me} timestamp={event.timestamp} />
{:else if event.event.kind === "direct_chat_created"}
    <DirectChatCreatedEvent timestamp={event.timestamp} />
{:else if event.event.kind === "members_added"}
    <MembersChangedEvent
        level={levelType}
        user={userSummary}
        changed={event.event.userIds}
        changedBy={event.event.addedBy}
        resourceKey={"addedBy"}
        timestamp={event.timestamp} />
{:else if event.event.kind === "users_invited"}
    <MembersChangedEvent
        level={levelType}
        user={userSummary}
        changed={event.event.userIds}
        changedBy={event.event.invitedBy}
        resourceKey={"invitedBy"}
        timestamp={event.timestamp} />
{:else if event.event.kind === "members_removed"}
    <MembersChangedEvent
        level={levelType}
        user={userSummary}
        changed={event.event.userIds}
        changedBy={event.event.removedBy}
        resourceKey={"removedBy"}
        timestamp={event.timestamp} />
{:else if event.event.kind === "aggregate_common_events"}
    <AggregateCommonEvents
        level={levelType}
        {observer}
        {readByMe}
        user={userSummary}
        joined={event.event.usersJoined}
        messagesDeleted={event.event.messagesDeleted}
        rolesChanged={event.event.rolesChanged} />
{:else if event.event.kind === "users_blocked"}
    <MembersChangedEvent
        level={levelType}
        user={userSummary}
        changed={event.event.userIds}
        changedBy={event.event.blockedBy}
        resourceKey={"blockedBy"}
        timestamp={event.timestamp} />
{:else if event.event.kind === "users_unblocked"}
    <MembersChangedEvent
        level={levelType}
        user={userSummary}
        changed={event.event.userIds}
        changedBy={event.event.unblockedBy}
        resourceKey={"unblockedBy"}
        timestamp={event.timestamp} />
{:else if event.event.kind === "name_changed"}
    <GroupChangedEvent
        {level}
        user={userSummary}
        changedBy={event.event.changedBy}
        property={interpolate($_, i18nKey("groupName", undefined, levelType, true))}
        timestamp={event.timestamp} />
{:else if event.event.kind === "desc_changed"}
    <GroupChangedEvent
        {level}
        user={userSummary}
        changedBy={event.event.changedBy}
        property={interpolate($_, i18nKey("groupDesc", undefined, levelType, true))}
        timestamp={event.timestamp} />
{:else if event.event.kind === "rules_changed"}
    <GroupRulesChangedEvent user={userSummary} event={event.event} timestamp={event.timestamp} />
{:else if event.event.kind === "avatar_changed"}
    <GroupChangedEvent
        {level}
        user={userSummary}
        changedBy={event.event.changedBy}
        property={interpolate($_, i18nKey("groupAvatar", undefined, levelType, true))}
        timestamp={event.timestamp} />
{:else if event.event.kind === "gate_updated"}
    <GroupChangedEvent
        {level}
        user={userSummary}
        changedBy={event.event.updatedBy}
        property={$_("access.gate").toLowerCase()}
        timestamp={event.timestamp} />
{:else if event.event.kind === "external_url_updated"}
    <GroupChangedEvent
        {level}
        user={userSummary}
        changedBy={event.event.updatedBy}
        property={$_("externalContent.name").toLowerCase()}
        timestamp={event.timestamp} />
{:else if event.event.kind === "group_visibility_changed"}
    <GroupVisibilityChangedEvent
        level={levelType}
        user={userSummary}
        isPublic={event.event.public}
        messagesVisibleToNonMembers={event.event.messagesVisibleToNonMembers}
        changedBy={event.event.changedBy}
        timestamp={event.timestamp} />
{:else if event.event.kind === "group_invite_code_changed"}
    {#if canInvite}
        <GroupInviteCodeChangedEvent
            user={userSummary}
            change={event.event.change}
            changedBy={event.event.changedBy}
            timestamp={event.timestamp} />
    {/if}
{:else if event.event.kind === "permissions_changed"}
    <PermissionsChangedEvent
        level={levelType}
        user={userSummary}
        event={event.event}
        timestamp={event.timestamp} />
{:else if event.event.kind === "events_ttl_updated"}
    <DisappearingMessageTimeUpdated
        user={userSummary}
        changedBy={event.event.updatedBy}
        newTimeToLive={event.event.newTimeToLive}
        timestamp={event.timestamp} />
{:else if event.event.kind === "chat_frozen"}
    <ChatFrozenEvent user={userSummary} event={event.event} timestamp={event.timestamp} />
{:else if event.event.kind === "chat_unfrozen"}
    <ChatUnfrozenEvent user={userSummary} event={event.event} timestamp={event.timestamp} />
{:else if event.event.kind === "bot_added"}
    <BotChangedEvent
        changedBy={event.event.addedBy}
        resourceKey={"bots.events.add"}
        event={event.event}
        userId={$currentUserIdStore}
        timestamp={event.timestamp} />
{:else if event.event.kind === "bot_removed"}
    <BotChangedEvent
        changedBy={event.event.removedBy}
        resourceKey={"bots.events.remove"}
        event={event.event}
        userId={$currentUserIdStore}
        timestamp={event.timestamp} />
{:else if event.event.kind === "bot_updated"}
    <BotChangedEvent
        changedBy={event.event.updatedBy}
        resourceKey={"bots.events.update"}
        event={event.event}
        userId={$currentUserIdStore}
        timestamp={event.timestamp} />
{:else if !client.isEventKindHidden(event.event.kind, publicGroup && chatType === "channel")}
    <div>Unexpected event type: {event.event.kind}</div>
{/if}
