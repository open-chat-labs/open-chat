<script lang="ts">
    import Avatar from "../../Avatar.svelte";
    import Panel from "../../Panel.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import HeartOutline from "svelte-material-icons/HeartOutline.svelte";
    import Compass from "svelte-material-icons/CompassOutline.svelte";
    import Wallet from "svelte-material-icons/WalletOutline.svelte";
    import Hamburger from "svelte-material-icons/Menu.svelte";
    import ArrowRight from "svelte-material-icons/ArrowExpandRight.svelte";
    import MessageOutline from "svelte-material-icons/MessageOutline.svelte";
    import ForumOutline from "svelte-material-icons/ForumOutline.svelte";
    import { AvatarSize, CommunitySummary, OpenChat } from "openchat-client";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import CommunityMenu from "../communities/CommunityMenu.svelte";
    import { _ } from "svelte-i18n";
    import { pathParams } from "../../../routes";
    import page from "page";
    import { createEventDispatcher, getContext } from "svelte";
    import DirectChats from "../../icons/DirectChats.svelte";
    import LeftNavItem from "./LeftNavItem.svelte";
    import MainMenu from "./MainMenu.svelte";
    import { navOpen } from "../../../stores/layout";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();
    const createdUser = client.user;
    $: userStore = client.userStore;
    $: user = $userStore[createdUser.userId];
    $: avatarSize = $mobileWidth ? AvatarSize.Small : AvatarSize.Default;
    $: communities = client.communitiesList;
    $: selectedCommunity = client.selectedCommunity;

    let iconSize = $mobileWidth ? "1.2em" : "1.4em"; // in this case we don't want to use the standard store

    function toggleNav() {
        if ($navOpen) {
            navOpen.set(false);
        } else {
            navOpen.set(true);
        }
    }

    function exploreCommunities() {
        page("/communities");
    }

    function directChats() {
        console.log("TODO - direct chats");
        page("/user");
    }

    function groupChats() {
        console.log("TODO - group chats");
        page("/group");
    }

    function favouriteChats() {
        console.log("TODO - favourite chats");
        page("/favourite");
    }

    function openWallet() {
        dispatch("wallet");
    }

    function selectCommunity(community: CommunitySummary) {
        page(`/community/${community.id.communityId}`);
    }

    function closeIfOpen() {
        if ($navOpen) {
            navOpen.set(false);
        }
    }
</script>

<svelte:body on:click={closeIfOpen} />

<Panel nav>
    <div class="top">
        <LeftNavItem separator label={$_("communities.mainMenu")}>
            <div class="hover logo">
                <MenuIcon position="right" align="start" gutter={20}>
                    <span slot="icon">
                        <HoverIcon>
                            <Hamburger size={iconSize} color={"var(--icon-txt)"} />
                        </HoverIcon>
                    </span>
                    <span slot="menu">
                        <MainMenu on:newGroup on:halloffame on:logout on:upgrade />
                    </span>
                </MenuIcon>
            </div>
        </LeftNavItem>

        {#if user !== undefined}
            <LeftNavItem label={$_("profile.title")} on:click={() => dispatch("profile")}>
                <Avatar url={client.userAvatarUrl(user)} userId={user.userId} size={avatarSize} />
            </LeftNavItem>
        {/if}

        <LeftNavItem label={$_("wallet")} on:click={openWallet}>
            <div class="hover wallet">
                <Wallet size={iconSize} color={"var(--icon-txt)"} />
            </div>
        </LeftNavItem>

        <LeftNavItem label={$_("communities.directChats")} on:click={directChats}>
            <div class="hover direct">
                <MessageOutline size={iconSize} color={"var(--icon-txt)"} />
            </div>
        </LeftNavItem>

        <LeftNavItem label={$_("communities.groupChats")} on:click={groupChats}>
            <div class="hover direct">
                <ForumOutline size={iconSize} color={"var(--icon-txt)"} />
            </div>
        </LeftNavItem>

        <LeftNavItem separator label={$_("communities.favourites")} on:click={favouriteChats}>
            <div class="hover favs">
                <HeartOutline size={iconSize} color={"var(--icon-txt)"} />
            </div>
        </LeftNavItem>
    </div>

    <div class="middle">
        {#each $communities as community, i}
            <LeftNavItem
                selected={community === $selectedCommunity}
                unread={0}
                label={community.name}
                on:click={() => selectCommunity(community)}>
                <Avatar
                    selected={community === $selectedCommunity}
                    url={client.communityAvatarUrl(community.avatar)}
                    size={avatarSize} />
                <div slot="menu">
                    <CommunityMenu
                        on:deleteCommunity
                        on:leaveCommunity
                        on:communityDetails
                        on:newChannel
                        {community} />
                </div>
            </LeftNavItem>
        {/each}
    </div>

    <div class="bottom">
        <LeftNavItem
            selected={$pathParams.kind === "communities_route"}
            label={"Explore communities"}
            on:click={exploreCommunities}>
            <div class="explore hover">
                <Compass size={iconSize} color={"var(--icon-txt)"} />
            </div>
        </LeftNavItem>
        <LeftNavItem label={"Collapse"}>
            <div class:open={$navOpen} on:click|stopPropagation={toggleNav} class="expand hover">
                <ArrowRight size={iconSize} color={"var(--icon-txt)"} />
            </div>
        </LeftNavItem>
    </div>
</Panel>

<style lang="scss">
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
        .explore {
            border: 1px solid var(--icon-selected);
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
        border: 1px solid transparent;
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

    .expand {
        transition: transform 250ms ease-in-out;

        &.open {
            transform: rotate(-180deg);
        }
    }
</style>
