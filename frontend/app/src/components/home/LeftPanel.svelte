<script lang="ts">
    import Panel from "../Panel.svelte";
    import ChatList from "./ChatList.svelte";
</script>

<Panel left>
    <div class="chat-list">
        <ChatList
            on:loadMessage
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
            on:newChannel />
    </div>
</Panel>

<style lang="scss">
    .chat-list {
        display: flex;
        flex-direction: column;
        height: 100%;
    }
</style>
