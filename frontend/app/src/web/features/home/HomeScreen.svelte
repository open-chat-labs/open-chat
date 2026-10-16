<!-- The shell with placeholder content: the nav rail and empty columns, so the layout and its
     breakpoints can be checked before any data is wired. The router (phase 2) replaces it. -->
<script lang="ts">
    import NavRail from "@openchat/ui/src/features/components/NavRail.svelte";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import IconButton from "@openchat/ui/src/lib/components/IconButton.svelte";
    import type { ComponentProps } from "svelte";
    import { RightColumnState } from "../../shell/rightColumn.svelte";
    import Shell from "../../shell/Shell.svelte";
    import { currentShellLayout } from "../../shell/viewport.svelte";

    const layout = $derived(currentShellLayout());
    const rightColumn = new RightColumnState(() => layout.right);
    // TODO(phase 2): the router picks the column a narrow screen shows
    let narrowView = $state<"left" | "middle">("left");

    // TODO(phase 2): the rail's items and pins come from the stores and navigate
    const items: ComponentProps<typeof NavRail>["items"] = [
        { icon: "messages" },
        { icon: "heart" },
        { icon: "bell" },
        { icon: "wallet" },
    ];
</script>

<Shell
    {narrowView}
    rightOpen={rightColumn.open}
    onCloseRight={() => (rightColumn.open = false)}
    rightLabel="ui.panelCover.info">
    {#snippet rail()}
        <NavRail {items} pins={[]} profileLabel="" profileHandle="" activeIndex={0} />
    {/snippet}
    {#snippet left()}
        <div class="placeholder">
            <EmptyState preset="no-conversations" actionHandler={() => (narrowView = "middle")} />
        </div>
    {/snippet}
    {#snippet middle()}
        <div class="placeholder">
            <!-- TODO(phase 3): ConversationHeader's back button and panel toggle -->
            <div class="toolbar">
                {#if layout.narrow}
                    <IconButton
                        icon="back"
                        variant="ghost"
                        label="ui.common.back"
                        onClick={() => (narrowView = "left")} />
                {/if}
                <span class="gap"></span>
                <IconButton
                    icon="panel"
                    variant="ghost"
                    pressed={rightColumn.open}
                    label={rightColumn.open
                        ? "ui.conversationHeader.hidePanel"
                        : "ui.conversationHeader.showPanel"}
                    onClick={() => rightColumn.toggle()} />
            </div>
            <EmptyState preset="no-results" actionLabel="" />
        </div>
    {/snippet}
    {#snippet right()}
        <div class="placeholder">
            <EmptyState preset="no-members" actionLabel="" />
        </div>
    {/snippet}
</Shell>

<style>
    .placeholder {
        position: relative;
        display: grid;
        place-items: center;
        height: 100%;
    }

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
