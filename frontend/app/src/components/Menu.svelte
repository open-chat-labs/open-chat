<script lang="ts">
    import { fade } from "svelte/transition";

    export let centered = false;
</script>

<div transition:fade|local={{ duration: 100 }} class="menu" class:centered>
    <slot />
</div>

<style lang="scss">
    .menu {
        width: toRem(250);
        background-color: var(--menu-bg);
        box-shadow: var(--menu-sh);
        border-radius: $sp2;
        border: 1px solid var(--menu-bd);

        @include mobile() {
            &.centered {
                width: 70vw;
            }
        }
    }
</style>
