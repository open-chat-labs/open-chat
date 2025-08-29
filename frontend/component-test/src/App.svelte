<script lang="ts">
    import { Button, Container, theme as neon } from "component-lib";
    import Buttons from "./Buttons.svelte";
    import Colours from "./Colours.svelte";

    neon.writeCssVariables();

    type Section = "colours" | "buttons";
    let selected = $state<Section>("colours");
</script>

<Container padding={["zero", "lg"]} gap={"lg"}>
    <Button onClick={() => (selected = "colours")} secondary={selected !== "colours"}
        >Colours</Button>
    <Button onClick={() => (selected = "buttons")} secondary={selected !== "buttons"}
        >Buttons</Button>
</Container>

<Container padding={["lg"]}>
    {#if selected === "colours"}
        <Colours></Colours>
    {:else if selected === "buttons"}
        <Buttons></Buttons>
    {/if}
</Container>
