<script lang="ts">
    import { currentUserIdStore, type OpenChat } from "@client";
    import { now500 } from "@src/stores/time";
    import {
        formatSolveTime,
        gameNameKey,
        openDailyPuzzle,
        tierKey,
        type HintButton,
    } from "@src/utils/dailyPuzzle.svelte";
    import {
        Body,
        BodySmall,
        Button,
        Caption,
        ColourVars,
        CommonButton2,
        Container,
        H2,
        transition,
    } from "component-lib";
    import { getContext, onDestroy } from "svelte";
    import { _ } from "svelte-i18n";
    import Fire from "svelte-material-icons/Fire.svelte";
    import LightbulbOutline from "svelte-material-icons/LightbulbOutline.svelte";
    import Refresh from "svelte-material-icons/Refresh.svelte";
    import ShareVariant from "svelte-material-icons/ShareVariant.svelte";
    import TimerOutline from "svelte-material-icons/TimerOutline.svelte";
    import GameDemo from "../../../components/home/dailypuzzle/GameDemo.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    interface Props {
        gameId?: string;
        onClose: () => void;
    }

    let { gameId, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");
    // undefined `def` = a game this build does not know how to render
    const opened = openDailyPuzzle(client, gameId, $currentUserIdStore);
    const { def, game } = opened;
    // the session's puzzle, which the poll may have replaced since this opened
    let puzzle = $derived(game?.puzzle ?? opened.puzzle);

    onDestroy(() => game?.dispose());
    let hintButton: HintButton = $derived(game?.hintButton ?? { kind: "noneLeft" });

    function share() {
        game?.share();
    }

    function toggleDemo() {
        transition(["fade"], () => {
            game?.toggleTutorial();
        });
    }
</script>

{#snippet howToPlay()}
    {#if game?.canToggleTutorial}
        <Container mainAxisAlignment={"center"}>
            <CommonButton2 variant={"primary"} mode={"text"} onClick={toggleDemo}>
                <Translatable
                    resourceKey={i18nKey(
                        game.tutorialOpen ? "dailyPuzzle.backToPuzzle" : "dailyPuzzle.howToPlay",
                    )} />
            </CommonButton2>
        </Container>
    {/if}
{/snippet}

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
        {:else if game === undefined}
            <Body><Translatable resourceKey={i18nKey("dailyPuzzle.needsNewerApp")} /></Body>
        {:else}
            <div class="board" class:pending={!game.started && def?.demo === undefined}>
                {#if game.showsDemo && def !== undefined}
                    <!-- Before Start the real board is inert and teaches nothing, so show the
                         game being played instead. Today's puzzle appears on Start. -->
                    <GameDemo {def} />
                {:else}
                    {#if game.replaced}
                        <Caption colour={"textSecondary"}>
                            <Translatable resourceKey={i18nKey("dailyPuzzle.replaced")} />
                        </Caption>
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

            <Container mainAxisAlignment={"spaceAround"} crossAxisAlignment={"center"}>
                <div class="stat">
                    <TimerOutline size={"1.2em"} color={ColourVars.textSecondary} />
                    <BodySmall width={"hug"}
                        ><span class="mono">{formatSolveTime(game.elapsed($now500))}</span></BodySmall>
                </div>
                <div class="stat">
                    <LightbulbOutline size={"1.2em"} color={ColourVars.textSecondary} />
                    <BodySmall width={"hug"}>
                        <Translatable
                            resourceKey={i18nKey("dailyPuzzle.hintsUsed", { count: game.hintsUsed })} />
                    </BodySmall>
                </div>
                <div class="stat">
                    <Fire size={"1.2em"} color={ColourVars.textSecondary} />
                    <BodySmall width={"hug"}>
                        <Translatable resourceKey={i18nKey("dailyPuzzle.streakDays", { streak: game.streak })} />
                    </BodySmall>
                </div>
            </Container>

            {#if game.showsRules}
                <Caption colour={"textSecondary"}>
                    <Translatable resourceKey={game.rulesKey} />
                </Caption>
            {/if}

            {#if game.solved !== undefined}
                <Container direction={"vertical"} gap={"sm"} crossAxisAlignment={"center"}>
                    <H2 width={"hug"} fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey("dailyPuzzle.solvedTitle")} />
                    </H2>
                    <Body width={"hug"} colour={"textSecondary"}>
                        <Translatable
                            resourceKey={i18nKey("dailyPuzzle.solvedSummary", {
                                time: formatSolveTime(Number(game.solved.solveTimeMs)),
                                hints: game.solved.hintsUsed,
                                streak: game.solved.streak,
                            })} />
                    </Body>
                    <Body width={"hug"} fontWeight={"bold"} colour={"primary"}>
                        <Translatable
                            resourceKey={i18nKey("dailyPuzzle.reward", {
                                reward: game.solved.reward,
                            })} />
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

                {#if !game.started}
                    <Button
                        loading={game.busy}
                        disabled={!game.canStart}
                        onClick={() => game?.start()}>
                        <Translatable
                            resourceKey={game.entryFee === 0
                                ? i18nKey("dailyPuzzle.startFree")
                                : i18nKey("dailyPuzzle.startFee", { fee: game.entryFee })} />
                    </Button>
                {:else if !game.tutorialOpen}
                    <CommonButton2
                        disabled={!game.canReset}
                        variant={"secondary"}
                        mode={"small"}
                        width={"fill"}
                        onClick={() => game?.reset()}>
                        {#snippet icon(color, size)}
                            <Refresh {color} {size} />
                        {/snippet}
                        <Translatable
                            resourceKey={i18nKey(
                                game.resetArmed ? "dailyPuzzle.resetConfirm" : "dailyPuzzle.reset",
                            )} />
                    </CommonButton2>
                    <CommonButton2
                        loading={game.busy}
                        disabled={game.hintDisabled}
                        variant={"secondary"}
                        mode={"regular"}
                        width={"fill"}
                        onClick={() => game?.hint()}>
                        {#snippet icon(color, size)}
                            <LightbulbOutline {color} {size} />
                        {/snippet}
                        {#if hintButton.kind === "mistake"}
                            <Translatable resourceKey={i18nKey("dailyPuzzle.fixMistakeFirst")} />
                        {:else if hintButton.kind === "noneLeft"}
                            <Translatable resourceKey={i18nKey("dailyPuzzle.noHintsLeft")} />
                        {:else}
                            <Translatable
                                resourceKey={i18nKey("dailyPuzzle.hintCost", {
                                    price: hintButton.price,
                                })} />
                            {#if hintButton.hintsLeft > 0}
                                · <Translatable
                                    resourceKey={i18nKey("dailyPuzzle.hintsLeft", {
                                        count: hintButton.hintsLeft,
                                    })} />
                            {/if}
                            {#if hintButton.checksLeft !== undefined}
                                · <Translatable
                                    resourceKey={i18nKey("dailyPuzzle.checksLeft", {
                                        count: hintButton.checksLeft,
                                    })} />
                            {/if}
                        {/if}
                    </CommonButton2>
                {/if}
                {@render howToPlay()}
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
