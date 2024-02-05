<script lang="ts">
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import Markdown from "./Markdown.svelte";

    export let edited: boolean;
    export let reply: boolean = false;
    export let caption: string | undefined;
</script>

{#if caption !== undefined && caption !== ""}
    <Markdown text={caption} inline={!reply} />
    {#if edited}
        <span class="edited-msg">(<Translatable resourceKey={i18nKey("edited")} />)</span>
    {/if}
{/if}

<style lang="scss">
</style>
