<script lang="ts">
    import { rtlStore } from "../stores/rtl";

    export let percent: number;
    export let bg: "button" | "accent" = "button";
</script>

<div class="bar">
    <span
        class="meter"
        class:rtl={$rtlStore}
        style={`width: ${percent}%; background-color: ${
            bg === "button" ? "var(--primary)" : "var(--accent)"
        }`} />
    <div class="label">
        <slot />
    </div>
</div>

<style type="text/scss">
    $progress-bar-x-large: 40px;

    .bar {
        // border: 1px solid rgba(255, 255, 255, 0.2);
        border: 1px solid var(--progress-bd);
        width: 100%;
        height: $progress-bar-x-large;
        position: relative;
        border-radius: math.div($progress-bar-x-large, 2);
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
