<script lang="ts">
    import { Body, BodySmall, ColourVars, Container, Subtitle } from "component-lib";
    import type { Metrics, OpenChat } from "openchat-client";
    import { minutesOnlineStore } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import Flag from "svelte-material-icons/Flag.svelte";
    import { cubicOut } from "svelte/easing";
    import { Tween } from "svelte/motion";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");
    interface Props {
        stats: Metrics;
        showReported?: boolean;
    }

    let { stats, showReported = false }: Props = $props();

    const tweenOptions = {
        duration: 600,
        easing: cubicOut,
    };
    let hoveredIndex: number | undefined = $state();
    let rendered = $state(false);
    let previousStats: Metrics | undefined = $state(undefined);
    let totalMessages = $state(0);
    let textPerc = new Tween(12.5, tweenOptions);
    let imagePerc = new Tween(12.5, tweenOptions);
    let videoPerc = new Tween(12.5, tweenOptions);
    let audioPerc = new Tween(12.5, tweenOptions);
    let filePerc = new Tween(12.5, tweenOptions);
    let pollPerc = new Tween(12.5, tweenOptions);
    let cryptoPerc = new Tween(12.5, tweenOptions);
    let giphyPerc = new Tween(12.5, tweenOptions);

    function percToDegree(perc: number): number {
        return (perc / 100) * 360;
    }

    onMount(() => {
        window.setTimeout(() => (rendered = true), 600);
    });

    function slice(val: number, tween: Tween<number>) {
        const perc = totalMessages > 0 ? (val / totalMessages) * 100 : 12.5;
        tween.set(0, { duration: 0 });
        tween.target = perc;
    }

    const circum = 471.24;

    function sumSlice(from: number, to: number): number {
        return percentages.slice(from, to).reduce((total, n) => total + percToDegree(n), 0);
    }

    let cryptoMessages = $derived(stats.icpMessages + stats.sns1Messages + stats.ckbtcMessages);
    $effect(() => {
        if (previousStats === undefined || !client.metricsEqual(stats, previousStats)) {
            totalMessages =
                stats.textMessages +
                stats.imageMessages +
                stats.videoMessages +
                stats.audioMessages +
                stats.fileMessages +
                stats.polls +
                cryptoMessages +
                stats.giphyMessages;

            slice(stats.textMessages, textPerc);
            slice(stats.imageMessages, imagePerc);
            slice(stats.videoMessages, videoPerc);
            slice(stats.audioMessages, audioPerc);
            slice(stats.fileMessages, filePerc);
            slice(stats.polls, pollPerc);
            slice(cryptoMessages, cryptoPerc);
            slice(stats.giphyMessages, giphyPerc);
            previousStats = stats;
        }
    });
    let percentages = $derived([
        textPerc.current,
        imagePerc.current,
        videoPerc.current,
        audioPerc.current,
        filePerc.current,
        pollPerc.current,
        cryptoPerc.current,
        giphyPerc.current,
    ]);
    let data = $derived([
        {
            cls: "text",
            perc: textPerc.current,
            rotate: 0,
        },
        {
            cls: "image",
            perc: imagePerc.current,
            rotate: sumSlice(0, 1),
        },
        {
            cls: "video",
            perc: videoPerc.current,
            rotate: sumSlice(0, 2),
        },
        {
            cls: "audio",
            perc: audioPerc.current,
            rotate: sumSlice(0, 3),
        },
        {
            cls: "file",
            perc: filePerc.current,
            rotate: sumSlice(0, 4),
        },
        {
            cls: "poll",
            perc: pollPerc.current,
            rotate: sumSlice(0, 5),
        },
        {
            cls: "crypto",
            perc: cryptoPerc.current,
            rotate: sumSlice(0, 6),
        },
        {
            cls: "giphy",
            perc: giphyPerc.current,
            rotate: sumSlice(0, 7),
        },
    ]);
</script>

