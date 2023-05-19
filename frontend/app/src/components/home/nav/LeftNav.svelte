<script lang="ts">
    import Avatar from "../../Avatar.svelte";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import HeartOutline from "svelte-material-icons/HeartOutline.svelte";
    import Plus from "svelte-material-icons/Plus.svelte";
    import Compass from "svelte-material-icons/CompassOutline.svelte";
    import Wallet from "svelte-material-icons/WalletOutline.svelte";
    import Hamburger from "svelte-material-icons/Menu.svelte";
    import TooltipWrapper from "../../TooltipWrapper.svelte";
    import { AvatarSize, OpenChat } from "openchat-client";
    import TooltipPopup from "../../TooltipPopup.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import { _ } from "svelte-i18n";
    import page from "page";
    import { createEventDispatcher, getContext } from "svelte";
    import DirectChats from "../../icons/DirectChats.svelte";
    import CurrentUserMenu from "../CurrentUserMenu.svelte";
    import CommunityIcon from "./CommunityIcon.svelte";

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

    /* 
    let's imagine that we have: 
    - home logo
    - direct chats
    - favourite chats
    - create community
    - explore communities

    ... all my communities

    - wallet
    - menu
    - profile pic

    It just feels like too much stuff to squeeze in

    */
</script>

<div class="top">
    <TooltipWrapper gutter={-6} fill position="right" align={"center"}>
        <div slot="target" on:click={() => page("/home")} class="hover logo">
            <FancyLoader loop={false} />
        </div>
        <div slot="tooltip" let:position let:align>
            <TooltipPopup {position} {align}>
                {$_("homepage")}
            </TooltipPopup>
        </div>
    </TooltipWrapper>

    <TooltipWrapper gutter={-6} fill position="right" align={"center"}>
        <div slot="target" on:click={directChats} class="hover direct">
            <DirectChats size={$iconSize} color={"var(--icon-txt)"} />
        </div>
        <div slot="tooltip" let:position let:align>
            <TooltipPopup {position} {align}>
                {"Direct chats"}
            </TooltipPopup>
        </div>
    </TooltipWrapper>
    <TooltipWrapper gutter={-6} fill position="right" align={"center"}>
        <div slot="target" on:click={favouriteChats} class="hover favs">
            <HeartOutline size={$iconSize} color={"var(--icon-txt)"} />
        </div>
        <div slot="tooltip" let:position let:align>
            <TooltipPopup {position} {align}>
                {"Favourite chats"}
            </TooltipPopup>
        </div>
    </TooltipWrapper>
</div>

<div class="middle">
    {#each communities as community, i}
        <CommunityIcon
            on:selectCommunity={() => (selectedIndex = i)}
            {community}
            selected={i === selectedIndex} />
    {/each}
    <TooltipWrapper gutter={-6} fill position="right" align={"center"}>
        <div slot="target" on:click={createCommunity} class="hover plus">
            <Plus size={$iconSize} color={"var(--icon-txt)"} />
        </div>
        <div slot="tooltip" let:position let:align>
            <TooltipPopup {position} {align}>
                {"Create community"}
            </TooltipPopup>
        </div>
    </TooltipWrapper>
    <TooltipWrapper gutter={-6} fill position="right" align={"center"}>
        <div slot="target" on:click={exploreCommunities} class="hover explore">
            <Compass size={$iconSize} color={"var(--icon-txt)"} />
        </div>
        <div slot="tooltip" let:position let:align>
            <TooltipPopup {position} {align}>
                {"Explore communities"}
            </TooltipPopup>
        </div>
    </TooltipWrapper>
</div>

<div class="bottom">
    <TooltipWrapper gutter={-6} fill position="right" align={"center"}>
        <div slot="target" on:click={openWallet} class="hover wallet">
            <Wallet size={$iconSize} color={"var(--icon-txt)"} />
        </div>
        <div slot="tooltip" let:position let:align>
            <TooltipPopup {position} {align}>
                {"Open wallet"}
            </TooltipPopup>
        </div>
    </TooltipWrapper>

    <span class="menu">
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
    </span>

    <TooltipWrapper gutter={-6} fill position="right" align={"center"}>
        <div slot="target" on:click={() => dispatch("profile")} class="hover avatar">
            <Avatar url={client.userAvatarUrl(user)} userId={user.userId} size={avatarSize} />
        </div>
        <div slot="tooltip" let:position let:align>
            <TooltipPopup {position} {align}>
                {$_("profile.title")}
            </TooltipPopup>
        </div>
    </TooltipWrapper>
</div>

<style type="text/scss">
    :global(.hover svg path) {
        transition: fill 250ms ease-in-out;
    }
    :global(.hover:hover svg path) {
        fill: var(--icon-selected);
    }

    .top,
    .bottom,
    .middle {
        display: flex;
        align-items: center;
        flex-direction: column;
        gap: $sp5;
        width: 100%;

        @include mobile() {
            gap: $sp4;
        }
    }
    .bottom {
        gap: $sp3;
    }
    .hover {
        cursor: pointer;
        text-align: center;
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
        gap: 0;
        overflow: auto;
        @include nice-scrollbar();
    }

    .plus,
    .explore {
        margin: toRem(6) auto;
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

        &:hover {
            border-color: var(--icon-selected);
        }
    }
</style>
