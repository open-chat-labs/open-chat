<svelte:options immutable />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { DeletedContent, OpenChat } from "openchat-client";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    export let content: DeletedContent;
    export let undeleting: boolean;

    $: date = new Date(Number(content.timestamp));
    $: timestampStr = `${client.toLongDateString(date)} @ ${client.toShortTimeString(date)}`;
    $: communityMembers = client.currentCommunityMembers;
    $: username = client.getDisplayNameById(content.deletedBy, $communityMembers);
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
