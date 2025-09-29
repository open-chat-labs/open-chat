<script lang="ts">
    import type { Snippet } from "svelte";
    import { rtlStore } from "../stores/rtl";

    interface Props {
        percent: number;
        size?: string;
        children?: Snippet;
    }

    let { percent, size = "40px", children }: Props = $props();
</script>

<div class="bar" style={`--size: ${size}`}>
    <span class="meter" class:rtl={$rtlStore} style={`width: ${percent}%;}`}></span>
    <div class="label">
        {@render children?.()}
    </div>
</div>

<style lang="scss">
    .bar {
        width: 100%;
        height: var(--size);
        position: relative;
        background-color: var(--text-tertiary);
        border-radius: var(--rad-circle);
        overflow: hidden;
    }

    .meter {
        background-color: var(--primary);
        border-radius: var(--rad-circle);
        width: 0;
        transition: width 300ms;
        display: block;
        height: 100%;

        position: absolute;
        left: 0;
        top: 0;

        &.rtl {
            left: unset;
            right: 0;
        }
    }

    .label {
        display: flex;
        align-items: center;
        height: 100%;
        padding: 0 $sp4;
        position: relative;
        @include ellipsis();
    }
</style>
