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
    import { formatSolveTime, gameNameKey, tierKey } from "@src/utils/dailyPuzzle.svelte";
    import { dailyPuzzleGame } from "@src/utils/dailyPuzzleGames";
    import {
        Caption,
        ColourVars,
        Column,
        CommonButton2,
        H2,
        Row,
        type ColourVarKeys,
    } from "component-lib";
    import { getContext } from "svelte";
    import Play from "svelte-material-icons/Play.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import ContentCaption from "../ContentCaption.svelte";

    interface Props {
        content: DailyResultContent;
        intersecting: boolean;
        me?: boolean;
        edited?: boolean;
        blockLevelMarkdown?: boolean;
    }

    let {
        content,
        intersecting,
        me = false,
        edited = false,
        blockLevelMarkdown = false,
    }: Props = $props();

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

    let textColour: ColourVarKeys = $derived(me ? "chatTextSent" : "textPrimary");
    let mutedColour: ColourVarKeys = $derived(me ? "chatMetadataSent" : "textSecondary");
    // Unverified numbers are shown muted; the verification entry itself stays full strength.
    let valueColour = $derived(verification === "unverified" ? mutedColour : textColour);
    let ruleColour = $derived(me ? ColourVars.chatMetadataSent : ColourVars.surface2);
</script>

{#snippet stat(value: string, labelKey: string, mono: boolean = false)}
    <Column gap="zero" width="hug">
        <H2 fontWeight="semi-bold" width="hug" colour={valueColour}>
            <span class:mono>{value}</span>
        </H2>
        <Caption uppercase width="hug" colour={mutedColour}>
            <Translatable resourceKey={i18nKey(labelKey)} />
        </Caption>
    </Column>
{/snippet}

<Column gap="lg" padding="lg" minWidth="220px" maxWidth="400px">
    <Column gap="xxs">
        <H2 fontWeight="semi-bold" colour={textColour}>
            <Translatable resourceKey={i18nKey("dailyPuzzle.number", { number: content.number })} />
        </H2>
        <Caption uppercase colour={mutedColour}>
            <Translatable resourceKey={i18nKey(gameNameKey(content.gameId))} />
            {#if content.tier !== undefined}
                · <Translatable resourceKey={i18nKey(tierKey(content.tier))} />
            {/if}
            .
            <Translatable
                resourceKey={i18nKey(
                    verification === "verified" ? "dailyPuzzle.verified" : "dailyPuzzle.unverified",
                )} />
        </Caption>
    </Column>
    <Row gap="lg" crossAxisAlignment="center">
        {#if model !== undefined && Pictogram !== undefined}
            <Column width={{ size: "160px" }} height={{ size: "160px" }} overflow="visible">
                <Pictogram {model} />
            </Column>
        {/if}
        <Column gap="xs" width="hug">
            {@render stat(formatSolveTime(content.solveTimeMs), "dailyPuzzle.card.time", true)}
            {@render stat(`${content.hintsUsed}`, "dailyPuzzle.card.hints")}
            {@render stat(`${content.streak}`, "dailyPuzzle.card.dayStreak")}
        </Column>
    </Row>
    <Row width="fill" height={{ size: "1px" }} backgroundColor={ruleColour}>{""}</Row>
    <ContentCaption caption={content.caption} {edited} {blockLevelMarkdown} />
    {#if def === undefined}
        <Caption colour={mutedColour}>
            <Translatable resourceKey={i18nKey("dailyPuzzle.needsNewerApp")} />
        </Caption>
    {:else if isCurrent && !viewerSolved}
        <CommonButton2
            variant={"primary"}
            mode={"small"}
            width={"fill"}
            onClick={() => publish("dailyPuzzle", { gameId: content.gameId })}>
            {#snippet icon(color, size)}
                <Play {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("dailyPuzzle.play")} />
        </CommonButton2>
    {/if}
</Column>

<style lang="scss">
    .mono {
        font-variant-numeric: tabular-nums;
    }
</style>
