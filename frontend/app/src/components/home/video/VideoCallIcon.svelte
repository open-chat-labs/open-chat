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
        $size: $avatar-mod;
        $offset: $avatar-mod-offset;
        width: $size;
        height: $size;
        left: $offset;
        bottom: $offset;
        position: absolute;
        border-radius: 50%;
        background-image: url("/assets/video_call.svg");

        &.muted {
            background-image: url("/assets/video_call_ended.svg");
        }

        @include mobile() {
            $size: $avatar-mod-small;
            $offset: $avatar-mod-offset-small;
            width: $size;
            height: $size;
            left: $offset;
        }
    }
</style>
