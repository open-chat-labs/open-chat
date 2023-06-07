<script lang="ts">
    export let size: "small" | "medium" | "large" = "medium";

    let cls = `loading ${size}`;
</script>

<div class={cls} />

<style lang="scss">
    .loading {
        height: 100%;
        width: 100%;
        &.small {
            @include loading-spinner(2em, 1em, var(--spinner));
        }

        &.medium {
            @include loading-spinner(3em, 1.5em, var(--spinner));
        }

        &.large {
            @include loading-spinner(5em, 2.5em, var(--spinner));
        }
    }
</style>
