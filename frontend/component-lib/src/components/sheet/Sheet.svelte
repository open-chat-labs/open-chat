<script lang="ts">
    import { ColourVars, Container } from "component-lib";
    import { type Snippet } from "svelte";
    import { expoInOut } from "svelte/easing";
    import { fade, fly } from "svelte/transition";

    interface Props {
        sheet: Snippet<[() => void]>;
        onClose: () => void;
    }
    let { sheet, onClose }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={onClose} transition:fade={{ duration: 300 }} class="sheet_overlay">
    <div transition:fly={{ duration: 300, easing: expoInOut, y: 2000 }}>
        <Container
            parentDirection={"vertical"}
            height={{ kind: "fixed", size: "100%" }}
            onClick={(e) => e?.stopPropagation()}
            background={ColourVars.background1}
            supplementalClass={"sheet_content"}
            borderRadius={["xl", "xl", "zero", "zero"]}
            direction={"vertical"}>
            {@render sheet(onClose)}
        </Container>
    </div>
</div>

<style lang="scss">
    .sheet_overlay {
        flex-direction: column;
        position: fixed;
        display: flex;
        justify-content: flex-end;
        top: 0;
        left: 0;
        height: 100vh;
        width: 100vw;
        overflow: hidden;
        z-index: 100;
        backdrop-filter: blur(4px);
        background: rgba(0, 0, 0, 0.5);
    }

    :global(.sheet_content) {
        max-height: 75vh;
    }
</style>
