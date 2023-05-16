<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { AuthProvider, OpenChat } from "openchat-client";
    import MenuItem from "../MenuItem.svelte";
    import Menu from "../Menu.svelte";
    import { location } from "../../routes";
    import page from "page";

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    export let showBlog: boolean;

    $: identityState = client.identityState;
    $: selectedAuthProviderStore = client.selectedAuthProviderStore;
    $: path = $location;

    let showAuthProviders = false;

    onMount(async () => {
        showAuthProviders = await client.showAuthProviders();
    });

    function launch() {
        if ($identityState === "logged_in") {
            page("/");
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
        <div slot="text">{"Features"}</div>
    </MenuItem>
    <MenuItem selected={path === "/roadmap"} on:click={() => page("/roadmap")}>
        <div slot="text">{"Roadmap"}</div>
    </MenuItem>
    <MenuItem selected={path === "/whitepaper"} on:click={() => page("/whitepaper")}>
        <div slot="text">{"Whitepaper"}</div>
    </MenuItem>
    <MenuItem selected={path === "/architecture"} on:click={() => page("/architecture")}>
        <div slot="text">{"Architecture"}</div>
    </MenuItem>
    {#if showBlog}
        <MenuItem selected={path.startsWith("/blog")} on:click={() => page("/blog")}>
            <div slot="text">{"Blog"}</div>
        </MenuItem>
    {/if}
    <MenuItem selected={path.startsWith("/faq")} on:click={() => page("/faq")}>
        <div slot="text">{"FAQs"}</div>
    </MenuItem>
    <MenuItem on:click={launch}>
        <div slot="text">{"Launch app"}</div>
    </MenuItem>
    {#if $identityState === "logged_in"}
        <MenuItem on:click={() => dispatch("logout")}>
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
