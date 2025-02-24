<script lang="ts">
    import type { BotRenderedContent } from "openchat-client";

    interface Props {
        content: BotRenderedContent;
    }

    let { content }: Props = $props();
</script>

<iframe src={content.endpoint} />

<style lang="scss">
</style>
