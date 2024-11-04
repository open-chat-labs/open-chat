<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { identityState, chatListScopeStore as chatListScope } from "openchat-client";
    import MenuItem from "../MenuItem.svelte";
    import InformationOutline from "svelte-material-icons/InformationOutline.svelte";
    import Road from "svelte-material-icons/RoadVariant.svelte";
    import Note from "svelte-material-icons/NoteTextOutline.svelte";
    import Graph from "svelte-material-icons/GraphOutline.svelte";
    import Blog from "svelte-material-icons/PostOutline.svelte";
    import Help from "svelte-material-icons/HelpCircleOutline.svelte";
    import Logout from "svelte-material-icons/Logout.svelte";
    import Shopping from "svelte-material-icons/ShoppingOutline.svelte";
    import Menu from "../Menu.svelte";
    import { location, routeForScope } from "../../routes";
    import page from "page";
    import { iconSize } from "../../stores/iconSize";

    const dispatch = createEventDispatcher();

    export let showBlog: boolean;

    $: path = $location;

    function launch() {
        if ($identityState.kind === "logged_in") {
            page(routeForScope($chatListScope));
        } else {
            page("/communities");
        }
    }
</script>

<Menu>
    <MenuItem>
        <Shopping size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <div slot="text">
            <a
                class="link"
                href={"https://openchat.myspreadshop.com"}
                target="_blank"
                rel="noreferrer">
                Shop
            </a>
        </div>
    </MenuItem>
    <MenuItem selected={path === "/features"} on:click={() => page("/features")}>
        <InformationOutline size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <div slot="text">{"Features"}</div>
    </MenuItem>
    <MenuItem selected={path === "/roadmap"} on:click={() => page("/roadmap")}>
        <Road size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <div slot="text">{"Roadmap"}</div>
    </MenuItem>
    <MenuItem selected={path === "/whitepaper"} on:click={() => page("/whitepaper")}>
        <Note size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <div slot="text">{"Whitepaper"}</div>
    </MenuItem>
    <MenuItem selected={path === "/architecture"} on:click={() => page("/architecture")}>
        <Graph size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <div slot="text">{"Architecture"}</div>
    </MenuItem>
    {#if showBlog}
        <MenuItem selected={path.startsWith("/blog")} on:click={() => page("/blog")}>
            <Blog size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
            <div slot="text">{"Blog"}</div>
        </MenuItem>
    {/if}
    <MenuItem selected={path.startsWith("/faq")} on:click={() => page("/faq")}>
        <Help size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
        <div slot="text">{"FAQs"}</div>
    </MenuItem>
    <MenuItem on:click={launch}>
        <div class="rocket" slot="icon">🚀</div>
        <div slot="text">{"Launch app"}</div>
    </MenuItem>
    {#if $identityState.kind === "logged_in"}
        <MenuItem separator />
        <MenuItem on:click={() => dispatch("logout")}>
            <Logout size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
            <div slot="text">{"Logout"}</div>
        </MenuItem>
    {/if}
</Menu>

<style lang="scss">
    .rocket {
        @include font-size(fs-120);
    }

    .link {
        color: inherit;
    }
</style>
