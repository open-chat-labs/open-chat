<script lang="ts">
    import { rtlStore } from "../stores/rtl";
    import { iconSize } from "../stores/iconSize";
    import { slide } from "svelte/transition";
    import { expoInOut } from "svelte/easing";

    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();
    export let headerText: string;
    export let open = true;
    export let bordered = false;

    function toggle() {
        open = !open;
        dispatch(open ? "opened" : "closed");
        dispatch("toggle");
    }
</script>

<div class="card" class:bordered>
    <div class="header" class:open on:click={toggle}>
        <slot name="titleSlot">
            <h4>{headerText}</h4>
        </slot>

        <div class="arrow" class:rtl={$rtlStore} class:open>
            <ChevronDown viewBox="0 -3 24 24" size={$iconSize} color={"var(--icon-txt)"} />
        </div>
    </div>
    {#if open}
        <div transition:slide|local={{ duration: 200, easing: expoInOut }} class="body" class:open>
            <slot />
        </div>
    {/if}
</div>

<style type="text/scss">
    .card {
        background-color: var(--collapsible-bg);

        &.bordered {
            border: var(--collapsible-header-bd);
        }
    }

    .header {
        padding: $sp3 $sp4;
        display: flex;
        cursor: pointer;
        justify-content: space-between;
        align-items: center;
        @include font(mediumBold, normal, fs-100);
        background-color: var(--collapsible-header-bg);

        &.open {
            // border-bottom: 1px solid #ddd;
            border-bottom: var(--collapsible-header-bd);
        }
    }

    .arrow {
        flex: 0 0 20px;
        transition: transform 200ms ease-in-out;

        &.open {
            transform: rotate(180deg);
            transform-origin: 50%;
        }
    }

    .body {
        padding: $sp4;

        @include mobile() {
            padding: $sp3;
        }
    }
</style>
