<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";

    const client = getContext<OpenChat>("client");

    interface Props {
        timestamp: bigint;
    }

    let { timestamp }: Props = $props();
</script>

<div class="date-label">
    {client.formatMessageDate(timestamp, $_("today"), $_("yesterday"))}
</div>

<style lang="scss">
    .date-label {
        padding: $sp2 10px;
        background-color: var(--currentChat-date-bg);
        border: var(--currentChat-date-bd);
        color: var(--currentChat-date-txt);
        width: fit-content;
        min-width: 100px;
        margin: 0 auto;
        border-radius: 12px;
        @include z-index("date-label");
        @include font(book, normal, fs-70);
        text-align: center;
        margin-bottom: $sp4;
    }
</style>
