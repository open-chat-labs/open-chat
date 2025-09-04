<script lang="ts">
    import type { Snippet } from "svelte";
    import Container from "../Container.svelte";
    import NotificationIndicator from "../NotificationIndicator.svelte";

    interface Props {
        selected?: boolean;
        indicator?: boolean;
        onSelect: () => void;
        icon: Snippet<[string]>;
    }

    let { indicator = false, selected = false, onSelect, icon }: Props = $props();

    let iconColour = $derived(selected ? "var(--primary)" : "var(--text-primary)");
</script>

<Container
    onClick={onSelect}
    borderWidth={"zero"}
    borderColour={"red"}
    borderStyle={"dashed"}
    crossAxisAlignment={"center"}
    mainAxisAlignment={"spaceBetween"}
    height={{ kind: "fill" }}
    direction={"vertical"}>
    <div class="selection" class:selected></div>
    <div class="bottom_bar_icon">
        {@render icon(iconColour)}
    </div>
    <div class="indicator">
        {#if indicator}
            <NotificationIndicator />
        {/if}
    </div>
</Container>

<style lang="scss">
    :global(.bottom_bar_icon svg) {
        width: var(--icon-lg);
        height: var(--icon-lg);
    }

    .selection {
        height: 4px;
        width: 100%;
        border-radius: var(--rad-sm);
        background-color: transparent;
        transition: background-color ease-in-out 300ms;
    }

    .selected {
        background-color: var(--primary);
    }

    .icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: var(--avatar-lg);
        height: var(--avatar-lg);
        border-radius: 50%;
    }

    .indicator {
        display: flex;
    }
</style>
