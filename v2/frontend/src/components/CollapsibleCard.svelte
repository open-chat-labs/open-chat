<script lang="ts">
    import { rtlStore } from "../stores/rtl";
    import { iconSize } from "../stores/iconSize";
    import { slide } from "svelte/transition";

    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import { quartInOut } from "svelte/easing";

    export let headerText: string;
    export let open: boolean = true;
</script>

<div class="card">
    <div class="header" class:open on:click={() => (open = !open)}>
        <h4>{headerText}</h4>
        <div class="arrow" class:rtl={$rtlStore} class:open>
            <ChevronDown size={$iconSize} color={"var(--icon-txt)"} />
        </div>
    </div>
    {#if open}
        <div transition:slide={{ duration: 200, easing: quartInOut }} class="body" class:open>
            <slot />
        </div>
    {/if}
</div>

<style type="text/scss">
    .card {
        // background-color: var(--section-bg);
        background-color: var(--collapsible-bg);
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
    }
</style>
