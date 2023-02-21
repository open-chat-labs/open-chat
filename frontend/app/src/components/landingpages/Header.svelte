<script lang="ts">
    import { mobileWidth } from "../../stores/screenDimensions";
    import MenuItems from "./MenuItems.svelte";
    import MobileMenuItems from "./MobileMenuItems.svelte";
    import Menu from "svelte-material-icons/Menu.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { push } from "svelte-spa-router";
    import { postsBySlug } from "./blog/posts";

    let showMenu = false;
    $: showBlog = Object.values(postsBySlug).length > 0;

    function home() {
        push("/home");
    }
</script>

<div class="wrapper">
    <div class="header">
        <div class="logo" on:click={home}>
            <div class="logo-img" />
            <div class="name">OpenChat</div>
        </div>
        {#if $mobileWidth}
            <div class="menu-toggle" on:click|stopPropagation={() => (showMenu = !showMenu)}>
                {#if showMenu}
                    <Close size={"1.6em"} color={"var(--landing-txt)"} />
                    <MobileMenuItems
                        {showBlog}
                        on:close={() => (showMenu = false)}
                        on:login
                        on:logout />
                {:else}
                    <Menu size={"1.6em"} color={"var(--landing-txt)"} />
                {/if}
            </div>
        {:else}
            <div class="menu">
                <MenuItems {showBlog} on:login on:logout />
            </div>
        {/if}
    </div>
</div>

<style type="text/scss">
    .wrapper {
        width: 100%;
        padding: 0;
        margin: 0 auto;
        position: fixed;
        top: 0;
        @include z-index("landing-page-menu");
        background-color: var(--landing-header-bg);
    }

    .menu-toggle {
        cursor: pointer;
    }

    .logo {
        display: flex;
        cursor: pointer;
        gap: $sp3;
        align-items: center;

        .logo-img {
            background-image: url("../assets/spinner.svg");
            background-repeat: no-repeat;
            height: 32px;
            width: 32px;

            @include mobile() {
                height: 24px;
                width: 24px;
            }
        }

        .name {
            @include font(bold, normal, fs-130);
        }
    }

    .header {
        max-width: 1440px;
        @include lp-content-padding();

        @include mobile() {
            width: 100%;
        }

        margin: 0 auto;
        width: 100%;
        flex: 0 0 toRem(80);
        color: var(--landing-txt);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: $sp5;
        height: toRem(80);
    }
</style>
