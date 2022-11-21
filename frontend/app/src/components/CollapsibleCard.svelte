<script lang="ts">
    import { rtlStore } from "../stores/rtl";
    import { slide } from "svelte/transition";
    import { expoInOut } from "svelte/easing";

    import { createEventDispatcher } from "svelte";
    import Arrow from "./Arrow.svelte";

    const dispatch = createEventDispatcher();
    export let headerText: string;
    export let open = true;

    function toggle() {
        open = !open;
        dispatch(open ? "opened" : "closed");
        dispatch("toggle");
    }
</script>

<div class="card">
    <div class="header" class:open on:click={toggle}>
        <slot name="titleSlot">
            <div>{headerText}</div>
        </slot>

        <div class="arrow" class:rtl={$rtlStore}>
            <Arrow
                size={16}
                rotate={open ? -45 : 45}
                color={open ? "var(--collapsible-open)" : "var(--txt)"} />
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
        border-bottom: 1px solid var(--bd);
    }

    .header {
        padding: $sp4;
        display: flex;
        cursor: pointer;
        justify-content: space-between;
        align-items: center;
        @include font(bold, normal, fs-100);

        @include mobile() {
            padding: $sp3 $sp4;
        }
    }

    .arrow {
        flex: 0 0 20px;
        justify-self: flex-end;
        text-align: right;
    }

    .body {
        padding: $sp4;

        @include mobile() {
            padding: $sp3;
        }
    }
</style>
