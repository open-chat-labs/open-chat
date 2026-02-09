<script lang="ts">
    import { Container, ColourVars } from "component-lib";
    import { type Snippet } from "svelte";

    export type BadgeSize = "default" | "large";

    interface Props {
        children: Snippet;
        size?: BadgeSize;
        supplementalClass?: string;
        backgroundColor?: string;
        backgroundImage?: string;
    }

    let {
        children,
        size = "default",
        supplementalClass,
        backgroundColor = ColourVars.primary,
        backgroundImage,
    }: Props = $props();

    let remSize = size === "large" ? "2rem" : "1.375rem";
</script>

<div class="badge" class:large={size === "large"}>
    <Container
        {backgroundColor}
        {backgroundImage}
        {supplementalClass}
        borderRadius={"circle"}
        width={{ size: remSize }}
        height={{ size: remSize }}
        mainAxisAlignment="center"
        crossAxisAlignment="center"
        parentDirection={"vertical"}
        borderStyle={"solid"}
        borderWidth={"thick"}
        borderColour={ColourVars.background0}
        overflow={"visible"}>
        {@render children()}
    </Container>
</div>

<style lang="scss">
    .badge {
        width: 1.375rem;
        height: 1.375rem;
        display: flex;
        flex-direction: column;

        &.large {
            width: 2rem;
            height: 2rem;
        }
    }
</style>
