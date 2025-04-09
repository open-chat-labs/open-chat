<script lang="ts">
    import Link from "./Link.svelte";
    import Launch from "./Launch.svelte";
    import { getContext } from "svelte";
    import { identityState, OpenChat, pathState } from "openchat-client";

    const client = getContext<OpenChat>("client");

    interface Props {
        showBlog: boolean;
    }

    let { showBlog }: Props = $props();
</script>

<div class="menu-items">
    <div class="nav">
        <div class="menu-item">
            <a href={"https://openchat.myspreadshop.com"} target="_blank" rel="noreferrer">
                Shop
            </a>
        </div>
        <div class="menu-item">
            <Link selected={pathState.location === "/features"} mode={"menu"} path="features"
                >Features</Link>
        </div>
        <div class="menu-item">
            <Link selected={pathState.location === "/roadmap"} mode={"menu"} path="roadmap"
                >Roadmap</Link>
        </div>
        <div class="menu-item">
            <Link selected={pathState.location === "/whitepaper"} mode={"menu"} path="whitepaper"
                >Whitepaper</Link>
        </div>
        <div class="menu-item">
            <Link
                selected={pathState.location === "/architecture"}
                mode={"menu"}
                path="architecture">Architecture</Link>
        </div>
        {#if showBlog}
            <div class="menu-item">
                <Link selected={pathState.location.startsWith("/blog")} mode={"menu"} path="blog"
                    >Blog</Link>
            </div>
        {/if}
        <div class="menu-item">
            <Link selected={pathState.location.startsWith("/faq")} mode={"menu"} path="faq"
                >FAQs</Link>
        </div>
        {#if $identityState.kind === "logged_in"}
            <Link onLinkClicked={() => client.logout()} mode={"menu"}>Logout</Link>
        {/if}
        <div class="menu-item">
            <Launch />
        </div>
    </div>
</div>

<style lang="scss">
    a {
        color: inherit;
    }

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
