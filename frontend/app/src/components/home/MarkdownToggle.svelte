<script lang="ts">
    import MarkdownOutline from "svelte-material-icons/LanguageMarkdownOutline.svelte";
    import Markdown from "svelte-material-icons/LanguageMarkdown.svelte";
    import { iconSize } from "../../stores/iconSize";
    import Tooltip from "../tooltip/Tooltip.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { useBlockLevelMarkdown } from "../../stores/settings";
    import type { EventWrapper, Message } from "openchat-client";

    interface Props {
        editingEvent: EventWrapper<Message> | undefined;
    }

    let { editingEvent }: Props = $props();

    let enabled = $state(
        editingEvent === undefined ? $useBlockLevelMarkdown : editingEvent.event.blockLevelMarkdown,
    );

    function toggle() {
        enabled = !enabled;
        useBlockLevelMarkdown.set(enabled);
    }
</script>

<div class="toggle">
    <Tooltip position={"top"} align={"middle"}>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div onclick={toggle}>
            {#if enabled}
                <Markdown size={$iconSize} color={"var(--icon-txt)"} />
            {:else}
                <MarkdownOutline size={$iconSize} color={"var(--icon-txt)"} />
            {/if}
        </div>
        {#snippet popupTemplate()}
            <Translatable resourceKey={i18nKey("toggleBlockMarkdown")} />
        {/snippet}
    </Tooltip>
</div>

<style lang="scss">
    .toggle {
        cursor: pointer;
        position: absolute;
        right: 12px;
        top: 12px;
    }
</style>
