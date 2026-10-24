<!-- Today's daily puzzle (?chit=puzzle, ?chit=puzzle:<gameId>, ?chit=howto[:<gameId>]; 8d, #10130),
     in the CHIT dialog's place over the same backdrop. The design's PuzzleDialog plays Bridges
     only, so this is a plain frame around a play session (PuzzleSession). One frame for as long as
     the dialog is open, so its backdrop never plays in again: it waits for today's puzzles to load
     (a reload or a link lands before the first fetch) and only its body changes, a new session for
     another game or view. -->
<script lang="ts">
    import { dailyPuzzleStore, type OpenChat, type ResourceKey } from "@client";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { openablePuzzle } from "@src/core/dailyPuzzle/registry";
    import { interpolate } from "@src/i18n/i18n";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogProps, LinkedDialog } from "../app/dialogs";
    import { backToLinked, openedFrom } from "../app/linkedDialogs";
    import { puzzleTitle } from "./puzzle.adapter";
    import PuzzleSession from "./PuzzleSession.svelte";

    let { dialog, onClose }: DialogProps<Extract<LinkedDialog, { kind: "puzzle" }>> = $props();

    const client = getContext<OpenChat>("client");

    // today's puzzles are known once a fetch has come back: the poll's, or this one's, which also
    // settles for a guest (who has none) and after a failed fetch (none known, so none offered)
    let fetched = $state(false);
    onMount(async () => {
        if ($dailyPuzzleStore.lastFetched !== undefined) return;
        try {
            await client.dailyPuzzleFetch();
        } finally {
            fetched = true;
        }
    });
    const ready = $derived(fetched || $dailyPuzzleStore.lastFetched !== undefined);
    const how = $derived(dialog.how ?? false);

    // the session's puzzle, as the store now holds it (one the poll swapped in included)
    const title = $derived(
        ready
            ? puzzleTitle(openablePuzzle($dailyPuzzleStore, dialog.gameId), (key: ResourceKey) =>
                  interpolate($_, key),
              )
            : "dailyPuzzle.title",
    );

    // back to the CHIT dialog in its place when it opened this one (a frame has no exit of its own
    // to play), else closed
    function close() {
        if (openedFrom({ kind: "chit" })) backToLinked({ kind: "chit" });
        else onClose();
    }
</script>

<!-- TODO(design): the design's PuzzleDialog plays Bridges only; GAPS.md -->
<DialogShell {title} width={560} height="auto" onClose={close}>
    {#if ready}
        {#key `${dialog.gameId ?? ""}|${how}`}
            <PuzzleSession gameId={dialog.gameId} {how} onClose={close} />
        {/key}
    {:else}
        <!-- till today's puzzles are known -->
        <div class="loading"><Spinner /></div>
    {/if}
</DialogShell>

<style>
    .loading {
        display: grid;
        place-items: center;
        min-height: 200px;
    }
</style>
