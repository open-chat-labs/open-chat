<script lang="ts">
    import Markdown from "./Markdown.svelte";
    import { _ } from "svelte-i18n";

    export let edited: boolean;
    export let reply: boolean = false;
    export let caption: string | undefined;
</script>

{#if caption !== undefined && caption !== ""}
    <Markdown text={caption} inline={!reply} />
    {#if edited}
        <span class="edited-msg">({$_("edited")})</span>
    {/if}
{/if}

<style lang="scss">
</style>
