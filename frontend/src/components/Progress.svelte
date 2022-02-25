<script lang="ts">
    export let percent: number;
    export let bg: "button" | "accent" = "button";
</script>

<div class="bar">
    <span
        class="meter"
        style={`width: ${percent}%; background-color: ${
            bg === "button" ? "var(--button-bg)" : "var(--accent)"
        }`} />
    <div class="label">
        <slot />
    </div>
</div>

<style type="text/scss">
    $progress-bar-x-large: 40px;

    .bar {
        border: 1px solid #ccc;
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
        // border-radius: math.div($progress-bar-x-large, 2);
        position: relative;
    }

    .label {
        position: absolute;
        top: 6px;
        left: $sp4;
        @include ellipsis();
    }
</style>
