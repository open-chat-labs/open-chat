<script lang="ts">
    import Magnify from "svelte-material-icons/Magnify.svelte";
    import Refresh from "svelte-material-icons/Refresh.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();
    export let searchTerm = "";
    export let searching: boolean;

    function performSearch() {
        dispatch("searchEntered", searchTerm);
    }
    function clearSearch() {
        searchTerm = "";
        performSearch();
    }
</script>

<form on:submit|preventDefault={performSearch} class="wrapper">
    <span class="icon" class:searching>
        {#if !searching}
            <Magnify color={"#ccc"} />
        {/if}
    </span>
    <input
        spellcheck="false"
        bind:value={searchTerm}
        type="text"
        placeholder={$_("searchPlaceholder")} />
    {#if searchTerm !== ""}
        <span on:click={clearSearch} class="icon close"><Close color={"#ccc"} /></span>
    {/if}
</form>

<style type="text/scss">
    .wrapper {
        background-color: var(--chatSearch-bg);
        display: flex;
        align-items: center;
        position: relative;
        padding: $sp2 $sp4;
        margin-bottom: $sp3;
        border-radius: $sp5;
        border: 1px solid var(--chatSearch-bd);
    }
    .icon {
        flex: 0 0 25px;
    }
    .close {
        cursor: pointer;
    }
    .searching {
        @include loading-spinner(1em, 0.5em, false, var(--button-spinner));
    }
    input {
        background-color: var(--chatSearch-bg);
        color: var(--chatSearch-txt);
        outline: none;
        flex: 1;
        padding: $sp3;
        margin: 0;
        border: none;
        width: 100%;
        @include font(book, normal, fs-100);
    }
</style>
