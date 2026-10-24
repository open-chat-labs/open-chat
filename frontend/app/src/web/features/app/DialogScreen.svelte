<!-- One of the app's dialogs (dialogs.ts): its screen, loaded the first time it opens and kept (a
     spinner only if that takes a moment: DialogHost loads them ahead, once the app is idle), an
     error with a retry if it doesn't load, or a placeholder for a dialog that isn't built yet. One
     another has handed off to (Diamond from the profile) keeps the backdrop that one showed: only
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
        dialogs: stack,
        claimInPlace,
    }: DialogProps<D> & {
        // whether another dialog, its backdrop still showing, handed off to this one (once)
        claimInPlace?: () => boolean;
    } = $props();

    // the table is keyed by kind, and the entry for D's kind takes a D
    type Loaded = { default: Component<DialogProps<D>> };
    const load = $derived(dialogs[dialog.kind as D["kind"]] as (() => Promise<Loaded>) | undefined);
    const loader = $derived(load && screenLoader(load));

    // as it opens: the backdrop's fade only ever plays (or doesn't) then. Only when the dialog
    // shows at once (loaded ahead, or a placeholder): a backdrop kept over a blank, still loading
    // screen would vanish, without a fade, if that's closed
    const keepBackdrop = untrack(() => {
        const handedOff = claimInPlace?.() ?? false;
        return handedOff && (loader === undefined || loader.module !== undefined);
    });

    $effect(() => {
        const wanted = loader;
        untrack(() => wanted?.want());
    });
</script>

<div class="screen" class:keep-backdrop={keepBackdrop}>
    {#if loader !== undefined && loader.module === undefined && !loader.failed && !loader.slow}
        <!-- loading, for a moment: nothing shows yet, but a click outside or Esc still closes it -->
        <div class="pending" onclick={onClose} use:modal={onClose} aria-hidden="true"></div>
    {:else if loader?.module}
        <loader.module.default {dialog} {onClose} dialogs={stack} />
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

    /* a frame's lighter scrim (DialogShell) taking over the dialogs' backdrop wears the dialogs' veil,
       so the backdrop doesn't change as it does */
    .keep-backdrop > :global(:first-child > .scrim) {
        background: var(--oc-veil, rgba(3, 3, 6, 0.72));
        backdrop-filter: var(--oc-veil-blur, blur(4px));
        -webkit-backdrop-filter: var(--oc-veil-blur, blur(4px));
    }

    .pending {
        position: fixed;
        inset: 0;
    }

    .state {
        display: grid;
        place-items: center;
        min-height: 200px;
    }
</style>
