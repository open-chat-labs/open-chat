<script lang="ts">
    import { _ } from "svelte-i18n";

    export let video = { muted: 0, unmuted: 0 };

    $: muted = video.unmuted <= 0;
    $: count = muted ? video.muted : video.unmuted;
</script>

{#if count > 0}
    <div class="video-call" class:muted></div>
{/if}

<style lang="scss">
    .video-call {
        $size: 23px;
        position: absolute;
        width: $size;
        height: $size;
        border-radius: 50%;
        position: absolute;
        left: -4px;
        bottom: -4px;
        background-image: url("/assets/video_call.svg");

        &.muted {
            background-image: url("/assets/video_call_ended.svg");
        }
    }
</style>
