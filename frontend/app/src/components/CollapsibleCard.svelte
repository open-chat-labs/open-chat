<script lang="ts">
    import { rtlStore } from "../stores/rtl";

    import { createEventDispatcher, onMount, tick } from "svelte";
    import Arrow from "./Arrow.svelte";

    const dispatch = createEventDispatcher();
    export let headerText: string = "";
    export let open = true;
    export let first = false;

    let bodyNode: HTMLDivElement;
    let openStyle = "";
    let closedStyle = "";
    let initialised = false;

    onMount(() => {
        const open_ = open;
        open = true;
        initialised = false;
        // capturing the computed styles onMount allows us to implement the slide effect properly
        tick().then(() => {
            const style = getComputedStyle(bodyNode);
            const opacity = +style.opacity;
            const height = parseFloat(style.height);
            const padding_top = parseFloat(style.paddingTop);
            const padding_bottom = parseFloat(style.paddingBottom);
            const margin_top = parseFloat(style.marginTop);
            const margin_bottom = parseFloat(style.marginBottom);
            const border_top_width = parseFloat(style.borderTopWidth);
            const border_bottom_width = parseFloat(style.borderBottomWidth);
            openStyle = `opacity: ${opacity}; height: ${height}px; padding-top: ${padding_top}px; padding-bottom: ${padding_bottom}px; margin-top: ${margin_top}px; margin-bottom: ${margin_bottom}px; border-top-width: ${border_top_width}px; border-bottom-width: ${border_bottom_width}px`;
            closedStyle = `opacity: 0; height: 0px; padding-top: 0px; padding-bottom: 0px; margin-top: 0px; margin-bottom: 0px; border-top-width: 0px; border-bottom-width: 0px`;
            open = open_;
            window.setTimeout(() => (initialised = true), 100);
        });
    });

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
    <div
        bind:this={bodyNode}
        class="body"
        class:initialised
        class:open
        style={open ? openStyle : closedStyle}>
        <slot />
    </div>
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
        $speed: 200ms;
        padding: $sp4 0;
        pointer-events: none;

        &.initialised {
            transition: opacity $speed ease-in-out, height $speed ease-in-out,
                padding-top $speed ease-in-out, padding-bottom $speed ease-in-out,
                margin-top $speed ease-in-out, margin-bottom $speed ease-in-out,
                border-top-width $speed ease-in-out, border-bottom-width $speed ease-in-out;
        }

        &.open {
            pointer-events: all;
        }

        @include mobile() {
            padding: $sp3 0;
        }
    }
</style>
