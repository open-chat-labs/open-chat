<script lang="ts">
    import {
        AvatarSize,
        type CommunitySummary,
        type OpenChat,
        activityFeedShowing,
        anonUserStore,
        app,
        communityListScrollTop,
        currentUserIdStore,
        emptyCombinedUnreadCounts,
        mobileWidth,
        navOpen,
        pathState,
        publish,
        showNav,
        ui,
        userStore,
    } from "openchat-client";
    import page from "page";
    import { getContext, onMount, tick } from "svelte";
    import { type DndEvent, dndzone } from "svelte-dnd-action";
    import ArrowRight from "svelte-material-icons/ArrowExpandRight.svelte";
    import BellRingOutline from "svelte-material-icons/BellRingOutline.svelte";
    import Compass from "svelte-material-icons/CompassOutline.svelte";
    import ForumOutline from "svelte-material-icons/ForumOutline.svelte";
    import HeartOutline from "svelte-material-icons/HeartOutline.svelte";
    import Hamburger from "svelte-material-icons/Menu.svelte";
    import MessageOutline from "svelte-material-icons/MessageOutline.svelte";
    import { flip } from "svelte/animate";
    import { i18nKey } from "../../../i18n/i18n";
    import { rtlStore } from "../../../stores/rtl";
    import { disableChit, hideChitIcon } from "../../../stores/settings";
    import { now } from "../../../stores/time";
    import { isTouchDevice } from "../../../utils/devices";
    import Avatar from "../../Avatar.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import LeftNavItem from "./LeftNavItem.svelte";
    import LighteningBolt from "./LighteningBolt.svelte";
    import MainMenu from "./MainMenu.svelte";

    const client = getContext<OpenChat>("client");
    const flipDurationMs = 300;

    let user = $derived(userStore.get($currentUserIdStore));
    let avatarSize = $derived($mobileWidth ? AvatarSize.Small : AvatarSize.Default);
    let communityExplorer = $derived(pathState.route.kind === "communities_route");
    let selectedCommunityId = $derived(app.selectedCommunitySummary?.id.communityId);
    let claimChitAvailable = $derived(app.chitState.nextDailyChitClaim < $now);

    let iconSize = $mobileWidth ? "1.2em" : "1.4em"; // in this case we don't want to use the standard store
    let scrollingSection: HTMLElement;

    // we don't want drag n drop to monkey around with the key
    type CommunityItem = CommunitySummary & { _id: string };

    let communityItems = $state<CommunityItem[]>([]);

    $effect(() => {
        communityItems = app.sortedCommunities.map((c) => ({ ...c, _id: c.id.communityId }));
    });

    onMount(() => {
        tick().then(() => (scrollingSection.scrollTop = $communityListScrollTop ?? 0));
    });

    function onScroll() {
        communityListScrollTop.set(scrollingSection.scrollTop);
    }

    function handleDndConsider(e: CustomEvent<DndEvent<CommunityItem>>) {
        communityItems = e.detail.items;
    }

    function handleDndFinalize(e: CustomEvent<DndEvent<CommunityItem>>) {
        client.updateCommunityIndexes(e.detail.items);
    }

    function toggleNav(e: Event) {
        e.stopPropagation();
        ui.toggleNav();
    }

    function viewProfile() {
        activityFeedShowing.set(false);
        publish("profile");
    }

    function exploreCommunities() {
        activityFeedShowing.set(false);
        page("/communities");
    }

    function directChats() {
        activityFeedShowing.set(false);
        page("/user");
    }

    function groupChats() {
        activityFeedShowing.set(false);
        page("/group");
    }

    function favouriteChats() {
        activityFeedShowing.set(false);
        page("/favourite");
    }

    function selectCommunity(community: CommunitySummary) {
        activityFeedShowing.set(false);
        page(`/community/${community.id.communityId}`);
    }

    function closeIfOpen() {
        ui.closeNavIfOpen();
    }

    function showActivityFeed() {
        if (pathState.route.kind === "communities_route") {
            page("/");
        }
        activityFeedShowing.set(true);
    }
</script>

<svelte:body onclick={closeIfOpen} />

