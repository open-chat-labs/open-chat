<script lang="ts">
    import { fade } from "svelte/transition";
</script>

<h4 in:fade|local class="error">
    <slot />
</h4>

<style type="text/scss">
    .error {
        @include font(bold, normal, fs-80);
        color: var(--error);
        margin-bottom: $sp3;
    }
</style>
