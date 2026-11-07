<!-- You → Storage (native design notes §3.11): what the user has stored on the backend against
     their allowance (Diamond's), what this phone keeps (the browser's estimate for the app), and
     Clear cached data with Undo (notes §1: destructive actions show Undo). Clearing restarts the
     app (utils/clearCache, every tree's), so it waits out the Undo toast before it starts. -->
<script lang="ts">
    import { formatFileSize, storageStore, type OpenChat } from "@client";
    import SettingsAction from "@openchat/ui/src/native/SettingsAction.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import SettingsMeter from "@openchat/ui/src/native/SettingsMeter.svelte";
    import { UNDO_TOAST_MS } from "@openchat/ui/src/native/toastQueue.svelte";
    import { clearCacheAndRestart } from "@src/utils/clearCache";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import type { ScreenContext } from "../../app/screens";
    import { storageFraction } from "../you.adapter";

    let { context }: { context: ScreenContext } = $props();

    const client = getContext<OpenChat>("client");

    const used = $derived(formatFileSize($storageStore.bytesUsed));
    const limit = $derived(formatFileSize($storageStore.byteLimit));

    // this phone's: the browser's estimate of what the app keeps (its caches, IndexedDB …)
    let local = $state<{ usage: number; quota: number }>();
    onMount(async () => {
        try {
            const estimate = await navigator.storage?.estimate();
            if (estimate?.usage !== undefined) {
                local = { usage: estimate.usage, quota: estimate.quota ?? 0 };
            }
        } catch (err) {
            console.warn("Unable to estimate the storage used", err);
        }
    });

    // the clear waiting out its Undo; it carries on if the page goes meanwhile
    let pending: ReturnType<typeof setTimeout> | undefined = $state();

    function clearCache() {
        if (pending !== undefined) return;
        pending = setTimeout(() => void clearCacheAndRestart(client), UNDO_TOAST_MS);
        context.toast($_("native.you.storage.clearing"), () => {
            clearTimeout(pending);
            pending = undefined;
        });
    }
</script>

<SettingsGroup
    label={$_("native.you.storage.remote")}
    note={$storageStore.byteLimit > 0 ? "" : $_("native.you.storage.noAllowance")}>
    <SettingsMeter
        label={$_("native.you.storage.used")}
        value={$storageStore.byteLimit > 0
            ? $_("native.you.storage.ofLimit", { values: { used, limit } })
            : used}
        fraction={storageFraction($storageStore.bytesUsed, $storageStore.byteLimit)}
        help={$_("native.you.storage.remoteHelp")} />
</SettingsGroup>

<SettingsGroup label={$_("native.you.storage.onThisPhone")} note={$_("native.you.storage.cacheNote")}>
    {#if local !== undefined}
        <SettingsMeter
            label={$_("native.you.storage.cache")}
            value={formatFileSize(local.usage)}
            fraction={storageFraction(local.usage, local.quota)} />
    {/if}
    <SettingsAction
        icon="trash"
        label={$_("clearDataCache")}
        danger
        onClick={clearCache} />
</SettingsGroup>
