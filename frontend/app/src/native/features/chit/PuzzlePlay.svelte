<!-- A play session on today's puzzle, the body of the native puzzle screen once today's puzzles are
     known (native plan 14, "Daily puzzle"): the app's own boards (core/dailyPuzzle) driven by the
     shared flow (DailyPuzzleGame, logic/dailyPuzzle), as the web's PuzzleSession, laid out as the
     prototype's screen (PuzzleDialog layout="screen"), the same frame for every game: the time,
     hints and streak as three chips, the board on its card centred under them, and Reset over
     "Use a hint" (its price and what's left beside it) pinned to the bottom; before Start, the
     game's demo with Start; "How to play" (the header's) shows the demo again. A solve made here
     plays the "Challenge solved" banner just above the bottom buttons first (AchievementToast at
     speed 1.25, outro 1.8; a tap skips it), then the solved view (the 160px trophy tile, "Solved
     in 3:44" over the puzzle's number, the countdown to the next puzzle, the tiles, Share to chat
     and Done side by side), as SolveReveal decides. -->
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
    import {
        formatSolveTime,
        gameNameKey,
        hintButtonParts,
    } from "@src/logic/dailyPuzzle/dailyPuzzle.svelte";
    import { SolveReveal } from "@src/logic/dailyPuzzle/solveReveal.svelte";
    import { now500 } from "@src/stores/time";
    import { getContext, onDestroy, untrack } from "svelte";
    import { _, locale } from "svelte-i18n";

    type Props = {
        /** The game to play, or the first on today's rota. */
        gameId: string | undefined;
        /** Says a step failed (start, submit, a hint): the screen's toast. */
        onFailure: (message: string) => void;
        /** Told the puzzle it plays, for the header's title, whether it has a tutorial to toggle,
         *  and whether the tutorial (or the demo before Start) shows. */
        onPuzzle: (
            puzzle: PublicDailyPuzzle | undefined,
            howToPlay: (() => void) | undefined,
            tutorial: boolean,
        ) => void;
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
        const tutorial = game !== undefined && (game.tutorialOpen || game.showsDemo);
        untrack(() => onPuzzle(puzzle, toggle, tutorial));
    });

    // the banner, then the solved view, for a solve made here
    const reveal = new SolveReveal(untrack(() => game?.solved !== undefined));
    $effect(() => reveal.observe(game?.solved !== undefined));

    const hint = $derived(game === undefined ? undefined : hintButtonParts(game.hintButton));
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
            <span class="trophy" aria-hidden="true"><span class="trophy-icon"></span></span>
            <span class="solved-head">
                <h2 class="solved-title">
                    {$_("native.chit.solvedIn", {
                        values: { time: formatSolveTime(Number(solved.solveTimeMs)) },
                    })}
                </h2>
                <span class="solved-sub">
                    {tr(i18nKey("dailyPuzzle.number", { number: game.puzzle.number }))}
                </span>
            </span>
            <span class="pill">
                <span class="pill-icon"></span>
                {$_("native.chit.nextPuzzle", { values: { time: nextIn } })}
            </span>
            <div class="tiles">
                <span class="tile">
                    <span class="tile-value">{solved.hintsUsed}</span>
                    <span class="tile-label">{$_("dailyPuzzle.card.hints")}</span>
                </span>
                <span class="tile">
                    <span class="tile-value streak">{solved.streak}</span>
                    <span class="tile-label">{$_("dailyPuzzle.card.dayStreak")}</span>
                </span>
                <span class="tile">
                    <span class="tile-value">+{solved.reward}</span>
                    <span class="tile-label">CHIT</span>
                </span>
            </div>
        </div>
        <div class="actions row">
            {#if game.canShare}
                <Button
                    label={$_("native.chit.shareToChat")}
                    icon="share"
                    variant="secondary"
                    size="lg"
                    fullWidth
                    onClick={() => onShare(game.puzzle.gameId)} />
            {/if}
            <Button label={$_("native.chit.done")} size="lg" fullWidth onClick={onDone} />
        </div>
    </div>
{:else}
    <div class="play">
        <div class="stats">
            <span class="chip">
                <span class="chip-icon timer"></span>
                <span class="mono">{formatSolveTime(game.elapsed($now500))}</span>
            </span>
            <span class="chip">
                <span class="chip-icon spark"></span>
                {tr(i18nKey("dailyPuzzle.hintsUsed", { count: game.hintsUsed }))}
            </span>
            <span class="chip streak">
                <span class="chip-icon flame"></span>
                {$_("native.you.chit.streak", { values: { count: game.streak } })}
            </span>
        </div>
        {#if def?.Settings !== undefined}
            <div class="settings"><def.Settings /></div>
        {/if}

        <div class="stage">
            {#if game.showsDemo && def !== undefined}
                <div class="demo"><GameDemo {def} /></div>
            {:else}
                {#if game.replaced}
                    <p class="caption">{$_("dailyPuzzle.replaced")}</p>
                {/if}
                <!-- every game's board on the same card -->
                <div class="board" class:pending={!game.started && def?.demo === undefined}>
                    <game.board.Board
                        board={game.board}
                        violations={game.violations}
                        focus={game.focus}
                        target={game.target}
                        greyed={!game.started}
                        disabled={game.inputDisabled || reveal.view === "banner"}
                        onTap={(key: number) => game?.tap(key)} />
                </div>
            {/if}
            {#if game.showsRules}
                <p class="caption">{tr(game.rulesKey)}</p>
            {:else if game.caption !== undefined}
                <p class="caption" class:mistake={game.mistakes.size > 0}>{tr(game.caption)}</p>
            {:else if game.submitting}
                <p class="caption">{$_("dailyPuzzle.submitting")}</p>
            {/if}
        </div>

        <div class="actions">
            {#if reveal.view === "banner" && solved !== undefined}
                <!-- the "Challenge solved" banner, just above the bottom buttons; a tap skips it -->
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
                    fullWidth
                    disabled={!game.canReset}
                    onClick={() => game.reset()} />
                <!-- the hint, CHIT's: tinted in its colour, the price and what's left in mono -->
                <button
                    type="button"
                    class="hint"
                    disabled={game.hintDisabled || game.busy}
                    aria-busy={game.busy}
                    onclick={() => game.hint()}>
                    {#if game.busy}
                        <Spinner size={15} />
                    {:else}
                        <span class="hint-icon"></span>
                    {/if}
                    {#if hint !== undefined}
                        <span class="hint-label">{tr(hint.label)}</span>
                        {#if hint.meta.length > 0}
                            <span class="hint-meta">{hint.meta.map(tr).join(" · ")}</span>
                        {/if}
                    {/if}
                </button>
            {:else}
                <div class="waiting"><Spinner size={20} /></div>
            {/if}
        </div>
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
        /* the demo's muted text, as the old screens' theme names it */
        --txt-light: var(--ink-3);
    }

    // ---- the time, hints and streak: three chips across the top

    .stats {
        flex: none;
        display: flex;
        gap: 8px;
        padding: 8px var(--space-16) 0;
    }

    .chip {
        flex: 1;
        min-width: 0;
        height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        border-radius: 12px;
        background: var(--surface-2);
        font: var(--weight-semibold) text-size(13px) / 1 var(--font-sans);
        color: var(--ink);
        white-space: nowrap;

        &.streak {
            color: var(--status-chit);
        }
    }

    .chip-icon {
        &.timer {
            @include icon(timer, 14px);
        }

        &.spark {
            @include icon(spark, 14px);
        }

        &.flame {
            @include icon(flame, 14px);
        }
    }

    // a game's own display options (Unruly's colours), under the chips
    .settings {
        flex: none;
        display: flex;
        justify-content: center;
        padding: 8px var(--space-16) 0;
    }

    // the board on its card, centred in the space between the chips and the buttons
    .stage {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 10px var(--space-16);
    }

    .board {
        box-sizing: border-box;
        width: min(100%, 420px);
        display: flex;
        justify-content: center;
        padding: 10px;
        border-radius: 18px;
        background: var(--surface-2);
        box-shadow: inset 0 0 0 1px var(--line-1);

        &.pending {
            opacity: 0.6;
        }
    }

    .demo {
        width: min(100%, 420px);
    }

    .caption {
        margin: 0;
        padding: 0 4px;
        text-align: center;
        font: var(--weight-regular) text-size(13px) / 1.5 var(--font-sans);
        color: var(--ink-2);
        text-wrap: pretty;

        &.mistake {
            color: var(--status-danger);
        }
    }

    // ---- pinned to the bottom

    .actions {
        flex: none;
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px var(--space-16) var(--bar-end);

        &.row {
            flex-direction: row;

            > :global(*) {
                flex: 1;
            }
        }
    }

    // the banner's zero-height anchor, just clear of the buttons (it grows up from its bottom)
    .banner {
        position: absolute;
        inset-inline: 0;
        bottom: calc(100% + 4px);
        height: 0;
    }

    .hint {
        height: 52px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 0 var(--space-16);
        border: 0;
        border-radius: 14px;
        background: color-mix(in oklch, var(--status-chit) 16%, var(--surface-2));
        box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--status-chit) 35%, transparent);
        color: var(--ink);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:disabled {
            opacity: 0.45;
            cursor: default;
        }

        &[aria-busy="true"] {
            opacity: 1;
            cursor: progress;
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .hint-icon {
        @include icon(spark, 15px, var(--status-chit));
    }

    .hint-label {
        font: var(--weight-semibold) text-size(14px) / 1 var(--font-sans);
        @include truncate;
    }

    .hint-meta {
        flex: none;
        font: var(--weight-medium) text-size(12px) / 1 var(--font-mono);
        color: var(--ink-2);
    }

    .waiting {
        height: 52px;
        @include flex-center;
    }

    // ---- solved

    .solved-body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 22px;
        padding: 0 var(--space-16);
        text-align: center;
    }

    .trophy {
        flex: none;
        width: 160px;
        height: 160px;
        @include flex-center;
        border-radius: 48px;
        background: var(--accent-soft);
        animation: trophy-pop 420ms var(--ease-out) both;

        @media (prefers-reduced-motion: reduce) {
            animation: none;
        }
    }

    .trophy-icon {
        @include icon(trophy, 76px, var(--accent-bright));
    }

    @keyframes trophy-pop {
        0% {
            transform: scale(0.6);
            opacity: 0;
        }
        60% {
            transform: scale(1.08);
            opacity: 1;
        }
        100% {
            transform: scale(1);
        }
    }

    .solved-head {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .solved-title {
        margin: 0;
        font: 800 text-size(26px) / 1.1 var(--font-sans);
        letter-spacing: -0.01em;
    }

    .solved-sub {
        font: var(--weight-medium) text-size(13.5px) / 1 var(--font-sans);
        color: var(--ink-3);
    }

    .pill {
        display: flex;
        align-items: center;
        gap: 7px;
        height: 32px;
        padding: 0 13px;
        border-radius: 16px;
        background: var(--overlay-1);
        font: var(--weight-medium) text-size(13px) / 1 var(--font-sans);
        color: var(--ink-2);
    }

    .pill-icon {
        @include icon(clock, 14px);
    }

    .tiles {
        align-self: stretch;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
    }

    .tile {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 7px;
        padding: 14px 8px;
        border-radius: 14px;
        background: var(--overlay-1);
    }

    .tile-value {
        font: var(--weight-bold) text-size(18px) / 1 var(--font-mono);

        &.streak {
            color: var(--status-chit);
        }
    }

    .tile-label {
        font: var(--weight-medium) text-size(12px) / 1.2 var(--font-sans);
        color: var(--ink-3);
        text-align: center;
    }
</style>
