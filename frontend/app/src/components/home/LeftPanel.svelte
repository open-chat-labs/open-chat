<script lang="ts">
    import ChatList from "./ChatList.svelte";
    import { rtlStore } from "../../stores/rtl";
    import { currentTheme } from "../../theme/themes";
    import { layoutStore } from "../../stores/layout";
    import { activityFeedShowing } from "../../stores/activity";
    import ActivityFeed from "./activity/ActivityFeed.svelte";
</script>

<section
    class:offset={$layoutStore.showNav}
    class:rtl={$rtlStore}
    class:halloween={$currentTheme.name === "halloween"}>
    <div class="chat-list">
        {#if $activityFeedShowing}
            <ActivityFeed />
        {:else}
            <ChatList
                on:chatWith
                on:halloffame
                on:newGroup
                on:profile
                on:logout
                on:unarchiveChat
                on:wallet
                on:upgrade
                on:toggleMuteNotifications
                on:communityDetails
                on:leaveCommunity
                on:deleteCommunity
                on:editCommunity
                on:leaveGroup
                on:askToSpeak
                on:hangup
                on:newChannel />
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
    }
</style>
