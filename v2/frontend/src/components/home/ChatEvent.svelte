<svelte:options immutable={true} />

<script lang="ts">
    import ChatMessage from "./ChatMessage.svelte";
    import GroupChatCreatedEvent from "./GroupChatCreatedEvent.svelte";
    import type { UserLookup, UserSummary } from "../../domain/user/user";
    import type { ChatEvent, ChatSummary, EventWrapper } from "../../domain/chat/chat";

    export let chatSummary: ChatSummary;
    export let user: UserSummary | undefined;
    export let event: EventWrapper<ChatEvent>;
    export let last: boolean;
    export let me: boolean;
    export let userLookup: UserLookup;
</script>

{#if event.event.kind === "group_message" || event.event.kind === "direct_message"}
    <ChatMessage
        {chatSummary}
        {user}
        {me}
        {userLookup}
        {last}
        on:chatWith
        on:goToMessage
        on:replyPrivatelyTo
        on:replyTo
        index={event.index}
        timestamp={event.timestamp}
        msg={event.event} />
{:else if event.event.kind === "group_chat_created"}
    <GroupChatCreatedEvent event={event.event} {me} {userLookup} timestamp={event.timestamp} />
{:else}
    <div>Unexpected event type</div>
{/if}
