<script lang="ts">
    import { pageReplace, ui } from "openchat-client";
    import { rtlStore } from "../../stores/rtl";
    import { removeQueryStringParam } from "../../utils/urls";
    import Overlay from "../Overlay.svelte";
    import RightPanel from "./RightPanel.svelte";

    interface Props {
        onGoToMessageIndex: (details: { index: number; preserveFocus: boolean }) => void;
    }
    let { onGoToMessageIndex }: Props = $props();

    function closeRightPanel() {
        if (ui.rightPanelContains("message_thread_panel")) {
            pageReplace(removeQueryStringParam("open"));
        }
        ui.rightPanelHistory = [];
    }

    function onclick(e: Event) {
        e.stopPropagation();
    }
</script>

{#if ui.rightPanelMode === "inline"}
    <RightPanel {onGoToMessageIndex} />
{/if}

{#if ui.rightPanelMode === "floating"}
    <Overlay onClose={closeRightPanel} dismissible>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div {onclick} class="right-wrapper" class:rtl={$rtlStore}>
            <RightPanel {onGoToMessageIndex} />
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