<section class:visible={$showNav} class="nav" class:open={$navOpen} class:rtl={$rtlStore}>
    <div class="top">
        <LeftNavItem separator label={i18nKey("communities.mainMenu")}>
            <div class="hover logo">
                <MenuIcon position="right" align="start" gutter={20}>
                    {#snippet menuIcon()}
                        <HoverIcon>
                            <Hamburger size={iconSize} color={"var(--icon-txt)"} />
                        </HoverIcon>
                    {/snippet}
                    {#snippet menuItems()}
                        <MainMenu />
                    {/snippet}
                </MenuIcon>
            </div>
        </LeftNavItem>
        {#if user !== undefined}
            <LeftNavItem label={i18nKey("profile.title")} onClick={viewProfile}>
                <Avatar url={client.userAvatarUrl(user)} userId={user.userId} size={avatarSize} />
            </LeftNavItem>
        {/if}
        <LeftNavItem
            selected={app.chatListScope.kind === "direct_chat" && !communityExplorer}
            label={i18nKey("communities.directChats")}
            unread={app.unreadDirectCounts.chats}
            video={app.directVideoCallCounts}
            onClick={directChats}>
            <div class="hover direct">
                <MessageOutline size={iconSize} color={"var(--icon-txt)"} />
            </div>
        </LeftNavItem>
        <LeftNavItem
            selected={app.chatListScope.kind === "group_chat" && !communityExplorer}
            label={i18nKey("communities.groupChats")}
            unread={client.mergeCombinedUnreadCounts(app.unreadGroupCounts)}
            video={app.groupVideoCallCounts}
            onClick={groupChats}>
            <div class="hover direct">
                <ForumOutline size={iconSize} color={"var(--icon-txt)"} />
            </div>
        </LeftNavItem>
        {#if app.favourites.size > 0}
            <LeftNavItem
                selected={app.chatListScope.kind === "favourite" && !communityExplorer}
                label={i18nKey("communities.favourites")}
                unread={client.mergeCombinedUnreadCounts(app.unreadFavouriteCounts)}
                video={app.favouritesVideoCallCounts}
                onClick={favouriteChats}>
                <div class="hover favs">
                    <HeartOutline size={iconSize} color={"var(--icon-txt)"} />
                </div>
            </LeftNavItem>
        {/if}
        {#if !$anonUserStore}
            {#if !$disableChit && (claimChitAvailable || !$hideChitIcon)}
                <LeftNavItem
                    label={i18nKey(
                        claimChitAvailable ? "dailyChit.extendStreak" : "dailyChit.viewStreak",
                    )}
                    onClick={() => publish("claimDailyChit")}>
                    <div class="hover streak">
                        <LighteningBolt enabled={claimChitAvailable} />
                    </div>
                </LeftNavItem>
            {/if}
            {#if app.messageActivitySummary.latestTimestamp > 0n}
                <LeftNavItem
                    separator
                    selected={$activityFeedShowing}
                    label={i18nKey("activity.navLabel")}
                    unread={{
                        muted: 0,
                        unmuted: app.messageActivitySummary.unreadCount,
                        mentions: false,
                    }}
                    onClick={showActivityFeed}>
                    <div class="hover activity">
                        <BellRingOutline size={iconSize} color={"var(--icon-txt)"} />
                    </div>
                </LeftNavItem>
            {/if}
        {/if}
    </div>

    <div
        use:dndzone={{
            items: communityItems,
            flipDurationMs,
            dropTargetStyle: { outline: "var(--accent) solid 2px" },
            dragDisabled: isTouchDevice,
        }}
        onscroll={onScroll}
        bind:this={scrollingSection}
        onconsider={handleDndConsider}
        onfinalize={handleDndFinalize}
        class="middle">
        {#each communityItems as community (community._id)}
            <div animate:flip={{ duration: flipDurationMs }}>
                <LeftNavItem
                    selected={community.id.communityId === selectedCommunityId &&
                        app.chatListScope.kind !== "favourite" &&
                        !communityExplorer}
                    video={app.communityChannelVideoCallCounts.get(community.id) ?? {
                        muted: 0,
                        unmuted: 0,
                    }}
                    unread={client.mergeCombinedUnreadCounts(
                        app.unreadCommunityChannelCounts.get(community.id) ??
                            emptyCombinedUnreadCounts(),
                    )}
                    label={i18nKey(community.name)}
                    verified={community.verified}
                    onClick={() => selectCommunity(community)}>
                    <Avatar
                        selected={community.id.communityId === selectedCommunityId &&
                            app.chatListScope.kind !== "favourite" &&
                            !communityExplorer}
                        url={client.communityAvatarUrl(community.id.communityId, community.avatar)}
                        size={avatarSize} />
                </LeftNavItem>
            </div>
        {/each}
    </div>

    <div class="bottom">
        <LeftNavItem
            selected={communityExplorer}
            label={i18nKey("communities.explore")}
            onClick={exploreCommunities}>
            <div class="explore hover">
                <Compass size={iconSize} color={"var(--icon-txt)"} />
            </div>
        </LeftNavItem>
        <LeftNavItem label={$navOpen ? i18nKey("collapse") : i18nKey("expand")}>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class:open={$navOpen} onclick={toggleNav} class="expand hover">
                <ArrowRight size={iconSize} color={"var(--icon-txt)"} />
            </div>
        </LeftNavItem>
    </div>
</section>

<style lang="scss">
    :global(.hover svg path) {
        transition: fill 250ms ease-in-out;
    }

    @media (hover: hover) {
        :global(.left-nav-item .avatar:not(.selected):hover) {
            box-shadow: 0 0 0 1px var(--icon-selected);
        }

        :global(.left-nav-item:hover .hover svg path) {
            fill: var(--icon-selected);
        }

        :global(.left-nav-item:hover .hover) {
            border-color: var(--icon-selected);
        }
    }

    :global(.left-nav-item.selected svg path) {
        fill: var(--icon-selected);
    }

    :global(.left-nav-item.selected) {
        .explore {
            border: 1px solid var(--icon-selected);
        }
    }

    $size: toRem(48);
    $mobile-size: toRem(40);

    .nav {
        position: absolute;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        width: toRem(80);
        overflow-x: hidden;
        height: 100%;
        background: var(--panel-nav-bg);
        padding: $sp2 0;
        border-right: var(--bw) solid var(--bd);
        @include z-index("left-nav");
        transition: width 250ms ease-in-out;
        overflow: auto;
        overflow-x: hidden;

        &.rtl {
            border-right: none;
            border-left: var(--bw) solid var(--bd);
        }

        @include mobile() {
            width: toRem(60);
            padding: $sp1 0;
        }

        &.open {
            width: toRem(350);
            box-shadow: 10px 0 10px rgba(0, 0, 0, 0.1);

            @include mobile() {
                width: toRem(300);
            }
        }

        &:not(.visible) {
            display: none;
        }
    }

    .top,
    .bottom,
    .middle {
        display: flex;
        flex-direction: column;
    }
    .logo {
        width: $size;
        height: $size;
        margin: auto;

        @include mobile() {
            width: $mobile-size;
            height: $mobile-size;
        }
    }

    .middle {
        flex: auto;
        overflow-x: hidden;
        scrollbar-width: none;
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

    .expand {
        transition: transform 250ms ease-in-out;

        &.open {
            transform: rotate(-180deg);
        }
    }
</style>
