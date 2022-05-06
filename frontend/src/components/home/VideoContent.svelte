<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import type { VideoContent } from "../../domain/chat/chat";
    import { addEditedSuffix } from "../../domain/chat/chat.utils";
    import Markdown from "./Markdown.svelte";

    export let content: VideoContent;
    export let fill: boolean;
    export let draft: boolean = false;
    export let reply: boolean = false;
    export let height: number | undefined = undefined;
    export let edited: boolean;

    let withCaption = content.caption !== undefined && content.caption !== "";
    let landscape = content.height < content.width;
</script>

<div class="video" class:reply class:rtl={$rtlStore}>
    <video
        preload="none"
        poster={content.imageData.blobUrl}
        class:landscape
        class:fill
        class:withCaption
        class:draft
        class:reply
        style={height === undefined ? undefined : `height: ${height}px`}
        controls>
        <track kind="captions" />
        {#if content.videoData.blobUrl}
            <source src={content.videoData.blobUrl} />
        {/if}
    </video>
</div>

{#if content.caption !== undefined || content.caption === ""}
    <Markdown text={addEditedSuffix(content.caption, edited)} inline={!reply} />
{/if}

<style type="text/scss">
    .video {
        position: relative;
        cursor: pointer;

        &.reply {
            float: right;
            margin-left: $sp3;
            margin-right: 0;
        }

        &.rtl.reply {
            float: left;
            margin-left: 0;
            margin-right: $sp3;
        }

        video {
            width: 100%;
            display: block;

            &:not(.landscape) {
                min-height: 90px;
                min-width: 0px;
            }

            &:not(.fill) {
                border-radius: $sp4;
            }

            &.withCaption {
                margin-bottom: $sp2;
            }

            &.draft {
                max-width: calc(var(--vh, 1vh) * 50);
                max-height: none;
                height: auto;
            }

            &:not(.landscape).draft {
                max-width: none;
                max-height: calc(var(--vh, 1vh) * 50);
                width: auto;
                height: 100%;
            }

            &.reply {
                max-width: 90px;
                max-height: none;
                height: auto;
            }

            &:not(.landscape).reply {
                max-width: none;
                max-height: 90px;
                width: auto;
            }
        }
    }
</style>
