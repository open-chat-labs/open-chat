<script lang="ts">
    import {
        chitStateStore,
        currentUserIdStore,
        dailyPuzzleStore,
        stateFor,
        todaysPuzzle,
        type OpenChat,
    } from "@client";
    import { now500 } from "@src/stores/time";
    import {
        DailyPuzzleGame,
        formatSolveTime,
        gameNameKey,
        tierKey,
    } from "@src/utils/dailyPuzzle.svelte";
    import { dailyPuzzleGame } from "@src/utils/dailyPuzzleGames";
    import GameDemo from "../../../components/home/dailypuzzle/GameDemo.svelte";
    import {
        Body,
        BodySmall,
        Button,
        Caption,
        ColourVars,
        CommonButton2,
        Container,
        H2,
    } from "component-lib";
    import { getContext, onDestroy } from "svelte";
    import Fire from "svelte-material-icons/Fire.svelte";
    import LightbulbOutline from "svelte-material-icons/LightbulbOutline.svelte";
    import ShareVariant from "svelte-material-icons/ShareVariant.svelte";
    import TimerOutline from "svelte-material-icons/TimerOutline.svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    interface Props {
        gameId?: string;
        onClose: () => void;
    }

    let { gameId, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");
    const puzzle = todaysPuzzle($dailyPuzzleStore, gameId);
    // undefined = a game this build does not know how to render
    const def = puzzle !== undefined ? dailyPuzzleGame(puzzle.gameId) : undefined;
    const Board = def?.Board;
    const game =
        puzzle !== undefined && def !== undefined
            ? new DailyPuzzleGame(
                  client,
                  puzzle,
                  stateFor($dailyPuzzleStore, puzzle.gameId),
                  $currentUserIdStore,
                  def.game,
              )
            : undefined;

    onDestroy(() => game?.dispose());

    let state = $derived(
        puzzle !== undefined ? stateFor($dailyPuzzleStore, puzzle.gameId) : undefined,
    );
    let started = $derived(state?.startedAt !== undefined);
    let solved = $derived(state?.solved);
    let elapsed = $derived(
        solved !== undefined
            ? Number(solved.solveTimeMs)
            : state?.startedAt !== undefined
              ? $now500 - Number(state.startedAt)
              : 0,
    );
    let hintsUsed = $derived(state?.hints.filter((h) => !h.mistake).length ?? 0);
    let streak = $derived(state?.streak ?? 0);
    let disabled = $derived(
        game === undefined ||
            !started ||
            solved !== undefined ||
            game.submitting ||
            game.busy,
    );
    let entryFee = $derived(game?.entryFee ?? 0);
    let canAfford = $derived($chitStateStore.chitBalance >= entryFee);
    let hintPrice = $derived(game?.nextHintPrice ?? 0);
    let hintLevel = $derived(game?.nextHintLevel ?? 1);
    let hintsLeft = $derived(Math.max(0, (puzzle?.maxHints ?? 0) - hintsUsed));
    // a new step would be needed and the daily cap has been reached
    let noHintsLeft = $derived(hintLevel === 1 && hintsLeft === 0);
    let hintDisabled = $derived(
        disabled || noHintsLeft || $chitStateStore.chitBalance < hintPrice,
    );

    function share() {
        game?.share();
    }
</script>

<SlidingPageContent
    title={puzzle !== undefined
        ? i18nKey("dailyPuzzle.number", { number: puzzle.number })
        : i18nKey("dailyPuzzle.title")}
    subtitle={puzzle !== undefined
        ? i18nKey(`${$_(gameNameKey(puzzle.gameId))} · ${$_(tierKey(puzzle.tier))}`)
        : undefined}
    onBack={onClose}>
    <Container height={"fill"} padding={["xl", "xl", "huge"]} gap={"xl"} direction={"vertical"}>
        {#if puzzle === undefined}
            <Body><Translatable resourceKey={i18nKey("dailyPuzzle.unavailable")} /></Body>
        {:else if game === undefined || Board === undefined}
            <Body><Translatable resourceKey={i18nKey("dailyPuzzle.needsNewerApp")} /></Body>
        {:else}
            <div class="board" class:pending={!started && def?.demo === undefined}>
                {#if !started && def?.demo !== undefined}
                    <!-- Before Start the real board is inert and teaches nothing, so show the
                         game being played instead. Today's puzzle appears on Start. -->
                    <GameDemo {def} />
                {:else}
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
                    onTap={(key: number) => game.tap(key)} />
                {/if}
            </div>

            <Container mainAxisAlignment={"spaceAround"} crossAxisAlignment={"center"}>
                <div class="stat">
                    <TimerOutline size={"1.2em"} color={ColourVars.textSecondary} />
                    <BodySmall width={"hug"}><span class="mono">{formatSolveTime(elapsed)}</span></BodySmall>
                </div>
                <div class="stat">
                    <LightbulbOutline size={"1.2em"} color={ColourVars.textSecondary} />
                    <BodySmall width={"hug"}>
                        <Translatable
                            resourceKey={i18nKey("dailyPuzzle.hintsUsed", { count: hintsUsed })} />
                    </BodySmall>
                </div>
                <div class="stat">
                    <Fire size={"1.2em"} color={ColourVars.textSecondary} />
                    <BodySmall width={"hug"}>
                        <Translatable
                            resourceKey={i18nKey("dailyPuzzle.streakDays", { streak })} />
                    </BodySmall>
                </div>
            </Container>

            <Caption colour={"textSecondary"}>
                <Translatable resourceKey={game.rulesKey} />
            </Caption>

            {#if solved !== undefined}
                <Container direction={"vertical"} gap={"sm"} crossAxisAlignment={"center"}>
                    <H2 width={"hug"} fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey("dailyPuzzle.solvedTitle")} />
                    </H2>
                    <Body width={"hug"} colour={"textSecondary"}>
                        <Translatable
                            resourceKey={i18nKey("dailyPuzzle.solvedSummary", {
                                time: formatSolveTime(Number(solved.solveTimeMs)),
                                hints: solved.hintsUsed,
                                streak: solved.streak,
                            })} />
                    </Body>
                    <Body width={"hug"} fontWeight={"bold"} colour={"primary"}>
                        <Translatable
                            resourceKey={i18nKey("dailyPuzzle.reward", { reward: solved.reward })} />
                    </Body>
                </Container>
                {#if game.canShare}
                    <Button onClick={share}>
                        {#snippet icon(color)}
                            <ShareVariant {color} />
                        {/snippet}
                        <Translatable resourceKey={i18nKey("dailyPuzzle.share")} />
                    </Button>
                {/if}
            {:else}
                <Caption colour={"textSecondary"}>
                    {#if game.caption !== undefined}
                        <Translatable resourceKey={game.caption} />
                    {:else if game.submitting}
                        <Translatable resourceKey={i18nKey("dailyPuzzle.submitting")} />
                    {/if}
                </Caption>

                {#if !started}
                    <Button
                        loading={game.busy}
                        disabled={game.busy || !canAfford}
                        onClick={() => game.start()}>
                        <Translatable
                            resourceKey={entryFee === 0
                                ? i18nKey("dailyPuzzle.startFree")
                                : i18nKey("dailyPuzzle.startFee", { fee: entryFee })} />
                    </Button>
                {:else}
                    <CommonButton2
                        loading={game.busy}
                        disabled={hintDisabled}
                        variant={"secondary"}
                        mode={"regular"}
                        width={"fill"}
                        onClick={() => game.hint()}>
                        {#snippet icon(color, size)}
                            <LightbulbOutline {color} {size} />
                        {/snippet}
                        {#if noHintsLeft}
                            <Translatable resourceKey={i18nKey("dailyPuzzle.noHintsLeft")} />
                        {:else}
                            <Translatable
                                resourceKey={hintPrice === 0
                                    ? i18nKey("dailyPuzzle.hintFree", { level: hintLevel })
                                    : i18nKey("dailyPuzzle.hintPrice", {
                                          level: hintLevel,
                                          price: hintPrice,
                                      })} />
                            {#if hintsLeft > 0}
                                · <Translatable
                                    resourceKey={i18nKey("dailyPuzzle.hintsLeft", {
                                        count: hintsLeft,
                                    })} />
                            {/if}
                        {/if}
                    </CommonButton2>
                {/if}
            {/if}
        {/if}
    </Container>
</SlidingPageContent>

<style lang="scss">
    .board {
        width: 100%;
        max-width: 480px;
        align-self: center;
        aspect-ratio: 1;
        transition: opacity 200ms ease-in-out;

        &.pending {
            opacity: 0.6;
        }
    }

    .stat {
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .mono {
        font-variant-numeric: tabular-nums;
    }
</style>
