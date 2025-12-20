<script lang="ts">
    import { Container, ColourVars } from "component-lib";
    import { type Snippet } from "svelte";

    interface Props {
        children: Snippet;
        supplementalClass?: string;
        backgroundColor?: string;
        backgroundImage?: string;
    }

    let {
        children,
        supplementalClass,
        backgroundColor = ColourVars.primary,
        backgroundImage,
    }: Props = $props();
</script>

<div class="badge">
    <Container
        {backgroundColor}
        {backgroundImage}
        {supplementalClass}
        borderRadius={"circle"}
        width={{ size: "1.375rem" }}
        height={{ size: "1.375rem" }}
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
    }
</style>
