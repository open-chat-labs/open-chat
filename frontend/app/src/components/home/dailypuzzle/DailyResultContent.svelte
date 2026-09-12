<script lang="ts">
    import {
        dailyPuzzleStore,
        descriptionFromHex,
        publish,
        stateFor,
        todaysPuzzle,
        type DailyResultContent,
        type OpenChat,
    } from "@client";
    import { getContext } from "svelte";
    import AlertCircleOutline from "svelte-material-icons/AlertCircleOutline.svelte";
    import CheckCircleOutline from "svelte-material-icons/CheckCircleOutline.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { formatSolveTime, gameNameKey, tierKey } from "../../../utils/dailyPuzzle.svelte";
    import { dailyPuzzleGame } from "../../../utils/dailyPuzzleGames";
    import Button from "../../Button.svelte";
    import Translatable from "../../Translatable.svelte";
    import ContentCaption from "../ContentCaption.svelte";

    interface Props {
        content: DailyResultContent;
        intersecting: boolean;
        edited?: boolean;
        blockLevelMarkdown?: boolean;
    }

    let { content, intersecting, edited = false, blockLevelMarkdown = false }: Props = $props();

    const client = getContext<OpenChat>("client");

    // undefined = a game this build does not know how to render
    let def = $derived(dailyPuzzleGame(content.gameId));
    let Pictogram = $derived(def?.Pictogram);
    let model = $derived.by(() => {
        if (def === undefined) return undefined;
        try {
            return def.game.parse(descriptionFromHex(content.layout));
        } catch {
            return undefined;
        }
    });

    // Checked against the daily canister's results index the first time the card scrolls into
    // view. No row = the numbers are shown greyed and marked unverified.
    let verification = $state<"pending" | "verified" | "unverified">("pending");
    let checked = false;
    $effect(() => {
        if (intersecting && !checked) {
            checked = true;
            client
                .verifyDailyResults(content.gameId, content.number, [content.userId])
                .then((rows) => {
                    verification = rows[content.userId] !== undefined ? "verified" : "unverified";
                });
        }
    });

    let isCurrent = $derived.by(() => {
        const puzzle = todaysPuzzle($dailyPuzzleStore, content.gameId);
        return puzzle?.enabled === true && puzzle.number === content.number;
    });
    let viewerSolved = $derived(stateFor($dailyPuzzleStore, content.gameId)?.solved !== undefined);
</script>

<div class="card">
    <div class="header">
        <div class="title">
            <Translatable resourceKey={i18nKey("dailyPuzzle.number", { number: content.number })} />
        </div>
        <div class="subtitle">
            <Translatable resourceKey={i18nKey(gameNameKey(content.gameId))} />
            {#if content.tier !== undefined}
                · <Translatable resourceKey={i18nKey(tierKey(content.tier))} />
            {/if}
        </div>
    </div>
    <div class="row">
        {#if model !== undefined && Pictogram !== undefined}
            <div class="pictogram">
                <Pictogram {model} />
            </div>
        {/if}
        <div class="stats" class:unverified={verification === "unverified"}>
            <div class="stat">
                <span class="value mono">{formatSolveTime(content.solveTimeMs)}</span>
                <span class="label"
                    ><Translatable resourceKey={i18nKey("dailyPuzzle.card.time")} /></span>
            </div>
            <div class="stat">
                <span class="value">{content.hintsUsed}</span>
                <span class="label"
                    ><Translatable resourceKey={i18nKey("dailyPuzzle.card.hints")} /></span>
            </div>
            <div class="stat">
                <span class="value">{content.streak}</span>
                <span class="label"
                    ><Translatable resourceKey={i18nKey("dailyPuzzle.card.dayStreak")} /></span>
            </div>
            <div class="stat verification" class:verified={verification === "verified"}>
                {#if verification === "verified"}
                    <span class="icon"
                        ><CheckCircleOutline size={"1.2em"} color={"currentColor"} /></span>
                    <span class="label"
                        ><Translatable resourceKey={i18nKey("dailyPuzzle.verified")} /></span>
                {:else if verification === "unverified"}
                    <span class="icon"
                        ><AlertCircleOutline size={"1.2em"} color={"currentColor"} /></span>
                    <span class="label"
                        ><Translatable resourceKey={i18nKey("dailyPuzzle.unverified")} /></span>
                {/if}
            </div>
        </div>
    </div>
    {#if content.caption}
        <div class="rule"></div>
        <ContentCaption caption={content.caption} {edited} {blockLevelMarkdown} />
    {/if}
    {#if def === undefined}
        <div class="note">
            <Translatable resourceKey={i18nKey("dailyPuzzle.needsNewerApp")} />
        </div>
    {:else if isCurrent && !viewerSolved}
        <div class="play">
            <Button fill small onClick={() => publish("dailyPuzzle", { gameId: content.gameId })}>
                <Translatable resourceKey={i18nKey("dailyPuzzle.play")} />
            </Button>
        </div>
    {/if}
</div>

<style lang="scss">
    .card {
        display: flex;
        flex-direction: column;
        gap: $sp4;
        padding: $sp3 $sp3 0 $sp3;
        min-width: 220px;
        max-width: 400px;
    }

    .header {
        display: flex;
        flex-direction: column;
        gap: $sp1;
    }

    .title {
        @include font(bold, normal, fs-140);
    }

    .subtitle {
        @include font(book, normal, fs-60);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        opacity: 0.7;
    }

    .row {
        display: flex;
        flex-wrap: wrap;
        gap: $sp4 $sp5;
        align-items: center;
    }

    .pictogram {
        flex: 0 0 160px;
        width: 160px;
        height: 160px;
    }

    .stats {
        display: flex;
        flex-direction: column;
        gap: toRem(6);

        &.unverified .stat:not(.verification) {
            opacity: 0.5;
        }
    }

    .stat {
        display: flex;
        flex-direction: column;
        gap: $sp1;
        align-items: flex-start;
    }

    .value {
        @include font(bold, normal, fs-140);
        line-height: 1;
    }

    .label {
        @include font(book, normal, fs-50);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        opacity: 0.7;
    }

    .rule {
        border-top: 1px solid currentColor;
        opacity: 0.2;
    }

    .verification {
        flex-direction: row;
        align-items: center;
        gap: $sp2;
        min-height: 1.2em;
        opacity: 0.6;

        .label {
            @include font(bold, normal, fs-50);
            opacity: 1;
        }

        &.verified {
            opacity: 1;
        }
    }

    .icon {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .mono {
        font-variant-numeric: tabular-nums;
    }

    .play {
        display: flex;
    }

    .note {
        @include font(book, normal, fs-80);
        opacity: 0.7;
    }
</style>
