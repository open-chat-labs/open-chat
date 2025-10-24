<script lang="ts">
    import { ColourVars, Container } from "component-lib";
    import { onMount, type Snippet } from "svelte";

    interface Props {
        dismissible?: boolean;
        children?: Snippet;
        onClose?: () => void;
        block?: boolean;
    }

    let { dismissible = false, children, onClose, block = true }: Props = $props();

    let container: HTMLElement | undefined;

    let classes = $state(["sheet_content"]);

    onMount(() => {
        window.addEventListener("popstate", popState);
        return () => {
            window.removeEventListener("popstate", popState);
        };
    });

    function popState() {
        onClose?.();
    }

    function onMousedown(ev: MouseEvent) {
        if (dismissible && ev.target === container) {
            onClose?.();
        }
    }

    function onKeyDown(ev: KeyboardEvent) {
        if (dismissible && ev.key === "Escape") {
            onClose?.();
        }
    }
</script>

<svelte:window onkeydown={onKeyDown} />

{#if children}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class:block bind:this={container} class="sheet_overlay faded" onmousedown={onMousedown}>
        <Container
            parentDirection={"vertical"}
            maxHeight={"65vh"}
            height={{ kind: "hug" }}
            background={ColourVars.background1}
            supplementalClass={"sheet_content"}
            borderRadius={["xl", "xl", "zero", "zero"]}
            direction={"vertical"}>
            {@render children?.()}
        </Container>
    </div>
{/if}

<style lang="scss">
    :global(.sheet_overlay.block) {
        background: rgba(0, 0, 0, 0.5);
    }

    .sheet_overlay {
        z-index: 25; // this is annoyingly error prone
        position: fixed;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: center;
        top: 0;
        left: 0;
        height: 100%;
        width: 100%;
        overflow: hidden;

        &:not(.block) {
            pointer-events: none;
        }
    }
</style>
