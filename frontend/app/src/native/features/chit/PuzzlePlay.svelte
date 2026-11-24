<!-- A play session on today's puzzle, the body of the native puzzle screen once today's puzzles are
     known (native plan 14, "Daily puzzle"): the app's own boards (core/dailyPuzzle) driven by the
     shared flow (DailyPuzzleGame, logic/dailyPuzzle), as the web's PuzzleSession, laid out as the
     plan's screen: the board centred with the time, hints and streak over it and Reset / Hint at
     the bottom (the library's 52px lg buttons, not the plan's 48px); before Start, the game's demo
     with Start; "How to play" (the header's) shows the demo again. A solve made here plays the "Challenge solved" banner over the board
     first (AchievementToast at speed 1.25, outro 1.8; a tap skips it), then the solved view (the
     160px trophy, the time, the countdown to the next puzzle, the tiles, Share to chat and Done),
     as SolveReveal decides. -->
<script lang="ts">
    import {
        currentUserIdStore,
        formatTimeRemaining,
        type OpenChat,
        type PublicDailyPuzzle,
        type ResourceKey,
    } from "@client";
    import AchievementToast from "@openchat/ui/src/features/components/AchievementToast.svelte";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import GameDemo from "@src/core/dailyPuzzle/GameDemo.svelte";
    import { openDailyPuzzle } from "@src/core/dailyPuzzle/registry";
    import { i18nKey, interpolateNewUi } from "@src/i18n/i18n";
    import { formatSolveTime, gameNameKey, hintButtonKeys } from "@src/logic/dailyPuzzle/dailyPuzzle.svelte";
    import { SolveReveal } from "@src/logic/dailyPuzzle/solveReveal.svelte";
    import { now500 } from "@src/stores/time";
    import { getContext, onDestroy, untrack } from "svelte";
    import { _, locale } from "svelte-i18n";

    type Props = {
        /** The game to play, or the first on today's rota. */
        gameId: string | undefined;
        /** Says a step failed (start, submit, a hint): the screen's toast. */
        onFailure: (message: string) => void;
        /** Told the puzzle it plays, for the header's title, and whether it has a tutorial to toggle. */
        onPuzzle: (puzzle: PublicDailyPuzzle | undefined, howToPlay: (() => void) | undefined) => void;
        /** Share to chat, for a solve that may be shared. */
        onShare: (gameId: string) => void;
        onDone: () => void;
    };

    let { gameId, onFailure, onPuzzle, onShare, onDone }: Props = $props();

    const client = getContext<OpenChat>("client");
    const tr = (key: ResourceKey) => interpolateNewUi($_, key);

    const opened = openDailyPuzzle(
        client,
        // read once: the screen makes a new session for another game
        untrack(() => gameId),
        $currentUserIdStore,
        {
            onFailure: (reason) => onFailure(tr(reason)),
            translate: (key) => $_(key),
            locale: () => $locale ?? "en",
        },
    );
    const { def, game } = opened;
    onDestroy(() => game?.dispose());

    const current = $derived(game?.puzzle ?? opened.puzzle);
    $effect.pre(() => {
        const puzzle = current;
        const toggle = game?.canToggleTutorial ? () => game.toggleTutorial() : undefined;
        untrack(() => onPuzzle(puzzle, toggle));
    });

    // the banner, then the solved view, for a solve made here
    const reveal = new SolveReveal(untrack(() => game?.solved !== undefined));
    $effect(() => reveal.observe(game?.solved !== undefined));

    const hintLabel = $derived(
        game === undefined ? "" : hintButtonKeys(game.hintButton).map(tr).join(" · "),
    );
    const solved = $derived(game?.solved);
    const nextIn = $derived(
        current === undefined
            ? ""
            : formatTimeRemaining($now500, Math.max($now500, Number(current.expiresAt)), true),
    );
</script>

{#if current === undefined}
    <p class="text centre">{$_("dailyPuzzle.unavailable")}</p>
{:else if game === undefined}
    <p class="text centre">{$_("dailyPuzzle.needsNewerApp")}</p>
{:else if reveal.view === "solved" && solved !== undefined}
    <div class="solved">
        <div class="solved-body">
            <span class="trophy" aria-hidden="true"></span>
            <h2 class="solved-title">{$_("dailyPuzzle.solvedTitle")}</h2>
            <span class="time mono">{formatSolveTime(Number(solved.solveTimeMs))}</span>
            <span class="pill">{$_("native.chit.nextPuzzle", { values: { time: nextIn } })}</span>
            <div class="tiles">
                <span class="tile">
                    <span class="tile-value mono">{solved.hintsUsed}</span>
                    <span class="tile-label">{$_("dailyPuzzle.card.hints")}</span>
                </span>
                <span class="tile">
                    <span class="tile-value mono">{solved.streak}</span>
                    <span class="tile-label">{$_("dailyPuzzle.card.dayStreak")}</span>
                </span>
                <span class="tile">
                    <span class="tile-value mono chit">+{solved.reward}</span>
                    <span class="tile-label">CHIT</span>
                </span>
            </div>
        </div>
        <div class="actions">
            {#if game.canShare}
                <Button
                    label={$_("native.chit.shareToChat")}
                    icon="share"
                    size="lg"
                    fullWidth
                    onClick={() => onShare(game.puzzle.gameId)} />
            {/if}
            <Button
                label={$_("native.chit.done")}
                variant="secondary"
                size="lg"
                fullWidth
                onClick={onDone} />
        </div>
    </div>
{:else}
    <div class="play">
        <div class="stats">
            <span class="stat mono">{formatSolveTime(game.elapsed($now500))}</span>
            <span class="stat">{tr(i18nKey("dailyPuzzle.hintsUsed", { count: game.hintsUsed }))}</span>
            <span class="stat">{tr(i18nKey("dailyPuzzle.streakDays", { streak: game.streak }))}</span>
            {#if def?.Settings !== undefined}
                <def.Settings />
            {/if}
        </div>

        <div class="stage">
            <div class="board" class:pending={!game.started && def?.demo === undefined}>
                {#if game.showsDemo && def !== undefined}
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
                        disabled={game.inputDisabled || reveal.view === "banner"}
                        onTap={(key: number) => game?.tap(key)} />
                {/if}
            </div>
            {#if game.showsRules}
                <p class="caption">{tr(game.rulesKey)}</p>
            {:else if game.caption !== undefined}
                <p class="caption" class:mistake={game.mistakes.size > 0}>{tr(game.caption)}</p>
            {:else if game.submitting}
                <p class="caption">{$_("dailyPuzzle.submitting")}</p>
            {/if}
        </div>

        <div class="actions row">
            {#if game.tutorialOpen}
                <Button
                    label={$_("dailyPuzzle.backToPuzzle")}
                    size="lg"
                    fullWidth
                    onClick={() => game.toggleTutorial()} />
            {:else if !game.started}
                <Button
                    label={game.entryFee === 0
                        ? $_("dailyPuzzle.startFree")
                        : tr(i18nKey("dailyPuzzle.startFee", { fee: game.entryFee }))}
                    size="lg"
                    fullWidth
                    busy={game.busy}
                    disabled={!game.canStart}
                    onClick={() => game.start()} />
            {:else if solved === undefined}
                <Button
                    label={$_(game.resetArmed ? "dailyPuzzle.resetConfirm" : "dailyPuzzle.reset")}
                    icon="rotate-back"
                    variant={game.resetArmed ? "danger" : "secondary"}
                    size="lg"
                    disabled={!game.canReset}
                    onClick={() => game.reset()} />
                <Button
                    label={hintLabel}
                    icon="sparkle"
                    variant="secondary"
                    size="lg"
                    busy={game.busy}
                    disabled={game.hintDisabled}
                    onClick={() => game.hint()} />
            {:else}
                <div class="waiting"><Spinner size={20} /></div>
            {/if}
        </div>

        {#if reveal.view === "banner" && solved !== undefined}
            <!-- the "Challenge solved" banner over the board; a tap skips it -->
            <div class="banner">
                <AchievementToast
                    kicker={$_("native.chit.challengeSolved")}
                    title={$_(gameNameKey(game.puzzle.gameId))}
                    reward={solved.reward}
                    icon="trophy"
                    speed={1.25}
                    outroSpeed={1.8}
                    onClick={() => reveal.bannerDone()}
                    onDone={() => reveal.bannerDone()} />
            </div>
        {/if}
    </div>
{/if}

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .text {
        margin: 0;
        padding: 0 var(--space-24);
        text-align: center;
        font: var(--weight-regular) text-size(14.5px) / 1.5 var(--font-sans);
        color: var(--ink-2);
    }

    .centre {
        flex: 1;
        display: grid;
        place-items: center;
    }

    .mono {
        font-family: var(--font-mono);
    }

    .play,
    .solved {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        position: relative;
        /* the demo's muted text, as the old screens' theme names it */
        --txt-light: var(--ink-3);
    }

    .stats {
        flex: none;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: var(--space-16);
        padding: 8px var(--space-16);
        font: var(--weight-medium) text-size(13px) / 1.4 var(--font-sans);
        color: var(--ink-2);
    }

    // the board centred in the space between the stats and the buttons
    .stage {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 14px;
        padding: 0 var(--space-16);
    }

    .board {
        width: min(100%, 380px);
        display: flex;
        justify-content: center;

        &.pending {
            opacity: 0.6;
        }
    }

    .caption {
        margin: 0;
        text-align: center;
        font: var(--weight-regular) text-size(14px) / 1.5 var(--font-sans);
        color: var(--ink-2);

        &.mistake {
            color: var(--status-danger);
        }
    }

    .actions {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 12px var(--space-16) var(--bar-end);

        &.row {
            flex-direction: row;
            justify-content: center;

            > :global(*) {
                flex: 1;
            }
        }
    }

    .waiting {
        height: 52px;
        @include flex-center;
    }

    // the banner plays from the middle of the board
    .banner {
        position: absolute;
        inset-inline: 0;
        top: 45%;
        height: 0;
        display: flex;
        justify-content: center;
    }

    // ---- solved

    .solved-body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 0 var(--space-16);
    }

    .trophy {
        width: 160px;
        height: 160px;
        flex: none;
        border-radius: var(--radius-circle);
        background: radial-gradient(
            circle,
            color-mix(in oklch, var(--status-chit) 28%, transparent) 0%,
            transparent 70%
        );
        position: relative;

        &::after {
            content: "";
            position: absolute;
            inset: 0;
            margin: auto;
            width: 88px;
            height: 88px;
            mask: var(--icon-trophy) center/contain no-repeat;
            background: var(--status-chit);
        }
    }

    .solved-title {
        margin: 0;
        font: 800 text-size(24px) / 1.15 var(--font-sans);
    }

    .time {
        font: 800 text-size(34px) / 1 var(--font-mono);
        letter-spacing: -0.02em;
    }

    .pill {
        padding: 6px 12px;
        border-radius: 14px;
        background: var(--overlay-1);
        font: var(--weight-semibold) text-size(12.5px) / 1 var(--font-sans);
        color: var(--ink-3);
    }

    .tiles {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        width: min(100%, 360px);
        margin-top: 8px;
    }

    .tile {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 14px 8px;
        border-radius: 14px;
        background: var(--overlay-1);
    }

    .tile-value {
        font: 800 text-size(18px) / 1 var(--font-mono);

        &.chit {
            color: var(--status-chit);
        }
    }

    .tile-label {
        font: var(--weight-medium) text-size(11.5px) / 1.2 var(--font-sans);
        color: var(--ink-4);
        text-align: center;
    }
</style>
