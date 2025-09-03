<script lang="ts">
    import {
        Button,
        CommonButton,
        Container,
        MenuTrigger,
        theme as neon,
        Overview,
    } from "component-lib";
    import Burger from "svelte-material-icons/Menu.svelte";
    import MenuItem from "../../component-lib/src/components/menu/MenuItem.svelte";
    import BigButtons from "./BigButtons.svelte";
    import Buttons from "./Buttons.svelte";
    import Colours from "./Colours.svelte";
    import CommonButtons from "./CommonButtons.svelte";
    import ControlsAndIndicators from "./ControlsAndIndicators.svelte";
    import Layout from "./Layout.svelte";
    import Menus from "./Menus.svelte";
    import Typography from "./Typography.svelte";

    neon.writeCssVariables();

    type Section =
        | "colours"
        | "buttons"
        | "big_buttons"
        | "common_buttons"
        | "layout"
        | "controls"
        | "menus"
        | "typography";
    let selected = $state<Section>("colours");

    const labels: Record<Section, string> = {
        colours: "Colours",
        buttons: "Buttons",
        big_buttons: "Big buttons",
        common_buttons: "Common buttons",
        layout: "Layout",
        controls: "Controls & indicators",
        menus: "Menus",
        typography: "Typography",
    };
</script>

{#snippet sectionButton(section: Section)}
    <Button
        width={{ kind: "fixed", size: "200px" }}
        height={{ kind: "fill" }}
        onClick={() => (selected = section)}
        secondary={selected !== section}>{labels[section]}</Button>
{/snippet}

{#snippet sectionMenuItem(section: Section)}
    <MenuItem onclick={() => (selected = section)}>{labels[section]}</MenuItem>
{/snippet}

<Container gap={"xl"} height={{ kind: "fill" }} direction={"vertical"}>
    <Container crossAxisAlignment={"center"} padding={["zero", "lg"]} gap={"xl"}>
        <MenuTrigger>
            <CommonButton mode="active" size="large">
                {#snippet icon(color)}
                    <Burger {color} />
                {/snippet}
                Menu
            </CommonButton>
            {#snippet menuItems()}
                {@render sectionMenuItem("colours")}
                {@render sectionMenuItem("layout")}
                {@render sectionMenuItem("typography")}
                {@render sectionMenuItem("buttons")}
                {@render sectionMenuItem("big_buttons")}
                {@render sectionMenuItem("common_buttons")}
                {@render sectionMenuItem("controls")}
                {@render sectionMenuItem("menus")}
            {/snippet}
        </MenuTrigger>
        <Overview>{labels[selected]}</Overview>
        <!-- {@render sectionButton("colours")}
        {@render sectionButton("layout")}
        {@render sectionButton("typography")}
        {@render sectionButton("buttons")}
        {@render sectionButton("big_buttons")}
        {@render sectionButton("common_buttons")}
        {@render sectionButton("controls")}
        {@render sectionButton("menus")} -->
    </Container>

    <Container height={{ kind: "fill" }} direction={"vertical"} padding={["lg"]}>
        {#if selected === "colours"}
            <Colours></Colours>
        {:else if selected === "buttons"}
            <Buttons></Buttons>
        {:else if selected === "big_buttons"}
            <BigButtons></BigButtons>
        {:else if selected === "common_buttons"}
            <CommonButtons></CommonButtons>
        {:else if selected === "controls"}
            <ControlsAndIndicators />
        {:else if selected === "layout"}
            <Layout></Layout>
        {:else if selected === "menus"}
            <Menus></Menus>
        {:else if selected === "typography"}
            <Typography></Typography>
        {/if}
    </Container>
</Container>
