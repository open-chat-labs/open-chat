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

    // onMount(() => {
    //     setTimeout(() => {
    //         document.addEventListener("click", onClose, { once: true });
    //     }, 100);
    // });

    function internalClose() {
        // document.removeEventListener("click", onClose);
        onClose();
    }
</script>

<div onclick={onClose} transition:fade={{ duration: 300 }} class="sheet_overlay">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div transition:fly={{ duration: 300, easing: expoInOut, y: 2000 }} class="sheet_content">
        <Container
            parentDirection={"vertical"}
            height={{ kind: "fixed", size: "100%" }}
            onClick={(e) => e?.stopPropagation()}
            background={ColourVars.background2}
            supplementalClass={"sheet_content"}
            borderRadius={["xl", "xl", "zero", "zero"]}
            direction={"vertical"}>
            {@render sheet(internalClose)}
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

    .sheet_content {
        display: flex;
        flex-direction: column;
        max-height: 75vh;
    }
</style>
