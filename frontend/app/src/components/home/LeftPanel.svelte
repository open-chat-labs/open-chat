<script lang="ts">
    import { activityFeedShowing, showLeft, showNav } from "openchat-client";
    import { rtlStore } from "../../stores/rtl";
    import { currentTheme } from "../../theme/themes";
    import ActivityFeed from "./activity/ActivityFeed.svelte";
    import ChatList from "./ChatList.svelte";
</script>

<section
    class:visible={$showLeft}
    class:offset={$showNav}
    class:rtl={$rtlStore}
    class:halloween={$currentTheme.name === "halloween"}>
    <div class="chat-list">
        {#if $activityFeedShowing}
            <ActivityFeed />
        {:else}
            <ChatList />
        {/if}
    </div>
</section>

<style lang="scss">
    .chat-list {
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    section {
        overflow: auto;
        overflow-x: hidden;
        max-width: 500px;
        min-width: 300px;
        flex: 7;
        position: relative;
        border-right: var(--bw) solid var(--bd);
        background: var(--panel-left-bg);

        &.offset {
            margin-inline-start: toRem(80);
            @include mobile() {
                margin-inline-start: toRem(60);
            }
        }

        &.rtl {
            border-right: none;
            border-left: var(--bw) solid var(--bd);
        }

        @include mobile() {
            width: 100%;
            max-width: unset;
            min-width: unset;
            padding: 0;
            flex: auto;
            border-right: none;
        }

        &.halloween::after {
            @include cobweb();
            bottom: 0;
            right: 0;
            transform: scaleY(-1);
        }

        &:not(.visible) {
            display: none;
        }
    }
</style>
