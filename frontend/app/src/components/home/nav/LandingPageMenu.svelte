<script lang="ts">
    import { iconSize } from "../../../stores/iconSize";
    import HoverIcon from "../../HoverIcon.svelte";
    import Hamburger from "svelte-material-icons/Menu.svelte";
    import InformationOutline from "svelte-material-icons/InformationOutline.svelte";
    import Road from "svelte-material-icons/RoadVariant.svelte";
    import Note from "svelte-material-icons/NoteTextOutline.svelte";
    import Graph from "svelte-material-icons/GraphOutline.svelte";
    import Blog from "svelte-material-icons/PostOutline.svelte";
    import Help from "svelte-material-icons/HelpCircleOutline.svelte";
    import Security from "svelte-material-icons/Security.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import page from "page";
</script>

<MenuIcon>
    <span slot="icon">
        <HoverIcon>
            <Hamburger size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
    <span slot="menu">
        <Menu>
            <MenuItem on:click={() => page("/features")}>
                <InformationOutline
                    size={$iconSize}
                    color={"var(--icon-inverted-txt)"}
                    slot="icon" />
                <span slot="text">Features</span>
            </MenuItem>
            <MenuItem on:click={() => page("/roadmap")}>
                <Road size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                <span slot="text">Roadmap</span>
            </MenuItem>
            <MenuItem on:click={() => page("/whitepaper")}>
                <Note size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                <span slot="text">Whitepaper</span>
            </MenuItem>
            <MenuItem on:click={() => page("/architecture")}>
                <Graph size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                <span slot="text">Architecture</span>
            </MenuItem>
            <MenuItem on:click={() => page("/blog")}>
                <Blog size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                <span slot="text">Blog</span>
            </MenuItem>
            <MenuItem on:click={() => page("/faq")}>
                <Help size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                <span slot="text">FAQs</span>
            </MenuItem>
            <MenuItem on:click={() => page("/guidelines")}>
                <Security size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                <span slot="text">Guidelines</span>
            </MenuItem>
        </Menu>
    </span>
</MenuIcon>
