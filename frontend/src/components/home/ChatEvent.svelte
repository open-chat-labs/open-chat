<svelte:options immutable={true} />

<script lang="ts">
    import ChatMessage from "./ChatMessage.svelte";
    import GroupChatCreatedEvent from "./GroupChatCreatedEvent.svelte";
    import DirectChatCreatedEvent from "./DirectChatCreatedEvent.svelte";
    import ParticipantsChangedEvent from "./ParticipantsChangedEvent.svelte";
    import PermissionsChangedEvent from "./PermissionsChangedEvent.svelte";
    import RoleChangedEvent from "./RoleChangedEvent.svelte";
    import AggregateParticipantsJoinedOrLeftEvent from "./AggregateParticipantsJoinedOrLeftEvent.svelte";
    import type { UserSummary } from "../../domain/user/user";
    import type { ChatEvent, EventWrapper, Message, ThreadSummary } from "../../domain/chat/chat";
    import GroupChangedEvent from "./GroupChangedEvent.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    import GroupVisibilityChangedEvent from "./GroupVisibilityChangedEvent.svelte";
    import GroupInviteCodeChangedEvent from "./GroupInviteCodeChangedEvent.svelte";

    const dispatch = createEventDispatcher();

    export let chatId: string;
    export let chatType: "group_chat" | "direct_chat";
    export let user: UserSummary;
    export let event: EventWrapper<ChatEvent>;
    export let first: boolean;
    export let last: boolean;
    export let me: boolean;
    export let confirmed: boolean;
    export let readByThem: boolean;
    export let readByMe: boolean;
    export let observer: IntersectionObserver;
    export let focused: boolean;
    export let preview: boolean;
    export let pinned: boolean;
    export let canPin: boolean;
    export let canBlockUser: boolean;
    export let canDelete: boolean;
    export let canSend: boolean;
    export let canReact: boolean;
    export let canInvite: boolean;
    export let publicGroup: boolean;
    export let editing: boolean;
    export let selectedThreadMessageIndex: number | undefined;
    export let inThread: boolean;
    export let supportsEdit: boolean;
    export let supportsReply: boolean;

    function editEvent() {
        dispatch("editEvent", event as EventWrapper<Message>);
    }

    function replyInThread() {
        dispatch("replyInThread", { rootEvent: event });
    }
</script>

{#if event.event.kind === "message"}
    <ChatMessage
        senderId={event.event.sender}
        {selectedThreadMessageIndex}
        {focused}
        {observer}
        {confirmed}
        {readByMe}
        {readByThem}
        {chatId}
        {chatType}
        {user}
        {me}
        {first}
        {last}
        {preview}
        {pinned}
        {canPin}
        {canBlockUser}
        {canDelete}
        {canSend}
        {canReact}
        {publicGroup}
        {editing}
        {inThread}
        {supportsEdit}
        {supportsReply}
        on:chatWith
        on:goToMessageIndex
        on:replyPrivatelyTo
        on:replyTo
        on:replyInThread={replyInThread}
        on:selectReaction
        on:deleteMessage
        on:blockUser
        on:pinMessage
        on:unpinMessage
        on:registerVote
        on:editMessage={editEvent}
        on:upgrade
        on:forward
        on:copyMessageUrl
        on:shareMessage
        eventIndex={event.index}
        timestamp={event.timestamp}
        msg={event.event} />
{:else if event.event.kind === "group_chat_created"}
    <GroupChatCreatedEvent event={event.event} {me} timestamp={event.timestamp} />
{:else if event.event.kind === "direct_chat_created"}
    <DirectChatCreatedEvent timestamp={event.timestamp} />
{:else if event.event.kind === "participants_added"}
    <ParticipantsChangedEvent
        {user}
        changed={event.event.userIds}
        changedBy={event.event.addedBy}
        resourceKey={"addedBy"}
        timestamp={event.timestamp} />
{:else if event.event.kind === "participants_removed"}
    <ParticipantsChangedEvent
        {user}
        changed={event.event.userIds}
        changedBy={event.event.removedBy}
        resourceKey={"removedBy"}
        timestamp={event.timestamp} />
{:else if event.event.kind === "aggregate_participants_joined_left"}
    <AggregateParticipantsJoinedOrLeftEvent
        {user}
        joined={event.event.users_joined}
        left={event.event.users_left} />
{:else if event.event.kind === "role_changed"}
    <RoleChangedEvent {user} event={event.event} timestamp={event.timestamp} />
{:else if event.event.kind === "users_blocked"}
    <ParticipantsChangedEvent
        {user}
        changed={event.event.userIds}
        changedBy={event.event.blockedBy}
        resourceKey={"blockedBy"}
        timestamp={event.timestamp} />
{:else if event.event.kind === "users_unblocked"}
    <ParticipantsChangedEvent
        {user}
        changed={event.event.userIds}
        changedBy={event.event.unblockedBy}
        resourceKey={"unblockedBy"}
        timestamp={event.timestamp} />
{:else if event.event.kind === "ownership_transferred"}
    <ParticipantsChangedEvent
        {user}
        changed={[event.event.newOwner]}
        changedBy={event.event.oldOwner}
        resourceKey={"ownershipTransferredBy"}
        timestamp={event.timestamp} />
{:else if event.event.kind === "name_changed"}
    <GroupChangedEvent
        {user}
        changedBy={event.event.changedBy}
        property={$_("groupName")}
        timestamp={event.timestamp} />
{:else if event.event.kind === "desc_changed"}
    <GroupChangedEvent
        {user}
        changedBy={event.event.changedBy}
        property={$_("groupDesc")}
        timestamp={event.timestamp} />
{:else if event.event.kind === "avatar_changed"}
    <GroupChangedEvent
        {user}
        changedBy={event.event.changedBy}
        property={$_("groupAvatar")}
        timestamp={event.timestamp} />
{:else if event.event.kind === "group_visibility_changed"}
    <GroupVisibilityChangedEvent
        {user}
        nowPublic={event.event.nowPublic}
        changedBy={event.event.changedBy}
        timestamp={event.timestamp} />
{:else if event.event.kind === "group_invite_code_changed"}
    {#if canInvite}
        <GroupInviteCodeChangedEvent
            {user}
            change={event.event.change}
            changedBy={event.event.changedBy}
            timestamp={event.timestamp} />
    {/if}
{:else if event.event.kind === "permissions_changed"}
    <PermissionsChangedEvent {user} event={event.event} timestamp={event.timestamp} />
{:else if event.event.kind !== "reaction_added" && event.event.kind !== "reaction_removed" && event.event.kind !== "message_pinned" && event.event.kind !== "message_unpinned" && event.event.kind !== "poll_ended" && event.event.kind !== "participant_joined" && event.event.kind !== "participant_left"}
    <div>Unexpected event type</div>
{/if}
