<script lang="ts">
    import { iconSize } from "../../../stores/iconSize";
    import InformationOutline from "svelte-material-icons/InformationOutline.svelte";
    import Wallet from "svelte-material-icons/WalletOutline.svelte";
    import Home from "svelte-material-icons/Home.svelte";
    import Road from "svelte-material-icons/RoadVariant.svelte";
    import Note from "svelte-material-icons/NoteTextOutline.svelte";
    import Graph from "svelte-material-icons/GraphOutline.svelte";
    import Blog from "svelte-material-icons/PostOutline.svelte";
    import Help from "svelte-material-icons/HelpCircleOutline.svelte";
    import Security from "svelte-material-icons/Security.svelte";
    import Menu from "../../Menu.svelte";
    import Logout from "svelte-material-icons/Logout.svelte";
    import { _ } from "svelte-i18n";
    import MenuItem from "../../MenuItem.svelte";
    import page from "page";
    import { createEventDispatcher, getContext } from "svelte";
    import type { OpenChat } from "openchat-client";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    $: canExtendDiamond = client.canExtendDiamond;
</script>

<Menu>
    <MenuItem on:click={() => dispatch("halloffame")}>
        <span class="halloffame" slot="icon">👑</span>
        <span slot="text">{$_("halloffame.menu")}</span>
    </MenuItem>
    <MenuItem on:click={() => dispatch("upgrade")}>
        <span class="diamond-icon" slot="icon">💎</span>
        <span slot="text">{$canExtendDiamond ? $_("upgrade.extend") : $_("upgrade.diamond")}</span>
    </MenuItem>
    <MenuItem on:click={() => dispatch("wallet")}>
        <Wallet size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <span slot="text">{$_("wallet")}</span>
    </MenuItem>
    <MenuItem separator />
    <MenuItem on:click={() => page("/home")}>
        <Home size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <span slot="text">Home page</span>
    </MenuItem>
    <MenuItem on:click={() => page("/features")}>
        <InformationOutline size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
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
    <MenuItem separator />
    <MenuItem on:click={() => dispatch("logout")}>
        <Logout size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <span slot="text">{$_("logout")}</span>
    </MenuItem>
</Menu>
