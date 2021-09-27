<svelte:options immutable={true} />

<script lang="ts">
    import ChatMessage from "./ChatMessage.svelte";
    import GroupChatCreatedEvent from "./GroupChatCreatedEvent.svelte";
    import DirectChatCreatedEvent from "./DirectChatCreatedEvent.svelte";
    import ParticipantsChangedEvent from "./ParticipantsChangedEvent.svelte";
    import ParticipantLeftEvent from "./ParticipantLeftEvent.svelte";
    import type { UserLookup, UserSummary } from "../../domain/user/user";
    import type { ChatEvent, ChatSummary, EventWrapper } from "../../domain/chat/chat";
    import GroupChangedEvent from "./GroupChangedEvent.svelte";
    import { _ } from "svelte-i18n";

    // todo - I hate the way that I cannot enforce the relationship between the chatSummary and the event
    // i.e. I cannot prevent a group chat with a direct chat event *at the type level*
    // I am *sure* there must be a way to do it.
    export let chatSummary: ChatSummary;
    export let user: UserSummary | undefined;
    export let event: EventWrapper<ChatEvent>;
    export let last: boolean;
    export let me: boolean;
    export let userLookup: UserLookup;
    export let confirmed: boolean;
    export let readByThem: boolean;
    export let readByMe: boolean;
    export let observer: IntersectionObserver;
    export let focused: boolean;
</script>

{#if event.event.kind === "message"}
    <ChatMessage
        {focused}
        {observer}
        {confirmed}
        {readByMe}
        {readByThem}
        {chatSummary}
        {user}
        {me}
        {userLookup}
        {last}
        on:chatWith
        on:goToMessage
        on:replyPrivatelyTo
        on:replyTo
        on:selectReaction
        on:deleteMessage
        eventIndex={event.index}
        timestamp={event.timestamp}
        msg={event.event} />
{:else if event.event.kind === "group_chat_created"}
    <GroupChatCreatedEvent event={event.event} {me} {userLookup} timestamp={event.timestamp} />
{:else if event.event.kind === "direct_chat_created"}
    <DirectChatCreatedEvent timestamp={event.timestamp} />
{:else if event.event.kind === "participants_added"}
    <ParticipantsChangedEvent
        {user}
        changed={event.event.userIds}
        changedBy={event.event.addedBy}
        resourceKey={"addedBy"}
        {userLookup}
        timestamp={event.timestamp} />
{:else if event.event.kind === "participants_removed"}
    <ParticipantsChangedEvent
        {user}
        changed={event.event.userIds}
        changedBy={event.event.removedBy}
        resourceKey={"removedBy"}
        {userLookup}
        timestamp={event.timestamp} />
{:else if event.event.kind === "participant_left"}
    <ParticipantLeftEvent
        {user}
        left={userLookup[event.event.userId]}
        timestamp={event.timestamp} />
{:else if event.event.kind === "participants_promoted_to_admin"}
    <ParticipantsChangedEvent
        {user}
        changed={event.event.userIds}
        changedBy={event.event.promotedBy}
        resourceKey={"promotedBy"}
        {userLookup}
        timestamp={event.timestamp} />
{:else if event.event.kind === "participants_dismissed_as_admin"}
    <ParticipantsChangedEvent
        {user}
        changed={event.event.userIds}
        changedBy={event.event.dismissedBy}
        resourceKey={"dismissedBy"}
        {userLookup}
        timestamp={event.timestamp} />
{:else if event.event.kind === "name_changed"}
    <GroupChangedEvent
        {user}
        {userLookup}
        changedBy={event.event.changedBy}
        property={$_("groupName")}
        timestamp={event.timestamp} />
{:else if event.event.kind === "desc_changed"}
    <GroupChangedEvent
        {user}
        {userLookup}
        changedBy={event.event.changedBy}
        property={$_("groupDesc")}
        timestamp={event.timestamp} />
{:else if event.event.kind === "avatar_changed"}
    <GroupChangedEvent
        {user}
        {userLookup}
        changedBy={event.event.changedBy}
        property={$_("groupAvatar")}
        timestamp={event.timestamp} />
{:else if event.event.kind !== "reaction_added" && event.event.kind !== "reaction_removed"}
    <div>Unexpected event type</div>
{/if}
