<script lang="ts">
    import { Button, Container, theme as neon } from "component-lib";
    import BigButtons from "./BigButtons.svelte";
    import Buttons from "./Buttons.svelte";
    import Colours from "./Colours.svelte";
    import Layout from "./Layout.svelte";

    neon.writeCssVariables();

    type Section = "colours" | "buttons" | "big_buttons" | "layout";
    let selected = $state<Section>("colours");
</script>

<Container padding={["zero", "lg"]} gap={"md"}>
    <Button onClick={() => (selected = "colours")} secondary={selected !== "colours"}
        >Colours</Button>
    <Button onClick={() => (selected = "buttons")} secondary={selected !== "buttons"}
        >Buttons</Button>
    <Button onClick={() => (selected = "big_buttons")} secondary={selected !== "big_buttons"}
        >Big Buttons</Button>
    <Button onClick={() => (selected = "layout")} secondary={selected !== "layout"}>Layout</Button>
</Container>

<Container direction={"vertical"} padding={["lg"]}>
    {#if selected === "colours"}
        <Colours></Colours>
    {:else if selected === "buttons"}
        <Buttons></Buttons>
    {:else if selected === "big_buttons"}
        <BigButtons></BigButtons>
    {:else if selected === "layout"}
        <Layout></Layout>
    {/if}
</Container>
