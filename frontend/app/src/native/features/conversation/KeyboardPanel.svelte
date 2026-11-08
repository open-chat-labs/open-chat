<!-- A keyboard-area panel's surface (native plan 06 "Layout and size", 07 "What it is"): in the slot
     under the composer, at the bottom of the screen, resting at the slot's height over the spacer
     the slot keeps (so the chat and the composer move up by it). Its handle drags it: up it grows
     over the chat towards the status bar, following the finger; down from rest it slides out and
     closes (KeyboardPanelState, panelDrag.ts). It rises in as it opens; the emoji and attach panels
     swap inside it without that. Where the keyboard covers its bottom (the emoji search), what it
     shows sits above it. -->
<script lang="ts">
    import { onDestroy, type Snippet } from "svelte";
    import type { KeyboardPanelState } from "./panelState.svelte";
    import { panelLayers } from "./panelDrag";
    import { panelDragHandle } from "./panelDragHandle";

    type Props = {
        panel: KeyboardPanelState;
        /** Its resting height, in CSS pixels (the slot's). */
        rest: number;
        /** How much of its bottom the keyboard covers. */
        covered: number;
        /** The handle's accessible name (what dragging it does). */
        handleLabel: string;
        /** It slid out (dragged down): the slot closes. */
        onClose: () => void;
        children: Snippet;
    };

    let { panel, rest, covered, handleLabel, onClose, children }: Props = $props();

    // the duration of the slide out (06: ≈220ms)
    const CLOSE_MS = 220;

    let el = $state<HTMLElement>();
    let safeTop = $state<HTMLElement>();

    const layers = $derived(panelLayers(panel.f));

    // how far it can grow: up to just under the status bar
    function measure() {
        const slot = el?.parentElement;
        if (slot === null || slot === undefined) return;
        const bottom = slot.getBoundingClientRect().bottom;
        panel.setMaxGrow(bottom - (safeTop?.offsetHeight ?? 0) - rest);
    }

    $effect(() => {
        const measured = panel;
        measured.measuredBy(measure);
        return () => measured.measuredBy(undefined);
    });

    // again as its resting height or the window changes (the keyboard on iOS and the web)
    $effect(() => {
        void rest;
        measure();
        window.addEventListener("resize", measure);
        window.visualViewport?.addEventListener("resize", measure);
        return () => {
            window.removeEventListener("resize", measure);
            window.visualViewport?.removeEventListener("resize", measure);
        };
    });

    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    $effect(() => {
        if (!panel.closing) return;
        closeTimer = setTimeout(onClose, CLOSE_MS);
        return () => clearTimeout(closeTimer);
    });
    onDestroy(() => clearTimeout(closeTimer));

    function key(e: KeyboardEvent) {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        if (!panel.expandable) onClose();
        else if (panel.open) panel.rest();
        else panel.expand();
    }
</script>

<div
    bind:this={el}
    class="panel"
    class:settling={!panel.dragging}
    class:closing={panel.closing}
    style:height="{rest + panel.grown}px"
    style:transform={panel.closing
        ? "translateY(100%)"
        : panel.pulled > 0
          ? `translateY(${panel.pulled}px)`
          : undefined}
    style:--panel-shadow={layers.shadow / 0.45}
>
    <span class="safe-top" bind:this={safeTop} aria-hidden="true"></span>
    <div
        class="handle-area"
        role="button"
        tabindex="0"
        aria-label={handleLabel}
        onkeydown={key}
        {@attach panelDragHandle(panel)}
    >
        <span class="handle"></span>
    </div>
    <div class="content" style:padding-block-end="{covered}px">
        {@render children()}
    </div>
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    // 06: --surface-1, 18px top corners, a 1px line along the top, a shadow over the chat that
    // strengthens as it grows; rising 40px and fading in as it opens
    .panel {
        position: absolute;
        z-index: 5;
        inset-inline: 0;
        bottom: 0;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        border-radius: var(--radius-xl) var(--radius-xl) 0 0;
        background: var(--surface-1);
        box-shadow: inset 0 1px 0 var(--line-1);
        animation: rise 0.24s var(--ease-out);

        // the shadow, at f's strength
        &::before {
            content: "";
            position: absolute;
            inset: 0;
            z-index: -1;
            border-radius: inherit;
            box-shadow: var(--shadow-sheet);
            opacity: var(--panel-shadow);
            pointer-events: none;
        }

        // let go: it settles; dragged, it follows the finger as it is
        &.settling {
            transition:
                height 0.34s var(--ease-out),
                transform 0.22s var(--ease-out);
        }

        &.closing {
            transition: transform 0.22s ease-in;
            pointer-events: none;
        }

        @include reduced-motion {
            animation-name: fade;

            &.settling,
            &.closing {
                transition: none;
            }
        }
    }

    @keyframes rise {
        from {
            opacity: 0;
            translate: 0 40px;
        }
    }

    @keyframes fade {
        from {
            opacity: 0;
        }
    }

    .safe-top {
        position: absolute;
        visibility: hidden;
        height: var(--safe-top);
    }

    // 06: a 48 × 4px handle in a 22px area, 8px from the top
    .handle-area {
        flex: none;
        box-sizing: border-box;
        height: 22px;
        padding-block-start: var(--space-8);
        display: flex;
        justify-content: center;
        touch-action: none;
        cursor: grab;
        -webkit-tap-highlight-color: transparent;
    }

    .handle {
        width: 48px;
        height: 4px;
        border-radius: 2px;
        background: var(--overlay-3);
    }

    .content {
        position: relative;
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
    }
</style>
