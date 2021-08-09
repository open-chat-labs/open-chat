<svelte:options immutable={true} />

<script lang="ts">
    import ChatMessage from "./ChatMessage.svelte";
    import type { UserLookup, UserSummary } from "../../domain/user/user";
    import type { ChatSummary, EventWrapper } from "../../domain/chat/chat";
    import { afterUpdate } from "svelte";

    export let chatSummary: ChatSummary;
    export let user: UserSummary | undefined;
    export let event: EventWrapper;
    export let showStem: boolean;
    export let me: boolean;
    export let userLookup: UserLookup;

    // afterUpdate(() => {
    //     // todo - keep an eye on this
    //     console.log("updating ChatEvent component");
    // });
</script>

{#if event.event.kind === "message"}
    <ChatMessage
        {chatSummary}
        {user}
        {me}
        {showStem}
        {userLookup}
        on:chatWith
        on:goToMessage
        index={event.index}
        timestamp={event.timestamp}
        msg={event.event} />
{:else}
    <div>TODO - We got an event that wasn't a message</div>
{/if}
