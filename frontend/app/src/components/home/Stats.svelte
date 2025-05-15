<script lang="ts">
    import type { Metrics, OpenChat } from "openchat-client";
    import { minutesOnlineStore } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import Flag from "svelte-material-icons/Flag.svelte";
    import { cubicOut } from "svelte/easing";
    import { Tween } from "svelte/motion";
    import { i18nKey } from "../../i18n/i18n";
    import Tooltip from "../tooltip/Tooltip.svelte";
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

<div class="message-stats">
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
    <div class="numbers">
        <div class="text legend">
            <div class="key"></div>
            <div class="label">
                <span class="stat">{stats.textMessages.toLocaleString()}</span><Translatable
                    resourceKey={i18nKey("stats.textMessages")} />
            </div>
        </div>
        <div class="image legend">
            <div class="key"></div>
            <div class="label">
                <span class="stat">{stats.imageMessages.toLocaleString()}</span><Translatable
                    resourceKey={i18nKey("stats.imageMessages")} />
            </div>
        </div>
        <div class="video legend">
            <div class="key"></div>
            <div class="label">
                <span class="stat">{stats.videoMessages.toLocaleString()}</span><Translatable
                    resourceKey={i18nKey("stats.videoMessages")} />
            </div>
        </div>
        <div class="audio legend">
            <div class="key"></div>
            <div class="label">
                <span class="stat">{stats.audioMessages.toLocaleString()}</span><Translatable
                    resourceKey={i18nKey("stats.audioMessages")} />
            </div>
        </div>
        <div class="file legend">
            <div class="key"></div>
            <div class="label">
                <span class="stat">{stats.fileMessages.toLocaleString()}</span><Translatable
                    resourceKey={i18nKey("stats.fileMessages")} />
            </div>
        </div>
        <div class="poll legend">
            <div class="key"></div>
            <div class="label">
                <span class="stat">{stats.polls.toLocaleString()}</span><Translatable
                    resourceKey={i18nKey("stats.pollMessages")} />
            </div>
        </div>
        <div class="crypto legend">
            <div class="key"></div>
            <div class="label">
                <span class="stat">{cryptoMessages.toLocaleString()}</span><Translatable
                    resourceKey={i18nKey("stats.cryptoTransfers")} />
            </div>
        </div>
        <div class="giphy legend">
            <div class="key"></div>
            <div class="label">
                <span class="stat">{stats.giphyMessages.toLocaleString()}</span><Translatable
                    resourceKey={i18nKey("stats.giphyMessages")} />
            </div>
        </div>
    </div>
</div>

<div class="other-stats">
    <div class="poll-votes">
        <span class="stat">{stats.pollVotes.toLocaleString()}</span>
        <Translatable resourceKey={i18nKey("stats.pollVotes")} />
    </div>
    <div class="replies">
        <span class="stat">{stats.replies.toLocaleString()}</span>
        <Translatable resourceKey={i18nKey("stats.replies")} />
    </div>
    <div class="reactions">
        <span class="stat">{stats.reactions.toLocaleString()}</span>
        <Translatable resourceKey={i18nKey("stats.reactions")} />
    </div>
    <div class="deleted-messages">
        <span class="stat">{stats.deletedMessages.toLocaleString()}</span>
        <Translatable resourceKey={i18nKey("stats.deletedMessages")} />
    </div>
    <div class="minutes-online">
        <span class="stat">{$minutesOnlineStore.minutesOnlineThisMonth.toLocaleString()}</span>
        <Translatable resourceKey={i18nKey("stats.minutesOnlineThisMonth")} />
    </div>
    <div class="minutes-online">
        <span class="stat">{$minutesOnlineStore.minutesOnlineLastMonth.toLocaleString()}</span>
        <Translatable resourceKey={i18nKey("stats.minutesOnlineLastMonth")} />
    </div>
    {#if showReported}
        <Tooltip longestWord={20} position={"top"} align="middle">
            <div class="reported-messages">
                <span>
                    <span class="stat">{stats.reportedMessages.toLocaleString()}</span>
                    <Translatable resourceKey={i18nKey("stats.reportedMessages")} />
                </span>
                <span class="icon">
                    <Flag size={$iconSize} color={"var(--accent)"} />
                </span>
            </div>
            {#snippet popupTemplate()}
                <Translatable resourceKey={i18nKey("stats.reportedMessagesInfo")} />
            {/snippet}
        </Tooltip>
    {/if}
</div>

<style lang="scss">
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

    .stat {
        color: var(--txt);
        @include font-size(fs-110);

        @include mobile() {
            @include font-size(fs-90);
        }
    }

    .other-stats {
        display: flex;
        gap: $sp4;
        margin-bottom: $sp4;
        flex-wrap: wrap;
        justify-content: space-between;

        color: var(--txt-light);
        @include font(book, normal, fs-80);

        @include mobile() {
            gap: 6px;
        }

        .reported-messages {
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: $sp3;
            color: var(--accent);

            .icon {
                position: relative;
                top: $sp2;
            }
        }
    }

    .message-stats {
        text-align: center;
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

    .legend {
        color: var(--txt-light);
        display: flex;
        justify-content: flex-start;
        align-items: center;
        gap: $sp3;

        .stat {
            margin-right: $sp3;
        }
        .key {
            width: $sp5;
            height: $sp5;
            flex: 0 0 $sp5;

            @include mobile() {
                width: $sp6;
                height: $sp6;
                flex: 0 0 $sp6;
            }
        }
        .label {
            flex: auto;

            @include mobile() {
                @include font-size(fs-90);

                display: flex;
                flex-direction: column;
            }
        }
    }

    .text {
        stroke: $text-colour;
        .key {
            background-color: $text-colour;
        }
    }

    .image {
        stroke: $image-colour;
        .key {
            background-color: $image-colour;
        }
    }

    .video {
        stroke: $video-colour;
        .key {
            background-color: $video-colour;
        }
    }

    .audio {
        stroke: $audio-colour;
        .key {
            background-color: $audio-colour;
        }
    }

    .file {
        stroke: $file-colour;
        .key {
            background-color: $file-colour;
        }
    }

    .poll {
        stroke: $poll-colour;
        .key {
            background-color: $poll-colour;
        }
    }

    .crypto {
        stroke: $crypto-colour;
        .key {
            background-color: $crypto-colour;
        }
    }

    .giphy {
        stroke: $giphy-colour;
        .key {
            background-color: $giphy-colour;
        }
    }
</style>
