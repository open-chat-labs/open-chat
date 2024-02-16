<script lang="ts">
    import type { VideoCallContent } from "openchat-client";

    export let content: VideoCallContent;
</script>

<div class="video-call">
    <h1>Video call with: {content.participants}</h1>
</div>

<style lang="scss">
</style>
