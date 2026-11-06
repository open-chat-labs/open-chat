<!-- The app's toast (toastStore: showFailureToast, showSuccessToast) as the native kit's: above the tab
     bar on a tab's root, above the safe area on a pushed screen. A failure stays until it's closed, as
     in the other trees; a success goes by itself (toastStore). Undo is for the screens' own toasts. -->
<script lang="ts">
    import { interpolate } from "@i18n/i18n";
    import NativeToasts from "@openchat/ui/src/native/Toasts.svelte";
    import type { NativeToast } from "@openchat/ui/src/native/toastQueue.svelte";
    import { toastStore } from "@src/stores/toast";
    import type { ResourceKey, Toast } from "@client";
    import { _ } from "svelte-i18n";

    let { above }: { above: "tabBar" | "none" } = $props();

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

    // a new id for each toast shown, so a replacement plays in again
    let shownId = 0;
    let shownFor: Toast | undefined;
    const shown = $derived.by<NativeToast | null>(() => {
        if (toast === undefined || resourceKey === undefined) return null;
        if (toast !== shownFor) {
            shownFor = toast;
            shownId++;
        }
        return { id: shownId, message: interpolate($_, resourceKey), undoable: false };
    });
</script>

<NativeToasts toast={shown} {above} onUndo={() => {}} onDismiss={() => toastStore.hideToast()} />
