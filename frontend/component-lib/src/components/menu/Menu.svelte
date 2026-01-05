<script lang="ts">
    import { Rem } from "component-lib";
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

    let { centered = false, fit = false, children, shadow = true, cls = "" }: Props = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    oncontextmenu={(e) => e.preventDefault()}
    in:fade={{ duration: 100 }}
    class={`menu-content ${cls}`}
    class:fit
    class:shadow
    class:centered>
    <Container
        padding={["lg", "zero"]}
        background={"var(--background-1)"}
        minWidth={Rem.fromPixels(200).toString()}
        borderRadius={"xl"}
        shadow={"var(--shadow-menu)"}
        width={"fill"}
        height={"fill"}
        direction={"vertical"}>
        {@render children?.()}
    </Container>
</div>

<style lang="scss">
    .menu-conten {
        max-height: 80vh;
        max-height: var(--override-height, 80vh);
        border-radius: var(--rad-xl);

        &.centered {
            width: 70vw;
        }

        &.shadow {
            box-shadow: var(--menu-sh);
        }

        &.fit {
            width: fit-content;
        }
    }
</style>
