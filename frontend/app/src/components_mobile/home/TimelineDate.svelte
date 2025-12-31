<script lang="ts">
    import { BodySmall } from "component-lib";
    import type { OpenChat } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";

    const client = getContext<OpenChat>("client");

    interface Props {
        timestamp: bigint;
        observer?: IntersectionObserver;
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
    <BodySmall align={"center"} colour={"textSecondary"}>
        {client.formatMessageDate(timestamp, $_("today"), $_("yesterday"))}
    </BodySmall>
</div>

<style lang="scss">
    .date-label {
        text-align: center;
        padding: var(--sp-xs) var(--sp-md);
        background-color: var(--background-2);
        box-shadow: var(--menu-sh);
        color: var(--text-secondary);
        width: fit-content;
        min-width: 100px;
        margin: 0 auto;
        border-radius: var(--rad-circle);
        @include z-index("date-label");
        margin-bottom: var(--sp-lg);

        &.floating {
            position: absolute;
            top: 90px;
            left: 50%;
            transform: translateX(calc(-50% - 3px));
        }
    }
</style>
