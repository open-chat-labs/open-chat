<script lang="ts">
    import { fade } from "svelte/transition";
</script>

<h4 in:fade|local class="error">
    <slot />
</h4>

<style lang="scss">
    .error {
        @include font(book, normal, fs-80);
        margin-bottom: $sp3;
        background-color: var(--error);
        color: #fff;
        padding: $sp3 $sp4;
        border-radius: var(--rd);
    }
</style>
