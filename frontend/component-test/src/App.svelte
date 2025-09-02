<script lang="ts">
    import { Button, Container, theme as neon } from "component-lib";
    import BigButtons from "./BigButtons.svelte";
    import Buttons from "./Buttons.svelte";
    import Colours from "./Colours.svelte";
    import CommonButtons from "./CommonButtons.svelte";
    import Layout from "./Layout.svelte";
    import Typography from "./Typography.svelte";

    neon.writeCssVariables();

    type Section =
        | "colours"
        | "buttons"
        | "big_buttons"
        | "common_buttons"
        | "layout"
        | "typography";
    let selected = $state<Section>("colours");
</script>

<Container padding={["zero", "lg"]} gap={"md"}>
    <Button onClick={() => (selected = "colours")} secondary={selected !== "colours"}
        >Colours</Button>
    <Button onClick={() => (selected = "layout")} secondary={selected !== "layout"}>Layout</Button>
    <Button onClick={() => (selected = "typography")} secondary={selected !== "typography"}
        >Typography</Button>
    <Button onClick={() => (selected = "buttons")} secondary={selected !== "buttons"}
        >Buttons</Button>
    <Button onClick={() => (selected = "big_buttons")} secondary={selected !== "big_buttons"}
        >Big Buttons</Button>
    <Button onClick={() => (selected = "common_buttons")} secondary={selected !== "common_buttons"}
        >Common Buttons</Button>
</Container>

<Container direction={"vertical"} padding={["lg"]}>
    {#if selected === "colours"}
        <Colours></Colours>
    {:else if selected === "buttons"}
        <Buttons></Buttons>
    {:else if selected === "big_buttons"}
        <BigButtons></BigButtons>
    {:else if selected === "common_buttons"}
        <CommonButtons></CommonButtons>
    {:else if selected === "layout"}
        <Layout></Layout>
    {:else if selected === "typography"}
        <Typography></Typography>
    {/if}
</Container>
