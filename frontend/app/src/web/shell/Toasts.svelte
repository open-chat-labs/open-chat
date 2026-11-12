<!-- The app's toast layer, docked at the foot of the middle panel, just above its composer (above
     the panel's bottom where it has none), centred on the panel, over every dialog, sheet and veil
     and any popup it has open (web/00 and pass 7: bottomPlacement's toastSpot; the window's
     bottom with the panel hidden):
     the library components' toasts (`library`: a wallet send's, an invite's …, which they hand to
     the host: setToastHost), and under them the app's toast (toastStore: showFailureToast,
     showSuccessToast), as the library's UndoToast without its action. Both can show at once, as
     they did when a component showed its own: a dialog's "That didn't go through" and the app's
     reason. The app's failure stays until it's closed, as the old UI's; its success goes by itself
     (toastStore), and a library toast after its own time (ToastLayer). -->
<script lang="ts">
    import { interpolate } from "@i18n/i18n";
    import UndoToast from "@openchat/ui/src/lib/components/UndoToast.svelte";
    import type { ToastLayer } from "@openchat/ui/src/lib/toasts.svelte";
    import { toastStore } from "@src/stores/toast";
    import type { ResourceKey } from "@client";
    import { onDestroy } from "svelte";
    import {
        bottomAnchor,
        bottomAnchorFor,
        boxOf,
        composerPopups,
        watchBoxes,
        windowSize,
    } from "./bottomAnchors.svelte";
    import { toastSpot, type ToastSpot } from "./bottomPlacement";
    import { _ } from "svelte-i18n";

    let { library }: { library: ToastLayer } = $props();

    const toast = $derived($toastStore);
    // the key is a store of its own, which can change while the toast shows
    let resourceKey = $state<ResourceKey | undefined>();
    $effect(() => {
        if (toast === undefined) {
            resourceKey = undefined;
            return;
        }
        return toast.resourceKey.subscribe((key) => (resourceKey = key));
    });

    onDestroy(() => library.dispose());

    // where they show, measured only while one does: again as the middle panel or its composer
    // change size (a composer growing, a right column docking), the composer opens a popup, the
    // window changes size or the shell scrolls in it, and as either comes or goes (a chat opened,
    // the wallet in its place)
    const showing = $derived(
        library.current !== null || (toast !== undefined && resourceKey !== undefined),
    );
    let spot = $state<ToastSpot | undefined>();
    $effect(() => {
        if (!showing) {
            spot = undefined;
            return;
        }
        const middle = bottomAnchor("middle");
        const composer = bottomAnchor("composer");
        const toasts = bottomAnchor("toasts");
        let last: ToastSpot | undefined;
        return watchBoxes([middle, composer, toasts], composer, () => {
            const next = toastSpot(
                windowSize(),
                boxOf(middle),
                boxOf(composer),
                composerPopups(composer),
                boxOf(toasts)?.height,
            );
            if (last?.left !== next.left || last?.width !== next.width || last?.y !== next.y) {
                spot = last = next;
            }
        });
    });
</script>

{#if showing && spot !== undefined}
    <!-- the achievement toast stacks above it while it shows (bottomAnchors) -->
    <div
        class="toasts"
        style:left="{spot.left}px"
        style:width="{spot.width}px"
        style:bottom="calc(100% - {spot.y}px)"
        {@attach bottomAnchorFor("toasts")}>
        {#if library.current !== null}
            {@const shown = library.current}
            <div class="library">
                {#key shown.id}
                    <UndoToast
                        message={shown.message}
                        detail={shown.detail}
                        tone={shown.tone}
                        size={shown.size}
                        icon={shown.icon}
                        actionLabel={shown.actionLabel}
                        onAction={shown.onAction && (() => library.action())}
                        onClose={() => library.close()} />
                {/key}
            </div>
        {/if}
        {#if toast !== undefined && resourceKey !== undefined}
            <div role="status">
                <!-- TODO(design): no failure tone for a toast in the design -->
                <UndoToast
                    message={interpolate($_, resourceKey)}
                    tone={toast.kind === "success" ? "success" : "neutral"}
                    icon={toast.kind === "success" ? "check" : "none"}
                    onClose={() => toastStore.hideToast()} />
            </div>
        {/if}
    </div>
{/if}

<style lang="scss">
    /* placed by its spot (left, width, bottom), in the window's coordinates whatever the direction;
       it moves with the achievement toast above it (the same timing), none with reduced motion */
    .toasts {
        position: fixed;
        transition:
            bottom var(--duration-slow) var(--ease-out),
            left var(--duration-slow) var(--ease-out),
            width var(--duration-slow) var(--ease-out);
        /* over every dialog, sheet and veil, the library's menus and pickers (up to 96) and the
           sign-in dialog (200) included: a toast is never under, or inside, one (design pass 7) */
        z-index: 300;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-8);
        pointer-events: none;
    }

    .toasts > :global(*) {
        pointer-events: auto;
        max-width: calc(100% - 48px);
    }

    /* a library toast is as wide as it was in its component's own layer */
    .library {
        width: min(480px, calc(100% - 48px));
        display: grid;
        grid-template-columns: minmax(0, 1fr);
    }
</style>
