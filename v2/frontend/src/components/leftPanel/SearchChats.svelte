<script lang="ts">
    import Magnify from "svelte-material-icons/Magnify.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();
    let filter = "";

    function performSearch() {
        dispatch("filter", filter);
    }
    function clearSearch() {
        filter = "";
        performSearch();
    }
</script>

<form on:submit|preventDefault={performSearch} class="wrapper">
    <span class="icon"><Magnify color={"#ccc"} /></span>
    <input
        bind:value={filter}
        type="text"
        placeholder="search chats, users and messages"
    />
    {#if filter !== ""}
        <span on:click={clearSearch} class="icon close"
            ><Close color={"#ccc"} /></span
        >
    {/if}
</form>

<style type="text/scss">
    .wrapper {
        background-color: var(--chatSearch-bg);
        display: flex;
        align-items: center;
        position: relative;
        padding: 10px 15px;
        margin-bottom: 15px;
        border-radius: 24px;
        border: 1px solid var(--chatSearch-bd);
    }
    .icon {
        flex: 0 0 25px;
    }
    .close {
        cursor: pointer;
    }
    input {
        background-color: var(--chatSearch-bg);
        color: var(--chatSearch-txt);
        outline: none;
        flex: 1;
        padding: 5px;
        margin: 0;
        border: none;
        width: 100%;
        font-size: 12px;
    }
</style>
