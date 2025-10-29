<script module lang="ts">
    export type Unread = { show: boolean; muted: boolean };
</script>

<script lang="ts">
    import { Container, NotificationIndicator } from "component-lib";
    import type { Snippet } from "svelte";

    interface Props {
        selected?: boolean;
        indicator?: Unread;
        onSelect: () => void;
        icon: Snippet<[string]>;
    }

    let {
        indicator = { show: false, muted: false },
        selected = false,
        onSelect,
        icon,
    }: Props = $props();

    let iconColour = $derived(selected ? "var(--primary)" : "var(--text-primary)");
</script>

<!-- Semantically it would be better if this were a button but we also want it to behave like a Container which is ... interesting -->
<Container
    onClick={onSelect}
    borderWidth={"zero"}
    allowOverflow
    borderColour={"red"}
    borderStyle={"dashed"}
    crossAxisAlignment={"center"}
    mainAxisAlignment={"center"}
    height={{ kind: "fill" }}
    direction={"vertical"}>
    <div class="bottom_bar_icon">
        {@render icon(iconColour)}
    </div>
    <div class="indicator">
        {#if indicator.show}
            <NotificationIndicator muted={indicator.muted} />
        {/if}
    </div>
</Container>

<style lang="scss">
    .bottom_bar_icon {
        display: flex;
    }

    .indicator {
        position: absolute;
        display: flex;
        bottom: -0.75rem;
    }
</style>
