<script lang="ts">
    import Link from "./Link.svelte";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import InternetIdentityLogo from "./InternetIdentityLogo.svelte";
    import { AuthProvider, OpenChat } from "openchat-client";
    import { push, location } from "svelte-spa-router";

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    $: identityState = client.identityState;
    $: selectedAuthProviderStore = client.selectedAuthProviderStore;
    $: path = $location;

    let showAuthProviders = false;

    onMount(async () => {
        showAuthProviders = await client.showAuthProviders();
    });

    function close() {
        dispatch("close");
    }

    function launch() {
        if ($identityState === "logged_in") {
            push("/");
        } else {
            dispatch("login");
        }
    }

    function changeProvider(provider: AuthProvider) {
        selectedAuthProviderStore.set(provider);
    }
</script>

<svelte:body on:click|once={close} />

<div class="menu-items">
    <div class="menu-item">
        <Link selected={path === "/features"} mode={"menu"} path="features">Features</Link>
    </div>
    <div class="menu-item">
        <Link selected={path === "/roadmap"} mode={"menu"} path="roadmap">Roadmap</Link>
    </div>
    <div class="menu-item">
        <Link selected={path === "/whitepaper"} mode={"menu"} path="whitepaper">Whitepaper</Link>
    </div>
    <div class="menu-item">
        <Link selected={path === "/architecture"} mode={"menu"} path="architecture"
            >Architecture</Link>
    </div>
    <div class="menu-item">
        <Link selected={path === "/blog"} mode={"menu"} path="blog">Blog</Link>
    </div>
    <div class="menu-item">
        <Link on:linkClicked={launch} mode={"menu"}>Launch app</Link>
    </div>
    {#if $identityState === "logged_in"}
        <Link on:linkClicked={() => dispatch("logout")} mode={"menu"}>Logout</Link>
    {/if}
    {#if showAuthProviders}
        <div class="menu-item">
            <div
                class="provider"
                class:selected={$selectedAuthProviderStore === AuthProvider.II}
                on:click={() => changeProvider(AuthProvider.II)}>
                <div class="checked">✅</div>
                {AuthProvider.II}
                <div class="span ii-img"><InternetIdentityLogo /></div>
            </div>
        </div>
        <div class="menu-item">
            <div
                class="provider"
                class:selected={$selectedAuthProviderStore === AuthProvider.NFID}
                on:click={() => changeProvider(AuthProvider.NFID)}>
                <div class="checked">✅</div>
                {AuthProvider.NFID} (with google)
                <img class="nfid-img" src="../assets/nfid.svg" alt="" />
            </div>
        </div>
    {/if}
</div>

<style type="text/scss">
    :global(.menu-items .link) {
        @include font(bold, normal, fs-100);
    }

    .menu-items {
        @include font(bold, normal, fs-130);
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        gap: $sp5;
        align-items: flex-end;
        background: var(--landing-context-bg);
        border-radius: toRem(14);
        box-shadow: 8px 4px 16px 0px #00000030;
        padding: toRem(24) toRem(40);
        position: absolute;
        align-items: flex-end;
        justify-content: flex-start;
        right: toRem(24);
        top: toRem(70);
        flex-direction: column;
        @include z-index("landing-page-menu");
    }

    .provider {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: $sp3;

        .checked {
            display: none;
        }

        &.selected .checked {
            display: block;
        }
    }

    .ii-img,
    .nfid-img {
        display: inline-block;
        width: 20px;
        margin-left: $sp2;
    }
</style>
