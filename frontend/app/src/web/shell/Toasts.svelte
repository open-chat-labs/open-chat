<!-- The app's toast layer, centred at the bottom of the window, over every dialog, sheet and veil:
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
    import { bottomAnchorFor } from "./bottomAnchors.svelte";
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
</script>

{#if library.current !== null || (toast !== undefined && resourceKey !== undefined)}
    <!-- the achievement toast stacks above it while it shows (bottomAnchors) -->
    <div class="toasts" {@attach bottomAnchorFor("toasts")}>
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
    .toasts {
        position: fixed;
        inset-block-end: calc(var(--space-24) + var(--safe-bottom));
        inset-inline: 0;
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
