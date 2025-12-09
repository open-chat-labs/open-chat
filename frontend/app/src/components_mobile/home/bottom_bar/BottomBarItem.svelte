<script module lang="ts">
    export type Unread = { show: boolean; muted: boolean; pulse?: boolean };
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
        indicator = { show: false, muted: false, pulse: false },
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
    overflow={"visible"}
    borderColour={"red"}
    borderStyle={"dashed"}
    crossAxisAlignment={"center"}
    mainAxisAlignment={"center"}
    height={"fill"}
    direction={"vertical"}>
    <div class="bottom_bar_icon">
        {@render icon(iconColour)}
    </div>
    <div class="indicator" class:pulse={indicator.show && indicator.pulse}>
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

        &.pulse {
            animation: pulse 3s infinite;
        }
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
