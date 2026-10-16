<!-- The shell with placeholder content: the nav rail and empty columns, so the layout and its
     breakpoints can be checked before any data is wired. The router (phase 2) replaces it. -->
<script lang="ts">
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import IconButton from "@openchat/ui/src/lib/components/IconButton.svelte";
    import NavRail from "@openchat/ui/src/features/components/NavRail.svelte";
    import { RightColumnState } from "../../shell/rightColumn.svelte";
    import Shell from "../../shell/Shell.svelte";
    import { currentShellLayout } from "../../shell/viewport.svelte";

    const rightColumn = new RightColumnState();
    const mode = $derived(currentShellLayout().right);

    // TODO(phase 2): the rail's items and pins come from the stores and navigate
    const items = [{ icon: "messages" }, { icon: "heart" }, { icon: "bell" }, { icon: "wallet" }] as const;
</script>

<Shell rightOpen={rightColumn.isOpen(mode)} onCloseRight={() => rightColumn.setOpen(mode, false)}>
    {#snippet rail()}
        <NavRail items={[...items]} pins={[]} profileLabel="" profileHandle="" activeIndex={0} />
    {/snippet}
    {#snippet left()}
        <div class="placeholder">
            <EmptyState preset="no-conversations" actionLabel="" />
        </div>
    {/snippet}
    {#snippet middle()}
        <div class="placeholder">
            <!-- TODO(phase 3): ConversationHeader's panel toggle -->
            <div class="toggle">
                <IconButton
                    icon="panel"
                    variant="ghost"
                    pressed={rightColumn.isOpen(mode)}
                    label={rightColumn.isOpen(mode)
                        ? "ui.conversationHeader.hidePanel"
                        : "ui.conversationHeader.showPanel"}
                    onClick={() => rightColumn.toggle(mode)} />
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

    .toggle {
        position: absolute;
        inset-block-start: var(--space-12);
        inset-inline-end: var(--space-12);
    }
</style>
