<script lang="ts">
    import { rightPanelMode, setRightPanelHistory } from "openchat-client";
    import { rtlStore } from "../../stores/rtl";
    import Overlay from "../Overlay.svelte";
    import RightPanel from "./RightPanel.svelte";

    function closeRightPanel() {
        setRightPanelHistory([]);
    }

    function onclick(e: Event) {
        e.stopPropagation();
    }
</script>

{#if $rightPanelMode === "inline"}
    <RightPanel />
{/if}

{#if $rightPanelMode === "floating"}
    <Overlay onClose={closeRightPanel} dismissible>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div {onclick} class="right-wrapper" class:rtl={$rtlStore}>
            <RightPanel />
        </div>
    </Overlay>
{/if}

<style lang="scss">
    .right-wrapper {
        position: absolute;
        top: 0;
        height: 100%;
        &:not(.rtl) {
            right: 0;
        }
        &.rtl {
            left: 0;
        }
        @include z-index("right-panel");
        @include box-shadow(3);
        @include mobile() {
            width: 100%;
        }
    }
</style>
