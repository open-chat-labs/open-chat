<script lang="ts">
    import { Container, NotificationIndicator } from "component-lib";
    import type { Snippet } from "svelte";

    interface Props {
        selected?: boolean;
        indicator?: boolean;
        onSelect: () => void;
        icon: Snippet<[string]>;
    }

    let { indicator = false, selected = false, onSelect, icon }: Props = $props();

    let iconColour = $derived(selected ? "var(--primary)" : "var(--text-primary)");
</script>

<!-- Semantically it would be better if this were a button but we also want it to behave like a Container which is ... interesting -->
<Container
    onClick={onSelect}
    borderWidth={"zero"}
    borderColour={"red"}
    borderStyle={"dashed"}
    crossAxisAlignment={"center"}
    mainAxisAlignment={"spaceBetween"}
    height={{ kind: "fill" }}
    direction={"vertical"}>
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

    .indicator {
        display: flex;
    }
</style>
