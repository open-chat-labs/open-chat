<script lang="ts">
    import { CommonButton, Container, MenuTrigger, theme as neon, Overview } from "component-lib";
    import Burger from "svelte-material-icons/Menu.svelte";
    import MenuItem from "../../component-lib/src/components/menu/MenuItem.svelte";
    import Avatars from "./Avatars.svelte";
    import BigButtons from "./BigButtons.svelte";
    import Buttons from "./Buttons.svelte";
    import ChatSummaries from "./ChatSummaries.svelte";
    import Chips from "./Chips.svelte";
    import Colours from "./Colours.svelte";
    import CommonButtons from "./CommonButtons.svelte";
    import ControlsAndIndicators from "./ControlsAndIndicators.svelte";
    import Forms from "./Forms.svelte";
    import Layout from "./Layout.svelte";
    import ListActions from "./ListActions.svelte";
    import Longpress from "./Longpress.svelte";
    import Menus from "./Menus.svelte";
    import Messages from "./Messages.svelte";
    import SectionHeaders from "./SectionHeaders.svelte";
    import Typography from "./Typography.svelte";
    import Users from "./Users.svelte";

    neon.writeCssVariables();

    type Section =
        | "chips"
        | "colours"
        | "buttons"
        | "big_buttons"
        | "chat_summary"
        | "common_buttons"
        | "forms"
        | "layout"
        | "list_actions"
        | "longpress"
        | "controls"
        | "menus"
        | "messages"
        | "avatars"
        | "section_header"
        | "typography"
        | "users";

    let selected = $state<Section>("colours");

    const labels: Record<Section, string> = {
        avatars: "Avatars",
        big_buttons: "Big buttons",
        buttons: "Buttons",
        chat_summary: "Chat summary",
        chips: "Chips",
        colours: "Colours",
        common_buttons: "Common buttons",
        controls: "Controls & indicators",
        forms: "Forms",
        layout: "Layout",
        list_actions: "List Actions",
        longpress: "Longpress",
        menus: "Menus",
        messages: "Messages",
        section_header: "Section headers",
        typography: "Typography",
        users: "Users",
    };
</script>

{#snippet sectionMenuItem(section: Section)}
    <MenuItem onclick={() => (selected = section)}>{labels[section]}</MenuItem>
{/snippet}

<Container gap={"xl"} height={"fill"} direction={"vertical"}>
    <Container crossAxisAlignment={"center"} padding={["zero", "lg"]} gap={"xl"}>
        <MenuTrigger>
            <CommonButton mode="active" size="large">
                {#snippet icon(color, size)}
                    <Burger {color} {size} />
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

    <Container height={"fill"} direction={"vertical"} padding={"lg"}>
        {#if selected === "colours"}
            <Colours></Colours>
        {:else if selected === "chips"}
            <Chips></Chips>
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
        {:else if selected === "list_actions"}
            <ListActions></ListActions>
        {:else if selected === "menus"}
            <Menus></Menus>
        {:else if selected === "messages"}
            <Messages></Messages>
        {:else if selected === "avatars"}
            <Avatars />
        {:else if selected === "forms"}
            <Forms />
        {:else if selected === "section_header"}
            <SectionHeaders />
        {:else if selected === "chat_summary"}
            <ChatSummaries />
        {:else if selected === "longpress"}
            <Longpress />
        {:else if selected === "users"}
            <Users />
        {:else if selected === "typography"}
            <Typography></Typography>
        {/if}
    </Container>
</Container>
