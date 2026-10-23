<!-- One of the app's dialogs (dialogs.ts): its screen, loaded the first time it opens and kept (a
     spinner only if that takes a moment: DialogHost loads them ahead, once the app is idle), an
     error with a retry if it doesn't load, or a placeholder for a dialog that isn't built yet. One
     opened in place of another (Diamond from the profile) keeps the backdrop that one showed: only
     the dialog animates in. -->
<script lang="ts" generics="D extends AppDialog">
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { modal } from "@openchat/ui/src/lib/behaviours/modal";
    import { untrack, type Component } from "svelte";
    import { _ } from "svelte-i18n";
    import { dialogs, type AppDialog, type DialogProps } from "./dialogs";
    import Placeholder from "./Placeholder.svelte";
    import { regionSummary, screenLoader } from "./screens";

    let {
        dialog,
        onClose,
        inPlace = false,
    }: DialogProps<D> & {
        // opened in place of another dialog, whose backdrop is showing
        inPlace?: boolean;
    } = $props();

    // as it opened: the backdrop's fade only ever plays (or doesn't) then
    const keepBackdrop = untrack(() => inPlace);

    // the table is keyed by kind, and the entry for D's kind takes a D
    type Loaded = { default: Component<DialogProps<D>> };
    const load = $derived(dialogs[dialog.kind as D["kind"]] as (() => Promise<Loaded>) | undefined);
    const loader = $derived(load && screenLoader(load));

    $effect(() => {
        const wanted = loader;
        untrack(() => wanted?.want());
    });
</script>

<div class="screen" class:keep-backdrop={keepBackdrop}>
    {#if loader !== undefined && loader.module === undefined && !loader.failed && !loader.slow}
        <!-- loading, for a moment: nothing shows yet (but the backdrop, in place of another dialog),
         but a click outside or Esc still closes it -->
        <div
            class="pending"
            class:oc-veil={keepBackdrop}
            onclick={onClose}
            use:modal={onClose}
            aria-hidden="true">
        </div>
    {:else if loader?.module}
        <loader.module.default {dialog} {onClose} />
    {:else}
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
</div>

<style>
    .screen {
        display: contents;
    }

    /* the backdrop is already showing: it stays as it is, and fades when this dialog closes. Only
       the screen's own dialog (its first element), not one it opens over itself later */
    .keep-backdrop > :global(:first-child:not(.closing) > :is(.oc-veil, .scrim):not(.closing)) {
        animation: none;
    }

    .pending {
        position: fixed;
        inset: 0;
        animation: none;
    }

    .state {
        display: grid;
        place-items: center;
        min-height: 200px;
    }
</style>
