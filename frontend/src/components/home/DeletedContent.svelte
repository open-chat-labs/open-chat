<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { DeletedContent } from "../../domain/chat/chat";
    import { userStore } from "../../stores/user";
    import { toLongDateString, toShortTimeString } from "../../utils/date";
    export let content: DeletedContent;
    $: date = new Date(Number(content.timestamp));
    $: timestampStr = `${toLongDateString(date)} @ ${toShortTimeString(date)}`;
    $: username = $userStore[content.deletedBy]?.username ?? $_("unknownUser");
</script>

<div class="deleted">
    {$_("messageDeleted", {
        values: { username, timestamp: timestampStr },
    })}
</div>

<style type="text/scss">
    .deleted {
        @include font(light, italic, fs-90);
    }
</style>
