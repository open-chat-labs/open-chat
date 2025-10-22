<script lang="ts">
    import { Body } from "component-lib";
    import Markdown from "./Markdown.svelte";

    interface Props {
        edited: boolean;
        caption: string | undefined;
        blockLevelMarkdown?: boolean;
    }

    let { caption, blockLevelMarkdown = false }: Props = $props();
</script>

{#if caption !== undefined && caption !== ""}
    <Body>
        <Markdown text={caption} inline={!blockLevelMarkdown} />
    </Body>
{/if}
