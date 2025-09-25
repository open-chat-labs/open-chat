<script lang="ts">
    import type { Snippet } from "svelte";
    import { rtlStore } from "../stores/rtl";

    interface Props {
        percent: number;
        bg?: "button" | "accent";
        size?: string;
        children?: Snippet;
    }

    let { percent, bg = "button", size = "40px", children }: Props = $props();
</script>

<div class="bar" style={`--size: ${size}`}>
    <span
        class="meter"
        class:rtl={$rtlStore}
        style={`width: ${percent}%; background-color: ${
            bg === "button" ? "var(--primary)" : "var(--progress-fill)"
        }`}></span>
    <div class="label">
        {@render children?.()}
    </div>
</div>

<style lang="scss">
    $radius: calc(var(--size) / 2);

    .bar {
        border: 1px solid var(--progress-bd);
        width: 100%;
        height: var(--size);
        position: relative;
        border-radius: $radius;
        overflow: hidden;
    }

    .meter {
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
