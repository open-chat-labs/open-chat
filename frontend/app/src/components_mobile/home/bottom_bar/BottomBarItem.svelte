<script module lang="ts">
    export type Unread = { show: boolean; muted: boolean; pulse?: boolean };
</script>

<script lang="ts">
    import { Container, NotificationIndicator } from "component-lib";
    import type { Snippet } from "svelte";

    interface Props {
        selected?: boolean;
        indicator: boolean;
        onSelect: () => void;
        icon: Snippet<[string]>;
    }

    let { indicator, selected = false, onSelect, icon }: Props = $props();

    let iconColour = $derived(selected ? "var(--primary)" : "var(--text-primary)");
</script>

<!-- Semantically it would be better if this were a button but we also want it to behave like a Container which is ... interesting -->
<Container
    onClick={onSelect}
    borderWidth={"zero"}
    overflow={"visible"}
    borderColour={"red"}
    borderStyle={"dashed"}
    crossAxisAlignment={"center"}
    mainAxisAlignment={"center"}
    height={{ size: "3.5rem" }}
    direction={"vertical"}>
    <div class="bottom_bar_icon">
        {@render icon(iconColour)}
    </div>
    {#if indicator}
        <div class="indicator">
            <NotificationIndicator />
        </div>
    {/if}
</Container>

<style lang="scss">
    .bottom_bar_icon {
        display: flex;
    }

    .indicator {
        position: absolute;
        display: flex;
        bottom: -0.3rem;
    }

    @keyframes pulse {
        0% {
            scale: 1;
        }
        50% {
            scale: 1.2;
        }
        100% {
            scale: 1;
        }
    }
</style>
