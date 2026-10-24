<!-- A play session on today's puzzle for PuzzleDialogScreen, once today's puzzles are known: a
     plain frame around the app's own boards (core/dailyPuzzle), driven by the same flow as the
     old puzzle screens (DailyPuzzleGame, logic/dailyPuzzle): the board or its demo, the time, hints
     and streak, the rules or the hint's sentence, and Start / Reset / Hint. Opened on how to play
     (`how`), the tutorial shows once the game is under way (the demo stands in for the board
     before it starts, and a solved puzzle shows its result, never the tutorial). Sharing a result
     waits on the chat picker (4d). -->
<script lang="ts">
    import { currentUserIdStore, type OpenChat, type ResourceKey } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import GameDemo from "@src/core/dailyPuzzle/GameDemo.svelte";
    import { toastingPuzzleHost } from "@src/core/dailyPuzzle/puzzleHost";
    import { openDailyPuzzle } from "@src/core/dailyPuzzle/registry";
    import { interpolate, i18nKey } from "@src/i18n/i18n";
    import {
        formatSolveTime,
        gameNameKey,
        hintButtonKeys,
        tierKey,
    } from "@src/logic/dailyPuzzle/dailyPuzzle.svelte";
    import { now500 } from "@src/stores/time";
    import { getContext, onDestroy, untrack } from "svelte";
    import { _, locale } from "svelte-i18n";

    type Props = {
        // the game to play, or the first on today's rota
        gameId: string | undefined;
        // opened on how to play
        how: boolean;
        onClose: () => void;
    };

    let { gameId, how, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");
    const tr = (key: ResourceKey) => interpolate($_, key);

    // the game the link names, or the first on today's rota; no `game` for a puzzle this build
    // can't draw
    const opened = openDailyPuzzle(
        client,
        // read once: PuzzleDialogScreen makes a new session for another game or view
        untrack(() => gameId),
        $currentUserIdStore,
        toastingPuzzleHost(
            (key) => $_(key),
            () => $locale,
        ),
    );
    const { def, game } = opened;
    if (untrack(() => how) && game?.canToggleTutorial) game.toggleTutorial();
    // the session's puzzle, which the poll may have replaced since this opened
    const puzzle = $derived(game?.puzzle ?? opened.puzzle);
    onDestroy(() => game?.dispose());

    const title = $derived(
        puzzle === undefined
            ? $_("dailyPuzzle.title")
            : [
                  tr(i18nKey("dailyPuzzle.number", { number: puzzle.number })),
                  tr(i18nKey(gameNameKey(puzzle.gameId))),
                  tr(i18nKey(tierKey(puzzle.tier))),
              ].join(" · "),
    );
    const hintLabel = $derived(
        game === undefined ? "" : hintButtonKeys(game.hintButton).map(tr).join(" · "),
    );
</script>

<!-- TODO(design): the design's PuzzleDialog plays Bridges only; GAPS.md -->
<DialogShell {title} width={560} height="auto" {onClose}>
    <div class="puzzle">
        {#if puzzle === undefined}
            <p class="text">{$_("dailyPuzzle.unavailable")}</p>
        {:else if game === undefined}
            <p class="text">{$_("dailyPuzzle.needsNewerApp")}</p>
        {:else}
            <div class="board" class:pending={!game.started && def?.demo === undefined}>
                {#if game.showsDemo && def !== undefined}
                    <!-- before Start the real board is inert and teaches nothing: the game played -->
                    <GameDemo {def} />
                {:else}
                    {#if game.replaced}
                        <p class="caption">{$_("dailyPuzzle.replaced")}</p>
                    {/if}
                    <game.board.Board
                        board={game.board}
                        violations={game.violations}
                        focus={game.focus}
                        target={game.target}
                        greyed={!game.started}
                        disabled={game.inputDisabled}
                        onTap={(key: number) => game?.tap(key)} />
                {/if}
            </div>
            <div class="stats">
                <span class="stat mono">{formatSolveTime(game.elapsed($now500))}</span>
                <span class="stat"
                    >{tr(i18nKey("dailyPuzzle.hintsUsed", { count: game.hintsUsed }))}</span>
                <span class="stat"
                    >{tr(i18nKey("dailyPuzzle.streakDays", { streak: game.streak }))}</span>
                {#if def?.Settings !== undefined}
                    <def.Settings />
                {/if}
            </div>
            {#if game.showsRules}
                <p class="caption">{tr(game.rulesKey)}</p>
            {/if}
            {#if game.solved !== undefined}
                <div class="solved">
                    <p class="solved-title">{$_("dailyPuzzle.solvedTitle")}</p>
                    <p class="text">
                        {tr(
                            i18nKey("dailyPuzzle.solvedSummary", {
                                time: formatSolveTime(Number(game.solved.solveTimeMs)),
                                hints: game.solved.hintsUsed,
                                streak: game.solved.streak,
                            }),
                        )}
                    </p>
                    <p class="reward">
                        {tr(i18nKey("dailyPuzzle.reward", { reward: game.solved.reward }))}
                    </p>
                </div>
            {:else if game.caption !== undefined}
                <p class="caption" class:mistake={game.mistakes.size > 0}>{tr(game.caption)}</p>
            {:else if game.submitting}
                <p class="caption">{$_("dailyPuzzle.submitting")}</p>
            {/if}
        {/if}

        <div class="actions">
            {#if game !== undefined && !game.tutorialOpen}
                {#if game.busy}<Spinner />{/if}
                {#if game.solved !== undefined}
                    <Button label={$_("close")} variant="secondary" onClick={onClose} />
                {:else if !game.started}
                    <Button
                        label={game.entryFee === 0
                            ? $_("dailyPuzzle.startFree")
                            : tr(i18nKey("dailyPuzzle.startFee", { fee: game.entryFee }))}
                        disabled={!game.canStart}
                        onClick={() => game?.start()} />
                {:else}
                    <Button
                        label={$_(
                            game.resetArmed ? "dailyPuzzle.resetConfirm" : "dailyPuzzle.reset",
                        )}
                        variant={game.resetArmed ? "danger" : "secondary"}
                        disabled={!game.canReset}
                        onClick={() => game?.reset()} />
                    <Button
                        label={hintLabel}
                        variant="secondary"
                        disabled={game.hintDisabled}
                        onClick={() => game?.hint()} />
                {/if}
            {:else}
                <Button label={$_("close")} variant="secondary" onClick={onClose} />
            {/if}
        </div>
        {#if game?.canToggleTutorial}
            <div class="how">
                <Button
                    label={$_(
                        game.tutorialOpen ? "dailyPuzzle.backToPuzzle" : "dailyPuzzle.howToPlay",
                    )}
                    variant="ghost"
                    onClick={() => game?.toggleTutorial()} />
            </div>
        {/if}
    </div>
</DialogShell>

<style>
    .puzzle {
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
        /* the demo's muted text, as the old screens' theme names it */
        --txt-light: var(--ink-3);
    }

    /* a board as big as a phone's, however wide the dialog */
    .board {
        align-self: center;
        width: min(100%, 380px);
        display: flex;
        justify-content: center;
    }

    .board.pending {
        opacity: 0.6;
    }

    .stats {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: var(--space-16);
        font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
        color: var(--ink-2);
    }

    .mono {
        font-family: var(--font-mono);
    }

    .text,
    .caption,
    .solved-title,
    .reward {
        margin: 0;
        text-align: center;
        font: var(--weight-regular) var(--text-base) / 1.5 var(--font-sans);
        color: var(--ink-2);
    }

    .caption.mistake {
        color: var(--status-danger);
    }

    .solved-title {
        font-weight: var(--weight-semibold);
        color: var(--ink);
    }

    .reward {
        color: var(--status-chit);
    }

    .actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: var(--space-10);
    }

    .how {
        align-self: center;
    }
</style>
