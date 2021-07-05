<script lang="ts">
    import MessagePlus from "svelte-material-icons/MessagePlus.svelte";
    import { createEventDispatcher } from "svelte";
    import { rtlStore } from "../../stores/rtl";
    const dispatch = createEventDispatcher();

    function newChat() {
        dispatch("newchat");
    }
</script>

<div class="new-chat" on:click={newChat} class:rtl={$rtlStore}>
    <MessagePlus size={"1.2em"} color={"#fff"} />
</div>

<style type="text/scss">
    @import "../../styles/mixins";

    .new-chat {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: var(--button-bg);
        position: absolute;
        bottom: 30px;
        right: 30px;

        &.rtl {
            left: 30px;
            right: unset;
        }
    }
</style>
