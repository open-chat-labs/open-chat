<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import { toLongDateString, toShortTimeString } from "../../utils/date";

    export let timestamp: bigint;

    $: date = new Date(Number(timestamp));
</script>

<div class="created-chat">
    <p class="created-by">
        {$_("directChatCreatedAt")}
    </p>
    <p class="created-at">{`${toLongDateString(date)} @ ${toShortTimeString(date)}`}</p>
</div>

<style type="text/scss">
    .created-chat {
        padding: $sp2;
        background-color: var(--timeline-bg);
        margin: auto;
        text-align: center;
        color: var(--timeline-txt);
        margin-bottom: $sp4;
    }

    .created-at {
        @include font(light, normal, fs-70);
    }
</style>
