<script lang="ts">
    import type { Snippet } from "svelte";
    import { fade } from "svelte/transition";

    interface Props {
        centered?: boolean;
        fit?: boolean;
        children?: Snippet;
    }

    let { centered = false, fit = false, children }: Props = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    oncontextmenu={(e) => e.preventDefault()}
    transition:fade|local={{ duration: 100 }}
    class="menu"
    class:fit
    class:centered>
    {@render children?.()}
</div>

<style lang="scss">
    .menu {
        width: toRem(250);
        background-color: var(--menu-bg);
        box-shadow: var(--menu-sh);
        border-radius: var(--rd);
        border: var(--bw) solid var(--menu-bd);
        max-height: 80vh;
        height: var(--override-height);
        @include nice-scrollbar();

        @include mobile() {
            &.centered {
                width: 70vw;
            }
        }

        &.fit {
            width: fit-content;
        }
    }
</style>
