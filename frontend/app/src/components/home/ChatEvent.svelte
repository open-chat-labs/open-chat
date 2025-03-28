<script lang="ts">
    import ChatMessage from "./ChatMessage.svelte";
    import GroupChatCreatedEvent from "./GroupChatCreatedEvent.svelte";
    import DirectChatCreatedEvent from "./DirectChatCreatedEvent.svelte";
    import MembersChangedEvent from "./MembersChangedEvent.svelte";
    import PermissionsChangedEvent from "./PermissionsChangedEvent.svelte";
    import AggregateCommonEvents from "./AggregateCommonEvents.svelte";
    import {
        type CreatedUser,
        type UserSummary,
        type ChatEvent,
        type EventWrapper,
        type Message,
        type OpenChat,
        type ChatIdentifier,
        type ChatType,
        type Level,
        userStore,
        chatListScopeStore,
        typing,
        routeForMessage,
        type EnhancedReplyContext,
    } from "openchat-client";
    import GroupChangedEvent from "./GroupChangedEvent.svelte";
    import GroupRulesChangedEvent from "./GroupRulesChangedEvent.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext } from "svelte";
    import GroupVisibilityChangedEvent from "./GroupVisibilityChangedEvent.svelte";
    import GroupInviteCodeChangedEvent from "./GroupInviteCodeChangedEvent.svelte";
    import DisappearingMessageTimeUpdated from "./DisappearingMessageTimeUpdated.svelte";
    import ChatFrozenEvent from "./ChatFrozenEvent.svelte";
    import ChatUnfrozenEvent from "./ChatUnfrozenEvent.svelte";
    import page from "page";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import BotChangedEvent from "./BotChangedEvent.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let chatId: ChatIdentifier;
    export let chatType: ChatType;
    export let user: CreatedUser;
    export let event: EventWrapper<ChatEvent>;
    export let first: boolean;
    export let last: boolean;
    export let me: boolean;
    export let accepted: boolean;
    export let confirmed: boolean;
    export let failed: boolean;
    export let readByThem: boolean;
    export let readByMe: boolean;
    export let observer: IntersectionObserver;
    export let focused: boolean;
    export let readonly: boolean;
    export let pinned: boolean;
    export let canPin: boolean;
    export let canBlockUsers: boolean;
    export let canDelete: boolean;
    export let canSendAny: boolean;
    export let canReact: boolean;
    export let canInvite: boolean;
    export let canReplyInThread: boolean;
    export let publicGroup: boolean;
    export let editing: boolean;
    export let supportsEdit: boolean;
    export let supportsReply: boolean;
    export let collapsed: boolean;
    export let threadRootMessage: Message | undefined;
    export let onExpandMessage: (() => void) | undefined = undefined;
    export let onReplyTo: (replyContext: EnhancedReplyContext) => void;
    export let onReplyPrivatelyTo: (replyContext: EnhancedReplyContext) => void;

    let userSummary: UserSummary | undefined = undefined;

    $: levelType = (chatType === "channel" ? "channel" : "group") as Level;
    $: level = $_(`level.${levelType}`).toLowerCase();
    $: messageContext = { chatId, threadRootMessageIndex: threadRootMessage?.messageIndex };
    $: hidden =
        event.event.kind === "message" &&
        event.event.content.kind === "message_reminder_created_content" &&
        event.event.content.hidden;
    $: {
        userSummary = {
            kind: "user",
            userId: user.userId,
            username: user.username,
            displayName: user.displayName,
            updated: BigInt(0),
            suspended: false,
            diamondStatus: "inactive",
            chitBalance: 0,
            streak: 0,
            isUniquePerson: user.isUniquePerson,
            totalChitEarned: 0,
        };
    }

    function editEvent() {
        dispatch("editEvent", event as EventWrapper<Message>);
    }

    function deleteFailedMessage() {
        client.deleteFailedMessage(
            chatId,
            event as EventWrapper<Message>,
            threadRootMessage?.messageIndex,
        );
    }

    function retrySend() {
        client.retrySendMessage(messageContext, event as EventWrapper<Message>);
    }

    function initiateThread() {
        if (event.event.kind === "message") {
            if (event.event.thread !== undefined) {
                page(
                    `${routeForMessage(
                        $chatListScopeStore.kind,
                        { chatId },
                        event.event.messageIndex,
                    )}?open=true`,
                );
            } else {
                client.openThread(event as EventWrapper<Message>, true);
            }
        }
    }

    function removePreview(ev: CustomEvent<string>) {
        dispatch("removePreview", { event, url: ev.detail });
    }
</script>

{#if event.event.kind === "message"}
    {@const sender = $userStore.get(event.event.sender)}
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
            {readByThem}
            {chatId}
            {chatType}
            {user}
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
            {editing}
            {threadRootMessage}
            {supportsEdit}
            {supportsReply}
            {collapsed}
            botContext={event.event.botContext}
            on:goToMessageIndex
            {onReplyTo}
            {onReplyPrivatelyTo}
            on:retrySend={retrySend}
            onEditMessage={editEvent}
            on:upgrade
            on:verifyHumanity
            on:claimDailyChit
            on:forward
            {onExpandMessage}
            on:collapseMessage
            on:removePreview={removePreview}
            on:initiateThread={initiateThread}
            on:deleteFailedMessage={deleteFailedMessage}
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
        {chatId}
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
        userId={user.userId}
        timestamp={event.timestamp} />
{:else if event.event.kind === "bot_removed"}
    <BotChangedEvent
        changedBy={event.event.removedBy}
        resourceKey={"bots.events.remove"}
        event={event.event}
        userId={user.userId}
        timestamp={event.timestamp} />
{:else if event.event.kind === "bot_updated"}
    <BotChangedEvent
        changedBy={event.event.updatedBy}
        resourceKey={"bots.events.update"}
        event={event.event}
        userId={user.userId}
        timestamp={event.timestamp} />
{:else if !client.isEventKindHidden(event.event.kind)}
    <div>Unexpected event type: {event.event.kind}</div>
{/if}
