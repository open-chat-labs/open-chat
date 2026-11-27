<!-- A play session on today's puzzle, the body of the native puzzle screen once today's puzzles are
     known (native plan 14, "Daily puzzle"): the app's own boards (core/dailyPuzzle) driven by the
     shared flow (DailyPuzzleGame, logic/dailyPuzzle), as the web's PuzzleSession, laid out as the
     prototype's screen (PuzzleDialog layout="screen"), the same frame for every game: the time,
     hints and streak as three chips, the board on its card centred under them, and Reset over
     "Use a hint" (its price and what's left beside it) pinned to the bottom. Before Start, and
     while "How to play" (the header's) is open, the game's demo as the prototype's tutorial: its
     board on the same card, the step's text under it, and Back, the step dots and Next along the
     bottom, the last step's Next being Start (with its fee) or Back to puzzle; the header says
     which step and offers Skip (DemoSteps steps it, as the web's GameDemo). A solve made here
     plays the "Challenge solved" banner just above the bottom buttons first (AchievementToast at
     speed 1.25, outro 1.8; a tap skips it), then the solved view (the 160px trophy tile, "Solved
     in 3:44" over the puzzle's number, the countdown to the next puzzle, the tiles, Share to chat
     and Done side by side), as SolveReveal decides. -->
<script lang="ts" module>
    import type { PublicDailyPuzzle } from "@client";

    /** What the screen's header shows for the session: the puzzle, "How to play" when it's
     *  offered, whether the demo shows (and which of its steps), and its text button (Skip, or
     *  Back to puzzle over a game under way). */
    export type PuzzleSessionInfo = {
        puzzle: PublicDailyPuzzle | undefined;
        howToPlay: (() => void) | undefined;
        tutorial: boolean;
        step: { index: number; count: number } | undefined;
        leaveDemo: { label: string; run: () => void } | undefined;
    };
</script>

<script lang="ts">
    import {
        currentUserIdStore,
        formatTimeRemaining,
        type OpenChat,
        type ResourceKey,
    } from "@client";
    import AchievementToast from "@openchat/ui/src/features/components/AchievementToast.svelte";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { DemoSteps } from "@src/core/dailyPuzzle/demoSteps.svelte";
    import { tutorialSwipeAxis, tutorialSwipeStep } from "./tutorialSwipe";
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
        /** Told what the header shows for the session, as it changes. */
        onPuzzle: (info: PuzzleSessionInfo) => void;
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

    // the demo's steps, the same for each showing, back to the first as it's shown again
    const steps = def?.demo === undefined ? undefined : new DemoSteps(def);

    function howToPlay(): void {
        steps?.restart();
        game?.showHowToPlay();
    }

    const current = $derived(game?.puzzle ?? opened.puzzle);
    const demo = $derived(game?.showsDemo === true && steps !== undefined);

    // a sideways swipe on the tutorial steps it on or back (tutorialSwipe.ts); touch and pen only
    let swipe: { id: number; x0: number; y0: number; x: number; t: number; v: number } | undefined;
    // a swipe ends in a click on the board, which would step it again
    let swiped = false;

    function swipeStart(e: PointerEvent) {
        if (e.pointerType === "mouse" || !e.isPrimary) return;
        swipe = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, t: e.timeStamp, v: 0 };
        swiped = false;
    }

    function swipeMove(e: PointerEvent) {
        if (swipe === undefined || e.pointerId !== swipe.id) return;
        const dt = e.timeStamp - swipe.t;
        if (dt > 0) swipe.v = (e.clientX - swipe.x) / dt;
        swipe.x = e.clientX;
        swipe.t = e.timeStamp;
        if (tutorialSwipeAxis(e.clientX - swipe.x0, e.clientY - swipe.y0) !== "undecided") swiped = true;
    }

    function swipeEnd(e: PointerEvent) {
        if (swipe === undefined || e.pointerId !== swipe.id || steps === undefined) return;
        const drag = {
            dx: e.clientX - swipe.x0,
            dy: e.clientY - swipe.y0,
            width: (e.currentTarget as HTMLElement).getBoundingClientRect().width,
            velocity: swipe.v,
        };
        swipe = undefined;
        const to = tutorialSwipeStep(drag, steps.index, steps.count, document.documentElement.dir === "rtl");
        if (to === undefined) return;
        if (to > steps.index) steps.next();
        else steps.prev();
    }

    function tapBoard() {
        if (swiped) {
            swiped = false;
            return;
        }
        steps?.tapBoard();
    }
    $effect.pre(() => {
        const info: PuzzleSessionInfo = {
            puzzle: current,
            howToPlay: game?.offersHowToPlay ? howToPlay : undefined,
            tutorial: demo,
            step:
                demo && steps !== undefined
                    ? { index: steps.index, count: steps.count }
                    : undefined,
            leaveDemo: game?.canSkipDemo
                ? { label: $_("skip"), run: () => game.skipDemo() }
                : game?.tutorialOpen
                  ? { label: $_("dailyPuzzle.backToPuzzle"), run: () => game.toggleTutorial() }
                  : undefined,
        };
        untrack(() => onPuzzle(info));
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
{:else if demo && steps !== undefined && steps.board !== undefined && steps.frame !== undefined}
    {@const demoBoard = steps.board}
    <div class="play">
        <div class="stage">
            <div
                class="demo"
                onpointerdown={swipeStart}
                onpointermove={swipeMove}
                onpointerup={swipeEnd}
                onpointercancel={() => (swipe = undefined)}>
                <!-- the arrows below step through it; a tap on the board, or a swipe, is a shortcut -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="board" onclick={tapBoard}>
                    <demoBoard.Board
                        board={demoBoard}
                        violations={steps.violations}
                        focus={steps.pointed}
                        target={steps.pointed}
                        disabled
                        onTap={() => {}} />
                </div>
                <!-- the step's title over its text, read out together as the step changes -->
                <div class="step-copy" aria-live="polite" aria-atomic="true">
                    <h3 class="step-title">
                        {tr(i18nKey(`${def?.i18nPrefix}.${steps.frame.title}`))}
                    </h3>
                    <p class="step-text">
                        {tr(i18nKey(`${def?.i18nPrefix}.${steps.frame.caption}`))}
                    </p>
                </div>
            </div>
        </div>
        <div class="step-bar">
            <span class="step-side">
                {#if !steps.isFirst}
                    <button type="button" class="step-back" onclick={() => steps.prev()}>
                        <span class="step-chevron back"></span>{$_("back")}
                    </button>
                {/if}
            </span>
            <span class="step-dots" aria-hidden="true">
                {#each { length: steps.count } as _dot, i (i)}
                    <span
                        class="step-dot"
                        class:done={i <= steps.index}
                        class:on={i === steps.index}></span>
                {/each}
            </span>
            <span class="step-side end">
                {#if !steps.isLast}
                    <button type="button" class="step-next" onclick={() => steps.next()}>
                        {$_("next")}<span class="step-chevron"></span>
                    </button>
                {:else if game.tutorialOpen}
                    <button type="button" class="step-go" onclick={() => game.toggleTutorial()}>
                        {$_("dailyPuzzle.backToPuzzle")}<span class="step-chevron"></span>
                    </button>
                {:else}
                    <!-- back to the puzzle, where Start (with its fee) is: the tutorial doesn't charge -->
                    <button type="button" class="step-go" onclick={() => game.skipDemo()}>
                        {$_("dailyPuzzle.resume")}<span class="step-chevron"></span>
                    </button>
                {/if}
            </span>
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
            {#if game.replaced}
                <p class="caption">{$_("dailyPuzzle.replaced")}</p>
            {/if}
            <!-- every game's board on the same card -->
            <div class="board" class:pending={!game.started}>
                <game.board.Board
                    board={game.board}
                    violations={game.violations}
                    focus={game.focus}
                    target={game.target}
                    greyed={!game.started}
                    disabled={game.inputDisabled || reveal.view === "banner"}
                    onTap={(key: number) => game?.tap(key)} />
            </div>
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

    // ---- the tutorial (the demo, as the prototype's screen draws it)

    .demo {
        width: min(100%, 420px);
        // sideways drags are the tutorial's swipe; up and down still scroll
        touch-action: pan-y;
        display: flex;
        flex-direction: column;
        gap: var(--space-16);

        .board {
            width: 100%;
            cursor: pointer;
        }
    }

    // the step's title and text, under the board, at the board's start edge
    .step-copy {
        min-height: 64px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 0 4px;
    }

    .step-title {
        margin: 0;
        font: var(--weight-semibold) text-size(14px) / 1.3 var(--font-sans);
        color: var(--ink);
    }

    .step-text {
        margin: 0;
        font: var(--weight-regular) text-size(13px) / 1.5 var(--font-sans);
        color: var(--ink-2);
        text-wrap: pretty;
    }

    // Back · the step dots · Next (on the last step, Start or Back to puzzle as an accent pill)
    .step-bar {
        flex: none;
        display: flex;
        align-items: center;
        height: 48px;
        padding: 12px var(--space-16) var(--bar-end);
    }

    // the sides share what the dots leave, but never squeeze Start (with its fee) under them
    .step-side {
        flex: 1;
        display: flex;

        &.end {
            justify-content: flex-end;
        }
    }

    .step-back,
    .step-next,
    .step-go {
        display: flex;
        align-items: center;
        gap: 6px;
        border: 0;
        background: none;
        font: var(--weight-bold) text-size(15px) / 1 var(--font-sans);
        white-space: nowrap;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:focus-visible {
            @include focus-ring;
        }
    }

    .step-back,
    .step-next {
        height: 48px;
        padding: 0 4px;
    }

    .step-back {
        font-weight: var(--weight-semibold);
        color: var(--ink-2);
    }

    .step-next {
        color: var(--accent-bright);
    }

    .step-go {
        height: 40px;
        padding: 0 14px 0 16px;
        border-radius: 20px;
        background: var(--accent);
        color: var(--on-accent);

        &:disabled {
            opacity: 0.45;
            cursor: default;
        }

        &[aria-busy="true"] {
            opacity: 1;
            cursor: progress;
        }
    }

    .step-chevron {
        @include icon(chevron-right, 16px);

        &.back {
            transform: rotate(180deg);
        }
    }

    .step-dots {
        flex: none;
        display: flex;
        gap: 6px;
        padding: 0 10px;
    }

    .step-dot {
        width: 6px;
        height: 6px;
        border-radius: 3px;
        background: var(--overlay-3);
        transition:
            width 200ms var(--ease-out),
            background 200ms;

        &.done {
            background: var(--accent);
        }

        &.on {
            width: 22px;
        }
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
