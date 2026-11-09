<!-- A keyboard-area panel's sheet (native plan 06 "Sheet behaviour", shared with 07): in the slot
     under the composer, at the bottom of the screen, resting at the keyboard's height over the
     spacer the slot keeps (so the chat and the composer move up by it). Its handle drags it: up it
     grows over the chat to 90% of the screen, following the finger; down from rest it slides out
     and closes (KeyboardPanelState, panelDrag.ts). The backdrop (--scrim) over everything above it
     fades in as it grows (on in a search); a tap on it, or anywhere outside the sheet, takes it
     back to rest. It rises in as it opens; the emoji and attach panels swap inside it without that.
     Where the keyboard covers its bottom (the searches), what it shows sits above it. A tap that
     ends a drag isn't one. -->
<script lang="ts">
    import { onDestroy, type Snippet } from "svelte";
    import type { KeyboardPanelState } from "./panelState.svelte";
    import PanelHandle from "./PanelHandle.svelte";
    import { maxGrowFor, panelLayers } from "./panelDrag";

    type Props = {
        panel: KeyboardPanelState;
        /** Its resting height, in CSS pixels (the slot's). */
        rest: number;
        /** How much of its bottom the keyboard covers. */
        covered: number;
        /** The handle's accessible name (what dragging it does). */
        handleLabel: string;
        /** Its handle row (the emoji panel's, mobile web's attach panel); else the panel has its own. */
        handle: boolean;
        /** It slid out (dragged down): the slot closes. */
        onClose: () => void;
        children: Snippet;
    };

    let { panel, rest, covered, handleLabel, handle, onClose, children }: Props = $props();

    // the handle's area, over what it shows
    const HANDLE = 22;

    // the duration of the slide out (06: ≈220ms)
    const CLOSE_MS = 220;

    let el = $state<HTMLElement>();

    const layers = $derived(panelLayers(panel.f));

    // how far it can grow: to 90% of the screen, from its bottom
    function measure() {
        const slot = el?.parentElement;
        if (slot === null || slot === undefined) return;
        panel.setMaxGrow(maxGrowFor(slot.getBoundingClientRect().bottom, rest));
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

    // a tap that ends a drag (over a tile or an emoji) isn't one
    function guardClick(e: MouseEvent) {
        if (!panel.clickGuarded(e.timeStamp)) return;
        e.preventDefault();
        e.stopPropagation();
    }
</script>

<!-- the backdrop over everything above the sheet (none at rest: the chat stays as it is) -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
    class="veil"
    class:settling={!panel.dragging}
    style:opacity={panel.veil.opacity}
    style:pointer-events={panel.veil.tappable ? undefined : "none"}
    aria-hidden="true"
    onclick={() => panel.veilTapped()}
></div>
<div
    bind:this={el}
    class="panel"
    class:settling={!panel.dragging}
    class:closing={panel.closing}
    style:height="{rest + panel.grown}px"
    style:transform={panel.closing
        ? "translateY(400px)"
        : panel.pulled > 0
          ? `translateY(${panel.pulled}px)`
          : panel.searchOffset !== 0
            ? `translateY(${panel.searchOffset}px)`
            : undefined}
    style:--panel-shadow={layers.shadow / 0.45}
    style:--panel-rest-content="{rest - (handle ? HANDLE : 0)}px"
    onclickcapture={guardClick}
>
    {#if handle}
        <PanelHandle {panel} label={handleLabel} {onClose} />
    {/if}
    <div class="content" style:padding-block-end="{covered}px">
        {@render children()}
    </div>
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    // 06: --surface-1, 18px top corners, a 1px line along the top (--sheet-edge: --line-1 in dark,
    // --line-2 in light), a shadow over the chat that
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
        box-shadow: inset 0 1px 0 var(--sheet-edge);
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

    // the backdrop (06: --scrim) over the chat, the composer, the header and the status bar, under
    // the sheet
    .veil {
        position: fixed;
        inset: 0;
        z-index: 4;
        background: var(--scrim);

        &.settling {
            transition: opacity 0.34s var(--ease-out);
        }

        @include reduced-motion {
            &.settling {
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

    .content {
        position: relative;
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
    }
</style>
