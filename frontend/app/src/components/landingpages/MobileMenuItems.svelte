<script lang="ts">
    import { getContext } from "svelte";
    import { identityState, chatListScopeStore as chatListScope, OpenChat } from "openchat-client";
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

    const client = getContext<OpenChat>("client");

    interface Props {
        showBlog: boolean;
    }

    let { showBlog }: Props = $props();

    let path = $derived($location);

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
    <MenuItem selected={path === "/features"} onclick={() => page("/features")}>
        {#snippet icon()}
            <InformationOutline size={$iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            {"Features"}
        {/snippet}
    </MenuItem>
    <MenuItem selected={path === "/roadmap"} onclick={() => page("/roadmap")}>
        {#snippet icon()}
            <Road size={$iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            {"Roadmap"}
        {/snippet}
    </MenuItem>
    <MenuItem selected={path === "/whitepaper"} onclick={() => page("/whitepaper")}>
        {#snippet icon()}
            <Note size={$iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            {"Whitepaper"}
        {/snippet}
    </MenuItem>
    <MenuItem selected={path === "/architecture"} onclick={() => page("/architecture")}>
        {#snippet icon()}
            <Graph size={$iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            {"Architecture"}
        {/snippet}
    </MenuItem>
    {#if showBlog}
        <MenuItem selected={path.startsWith("/blog")} onclick={() => page("/blog")}>
            {#snippet icon()}
                <Blog size={$iconSize} color={"var(--icon-inverted-txt)"} />
            {/snippet}
            {#snippet text()}
                {"Blog"}
            {/snippet}
        </MenuItem>
    {/if}
    <MenuItem selected={path.startsWith("/faq")} onclick={() => page("/faq")}>
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
    {#if $identityState.kind === "logged_in"}
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
