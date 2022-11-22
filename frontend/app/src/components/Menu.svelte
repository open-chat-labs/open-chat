<script lang="ts">
    import { fade } from "svelte/transition";
</script>

<div transition:fade|local={{ duration: 100 }} class="menu">
    <slot />
</div>

<style type="text/scss">
    .menu {
        width: toRem(200);
        position: absolute;
        background-color: var(--menu-bg);
        @include z-index("popup-menu");
        box-shadow: var(--menu-sh);
    }
</style>
