<script lang="ts">
    import { Button, Container, theme as neon } from "component-lib";
    import Buttons from "./Buttons.svelte";
    import Colours from "./Colours.svelte";
    import Layout from "./Layout.svelte";

    neon.writeCssVariables();

    type Section = "colours" | "buttons" | "layout";
    let selected = $state<Section>("colours");
</script>

<Container padding={["zero", "lg"]} gap={"lg"}>
    <Button onClick={() => (selected = "colours")} secondary={selected !== "colours"}
        >Colours</Button>
    <Button onClick={() => (selected = "buttons")} secondary={selected !== "buttons"}
        >Buttons</Button>
    <Button onClick={() => (selected = "layout")} secondary={selected !== "layout"}>Layout</Button>
</Container>

<Container padding={["lg"]}>
    {#if selected === "colours"}
        <Colours></Colours>
    {:else if selected === "buttons"}
        <Buttons></Buttons>
    {:else if selected === "layout"}
        <Layout></Layout>
    {/if}
</Container>
