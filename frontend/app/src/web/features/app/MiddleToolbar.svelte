<!-- The middle's way out where no header has one (ConversationHeader's buttons): Back to the list
     on a narrow screen, and the details column's toggle where the route has the column. Over a
     placeholder, a screen loading or that failed to (RegionScreen), and the middle with nothing
     selected (NoChatScreen). -->
<script lang="ts">
    import IconButton from "@openchat/ui/src/lib/components/IconButton.svelte";
    import { navigate } from "@src/utils/navigation";
    import type { ScreenContext } from "./screens";

    let { context }: { context: ScreenContext } = $props();
</script>

<div class="toolbar">
    {#if context.narrow && context.back !== undefined}
        {@const back = context.back}
        <IconButton
            icon="back"
            variant="ghost"
            label="ui.common.back"
            onClick={() => navigate(back)}
        />
    {/if}
    <span class="gap"></span>
    {#if context.hasRightColumn}
        <IconButton
            icon="panel"
            variant="ghost"
            pressed={context.rightColumn.open}
            label={context.rightColumn.open
                ? "ui.conversationHeader.hidePanel"
                : "ui.conversationHeader.showPanel"}
            onClick={() => context.rightColumn.toggle()}
        />
    {/if}
</div>

<style lang="scss">
    .toolbar {
        position: absolute;
        inset-block-start: var(--space-12);
        inset-inline: var(--space-12);
        display: flex;
    }

    .gap {
        flex: 1;
    }
</style>
