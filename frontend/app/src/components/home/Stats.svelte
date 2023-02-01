<script lang="ts">
    import { cubicOut } from "svelte/easing";
    import Flag from "svelte-material-icons/Flag.svelte";
    import { tweened } from "svelte/motion";
    import { _ } from "svelte-i18n";
    import type { ChatMetrics, OpenChat } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { writable } from "svelte/store";
    import { iconSize } from "stores/iconSize";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import TooltipPopup from "../TooltipPopup.svelte";

    const client = getContext<OpenChat>("client");
    export let stats: ChatMetrics;
    export let showReported: boolean = false;

    let hoveredIndex: number | undefined;
    let rendered = false;
    let previousStats: ChatMetrics | undefined = undefined;
    let totalMessages = 0;
    let textPerc = writable(12.5);
    let imagePerc = writable(12.5);
    let videoPerc = writable(12.5);
    let audioPerc = writable(12.5);
    let filePerc = writable(12.5);
    let pollPerc = writable(12.5);
    let cryptoPerc = writable(12.5);
    let giphyPerc = writable(12.5);

    $: cryptoMessages = stats.icpMessages + stats.sns1Messages + stats.ckbtcMessages;

    $: {
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

            textPerc = slice(stats.textMessages);
            imagePerc = slice(stats.imageMessages);
            videoPerc = slice(stats.videoMessages);
            audioPerc = slice(stats.audioMessages);
            filePerc = slice(stats.fileMessages);
            pollPerc = slice(stats.polls);
            cryptoPerc = slice(cryptoMessages);
            giphyPerc = slice(stats.giphyMessages);
            previousStats = stats;
        }
    }

    function percToDegree(perc: number): number {
        return (perc / 100) * 360;
    }

    onMount(() => {
        window.setTimeout(() => (rendered = true), 600);
    });

    function slice(val: number) {
        const perc = totalMessages > 0 ? (val / totalMessages) * 100 : 12.5;
        const tween = tweened(0, {
            duration: 600,
            easing: cubicOut,
        });
        tween.set(perc);
        return tween;
    }

    const circum = 471.24;

    $: percentages = [
        $textPerc,
        $imagePerc,
        $videoPerc,
        $audioPerc,
        $filePerc,
        $pollPerc,
        $cryptoPerc,
        $giphyPerc,
    ];

    function sumSlice(from: number, to: number): number {
        return percentages.slice(from, to).reduce((total, n) => total + percToDegree(n), 0);
    }

    $: data = [
        {
            cls: "text",
            perc: $textPerc,
            rotate: 0,
        },
        {
            cls: "image",
            perc: $imagePerc,
            rotate: sumSlice(0, 1),
        },
        {
            cls: "video",
            perc: $videoPerc,
            rotate: sumSlice(0, 2),
        },
        {
            cls: "audio",
            perc: $audioPerc,
            rotate: sumSlice(0, 3),
        },
        {
            cls: "file",
            perc: $filePerc,
            rotate: sumSlice(0, 4),
        },
        {
            cls: "poll",
            perc: $pollPerc,
            rotate: sumSlice(0, 5),
        },
        {
            cls: "crypto",
            perc: $cryptoPerc,
            rotate: sumSlice(0, 6),
        },
        {
            cls: "giphy",
            perc: $giphyPerc,
            rotate: sumSlice(0, 7),
        },
    ];
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
                on:mouseenter={(_) => (hoveredIndex = i)}
                on:mouseleave={(_) => (hoveredIndex = undefined)}
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
            <div class="key" />
            <div class="label">
                <span class="stat">{stats.textMessages.toLocaleString()}</span>{$_(
                    "stats.textMessages"
                )}
            </div>
        </div>
        <div class="image legend">
            <div class="key" />
            <div class="label">
                <span class="stat">{stats.imageMessages.toLocaleString()}</span>{$_(
                    "stats.imageMessages"
                )}
            </div>
        </div>
        <div class="video legend">
            <div class="key" />
            <div class="label">
                <span class="stat">{stats.videoMessages.toLocaleString()}</span>{$_(
                    "stats.videoMessages"
                )}
            </div>
        </div>
        <div class="audio legend">
            <div class="key" />
            <div class="label">
                <span class="stat">{stats.audioMessages.toLocaleString()}</span>{$_(
                    "stats.audioMessages"
                )}
            </div>
        </div>
        <div class="file legend">
            <div class="key" />
            <div class="label">
                <span class="stat">{stats.fileMessages.toLocaleString()}</span>{$_(
                    "stats.fileMessages"
                )}
            </div>
        </div>
        <div class="poll legend">
            <div class="key" />
            <div class="label">
                <span class="stat">{stats.polls.toLocaleString()}</span>{$_("stats.pollMessages")}
            </div>
        </div>
        <div class="crypto legend">
            <div class="key" />
            <div class="label">
                <span class="stat">{cryptoMessages.toLocaleString()}</span>{$_(
                    "stats.cryptoTransfers"
                )}
            </div>
        </div>
        <div class="giphy legend">
            <div class="key" />
            <div class="label">
                <span class="stat">{stats.giphyMessages.toLocaleString()}</span>{$_(
                    "stats.giphyMessages"
                )}
            </div>
        </div>
    </div>
</div>

<div class="other-stats">
    <div class="poll-votes">
        <span class="stat">{stats.pollVotes.toLocaleString()}</span>
        {$_("stats.pollVotes")}
    </div>
    <div class="replies">
        <span class="stat">{stats.replies.toLocaleString()}</span>
        {$_("stats.replies")}
    </div>
    <div class="reactions">
        <span class="stat">{stats.reactions.toLocaleString()}</span>
        {$_("stats.reactions")}
    </div>
    <div class="deleted-messages">
        <span class="stat">{stats.deletedMessages.toLocaleString()}</span>
        {$_("stats.deletedMessages")}
    </div>
    {#if showReported}
        <TooltipWrapper alignRight={true} bottomOffset={-4} centreChevron={false}>
            <div slot="target" class="reported-messages">
                <span>
                    <span class="stat">{stats.reportedMessages.toLocaleString()}</span>
                    {$_("stats.reportedMessages")}
                </span>
                <span class="icon">
                    <Flag size={$iconSize} color={"var(--accent)"} />
                </span>
            </div>
            <div slot="tooltip">
                <TooltipPopup alignRight={true} textLength={100} longestWord={20}>
                    <div>
                        {$_("stats.reportedMessagesInfo")}
                    </div>
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {/if}
</div>

<style type="text/scss">
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
