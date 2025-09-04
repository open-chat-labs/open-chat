<script lang="ts">
    import { Pixel } from "component-lib";
    import type { Snippet } from "svelte";
    import { fade } from "svelte/transition";
    import Container from "../Container.svelte";

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
    <Container
        borderWidth={"thin"}
        padding={"md"}
        gap={"sm"}
        backgroundColour={"var(--background-1)"}
        minWidth={new Pixel(160)}
        borderRadius={"lg"}
        shadow={"var(--shadow-menu)"}
        width={{ kind: "hug" }}
        height={{ kind: "fill" }}
        direction={"vertical"}>
        {@render children?.()}
    </Container>
</div>

<style lang="scss">
    .menu {
        max-height: 80vh;
        max-height: var(--override-height, 80vh);

        // TODO
        // @include mobile() {
        //     &.centered {
        //         width: 70vw;
        //     }
        // }

        &.shadow {
            box-shadow: var(--menu-sh);
        }

        &.fit {
            width: fit-content;
        }
    }
</style>
