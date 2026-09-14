<script lang="ts">
    import {
        chitStateStore,
        currentUserIdStore,
        dailyPuzzleStore,
        publish,
        stateFor,
        todaysPuzzle,
        puzzleReplaced,
        type PublicDailyPuzzle,
        type OpenChat,
    } from "@client";
    import { getContext, onDestroy, tick, untrack } from "svelte";
    import Fire from "svelte-material-icons/Fire.svelte";
    import LightbulbOutline from "svelte-material-icons/LightbulbOutline.svelte";
    import ShareVariant from "svelte-material-icons/ShareVariant.svelte";
    import TimerOutline from "svelte-material-icons/TimerOutline.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { now500 } from "../../../stores/time";
    import {
        DailyPuzzleGame,
        formatSolveTime,
        gameNameKey,
        tierKey,
        type HintButton,
    } from "../../../utils/dailyPuzzle.svelte";
    import { dailyPuzzleGame } from "../../../utils/dailyPuzzleGames";
    import GameDemo from "./GameDemo.svelte";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Translatable from "../../Translatable.svelte";

    interface Props {
        gameId?: string;
        onClose: () => void;
    }

    let { gameId, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");
    let puzzle = $state.raw(todaysPuzzle($dailyPuzzleStore, gameId));
    // undefined = a game this build does not know how to render
    const def = puzzle !== undefined ? dailyPuzzleGame(puzzle.gameId) : undefined;
    const Board = def?.Board;
    function build(p: PublicDailyPuzzle | undefined): DailyPuzzleGame | undefined {
        return p !== undefined && def !== undefined
            ? new DailyPuzzleGame(
                  client,
                  p,
                  stateFor($dailyPuzzleStore, p.gameId),
                  $currentUserIdStore,
                  def.game,
              )
            : undefined;
    }
    let game = $state.raw(build(puzzle));
    // The poll can bring a different puzzle while this is open: a regenerate, or rollover. The
    // board is rebuilt from the new one so no marks from the old puzzle remain, and the player is
    // told (#9334 invariant 58).
    let replaced = $state(false);
    $effect(() => {
        const next = todaysPuzzle($dailyPuzzleStore, gameId);
        if (puzzle !== undefined && next !== undefined && puzzleReplaced(puzzle, next)) {
            untrack(() => {
                game?.dispose();
                puzzle = next;
                game = build(next);
                replaced = true;
            });
        }
    });

    onDestroy(() => game?.dispose());

    let userState = $derived(
        puzzle !== undefined ? stateFor($dailyPuzzleStore, puzzle.gameId) : undefined,
    );
    let started = $derived(userState?.startedAt !== undefined);
    let solved = $derived(userState?.solved);
    let elapsed = $derived(
        solved !== undefined
            ? Number(solved.solveTimeMs)
            : userState?.startedAt !== undefined
              ? $now500 - Number(userState.startedAt)
              : 0,
    );
    let hintsUsed = $derived(userState?.hints.filter((h) => !h.mistake).length ?? 0);
    let streak = $derived(userState?.streak ?? 0);
    let disabled = $derived(
        game === undefined || !started || solved !== undefined || game.submitting || game.busy,
    );
    let entryFee = $derived(game?.entryFee ?? 0);
    let canAfford = $derived($chitStateStore.chitBalance >= entryFee);
    let hintButton: HintButton = $derived(game?.hintButton ?? { kind: "noneLeft" });
    let hintDisabled = $derived(
        disabled || hintButton.kind !== "hint" || $chitStateStore.chitBalance < hintButton.price,
    );

    function share() {
        // close first: Home opens the chat picker in the same modal slot
        const card = game?.resultCard();
        onClose();
        if (card !== undefined) tick().then(() => publish("shareDailyResult", card));
    }
</script>

<ModalContent closeIcon {onClose}>
    {#snippet header()}
        {#if puzzle !== undefined}
            <div class="header">
                <Translatable
                    resourceKey={i18nKey("dailyPuzzle.number", { number: puzzle.number })}
                />
                <span class="tier">
                    · <Translatable resourceKey={i18nKey(gameNameKey(puzzle.gameId))} />
                    · <Translatable resourceKey={i18nKey(tierKey(puzzle.tier))} />
                </span>
            </div>
        {/if}
    {/snippet}
    {#snippet body()}
        {#if puzzle === undefined}
            <p><Translatable resourceKey={i18nKey("dailyPuzzle.unavailable")} /></p>
        {:else if game === undefined || Board === undefined}
            <p><Translatable resourceKey={i18nKey("dailyPuzzle.needsNewerApp")} /></p>
        {:else}
            <div class="body">
                <div class="board" class:pending={!started && def?.demo === undefined}>
                    {#if !started && def?.demo !== undefined}
                        <!-- Before Start the real board is inert and teaches nothing, so show
                             the game being played instead. Today's puzzle appears on Start. -->
                        <GameDemo {def} />
                    {:else}
                        {#if replaced}
                            <p class="caption replaced">
                                <Translatable resourceKey={i18nKey("dailyPuzzle.replaced")} />
                            </p>
                        {/if}
                        <Board
                            model={game.model}
                            state={game.state}
                            marks={game.marks}
                            lit={game.lit}
                            violations={game.violations}
                            focus={game.focus}
                            target={game.target}
                            greyed={!started}
                            {disabled}
                            onTap={(key: number) => game?.tap(key)}
                        />
                    {/if}
                </div>

                <div class="stats">
                    <div class="stat">
                        <TimerOutline size={"1.2em"} color={"var(--icon-txt)"} />
                        <span class="mono">{formatSolveTime(elapsed)}</span>
                    </div>
                    <div class="stat">
                        <LightbulbOutline size={"1.2em"} color={"var(--icon-txt)"} />
                        <Translatable
                            resourceKey={i18nKey("dailyPuzzle.hintsUsed", { count: hintsUsed })}
                        />
                    </div>
                    <div class="stat">
                        <Fire size={"1.2em"} color={"var(--icon-txt)"} />
                        <Translatable resourceKey={i18nKey("dailyPuzzle.streakDays", { streak })} />
                    </div>
                </div>

                <p class="caption">
                    <Translatable resourceKey={game.rulesKey} />
                </p>

                {#if solved !== undefined}
                    <div class="solved">
                        <h3><Translatable resourceKey={i18nKey("dailyPuzzle.solvedTitle")} /></h3>
                        <p>
                            <Translatable
                                resourceKey={i18nKey("dailyPuzzle.solvedSummary", {
                                    time: formatSolveTime(Number(solved.solveTimeMs)),
                                    hints: solved.hintsUsed,
                                    streak: solved.streak,
                                })}
                            />
                        </p>
                        <p class="reward">
                            <Translatable
                                resourceKey={i18nKey("dailyPuzzle.reward", {
                                    reward: solved.reward,
                                })}
                            />
                        </p>
                    </div>
                {:else if game.caption !== undefined}
                    <p class="caption" class:mistake={game.mistakes.size > 0}>
                        <Translatable resourceKey={game.caption} />
                    </p>
                {:else if game.submitting}
                    <p class="caption">
                        <Translatable resourceKey={i18nKey("dailyPuzzle.submitting")} />
                    </p>
                {/if}
            </div>
        {/if}
    {/snippet}
    {#snippet footer()}
        {#if puzzle !== undefined && game === undefined}
            <ButtonGroup align={"center"}>
                <Button secondary onClick={onClose}>
                    <Translatable resourceKey={i18nKey("close")} />
                </Button>
            </ButtonGroup>
        {:else if puzzle !== undefined && game !== undefined}
            <ButtonGroup align={"center"}>
                {#if solved !== undefined}
                    {#if game.canShare}
                        <Button onClick={share}>
                            <span class="btn-inner">
                                <ShareVariant size={"1em"} color={"currentColor"} />
                                <Translatable resourceKey={i18nKey("dailyPuzzle.share")} />
                            </span>
                        </Button>
                    {/if}
                    <Button secondary onClick={onClose}>
                        <Translatable resourceKey={i18nKey("close")} />
                    </Button>
                {:else if !started}
                    <Button
                        loading={game.busy}
                        disabled={game.busy || !canAfford}
                        onClick={() => game?.start()}
                    >
                        <Translatable
                            resourceKey={entryFee === 0
                                ? i18nKey("dailyPuzzle.startFree")
                                : i18nKey("dailyPuzzle.startFee", { fee: entryFee })}
                        />
                    </Button>
                {:else}
                    <Button
                        loading={game.busy}
                        disabled={hintDisabled}
                        secondary
                        onClick={() => game?.hint()}
                    >
                        <span class="btn-inner">
                            <LightbulbOutline size={"1em"} color={"currentColor"} />
                            {#if hintButton.kind === "mistake"}
                                <Translatable
                                    resourceKey={i18nKey("dailyPuzzle.fixMistakeFirst")}
                                />
                            {:else if hintButton.kind === "noneLeft"}
                                <Translatable resourceKey={i18nKey("dailyPuzzle.noHintsLeft")} />
                            {:else}
                                <Translatable
                                    resourceKey={hintButton.price === 0
                                        ? i18nKey("dailyPuzzle.hintFree", {
                                              level: hintButton.level,
                                          })
                                        : i18nKey("dailyPuzzle.hintPrice", {
                                              level: hintButton.level,
                                              price: hintButton.price,
                                          })}
                                />
                                {#if hintButton.hintsLeft > 0}
                                    · <Translatable
                                        resourceKey={i18nKey("dailyPuzzle.hintsLeft", {
                                            count: hintButton.hintsLeft,
                                        })}
                                    />
                                {/if}
                                {#if hintButton.checksLeft !== undefined}
                                    · <Translatable
                                        resourceKey={i18nKey("dailyPuzzle.checksLeft", {
                                            count: hintButton.checksLeft,
                                        })}
                                    />
                                {/if}
                            {/if}
                        </span>
                    </Button>
                {/if}
            </ButtonGroup>
        {/if}
    {/snippet}
</ModalContent>

<style lang="scss">
    .header {
        text-align: center;

        .tier {
            color: var(--txt-light);
            @include font(book, normal, fs-90);
        }
    }

    .body {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: $sp4;
    }

    .board {
        width: min(100%, 420px);
        aspect-ratio: 1;
        transition: opacity 200ms ease-in-out;

        &.pending {
            opacity: 0.6;
        }
    }

    .stats {
        display: flex;
        gap: $sp5;
        justify-content: center;
        @include font(book, normal, fs-90);

        .stat {
            display: flex;
            align-items: center;
            gap: $sp2;
        }

        .mono {
            font-variant-numeric: tabular-nums;
        }
    }

    .caption {
        text-align: center;
        color: var(--txt-light);
        min-height: 1.5em;
        @include font(book, normal, fs-90);

        &.mistake {
            color: var(--error);
        }
    }

    .solved {
        text-align: center;

        h3 {
            @include font(bold, normal, fs-140);
            margin-bottom: $sp2;
        }

        .reward {
            color: var(--accent);
            @include font(bold, normal, fs-120);
        }
    }

    .btn-inner {
        display: inline-flex;
        align-items: center;
        gap: $sp2;
    }
</style>
