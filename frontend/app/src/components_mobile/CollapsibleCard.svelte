<script lang="ts">
    import { expoInOut } from "svelte/easing";
    import { slide } from "svelte/transition";
    import { rtlStore } from "../stores/rtl";

    import type { ResourceKey } from "openchat-client";
    import { type Snippet } from "svelte";
    import Arrow from "./Arrow.svelte";
    import Translatable from "./Translatable.svelte";

    interface Props {
        headerText?: ResourceKey | undefined;
        open?: boolean;
        first?: boolean;
        transition?: boolean;
        fill?: boolean;
        titleSlot?: Snippet;
        children?: Snippet;
        onOpened?: () => void;
        onClosed?: () => void;
        onToggle?: () => void;
    }

    let {
        headerText = undefined,
        open = $bindable(true),
        first = false,
        transition = true,
        fill = false,
        titleSlot,
        children,
        onClosed,
        onOpened,
        onToggle,
    }: Props = $props();

    function toggle() {
        open = !open;
        onToggle?.();
        if (open) {
            onOpened?.();
        } else {
            onClosed?.();
        }
    }
</script>

<div class="card" class:first class:open>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="header" class:open onclick={toggle} class:fill>
        {#if titleSlot}{@render titleSlot()}{:else if headerText !== undefined}
            <Translatable resourceKey={headerText} />
        {/if}

        <div class="arrow" class:rtl={$rtlStore}>
            <Arrow
                size={16}
                rotate={open ? -45 : 45}
                color={open
                    ? "var(--collapsible-open-header-arrow)"
                    : "var(--collapsible-closed-header-txt)"} />
        </div>
    </div>
    {#if transition}
        {#if open}
            <div
                transition:slide|local={{ duration: 200, easing: expoInOut }}
                class="body"
                class:open>
                {@render children?.()}
            </div>
        {/if}
    {:else}
        <div class="body static" class:open>
            {@render children?.()}
        </div>
    {/if}
</div>

<style lang="scss">
    .card {
        width: 100%;
        border-bottom: var(--bw) solid var(--bd);

        &.first {
            border-top: var(--bw) solid var(--bd);
        }
    }

    .header {
        padding: 1rem 0;
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

        &.fill {
            padding-left: $sp4;
            padding-right: $sp4;
        }
    }

    .arrow {
        flex: 0 0 20px;
        justify-self: flex-end;
        text-align: right;
    }

    .body {
        padding-bottom: $sp4;

        @include mobile() {
            padding-bottom: $sp3;
        }

        &.static {
            display: none;
            pointer-events: none;
            &.open {
                pointer-events: all;
                display: block;
            }
        }
    }
</style>
