<script lang="ts">
    import Link from "./Link.svelte";
    import Launch from "./Launch.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import type { OpenChat } from "openchat-client";
    import { location } from "../../routes";

    export let showBlog: boolean;

    const client = getContext<OpenChat>("client");
    $: identityState = client.identityState;

    const dispatch = createEventDispatcher();
    $: path = $location;
</script>

<div class="menu-items">
    <div class="nav">
        <div class="menu-item">
            <Link selected={path === "/features"} mode={"menu"} path="features">Features</Link>
        </div>
        <div class="menu-item">
            <Link selected={path === "/roadmap"} mode={"menu"} path="roadmap">Roadmap</Link>
        </div>
        <div class="menu-item">
            <Link selected={path === "/whitepaper"} mode={"menu"} path="whitepaper"
                >Whitepaper</Link>
        </div>
        <div class="menu-item">
            <Link selected={path === "/architecture"} mode={"menu"} path="architecture"
                >Architecture</Link>
        </div>
        {#if showBlog}
            <div class="menu-item">
                <Link selected={path.startsWith("/blog")} mode={"menu"} path="blog">Blog</Link>
            </div>
        {/if}
        <div class="menu-item">
            <Link selected={path.startsWith("/faq")} mode={"menu"} path="faq">FAQs</Link>
        </div>
        {#if $identityState === "logged_in"}
            <Link on:linkClicked={() => dispatch("logout")} mode={"menu"}>Logout</Link>
        {/if}
        <div class="menu-item">
            <Launch on:login />
        </div>
    </div>
</div>

<style type="text/scss">
    .menu-items {
        @include font(bold, normal, fs-100);
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        gap: $sp5;

        .nav {
            display: flex;
            justify-content: flex-start;
            align-items: center;
            gap: $sp5;
        }
    }
</style>
