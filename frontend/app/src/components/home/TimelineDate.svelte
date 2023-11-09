<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";

    const client = getContext<OpenChat>("client");

    export let timestamp: bigint;
    export let observer: IntersectionObserver;
    export let floating: boolean = false;

    let element: HTMLElement;

    onMount(() => {
        if (floating) return;

        if (observer !== undefined) {
            observer.observe(element);
        }
        return () => observer.unobserve(element);
    });
</script>

<div data-timestamp={timestamp} bind:this={element} class="date-label" class:floating>
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

        &.floating {
            position: absolute;
            top: 90px;
            left: 50%;
            transform: translateX(calc(-50% - 3px));
        }
    }
</style>
