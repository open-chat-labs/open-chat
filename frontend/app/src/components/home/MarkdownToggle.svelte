<script lang="ts">
    import MarkdownOutline from "svelte-material-icons/LanguageMarkdownOutline.svelte";
    import Markdown from "svelte-material-icons/LanguageMarkdown.svelte";
    import { iconSize } from "../../stores/iconSize";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import TooltipPopup from "../TooltipPopup.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";

    let on = false;
</script>

<div class="toggle">
    <TooltipWrapper position={"top"} align={"middle"}>
        <div on:click={() => (on = !on)} slot="target">
            {#if on}
                <Markdown size={$iconSize} color={"var(--icon-txt)"} />
            {:else}
                <MarkdownOutline size={$iconSize} color={"var(--icon-txt)"} />
            {/if}
        </div>
        <div let:position let:align slot="tooltip">
            <TooltipPopup {position} {align}>
                <Translatable resourceKey={i18nKey("Toggle markdown")} />
            </TooltipPopup>
        </div>
    </TooltipWrapper>
</div>

<style lang="scss">
    .toggle {
        cursor: pointer;
        position: absolute;
        right: 12px;
        top: 12px;
    }
</style>
