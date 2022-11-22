<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { DeletedContent, OpenChat } from "openchat-client";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    export let content: DeletedContent;

    $: userStore = client.userStore;
    $: date = new Date(Number(content.timestamp));
    $: timestampStr = `${client.toLongDateString(date)} @ ${client.toShortTimeString(date)}`;
    $: username = $userStore[content.deletedBy]?.username ?? $_("unknownUser");
</script>

<div class="deleted">
    {$_("messageDeleted", {
        values: { username, timestamp: timestampStr },
    })}
</div>

<style type="text/scss">
    .deleted {
        @include font(light, normal, fs-100);
    }
</style>
