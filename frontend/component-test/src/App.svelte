<script lang="ts">
    import { CommonButton, Container, MenuTrigger, theme as neon, Overview } from "component-lib";
    import Burger from "svelte-material-icons/Menu.svelte";
    import MenuItem from "../../component-lib/src/components/menu/MenuItem.svelte";
    import Avatars from "./Avatars.svelte";
    import BigButtons from "./BigButtons.svelte";
    import BottomBars from "./BottomBars.svelte";
    import Buttons from "./Buttons.svelte";
    import Colours from "./Colours.svelte";
    import CommonButtons from "./CommonButtons.svelte";
    import ControlsAndIndicators from "./ControlsAndIndicators.svelte";
    import Layout from "./Layout.svelte";
    import Menus from "./Menus.svelte";
    import SectionHeaders from "./SectionHeaders.svelte";
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
        | "bottom_bar"
        | "avatars"
        | "section_header"
        | "typography";
    let selected = $state<Section>("colours");

    const labels: Record<Section, string> = {
        avatars: "Avatars",
        big_buttons: "Big buttons",
        bottom_bar: "Bottom bar",
        buttons: "Buttons",
        colours: "Colours",
        common_buttons: "Common buttons",
        controls: "Controls & indicators",
        layout: "Layout",
        menus: "Menus",
        section_header: "Section headers",
        typography: "Typography",
    };
</script>

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
                {#each Object.keys(labels) as k}
                    {@render sectionMenuItem(k as Section)}
                {/each}
            {/snippet}
        </MenuTrigger>
        <Overview>{labels[selected]}</Overview>
    </Container>

    <Container height={{ kind: "fill" }} direction={"vertical"} padding={"lg"}>
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
        {:else if selected === "bottom_bar"}
            <BottomBars />
        {:else if selected === "avatars"}
            <Avatars />
        {:else if selected === "section_header"}
            <SectionHeaders />
        {:else if selected === "typography"}
            <Typography></Typography>
        {/if}
    </Container>
</Container>
