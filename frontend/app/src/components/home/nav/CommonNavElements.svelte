<script lang="ts">
    import Hamburger from "svelte-material-icons/Menu.svelte";
    import MessageOutline from "svelte-material-icons/MessageOutline.svelte";
    import ForumOutline from "svelte-material-icons/ForumOutline.svelte";
    import HeartOutline from "svelte-material-icons/HeartOutline.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import NavItem from "./NavItem.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import MainMenu from "./MainMenu.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import { AvatarSize, type OpenChat, type UserSummary } from "openchat-client";
    import Avatar from "../../Avatar.svelte";
    import { pathParams } from "../../../routes";
    import page from "page";
    import type { Alignment, Position } from "../../../utils/alignment";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let menuPosition: Position = "right";
    export let menuAlignment: Alignment = "start";
    export let menuGutter: number = 20;
    export let orientation: "vertical" | "horizontal" = "vertical";

    let iconSize = $mobileWidth ? "1.2em" : "1.4em"; // in this case we don't want to use the standard store

    $: createdUser = client.user;
    $: userStore = client.userStore;
    $: user = $userStore[$createdUser.userId] as UserSummary | undefined; // annoying that this annotation is necessary
    $: chatListScope = client.chatListScope;
    $: avatarSize = $mobileWidth ? AvatarSize.Small : AvatarSize.Default;
    $: anonUser = client.anonUser;
    $: communityExplorer = $pathParams.kind === "communities_route";
    $: unreadDirectCounts = client.unreadDirectCounts;
    $: directVideoCallCounts = client.directVideoCallCounts;
    $: groupVideoCallCounts = client.groupVideoCallCounts;
    $: unreadGroupCounts = client.unreadGroupCounts;
    $: unreadFavouriteCounts = client.unreadFavouriteCounts;
    $: favouritesVideoCallCounts = client.favouritesVideoCallCounts;
</script>

{#if orientation === "vertical"}
    <NavItem separator {orientation} label={i18nKey("communities.mainMenu")}>
        <div class="hover logo">
            <MenuIcon position={menuPosition} align={menuAlignment} gutter={menuGutter}>
                <span slot="icon">
                    <HoverIcon>
                        <Hamburger size={iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                </span>
                <span slot="menu">
                    <MainMenu on:wallet on:halloffame on:upgrade on:profile />
                </span>
            </MenuIcon>
        </div>
    </NavItem>
{/if}

{#if user !== undefined}
    <NavItem {orientation} label={i18nKey("profile.title")} on:click={() => dispatch("profile")}>
        <Avatar url={client.userAvatarUrl(user)} userId={user.userId} size={avatarSize} />
    </NavItem>
{/if}

<NavItem
    {orientation}
    selected={$chatListScope.kind === "direct_chat" && !communityExplorer}
    label={i18nKey("communities.directChats")}
    disabled={$anonUser}
    unread={$unreadDirectCounts.chats}
    video={$directVideoCallCounts}
    on:click={() => page("/user")}>
    <div class="hover direct">
        <MessageOutline size={iconSize} color={"var(--icon-txt)"} />
    </div>
</NavItem>

<NavItem
    {orientation}
    selected={$chatListScope.kind === "group_chat" && !communityExplorer}
    label={i18nKey("communities.groupChats")}
    unread={client.mergeCombinedUnreadCounts($unreadGroupCounts)}
    video={$groupVideoCallCounts}
    on:click={() => page("/group")}>
    <div class="hover direct">
        <ForumOutline size={iconSize} color={"var(--icon-txt)"} />
    </div>
</NavItem>

<NavItem
    {orientation}
    separator={orientation === "vertical"}
    selected={$chatListScope.kind === "favourite" && !communityExplorer}
    disabled={$anonUser}
    label={i18nKey("communities.favourites")}
    unread={client.mergeCombinedUnreadCounts($unreadFavouriteCounts)}
    video={$favouritesVideoCallCounts}
    on:click={() => page("/favourite")}>
    <div class="hover favs">
        <HeartOutline size={iconSize} color={"var(--icon-txt)"} />
    </div>
</NavItem>

<style lang="scss">
    :global(.hover svg path) {
        transition: fill 250ms ease-in-out;
    }

    @media (hover: hover) {
        :global(.nav-item .avatar:not(.selected):hover) {
            box-shadow: 0 0 0 1px var(--icon-selected);
        }

        :global(.nav-item:hover .hover svg path) {
            fill: var(--icon-selected);
        }

        :global(.nav-item:hover .hover) {
            border-color: var(--icon-selected);
        }
    }

    :global(.nav-item.selected svg path) {
        fill: var(--icon-selected);
    }

    $size: toRem(48);
    $mobile-size: toRem(40);

    .logo {
        width: $size;
        height: $size;
        margin: auto;

        @include mobile() {
            width: $mobile-size;
            height: $mobile-size;
        }
    }

    .hover {
        width: $size;
        height: $size;
        border: 1px solid transparent;
        border-radius: var(--nav-icon-rd);
        background: var(--icon-hv);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: border-color 250ms ease-in-out;

        @include mobile() {
            width: $mobile-size;
            height: $mobile-size;
        }
    }
</style>
