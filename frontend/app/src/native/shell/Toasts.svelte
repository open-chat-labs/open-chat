<!-- The native toast, the kit's: the app's (toastStore: showFailureToast, showSuccessToast) and the
     screens' own (`queue`, ScreenContext.toast, which can offer Undo), above the tab bar on a tab's
     root, above a conversation's composer, above the safe area on another pushed screen. One at a time: whichever came last takes the
     other's place. The app's failure stays until it's closed, as in the other trees, and its success
     goes by itself (toastStore); a screen's goes by itself (ToastQueue: 2.6s, 5s with Undo). -->
<script lang="ts">
    import { interpolate } from "@i18n/i18n";
    import NativeToasts from "@openchat/ui/src/native/Toasts.svelte";
    import type { NativeToast, ToastQueue } from "@openchat/ui/src/native/toastQueue.svelte";
    import { toastStore } from "@src/stores/toast";
    import type { ResourceKey, Toast } from "@client";
    import { untrack } from "svelte";
    import { _ } from "svelte-i18n";

    let { above, queue }: { above: "tabBar" | "footer" | "none"; queue: ToastQueue } = $props();

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

    // an app toast takes the place of a screen's (a screen's hides the app's: ScreenContext.toast)
    $effect(() => {
        if (toast !== undefined) untrack(() => queue.dismiss());
    });

    // a new id for each app toast shown, so a replacement plays in again; negative, so it's never
    // a screen toast's
    let shownId = 0;
    let shownFor: Toast | undefined;
    const fromApp = $derived.by<NativeToast | null>(() => {
        if (toast === undefined || resourceKey === undefined) return null;
        if (toast !== shownFor) {
            shownFor = toast;
            shownId--;
        }
        return {
            id: shownId,
            message: interpolate($_, resourceKey),
            undoable: false,
            pending: false,
        };
    });

    const shown = $derived(queue.current ?? fromApp);

    function dismiss() {
        if (queue.current !== null) queue.dismiss();
        else toastStore.hideToast();
    }
</script>

<NativeToasts toast={shown} {above} onUndo={() => queue.undo()} onDismiss={dismiss} />
