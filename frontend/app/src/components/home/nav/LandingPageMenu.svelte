<script lang="ts">
    import { iconSize } from "../../../stores/iconSize";
    import HoverIcon from "../../HoverIcon.svelte";
    import Hamburger from "svelte-material-icons/Menu.svelte";
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
                <span slot="text">Features</span>
            </MenuItem>
            <MenuItem on:click={() => page("/roadmap")}>
                <span slot="text">Roadmap</span>
            </MenuItem>
            <MenuItem on:click={() => page("/whitepaper")}>
                <span slot="text">Whitepaper</span>
            </MenuItem>
            <MenuItem on:click={() => page("/architecture")}>
                <span slot="text">Architecture</span>
            </MenuItem>
            <MenuItem on:click={() => page("/blog")}>
                <span slot="text">Blog</span>
            </MenuItem>
            <MenuItem on:click={() => page("/faq")}>
                <span slot="text">FAQs</span>
            </MenuItem>
            <MenuItem on:click={() => page("/guidelines")}>
                <span slot="text">Guidelines</span>
            </MenuItem>
        </Menu>
    </span>
</MenuIcon>
