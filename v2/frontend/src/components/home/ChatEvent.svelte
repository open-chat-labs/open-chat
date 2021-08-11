<svelte:options immutable={true} />

<script lang="ts">
    import ChatMessage from "./ChatMessage.svelte";
    import type { UserLookup, UserSummary } from "../../domain/user/user";
    import type { ChatSummary, EventWrapper } from "../../domain/chat/chat";

    export let chatSummary: ChatSummary;
    export let user: UserSummary | undefined;
    export let event: EventWrapper;
    export let last: boolean;
    export let me: boolean;
    export let userLookup: UserLookup;
</script>

{#if event.event.kind === "message"}
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
{:else}
    <div>TODO - We got an event that wasn't a message</div>
{/if}
