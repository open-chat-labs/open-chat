<script lang="ts">
    import {
        chatListScopeStore,
        iconSize,
        identityStateStore,
        locationStore,
        OpenChat,
        routeForScope,
    } from "@client";
    import { navigate } from "@utils/navigation";
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
        if ($identityStateStore.kind === "logged_in") {
            navigate(routeForScope($chatListScopeStore));
        } else {
            navigate("/communities");
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
    <MenuItem selected={$locationStore === "/features"} onclick={() => navigate("/features")}>
        {#snippet icon()}
            <InformationOutline size={$iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            {"Features"}
        {/snippet}
    </MenuItem>
    <MenuItem selected={$locationStore === "/roadmap"} onclick={() => navigate("/roadmap")}>
        {#snippet icon()}
            <Road size={$iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            {"Roadmap"}
        {/snippet}
    </MenuItem>
    <MenuItem selected={$locationStore === "/whitepaper"} onclick={() => navigate("/whitepaper")}>
        {#snippet icon()}
            <Note size={$iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            {"Whitepaper"}
        {/snippet}
    </MenuItem>
    <MenuItem selected={$locationStore === "/architecture"} onclick={() => navigate("/architecture")}>
        {#snippet icon()}
            <Graph size={$iconSize} color={"var(--icon-inverted-txt)"} />
        {/snippet}
        {#snippet text()}
            {"Architecture"}
        {/snippet}
    </MenuItem>
    {#if showBlog}
        <MenuItem selected={$locationStore.startsWith("/blog")} onclick={() => navigate("/blog")}>
            {#snippet icon()}
                <Blog size={$iconSize} color={"var(--icon-inverted-txt)"} />
            {/snippet}
            {#snippet text()}
                {"Blog"}
            {/snippet}
        </MenuItem>
    {/if}
    <MenuItem selected={$locationStore.startsWith("/faq")} onclick={() => navigate("/faq")}>
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
    {#if $identityStateStore.kind === "logged_in"}
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
