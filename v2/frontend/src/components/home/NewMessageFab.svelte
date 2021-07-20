<script lang="ts">
    import MessagePlus from "svelte-material-icons/MessagePlus.svelte";
    import Fab from "../Fab.svelte";
    import { createEventDispatcher } from "svelte";
    import { rtlStore } from "../../stores/rtl";
    const dispatch = createEventDispatcher();

    function newChat() {
        dispatch("newchat");
    }
</script>

<div class="new-chat" on:click={newChat} class:rtl={$rtlStore}>
    <Fab on:click={newChat}>
        <MessagePlus size={"1.2em"} color={"#fff"} />
    </Fab>
</div>

<style type="text/scss">
    .new-chat {
        position: absolute;
        bottom: $sp6;
        right: $sp6;

        &.rtl {
            left: $sp6;
            right: unset;
        }
    }
</style>
