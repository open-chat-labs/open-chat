<script lang="ts">
    import { cubicOut } from "svelte/easing";
    import { tweened } from "svelte/motion";
    import { _ } from "svelte-i18n";
    import type { ChatMetrics } from "../../domain/chat/chat";
    import { onMount } from "svelte";

    export let stats: ChatMetrics;

    let hoveredIndex: number | undefined;
    let rendered = false;

    $: totalMessages =
        stats.textMessages +
        stats.imageMessages +
        stats.videoMessages +
        stats.audioMessages +
        stats.fileMessages +
        stats.polls +
        stats.icpMessages +
        stats.giphyMessages;
    $: textPerc = slice(stats.textMessages);
    $: imagePerc = slice(stats.imageMessages);
    $: videoPerc = slice(stats.videoMessages);
    $: audioPerc = slice(stats.audioMessages);
    $: filePerc = slice(stats.fileMessages);
    $: pollPerc = slice(stats.polls);
    $: icpPerc = slice(stats.icpMessages);
    $: giphyPerc = slice(stats.giphyMessages);

    function percToDegree(perc: number): number {
        return (perc / 100) * 360;
    }

    onMount(() => {
        setTimeout(() => (rendered = true), 600);
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
        $icpPerc,
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
            cls: "icp",
            perc: $icpPerc,
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
        <circle class="background" cx={160} cy={160} r={150} />

        {#each data as slice, i}
            <circle
                on:mouseenter={(e) => (hoveredIndex = i)}
                on:mouseleave={(e) => (hoveredIndex = undefined)}
                class={slice.cls}
                cx={160}
                cy={160}
                r={75}
                stroke-dasharray={`calc(${slice.perc} * ${circum} / 100) ${circum}`}
                transform={`rotate(${-90 + slice.rotate}) ${
                    i === hoveredIndex ? "scale(1.05)" : ""
                }`}>
                <title>{`${slice.perc.toFixed(2)}%`}</title>
            </circle>
        {/each}
    </svg>
    <div class="numbers">
        <div class="text legend">
            <span class="stat">{stats.textMessages}</span>
            {$_("stats.textMessages")}
        </div>
        <div class="image legend">
            <span class="stat">{stats.imageMessages}</span>
            {$_("stats.imageMessages")}
        </div>
        <div class="video legend">
            <span class="stat">{stats.videoMessages}</span>
            {$_("stats.videoMessages")}
        </div>
        <div class="audio legend">
            <span class="stat">{stats.audioMessages}</span>
            {$_("stats.audioMessages")}
        </div>
        <div class="file legend">
            <span class="stat">{stats.fileMessages}</span>
            {$_("stats.fileMessages")}
        </div>
        <div class="poll legend">
            <span class="stat">{stats.polls}</span>
            {$_("stats.pollMessages")}
        </div>
        <div class="icp legend">
            <span class="stat">{stats.icpMessages}</span>
            {$_("stats.icpTransfers")}
        </div>
        <div class="giphy legend">
            <span class="stat">{stats.giphyMessages}</span>
            {$_("stats.giphyMessages")}
        </div>
    </div>
</div>

<div class="other-stats">
    <div class="poll-votes">
        <span class="stat">📊 {stats.pollVotes}</span>
        {$_("stats.pollVotes")}
    </div>
    <div class="replies">
        <span class="stat">↩️ {stats.replies}</span>
        {$_("stats.replies")}
    </div>
    <div class="reactions">
        <span class="stat">🍿 {stats.reactions}</span>
        {$_("stats.reactions")}
    </div>
    <div class="deleted-messages">
        <span class="stat">🗑️ {stats.deletedMessages}</span>
        {$_("stats.deletedMessages")}
    </div>
</div>

<style type="text/scss">
    $saturation: 80%;
    $lightness: 65%;

    $video-colour: hsl(calc(360 / 8), $saturation, $lightness);
    $audio-colour: hsl(calc(360 / 8 * 2), $saturation, $lightness);
    $image-colour: hsl(calc(360 / 8 * 3), $saturation, $lightness);
    $file-colour: hsl(calc(360 / 8 * 4), $saturation, $lightness);
    $text-colour: hsl(calc(360 / 8 * 5), $saturation, $lightness);
    $poll-colour: hsl(calc(360 / 8 * 6), $saturation, $lightness);
    $icp-colour: hsl(calc(360 / 8 * 7), $saturation, $lightness);
    $giphy-colour: hsl(calc(360 / 8 * 8), $saturation, $lightness);

    .stat {
        @include font(book, italic, fs-100);
        @include mobile() {
            @include font-size(fs-90);
        }
    }

    .other-stats {
        display: flex;
        gap: $sp4;
        margin-bottom: $sp4;
        flex-wrap: wrap;
        justify-content: center;

        @include font(book, normal, fs-110);

        @include mobile() {
            @include font-size(fs-100);
        }

        .stat {
            @include font-size(fs-120);
        }
    }

    .message-stats {
        display: flex;
        gap: $sp5;
        align-items: center;
        justify-content: space-between;
        min-width: 80%;
        margin-bottom: $sp4;
    }

    circle {
        fill: transparent;
        transform-origin: 50% 50%;
        stroke-width: 150px;
        cursor: pointer;
    }

    .pie {
        flex: auto;

        &.rendered circle {
            transition: transform 200ms ease-in-out;
        }
    }

    .numbers {
        text-align: left;
        flex: 0 0 50%;
    }

    .background {
        fill: transparent;
    }

    .legend {
        padding: 0 $sp3;
        margin-bottom: $sp2;
        border-left-width: 6px;
        border-left-style: solid;
        @include font-size(fs-80);

        @include mobile() {
            margin-bottom: $sp2;
        }
    }

    .text {
        stroke: $text-colour;
        border-left-color: $text-colour;
    }

    .image {
        stroke: $image-colour;
        border-left-color: $image-colour;
    }

    .video {
        stroke: $video-colour;
        border-left-color: $video-colour;
    }

    .audio {
        stroke: $audio-colour;
        border-left-color: $audio-colour;
    }

    .file {
        stroke: $file-colour;
        border-left-color: $file-colour;
    }

    .poll {
        stroke: $poll-colour;
        border-left-color: $poll-colour;
    }

    .icp {
        stroke: $icp-colour;
        border-left-color: $icp-colour;
    }

    .giphy {
        stroke: $giphy-colour;
        border-left-color: $giphy-colour;
    }
</style>
