<script lang="ts">
    import type { Snippet } from "svelte";
    import { fade } from "svelte/transition";

    interface Props {
        centered?: boolean;
        fit?: boolean;
        children?: Snippet;
        shadow?: boolean;
        cls?: string;
    }

    let { centered = false, fit = false, children, shadow = true, cls }: Props = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    oncontextmenu={(e) => e.preventDefault()}
    in:fade={{ duration: 100 }}
    class={`menu ${cls}`}
    class:fit
    class:shadow
    class:centered>
    {@render children?.()}
</div>

<style lang="scss">
    .menu {
        width: toRem(250);
        background-color: var(--menu-bg);
        border-radius: var(--menu-rd);
        border: var(--bw) solid var(--menu-bd);
        max-height: 80vh;
        max-height: var(--override-height, 80vh);
        @include nice-scrollbar();

        @include mobile() {
            &.centered {
                width: 70vw;
            }
        }

        &.shadow {
            box-shadow: var(--menu-sh);
        }

        &.fit {
            width: fit-content;
        }
    }
</style>
