<script lang="ts">
    import Avatar from "../../Avatar.svelte";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import Panel from "../../Panel.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import HeartOutline from "svelte-material-icons/HeartOutline.svelte";
    import Plus from "svelte-material-icons/Plus.svelte";
    import Compass from "svelte-material-icons/CompassOutline.svelte";
    import Wallet from "svelte-material-icons/WalletOutline.svelte";
    import Hamburger from "svelte-material-icons/DotsVertical.svelte";
    import { AvatarSize, OpenChat } from "openchat-client";
    import { iconSize } from "../../../stores/iconSize";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import { _ } from "svelte-i18n";
    import { pathParams } from "../../../routes";
    import page from "page";
    import { createEventDispatcher, getContext } from "svelte";
    import DirectChats from "../../icons/DirectChats.svelte";
    import CurrentUserMenu from "../CurrentUserMenu.svelte";
    import LeftNavItem from "./LeftNavItem.svelte";
    import LandingPageMenu from "./LandingPageMenu.svelte";
    import { navOpen } from "stores/layout";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();
    const createdUser = client.user;
    $: userStore = client.userStore;
    $: user = $userStore[createdUser.userId];
    $: avatarSize = $mobileWidth ? AvatarSize.Small : AvatarSize.Default;

    let selectedIndex = 0;

    const communities = [
        {
            name: "OpenChat Community",
            url: "../assets/evil-robot.svg",
        },
        {
            name: "SNS1 Idiots",
            url: "../assets/sns1_medium.png",
        },
        {
            name: "ckBTC Enthusiasts",
            url: "../assets/ckbtc_nobackground.png",
        },
        {
            name: "8Year Gang",
            url: "../assets/unknownUserAvatar.svg",
        },
        {
            name: "/biz Nazis",
            url: "../assets/unknownUserAvatar.svg",
        },
        {
            name: "Community One",
            url: "../assets/unknownUserAvatar.svg",
        },
        {
            name: "Community Two",
            url: "../assets/unknownUserAvatar.svg",
        },
        {
            name: "Community Three",
            url: "../assets/unknownUserAvatar.svg",
        },
        {
            name: "Community Four",
            url: "../assets/unknownUserAvatar.svg",
        },
        {
            name: "Community Five",
            url: "../assets/unknownUserAvatar.svg",
        },
    ];

    function createCommunity() {
        console.log("create community");
    }

    function exploreCommunities() {
        page("/communities");
    }

    function directChats() {
        console.log("direct chats");
    }

    function favouriteChats() {
        console.log("favourite chats");
    }

    function openWallet() {
        dispatch("wallet");
        console.log("favourite chats");
    }

    function selectCommunity(idx: number) {
        selectedIndex = idx;
        page("/"); // TODO - we will need a new route here to represent the selected community
    }
</script>

<Panel on:click={() => navOpen.set(false)} nav>
    <div class="top">
        <LeftNavItem separator label={$_("homepage")} on:click={() => page("/home")}>
            <div class="hover logo">
                <FancyLoader loop={false} />
            </div>
            <div slot="menu">
                <LandingPageMenu />
            </div>
        </LeftNavItem>

        {#if user !== undefined}
            <LeftNavItem label={$_("profile.label")} on:click={() => dispatch("profile")}>
                <Avatar url={client.userAvatarUrl(user)} userId={user.userId} size={avatarSize} />
                <div slot="menu">
                    <MenuIcon>
                        <span slot="icon">
                            <HoverIcon>
                                <Hamburger size={$iconSize} color={"var(--icon-txt)"} />
                            </HoverIcon>
                        </span>
                        <span slot="menu">
                            <CurrentUserMenu
                                on:halloffame
                                on:logout
                                on:newGroup
                                on:profile
                                on:showHomePage
                                on:upgrade
                                on:wallet
                                on:whatsHot />
                        </span>
                    </MenuIcon>
                </div>
            </LeftNavItem>
        {/if}

        <LeftNavItem label={"Open wallet"} on:click={openWallet}>
            <div class="hover wallet">
                <Wallet size={$iconSize} color={"var(--icon-txt)"} />
            </div>
        </LeftNavItem>

        <LeftNavItem label={"Direct chats"} on:click={directChats}>
            <div class="hover direct">
                <DirectChats size={$iconSize} color={"var(--icon-txt)"} />
            </div>
        </LeftNavItem>

        <LeftNavItem separator label={"Favourite chats"} on:click={favouriteChats}>
            <div class="hover favs">
                <HeartOutline size={$iconSize} color={"var(--icon-txt)"} />
            </div>
        </LeftNavItem>
    </div>

    <div class="middle">
        {#each communities as community, i}
            <LeftNavItem
                selected={i === selectedIndex}
                label={community.name}
                on:click={() => selectCommunity(i)}>
                <Avatar selected={i === selectedIndex} url={community.url} size={avatarSize} />
            </LeftNavItem>
        {/each}
    </div>

    <div class="bottom">
        <LeftNavItem label={"Create community"} on:click={createCommunity}>
            <div class="plus hover">
                <Plus size={$iconSize} color={"var(--icon-txt)"} />
            </div>
        </LeftNavItem>
        <LeftNavItem
            selected={$pathParams.kind === "communities_route"}
            label={"Explore communities"}
            on:click={exploreCommunities}>
            <div class="explore hover">
                <Compass size={$iconSize} color={"var(--icon-txt)"} />
            </div>
        </LeftNavItem>
    </div>
</Panel>

<style type="text/scss">
    :global(.hover svg path) {
        transition: fill 250ms ease-in-out;
    }

    :global(.left-nav-item:hover .hover svg path) {
        fill: var(--icon-selected);
    }

    :global(.left-nav-item:hover .hover) {
        border-color: var(--icon-selected);
    }

    :global(.left-nav-item.selected svg path) {
        fill: var(--icon-selected);
    }

    :global(.left-nav-item.selected) {
        .path,
        .explore {
            border: 2px solid var(--icon-selected);
        }
    }

    .top,
    .bottom,
    .middle {
        display: flex;
        flex-direction: column;
    }
    .bottom {
        gap: $sp3;
    }
    .logo {
        width: toRem(48);
        height: toRem(48);
        margin: auto;

        @include mobile() {
            width: toRem(35);
            height: toRem(35);
        }
    }

    .middle {
        flex: auto;
        overflow-x: hidden;
        @include nice-scrollbar();
    }

    .hover {
        width: toRem(48);
        height: toRem(48);
        border: 2px solid transparent;
        border-radius: 50%;
        background: var(--icon-hv);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: border-color 250ms ease-in-out;

        @include mobile() {
            width: toRem(35);
            height: toRem(35);
        }
    }
</style>
