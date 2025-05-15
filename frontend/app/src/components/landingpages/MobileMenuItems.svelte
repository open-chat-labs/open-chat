<script lang="ts">
    import { app, iconSize, OpenChat, pathState, routeForScope } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import Graph from "svelte-material-icons/GraphOutline.svelte";
    import Help from "svelte-material-icons/HelpCircleOutline.svelte";
    import InformationOutline from "svelte-material-icons/InformationOutline.svelte";
    import Logout from "svelte-material-icons/Logout.svelte";
    import Note from "svelte-material-icons/NoteTextOutline.svelte";
    import Blog from "svelte-material-icons/PostOutline.svelte";
    import Road from "svelte-material-icons/RoadVariant.svelte";
    import Shopping from "svelte-material-icons/ShoppingOutline.svelte";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        showBlog: boolean;
    }

    let { showBlog }: Props = $props();

    function launch() {
        if (app.identityState.kind === "logged_in") {
            page(routeForScope(app.chatListScope));
        } else {
            page("/communities");
        }
    }
</script>

<Menu>
    <MenuItem>
        {#snippet icon()}
            <Shopping size={$iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            <a
                class="link"
                href={"https://openchat.myspreadshop.com"}
                target="_blank"
                rel="noreferrer">
                Shop
            </a>
        {/snippet}
    </MenuItem>
    <MenuItem selected={pathState.location === "/features"} onclick={() => page("/features")}>
        {#snippet icon()}
            <InformationOutline size={$iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            {"Features"}
        {/snippet}
    </MenuItem>
    <MenuItem selected={pathState.location === "/roadmap"} onclick={() => page("/roadmap")}>
        {#snippet icon()}
            <Road size={$iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            {"Roadmap"}
        {/snippet}
    </MenuItem>
    <MenuItem selected={pathState.location === "/whitepaper"} onclick={() => page("/whitepaper")}>
        {#snippet icon()}
            <Note size={$iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            {"Whitepaper"}
        {/snippet}
    </MenuItem>
    <MenuItem
        selected={pathState.location === "/architecture"}
        onclick={() => page("/architecture")}>
        {#snippet icon()}
            <Graph size={$iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            {"Architecture"}
        {/snippet}
    </MenuItem>
    {#if showBlog}
        <MenuItem selected={pathState.location.startsWith("/blog")} onclick={() => page("/blog")}>
            {#snippet icon()}
                <Blog size={$iconSize} color={"var(--icon-inverted-txt)"} />
            {/snippet}
            {#snippet text()}
                {"Blog"}
            {/snippet}
        </MenuItem>
    {/if}
    <MenuItem selected={pathState.location.startsWith("/faq")} onclick={() => page("/faq")}>
        {#snippet icon()}
            <Help size={$iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            {"FAQs"}
        {/snippet}
    </MenuItem>
    <MenuItem onclick={launch}>
        {#snippet icon()}
            <div class="rocket">🚀</div>
        {/snippet}
        {#snippet text()}
            {"Launch app"}
        {/snippet}
    </MenuItem>
    {#if app.identityState.kind === "logged_in"}
        <MenuItem separator />
        <MenuItem onclick={() => client.logout()}>
            {#snippet icon()}
                <Logout size={$iconSize} color={"var(--icon-inverted-txt)"} />
            {/snippet}
            {#snippet text()}
                {"Logout"}
            {/snippet}
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
