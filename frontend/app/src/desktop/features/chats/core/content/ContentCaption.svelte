<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import Translatable from "@src/ui/Translatable.svelte";
    import Markdown from "@src/ui/Markdown.svelte";

    interface Props {
        edited: boolean;
        caption: string | undefined;
        blockLevelMarkdown?: boolean;
    }

    let { edited, caption, blockLevelMarkdown = false }: Props = $props();
</script>

{#if caption !== undefined && caption !== ""}
    <Markdown text={caption} inline={!blockLevelMarkdown} />
    {#if edited}
        <span class="edited-msg">(<Translatable resourceKey={i18nKey("edited")} />)</span>
    {/if}
{/if}
