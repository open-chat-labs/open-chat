<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import { toLongDateString, toShortTimeString } from "../../utils/date";

    export let text: string;
    export let timestamp: bigint;
    $: date = new Date(Number(timestamp));
</script>

<div class="timeline-event">
    <p>{text}</p>
    <p class="timestamp">{`${toLongDateString(date)} @ ${toShortTimeString(date)}`}</p>
</div>

<style type="text/scss">
    .timeline-event {
        padding: $sp2;
        background-color: var(--timeline-bg);
        margin: $sp4 auto;
        text-align: center;
        color: var(--timeline-txt);
        @include font(book, normal, fs-70);
    }
    .timestamp {
        @include font(light, normal, fs-70);
    }
</style>
