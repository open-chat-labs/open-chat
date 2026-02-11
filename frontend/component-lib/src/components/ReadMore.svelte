<script lang="ts">
    import { CommonButton, Container, transition } from "component-lib";
    import { onMount, tick, type Snippet } from "svelte";

    interface Props {
        children: Snippet;
        moreLabel?: string;
        lessLabel?: string;
        maxHeight?: string;
    }

    let {
        children,
        moreLabel = "Show more",
        lessLabel = "Show less",
        maxHeight = "10rem",
    }: Props = $props();
    let container = $state<HTMLHtmlElement>();
    let overflowing = $state(false);
    let expanded = $state(false);

    onMount(checkOverflow);

    function toggle() {
        transition(["fade"], async () => {
            expanded = !expanded;
            await tick();
            checkOverflow();
        });
    }

    function checkOverflow() {
        if (container !== undefined) {
            overflowing = container.scrollHeight > container.clientHeight;
        }
    }
</script>

<Container crossAxisAlignment={"end"} direction={"vertical"}>
    <Container
        overflow={overflowing && !expanded ? "hidden" : "auto"}
        supplementalClass={`read_more_content ${expanded ? "expanded" : ""}`}
        maxHeight={expanded ? "1000rem" : maxHeight}
        bind:ref={container}>
        {@render children()}
        {#if overflowing}
            <div class="fade"></div>
        {/if}
    </Container>

    {#if overflowing || expanded}
        <CommonButton onClick={toggle} mode={"active"} size="small_text">
            {expanded ? lessLabel : moreLabel}
        </CommonButton>
    {/if}
</Container>

<style lang="scss">
    :global(.container.read_more_content:not(.expanded)) {
        overflow: hidden;
    }

    .fade {
        position: absolute;
        bottom: 0;
        inset: auto 0 0 0;
        height: 3rem;
        pointer-events: none;
        background: linear-gradient(to bottom, rgba(0, 0, 0, 0), var(--background-1));
    }
</style>
