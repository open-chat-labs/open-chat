<script lang="ts">
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import Markdown from "./Markdown.svelte";

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
