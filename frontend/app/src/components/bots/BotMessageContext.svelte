<script lang="ts">
    import type { BotMessageContext } from "openchat-client";
    import Markdown from "../home/Markdown.svelte";

    interface Props {
        botContext: BotMessageContext;
    }

    let { botContext }: Props = $props();

    let text = $derived(
        `@UserId(${botContext.initiator}) executed command ${botContext.commandText}`,
    );
</script>

<div class="bot-context">
    <Markdown {text} />
</div>

<style lang="scss">
    .bot-context {
        @include font(light, normal, fs-80);
        margin-bottom: $sp4;
    }
</style>
