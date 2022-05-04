<svelte:options immutable={false} />

<script lang="ts">
    import Markdown from "./Markdown.svelte";
    import { translationStore } from "../../stores/translation";
    import { _ } from "svelte-i18n";
    import type { TextContent } from "../../domain/chat/chat";

    const SIZE_LIMIT = 1000;
    export let content: TextContent;
    export let truncate: boolean = false;
    export let pinned: boolean = false;
    export let messageId: bigint;

    function truncateText(text: string): string {
        // todo - we might be able to do something nicer than this with pure css, but we just need to do
        // *something* to make sure there a limit to the size of this box
        if (truncate && text.length > SIZE_LIMIT) {
            text = text.slice(0, SIZE_LIMIT) + "...";
        }

        return text;
    }

    $: textContent =
        content.kind === "text_content" ? $translationStore[Number(messageId)] ?? content.text : "";
</script>

<Markdown suppressLinks={pinned} text={truncateText(textContent)} />
