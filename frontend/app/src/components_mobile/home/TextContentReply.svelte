<script lang="ts">
    import { ChatCaption } from "component-lib";
    import type { TextContent } from "openchat-client";
    import { type Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import Markdown from "./Markdown.svelte";

    const SIZE_LIMIT = 200;

    interface Props {
        title: Snippet;
        content: TextContent;
        truncate?: boolean;
        pinned?: boolean;
        me: boolean;
        blockLevelMarkdown: boolean;
    }

    let {
        title,
        content,
        truncate = false,
        pinned = false,
        me,
        blockLevelMarkdown,
    }: Props = $props();

    function truncateText(text: string): string {
        // todo - we might be able to do something nicer than this with pure css, but we just need to do
        // *something* to make sure there a limit to the size of this box
        if (truncate && text.length > SIZE_LIMIT) {
            text = text.slice(0, SIZE_LIMIT) + "...";
        }
        return text;
    }

    let text = $derived(truncateText(content.text));
</script>

{@render title()}
<ChatCaption width={"hug"} colour={me ? "secondary" : "primaryLight"} maxLines={3}>
    <Markdown inline={!blockLevelMarkdown} suppressLinks={pinned} {text} />
</ChatCaption>
