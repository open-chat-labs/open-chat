<script lang="ts">
    import { fade } from "svelte/transition";
</script>

<div transition:fade|local={{ duration: 100 }} class="menu">
    <slot />
</div>

<style type="text/scss">
    .menu {
        width: 200px;
        position: absolute;
        background-color: var(--menu-bg);
        @include z-index("popup-menu");
        border: 1px solid var(--menu-bd);
        box-shadow: var(--menu-sh);
    }
</style>
