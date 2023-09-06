<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { AuthProvider, OpenChat } from "openchat-client";
    import MenuItem from "../MenuItem.svelte";
    import InformationOutline from "svelte-material-icons/InformationOutline.svelte";
    import Road from "svelte-material-icons/RoadVariant.svelte";
    import Note from "svelte-material-icons/NoteTextOutline.svelte";
    import Graph from "svelte-material-icons/GraphOutline.svelte";
    import Blog from "svelte-material-icons/PostOutline.svelte";
    import Help from "svelte-material-icons/HelpCircleOutline.svelte";
    import Logout from "svelte-material-icons/Logout.svelte";
    import Menu from "../Menu.svelte";
    import { location, routeForScope } from "../../routes";
    import page from "page";
    import { iconSize } from "../../stores/iconSize";

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    export let showBlog: boolean;

    $: identityState = client.identityState;
    $: chatListScope = client.chatListScope;
    $: selectedAuthProviderStore = client.selectedAuthProviderStore;
    $: path = $location;

    let showAuthProviders = false;

    onMount(async () => {
        showAuthProviders = await client.showAuthProviders();
    });

    function launch() {
        if ($identityState === "logged_in") {
            page(routeForScope($chatListScope));
        } else {
            dispatch("login");
        }
    }

    function changeProvider(provider: AuthProvider) {
        selectedAuthProviderStore.set(provider);
    }
</script>

<Menu>
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
    {#if $identityState === "logged_in"}
        <MenuItem separator />
        <MenuItem on:click={() => dispatch("logout")}>
            <Logout size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
            <div slot="text">{"Logout"}</div>
        </MenuItem>
    {/if}
    {#if showAuthProviders}
        <MenuItem separator />
        <MenuItem on:click={() => changeProvider(AuthProvider.II)}>
            <div slot="icon" class="checked">
                {#if $selectedAuthProviderStore === AuthProvider.II}
                    ✅
                {/if}
            </div>

            <div slot="text">{AuthProvider.II}</div>
        </MenuItem>
        <MenuItem on:click={() => changeProvider(AuthProvider.NFID)}>
            <div slot="icon" class="checked">
                {#if $selectedAuthProviderStore === AuthProvider.NFID}
                    ✅
                {/if}
            </div>

            <div slot="text">{AuthProvider.NFID} (with google)</div>
        </MenuItem>
    {/if}
</Menu>

<style lang="scss">
    .rocket {
        @include font-size(fs-120);
    }
</style>
