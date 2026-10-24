<!-- Today's daily puzzle (?chit=puzzle, ?chit=puzzle:<gameId>, ?chit=howto[:<gameId>]; 8d, #10130),
     in the CHIT dialog's place over the same backdrop. The design's PuzzleDialog plays Bridges
     only, so this is a plain frame (PuzzleSession). It waits for today's puzzles to load (a reload
     or a link lands before the first fetch), and starts a new session for another game or view
     of it, since the dialog stays open across them. -->
<script lang="ts">
    import { dailyPuzzleStore } from "@client";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import type { DialogProps, LinkedDialog } from "../app/dialogs";
    import { backToLinked, openedFrom } from "../app/linkedDialogs";
    import PuzzleSession from "./PuzzleSession.svelte";

    let { dialog, onClose }: DialogProps<Extract<LinkedDialog, { kind: "puzzle" }>> = $props();

    const loaded = $derived($dailyPuzzleStore.lastFetched !== undefined);
    const how = $derived(dialog.how ?? false);

    // back to the CHIT dialog in its place when it opened this one (a frame has no exit of its own
    // to play), else closed
    function close() {
        if (openedFrom({ kind: "chit" })) backToLinked({ kind: "chit" });
        else onClose();
    }
</script>

{#if loaded}
    {#key `${dialog.gameId ?? ""}|${how}`}
        <PuzzleSession gameId={dialog.gameId} {how} onClose={close} />
    {/key}
{:else}
    <!-- till the first fetch of today's puzzles -->
    <DialogShell title="dailyPuzzle.title" width={560} height="auto" onClose={close}>
        <div class="loading"><Spinner /></div>
    </DialogShell>
{/if}

<style>
    .loading {
        display: grid;
        place-items: center;
        min-height: 200px;
    }
</style>
