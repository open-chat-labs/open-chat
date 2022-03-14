<script lang="ts">
    import { fade } from "svelte/transition";
</script>

<h4 in:fade class="error">
    <slot />
</h4>

<style type="text/scss">
    .error {
        @include font(bold, normal, fs-100);
        text-transform: lowercase;
        color: var(--error);
        margin-bottom: $sp3;
    }
</style>
