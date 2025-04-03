<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";

    const client = getContext<OpenChat>("client");

    interface Props {
        timestamp: bigint;
        observer: IntersectionObserver;
        floating?: boolean;
    }

    let { timestamp, observer, floating = false }: Props = $props();

    let element: HTMLElement | undefined = $state();

    onMount(() => {
        if (floating) return;

        if (observer !== undefined && element) {
            observer.observe(element);
        }
        return () => {
            if (observer && element) {
                observer.unobserve(element);
            }
        };
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