{#snippet mediaStat(n: number, resourceKey: string, cls?: string)}
    <Container crossAxisAlignment={"center"} gap={"sm"}>
        <div class={`legend ${cls} key`}></div>
        <div class={`legend ${cls}`}>{n.toLocaleString()}</div>
        <BodySmall width={"hug"}>
            <Translatable resourceKey={i18nKey(resourceKey)} />
        </BodySmall>
    </Container>
{/snippet}

<Container direction={"vertical"} gap={"xl"} crossAxisAlignment={"center"}>
    <svg class:rendered class="pie" viewBox="0 0 320 320">
        <clipPath id="hollow">
            <path
                d="M 160 160 m -160 0 a 160 160 0 1 0 320 0 a 160 160 0 1 0 -320 0 Z M 160 160 m -100 0 a 100 100 0 0 1 200 0 a 100 100 0 0 1 -200 0 Z"
                style="fill: rgb(216, 216, 216); stroke: rgb(0, 0, 0);" />
        </clipPath>

        <circle class="background" cx={160} cy={160} r={150} clip-path="url(#hollow)" />

        {#each data as slice, i}
            <circle
                onmouseenter={(_) => (hoveredIndex = i)}
                onmouseleave={(_) => (hoveredIndex = undefined)}
                class={`slice ${slice.cls}`}
                cx={160}
                cy={160}
                r={75}
                clip-path="url(#hollow)"
                stroke-dasharray={`${(slice.perc * circum) / 100} ${circum}`}
                transform={`rotate(${-90 + slice.rotate}) ${
                    i === hoveredIndex ? "scale(1.05)" : ""
                }`}>
                <title>{`${slice.perc.toFixed(2)}%`}</title>
            </circle>
        {/each}
    </svg>

    <Container
        supplementalClass={"stats_online_summary"}
        crossAxisAlignment={"center"}
        direction={"vertical"}>
        <Container mainAxisAlignment={"center"} gap={"xs"}>
            <Body colour={"primary"} width={"hug"} fontWeight={"bold"}
                >{$minutesOnlineStore.minutesOnlineThisMonth.toLocaleString()}</Body>
            <Body width={"hug"} fontWeight={"bold"}>min</Body>
        </Container>
        <Body align={"center"}>
            <Translatable resourceKey={i18nKey("online this month")}></Translatable>
        </Body>
        <Container mainAxisAlignment={"center"} gap={"xs"}>
            <BodySmall colour={"textSecondary"} width={"hug"} fontWeight={"bold"}
                >{$minutesOnlineStore.minutesOnlineLastMonth.toLocaleString()}</BodySmall>
            <BodySmall colour={"textSecondary"} width={"hug"} fontWeight={"bold"}
                >previous month</BodySmall>
        </Container>
    </Container>

    <Container gap={"lg"}>
        <Container gap={"md"} direction={"vertical"}>
            {@render mediaStat(stats.textMessages, "stats.textMessages", "text")}
            {@render mediaStat(stats.videoMessages, "stats.videoMessages", "video")}
            {@render mediaStat(stats.fileMessages, "stats.fileMessages", "file")}
            {@render mediaStat(cryptoMessages, "stats.cryptoTransfers", "crypto")}
            {@render mediaStat(stats.pollVotes, "stats.pollVotes")}
            {@render mediaStat(stats.reactions, "stats.reactions")}
        </Container>
        <Container gap={"md"} direction={"vertical"}>
            {@render mediaStat(stats.imageMessages, "stats.imageMessages", "image")}
            {@render mediaStat(stats.audioMessages, "stats.audioMessages", "audio")}
            {@render mediaStat(stats.polls, "stats.pollMessages", "poll")}
            {@render mediaStat(stats.giphyMessages, "stats.giphyMessages", "giphy")}
            {@render mediaStat(stats.replies, "stats.replies")}
            {@render mediaStat(stats.deletedMessages, "stats.deletedMessages")}
        </Container>
    </Container>

    {#if showReported}
        <Container gap={"xs"} direction={"vertical"}>
            <Container crossAxisAlignment={"center"} gap={"xs"}>
                <Flag color={ColourVars.error} />
                <Subtitle width={"hug"} colour={"error"} fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("stats.reportedMessages")} />
                </Subtitle>
                <Subtitle width={"hug"} colour={"error"} fontWeight={"bold"}>
                    / {stats.reportedMessages.toLocaleString()}
                </Subtitle>
            </Container>
            <BodySmall colour={"textSecondary"} align={"start"}>
                <Translatable resourceKey={i18nKey("stats.reportedMessagesInfo")} />
            </BodySmall>
        </Container>
    {/if}
</Container>

<style lang="scss">
    :global(.container.stats_online_summary) {
        top: 90px; // might need to do better than this but it'll do for now
        left: 50%;
        transform: translateX(-50%);
        position: absolute;
    }

    $saturation: 80%;
    $lightness: 65%;

    $video-colour: #ed5ec9;
    $audio-colour: #a65eed;
    $image-colour: #5eeded;
    $file-colour: #edc95e;
    $text-colour: #5e82ed;
    $poll-colour: #5eed82;
    $crypto-colour: #a6ed5e;
    $giphy-colour: #ed5e5e;

    .legend {
        font-size: var(--typo-bodySmall-sz);
        line-height: var(--typo-bodySmall-lh);
    }

    .slice {
        fill: transparent;
        transform-origin: 50% 50%;
        stroke-width: 150px;
        cursor: pointer;
    }
    .pie {
        width: min(250px, 100%);
        margin-bottom: $sp5;
        &.rendered circle {
            transition: transform 200ms ease-in-out;
        }
    }

    .numbers {
        text-align: left;
        display: grid;
        grid-template-columns: 1fr 1fr;
        margin-bottom: $sp5;
        row-gap: $sp3;
    }

    .background {
        fill: transparent;
    }

    .key {
        width: toRem(12);
        height: toRem(12);
        flex: 0 0 toRem(12);
        border-radius: var(--rad-circle);
    }

    .text {
        stroke: $text-colour;
        color: $text-colour;
        &.key {
            background-color: $text-colour;
        }
    }

    .image {
        stroke: $image-colour;
        color: $image-colour;
        &.key {
            background-color: $image-colour;
        }
    }

    .video {
        stroke: $video-colour;
        color: $video-colour;
        &.key {
            background-color: $video-colour;
        }
    }

    .audio {
        stroke: $audio-colour;
        color: $audio-colour;
        &.key {
            background-color: $audio-colour;
        }
    }

    .file {
        stroke: $file-colour;
        color: $file-colour;
        &.key {
            background-color: $file-colour;
        }
    }

    .poll {
        stroke: $poll-colour;
        color: $poll-colour;
        &.key {
            background-color: $poll-colour;
        }
    }

    .crypto {
        stroke: $crypto-colour;
        color: $crypto-colour;
        &.key {
            background-color: $crypto-colour;
        }
    }

    .giphy {
        stroke: $giphy-colour;
        color: $giphy-colour;
        &.key {
            background-color: $giphy-colour;
        }
    }
</style>
