<script lang="ts">
    import { OpenChat, pageReplace, rightPanelHistory, rightPanelMode } from "openchat-client";
    import { getContext } from "svelte";
    import { rtlStore } from "../../stores/rtl";
    import { removeQueryStringParam } from "../../utils/urls";
    import Overlay from "../Overlay.svelte";
    import RightPanel from "./RightPanel.svelte";

    const client = getContext<OpenChat>("client");

    function closeRightPanel() {
        if (client.rightPanelContains("message_thread_panel")) {
            pageReplace(removeQueryStringParam("open"));
        }
        rightPanelHistory.set([]);
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
