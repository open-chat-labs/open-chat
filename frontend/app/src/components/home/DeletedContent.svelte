<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { DeletedContent, OpenChat } from "openchat-client";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    export let content: DeletedContent;
    export let undeleting: boolean;

    $: userStore = client.userStore;
    $: date = new Date(Number(content.timestamp));
    $: timestampStr = `${client.toLongDateString(date)} @ ${client.toShortTimeString(date)}`;
    $: username = $userStore[content.deletedBy]?.username ?? $_("unknownUser");
</script>

<div class="deleted">
    {#if undeleting}
        {$_("undeletingMessage", {
            values: { username, timestamp: timestampStr },
        })}
    {:else}
        {$_("messageDeleted", {
            values: { username, timestamp: timestampStr },
        })}
    {/if}
</div>

<style lang="scss">
    .deleted {
        @include font(light, italic, fs-80);
    }
</style>
