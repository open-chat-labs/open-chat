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

{#snippet sectionButton(section: Section, name: string)}
    <Button
        width={{ kind: "fixed", size: "200px" }}
        onClick={() => (selected = section)}
        secondary={selected !== section}>{name}</Button>
{/snippet}

<Container padding={["zero", "lg"]} gap={"md"}>
    {@render sectionButton("colours", "Colours")}
    {@render sectionButton("layout", "Layout")}
    {@render sectionButton("typography", "Typography")}
    {@render sectionButton("buttons", "Buttons")}
    {@render sectionButton("big_buttons", "Big buttons")}
    {@render sectionButton("common_buttons", "Common buttons")}
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
