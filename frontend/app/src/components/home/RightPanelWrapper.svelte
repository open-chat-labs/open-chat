<script lang="ts">
    import { layoutStore } from "../../stores/layout";
    import { rtlStore } from "../../stores/rtl";
    import { rightPanelHistory } from "../../stores/rightPanel";
    import { removeQueryStringParam } from "../../utils/urls";
    import Overlay from "../Overlay.svelte";
    import RightPanel from "./RightPanel.svelte";
    import { pageReplace } from "../../routes";

    function closeRightPanel() {
        if ($rightPanelHistory.find((panel) => panel.kind === "message_thread_panel")) {
            pageReplace(removeQueryStringParam("open"));
        }
        rightPanelHistory.set([]);
    }
</script>

{#if $layoutStore.rightPanel === "inline"}
    <RightPanel
        on:goToMessageIndex
        on:replyPrivatelyTo
        on:showInviteGroupUsers
        on:showGroupMembers
        on:chatWith
        on:upgrade
        on:verifyHumanity
        on:claimDailyChit
        on:deleteGroup
        on:editGroup
        on:editCommunity
        on:deleteCommunity
        on:newChannel
        on:groupCreated />
{/if}

{#if $layoutStore.rightPanel === "floating"}
    <Overlay onClose={closeRightPanel} dismissible>
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div on:click|stopPropagation class="right-wrapper" class:rtl={$rtlStore}>
            <RightPanel
                on:goToMessageIndex
                on:replyPrivatelyTo
                on:showInviteGroupUsers
                on:showGroupMembers
                on:chatWith
                on:upgrade
                on:verifyHumanity
                on:deleteGroup
                on:editGroup
                on:editCommunity
                on:deleteCommunity
                on:newChannel
                on:groupCreated />
        </div>
    </Overlay>
{/if}

<style lang="scss">
    .right-wrapper {
        position: absolute;
        top: 0;
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
            height: 100%;
        }
    }
</style>
