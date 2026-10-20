<!-- The app's toast (toastStore: showFailureToast, showSuccessToast), centred at the bottom of the
     window, as the library's UndoToast without its action. A failure stays until it's closed, as
     the old UI's; a success goes by itself (toastStore). -->
<script lang="ts">
    import { interpolate } from "@i18n/i18n";
    import UndoToast from "@openchat/ui/src/lib/components/UndoToast.svelte";
    import { toastStore } from "@src/stores/toast";
    import type { ResourceKey } from "@client";
    import { _ } from "svelte-i18n";

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
</script>

{#if toast !== undefined && resourceKey !== undefined}
    <div class="toast" role="status">
        <!-- TODO(design): no failure tone for a toast in the design -->
        <UndoToast
            message={interpolate($_, resourceKey)}
            tone={toast.kind === "success" ? "success" : "neutral"}
            icon={toast.kind === "success" ? "check" : "none"}
            onClose={() => toastStore.hideToast()} />
    </div>
{/if}

<style>
    .toast {
        position: fixed;
        inset-block-end: var(--space-24);
        inset-inline: 0;
        /* over dialogs, as the old toast was */
        z-index: calc(var(--z-modal) + 10);
        display: flex;
        justify-content: center;
        pointer-events: none;
    }

    .toast > :global(*) {
        pointer-events: auto;
    }
</style>
