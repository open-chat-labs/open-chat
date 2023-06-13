<script lang="ts">
    import Magnify from "svelte-material-icons/Magnify.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    import { iconSize } from "../stores/iconSize";

    const dispatch = createEventDispatcher();
    export let searchTerm = "";
    export let searching: boolean;
    export let placeholder: string = "searchPlaceholder";
    export let fill = false;

    let timer: number | undefined;

    function performSearch() {
        dispatch("searchEntered", searchTerm);
    }
    function clearSearch() {
        searchTerm = "";
        performSearch();
    }
    function keydown(ev: KeyboardEvent) {
        if (ev.key === "Tab") {
            return;
        }
        if (timer !== undefined) {
            window.clearTimeout(timer);
        }
        timer = window.setTimeout(() => {
            if (searchTerm.length > 1) {
                performSearch();
            } else {
                if (searchTerm.length === 0) {
                    performSearch();
                }
            }
        }, 300);
    }
</script>

<form on:submit|preventDefault={performSearch} class="wrapper" class:fill>
    <input
        on:keydown={keydown}
        spellcheck="false"
        bind:value={searchTerm}
        type="text"
        placeholder={$_(placeholder)} />
    {#if searchTerm !== ""}
        <span on:click={clearSearch} class="icon close"
            ><Close size={$iconSize} color={"var(--icon-txt)"} /></span>
    {:else}
        <span class="icon" class:searching>
            {#if !searching}
                <Magnify size={$iconSize} color={"var(--icon-txt)"} />
            {/if}
        </span>
    {/if}
</form>

<style lang="scss">
    .wrapper {
        margin: 0 $sp4 $sp4 $sp4;
        background-color: var(--chatSearch-bg);
        display: flex;
        align-items: center;
        position: relative;
        padding: $sp2 $sp4;
        border-radius: $sp2;
        box-shadow: var(--chatSearch-sh);

        @include mobile() {
            margin: 0 $sp3;
            margin-bottom: $sp3;
        }

        &.fill {
            margin: 0;
        }
    }
    .icon {
        margin-top: $sp3;
        flex: 0 0 25px;
    }
    .close {
        cursor: pointer;
    }
    .searching {
        @include loading-spinner(1em, 0.5em, var(--button-spinner));
    }
    input {
        background-color: transparent;
        color: var(--txt);
        outline: none;
        flex: 1;
        padding: $sp3;
        margin: 0;
        border: none;
        width: 100%;
        @include font(book, normal, fs-100);

        &::placeholder {
            color: var(--placeholder);
        }
    }
</style>
