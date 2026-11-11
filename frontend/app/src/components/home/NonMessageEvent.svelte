<script lang="ts">
    import { toLongDatetimeString } from "@client";
    import { locale } from "svelte-i18n";
    import Markdown from "@src/core/Markdown.svelte";

    interface Props {
        text: string;
        timestamp: bigint;
    }

    let { text, timestamp }: Props = $props();
    let date = $derived(new Date(Number(timestamp)));
</script>

<div class="timeline-event">
    <Markdown suppressLinks {text} />
    <p class="timestamp">
        {toLongDatetimeString(date, $locale ?? "en")}
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
