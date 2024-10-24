<script lang="ts">
    import { rtlStore } from "../stores/rtl";

    export let percent: number;
    export let bg: "button" | "accent" = "button";
    export let size = "40px";
</script>

<div class="bar" style={`--size: ${size}`}>
    <span
        class="meter"
        class:rtl={$rtlStore}
        style={`width: ${percent}%; background-color: ${
            bg === "button" ? "var(--primary)" : "var(--progress-fill)"
        }`} />
    <div class="label">
        <slot />
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
