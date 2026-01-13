<script lang="ts">
    import { ColourVars, Container } from "component-lib";
    import { onMount, tick, type Snippet } from "svelte";

    interface Props {
        onDismiss?: () => void;
        children?: Snippet;
        block?: boolean;
        transparent?: boolean;
        animate?: boolean;
    }

    let {
        onDismiss,
        children,
        transparent = false,
        block = !transparent,
        animate = true,
    }: Props = $props();

    let container: HTMLElement | undefined;
    const SPEED = animate ? 250 : 0;

    export async function beforeClose(): Promise<void> {
        container?.classList.remove("faded");
        return new Promise((resolve) => {
            setTimeout(() => resolve(), SPEED);
        });
    }

    onMount(() => {
        tick().then(() => container?.classList.add("faded"));
    });

    function dismissInternal() {
        if (onDismiss !== undefined) {
            onDismiss?.();
        }
    }

    function onMousedown(ev: MouseEvent) {
        if (ev.target === container) {
            dismissInternal();
        }
    }

    function onKeyDown(ev: KeyboardEvent) {
        if (ev.key === "Escape") {
            dismissInternal();
        }
    }
</script>

<svelte:window onkeydown={onKeyDown} />

<!-- Yes this *should* be set to height:hug because we don't want it to take up more space than it needs -->
<!-- When you feel like changing it to height:fill - DON'T -->
<!-- That said, this *can* cause issues because it means that the children of the sheet must define the height if it matters -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    style={`--speed: ${SPEED}ms`}
    class:block
    class:animate
    class:transparent
    bind:this={container}
    class="sheet_overlay"
    onmousedown={onMousedown}>
    <Container
        parentDirection={"vertical"}
        maxHeight={"85vh"}
        height={"hug"}
        background={transparent ? undefined : ColourVars.background1}
        supplementalClass={"sheet_content"}
        borderRadius={["xl", "xl", "zero", "zero"]}
        direction={"vertical"}>
        {@render children?.()}
    </Container>
</div>

<style lang="scss">
    :global(.sheet_overlay) {
        animation: var(--speed) ease-out fade-out;
    }

    :global(.sheet_overlay.block) {
        background: rgba(0, 0, 0, 0.5);
    }

    :global(.sheet_content) {
        pointer-events: all;
    }

    :global(.sheet_overlay .sheet_content) {
        animation: var(--speed) ease-out slide_down;
    }

    :global(.sheet_overlay.faded.block) {
        background: rgba(0, 0, 0, 0.5);
        animation: var(--speed) ease-out fade-in;
    }

    :global(.sheet_overlay.faded .sheet_content) {
        animation: var(--speed) ease-out slide_up;
    }

    :global(.sheet_overlay:not(.animate)) {
        animation: none;
    }

    :global(.sheet_overlay:not(.animate) .sheet_content) {
        animation: none;
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
