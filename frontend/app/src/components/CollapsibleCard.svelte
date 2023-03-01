<script lang="ts">
    import { rtlStore } from "../stores/rtl";
    import { slide } from "svelte/transition";
    import { expoInOut } from "svelte/easing";

    import { createEventDispatcher } from "svelte";
    import Arrow from "./Arrow.svelte";

    const dispatch = createEventDispatcher();
    export let headerText: string = "";
    export let open = true;
    export let first = false;

    function toggle() {
        open = !open;
        dispatch(open ? "opened" : "closed");
        dispatch("toggle");
    }
</script>

<div class="card" class:first>
    <div class="header" class:open on:click={toggle}>
        <slot name="titleSlot">
            <div>{headerText}</div>
        </slot>

        <div class="arrow" class:rtl={$rtlStore}>
            <Arrow
                size={16}
                rotate={open ? -45 : 45}
                color={open
                    ? "var(--collapsible-open-header-arrow)"
                    : "var(--collapsible-closed-header-txt)"} />
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

        &.first {
            border-top: 1px solid var(--bd);
        }
    }

    .header {
        padding: toRem(20) 0;
        display: flex;
        cursor: pointer;
        justify-content: space-between;
        align-items: center;
        @include font(bold, normal, fs-100);
        color: var(--collapsible-closed-header-txt);

        @include mobile() {
            padding: toRem(18) 0;
        }

        &.open {
            color: var(--txt);
        }
    }

    .arrow {
        flex: 0 0 20px;
        justify-self: flex-end;
        text-align: right;
    }

    .body {
        padding: $sp4 0;

        @include mobile() {
            padding: $sp3 0;
        }
    }
</style>
