<svelte:options immutable={true} />

<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Markdown from "./Markdown.svelte";

    const client = getContext<OpenChat>("client");

    export let text: string;
    export let timestamp: bigint;
    $: date = new Date(Number(timestamp));
</script>

<div class="timeline-event">
    <Markdown suppressLinks {text} />
    <p class="timestamp">
        {`${client.toLongDateString(date)} @ ${client.toShortTimeString(date)}`}
    </p>
</div>

<style lang="scss">
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
