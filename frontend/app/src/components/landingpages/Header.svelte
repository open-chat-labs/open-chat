<script lang="ts">
    import { mobileWidth } from "../../stores/screenDimensions";
    import MenuIcon from "../MenuIcon.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import MenuItems from "./MenuItems.svelte";
    import MobileMenuItems from "./MobileMenuItems.svelte";
    import Menu from "svelte-material-icons/Menu.svelte";
    import page from "page";
    import { iconSize } from "../../stores/iconSize";
    import { postsBySlug } from "./blog/posts";

    $: showBlog = Object.values(postsBySlug).length > 0;

    function home() {
        page("/home");
    }
</script>

<div class="wrapper">
    <div class="header">
        <div class="logo" on:click={home}>
            <div class="logo-img" />
            <div class="name">OpenChat</div>
        </div>
        {#if $mobileWidth}
            <MenuIcon position={"bottom"} align={"end"}>
                <div slot="icon">
                    <HoverIcon>
                        <Menu size={$iconSize} color={"var(--landing-txt)"} />
                    </HoverIcon>
                </div>
                <div slot="menu">
                    <MobileMenuItems {showBlog} on:login on:logout />
                </div>
            </MenuIcon>
        {:else}
            <div class="menu">
                <MenuItems {showBlog} on:login on:logout />
            </div>
        {/if}
    </div>
</div>

<style lang="scss">
    .wrapper {
        width: 100%;
        padding: 0;
        margin: 0 auto;
        position: fixed;
        top: 0;
        @include z-index("landing-page-menu");
        background-color: var(--landing-header-bg);
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
