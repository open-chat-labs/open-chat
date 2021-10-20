<svelte:options immutable={true} />

<script lang="ts">
    import ChatMessage from "./ChatMessage.svelte";
    import GroupChatCreatedEvent from "./GroupChatCreatedEvent.svelte";
    import DirectChatCreatedEvent from "./DirectChatCreatedEvent.svelte";
    import ParticipantsChangedEvent from "./ParticipantsChangedEvent.svelte";
    import ParticipantLeftEvent from "./ParticipantLeftEvent.svelte";
    import type { UserSummary } from "../../domain/user/user";
    import type { ChatEvent, EventWrapper, Message } from "../../domain/chat/chat";
    import GroupChangedEvent from "./GroupChangedEvent.svelte";
    import { _ } from "svelte-i18n";
    import { afterUpdate, createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    export let chatId: string;
    export let chatType: "group_chat" | "direct_chat";
    export let user: UserSummary | undefined;
    export let event: EventWrapper<ChatEvent>;
    export let last: boolean;
    export let me: boolean;
    export let confirmed: boolean;
    export let readByThem: boolean;
    export let readByMe: boolean;
    export let observer: IntersectionObserver;
    export let focused: boolean;
    export let admin: boolean;

    function editEvent() {
        dispatch("editEvent", event as EventWrapper<Message>);
    }

    afterUpdate(() => {
        console.log("updating ChatEvent component");
    });
</script>

{#if event.event.kind === "message"}
    <ChatMessage
        senderId={event.event.sender}
        {focused}
        {observer}
        {confirmed}
        {readByMe}
        {readByThem}
        {chatId}
        {chatType}
        {user}
        {me}
        {last}
        {admin}
        on:chatWith
        on:goToMessage
        on:replyPrivatelyTo
        on:replyTo
        on:selectReaction
        on:deleteMessage
        on:editMessage={editEvent}
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
{:else if event.event.kind === "participant_left"}
    <ParticipantLeftEvent
        {user}
        label={"userLeft"}
        subjectId={event.event.userId}
        timestamp={event.timestamp} />
{:else if event.event.kind === "participant_joined"}
    <ParticipantLeftEvent
        {user}
        label={"userJoined"}
        subjectId={event.event.userId}
        timestamp={event.timestamp} />
{:else if event.event.kind === "participants_promoted_to_admin"}
    <ParticipantsChangedEvent
        {user}
        changed={event.event.userIds}
        changedBy={event.event.promotedBy}
        resourceKey={"promotedBy"}
        timestamp={event.timestamp} />
{:else if event.event.kind === "participants_dismissed_as_admin"}
    <ParticipantsChangedEvent
        {user}
        changed={event.event.userIds}
        changedBy={event.event.dismissedBy}
        resourceKey={"dismissedBy"}
        timestamp={event.timestamp} />
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
{:else if event.event.kind !== "reaction_added" && event.event.kind !== "reaction_removed"}
    <div>Unexpected event type</div>
{/if}
