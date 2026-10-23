<!-- One of the app's dialogs (dialogs.ts): its screen, loaded the first time it opens and kept (a
     spinner only if that takes a moment: DialogHost loads them ahead, once the app is idle), an
     error with a retry if it doesn't load, or a placeholder for a dialog that isn't built yet. -->
<script lang="ts" generics="D extends AppDialog">
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { untrack, type Component } from "svelte";
    import { _ } from "svelte-i18n";
    import { dialogs, type AppDialog, type DialogProps } from "./dialogs";
    import Placeholder from "./Placeholder.svelte";
    import { regionSummary, screenLoader } from "./screens";

    let { dialog, onClose }: DialogProps<D> = $props();

    // the table is keyed by kind, and the entry for D's kind takes a D
    type Loaded = { default: Component<DialogProps<D>> };
    const load = $derived(dialogs[dialog.kind as D["kind"]] as (() => Promise<Loaded>) | undefined);
    const loader = $derived(load && screenLoader(load));

    $effect(() => {
        const wanted = loader;
        untrack(() => wanted?.want());
    });
</script>

{#if loader?.module}
    <loader.module.default {dialog} {onClose} />
{:else if loader === undefined || loader.failed || loader.slow}
    <!-- development text while there's no dialog: no translation -->
    <DialogShell title={dialog.kind} {onClose}>
        <div class="state">
            {#if !loader}
                <Placeholder title="dialog: {dialog.kind}" detail={regionSummary(dialog)} />
            {:else if loader.failed}
                <!-- a browser keeps a failed import() failed, so the retry reloads the page -->
                <EmptyState
                    preset="error"
                    title={$_("unexpectedError")}
                    body={$_("regionLoadFailed")}
                    actionLabel="ui.common.retry"
                    actionHandler={() => location.reload()} />
            {:else}
                <Spinner />
            {/if}
        </div>
    </DialogShell>
{/if}

<style>
    .state {
        display: grid;
        place-items: center;
        min-height: 200px;
    }
</style>
