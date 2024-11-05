<script lang="ts">
    import Avatar from "../../Avatar.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import HeartOutline from "svelte-material-icons/HeartOutline.svelte";
    import Compass from "svelte-material-icons/CompassOutline.svelte";
    import Hamburger from "svelte-material-icons/Menu.svelte";
    import ArrowRight from "svelte-material-icons/ArrowExpandRight.svelte";
    import MessageOutline from "svelte-material-icons/MessageOutline.svelte";
    import ForumOutline from "svelte-material-icons/ForumOutline.svelte";
    import BellRingOutline from "svelte-material-icons/BellRingOutline.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import { communityListScrollTop } from "../../../stores/scrollPos";
    import { pathParams } from "../../../routes";
    import page from "page";
    import { createEventDispatcher, getContext, onDestroy, onMount, tick } from "svelte";
    import LeftNavItem from "./LeftNavItem.svelte";
    import MainMenu from "./MainMenu.svelte";
    import { navOpen } from "../../../stores/layout";
    import { flip } from "svelte/animate";
    import { type DndEvent, dndzone } from "svelte-dnd-action";
    import { isTouchDevice } from "../../../utils/devices";
    import { rtlStore } from "../../../stores/rtl";
    import { i18nKey } from "../../../i18n/i18n";
    import { now } from "../../../stores/time";
    import LighteningBolt from "./LighteningBolt.svelte";
    import { activityFeedShowing } from "../../../stores/activity";
    import {
        AvatarSize,
        type CommunitySummary,
        type OpenChat,
        emptyCombinedUnreadCounts,
        userStore,
        chitStateStore as chitState,
        currentUser as createdUser,
        communitiesList as communities,
        selectedCommunity,
        chatListScopeStore as chatListScope,
        unreadDirectCounts,
        unreadActivityCount,
        directVideoCallCounts,
        groupVideoCallCounts,
        favouritesVideoCallCounts,
        unreadGroupCounts,
        unreadFavouriteCounts,
        unreadCommunityChannelCounts,
        communityChannelVideoCallCounts,
        anonUser,
        globalStateStore as globalState,
    } from "openchat-client";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();
    const flipDurationMs = 300;

    $: user = $userStore.get($createdUser.userId);
    $: avatarSize = $mobileWidth ? AvatarSize.Small : AvatarSize.Default;
    $: communityExplorer = $pathParams.kind === "communities_route";
    $: selectedCommunityId = $selectedCommunity?.id.communityId;
    $: claimChitAvailable = $chitState.nextDailyChitClaim < $now;

    let iconSize = $mobileWidth ? "1.2em" : "1.4em"; // in this case we don't want to use the standard store
    let scrollingSection: HTMLElement;
    let navWrapper: HTMLElement;

    // we don't want drag n drop to monkey around with the key
    type CommunityItem = CommunitySummary & { _id: string };
    let communityItems: CommunityItem[] = [];
    let dragging = false;

    onMount(() => {
        const unsub = communities.subscribe(initCommunitiesList);
        tick().then(() => (scrollingSection.scrollTop = $communityListScrollTop ?? 0));
        return unsub;
    });

    onDestroy(() => {
        communityListScrollTop.set(scrollingSection?.scrollTop);
    });

    function initCommunitiesList(communities: CommunitySummary[]) {
        // we don't want to allow the list to update if we're in the middle of dragging
        if (dragging) return;

        communityItems = communities.map((c) => ({
            ...c,
            _id: c.id.communityId,
        }));
    }

    function reindex(communities: CommunitySummary[]): CommunitySummary[] {
        return communities.map((item, i) => ({
            ...item,
            membership: {
                ...item.membership,
                index: communities.length - i,
            },
        }));
    }

    function handleDndConsider(e: CustomEvent<DndEvent<CommunityItem>>) {
        dragging = true;
        communityItems = e.detail.items;
    }

    function resetScroll(el: HTMLElement | undefined) {
        if (el) {
            el.scrollLeft = 0;
        }
    }

    function handleDndFinalize(e: CustomEvent<DndEvent<CommunityItem>>) {
        dragging = false;
        communityItems = e.detail.items;
        resetScroll(navWrapper);
        resetScroll(scrollingSection);
        client.updateCommunityIndexes(reindex(e.detail.items));
    }

    function toggleNav() {
        if ($navOpen) {
            navOpen.set(false);
        } else {
            navOpen.set(true);
        }
    }

    function viewProfile() {
        activityFeedShowing.set(false);
        dispatch("profile");
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
        if ($navOpen) {
            navOpen.set(false);
        }
    }

    function showActivityFeed() {
        if ($pathParams.kind === "communities_route") {
            page("/");
        }
        activityFeedShowing.set(true);
    }
</script>

<svelte:body on:click={closeIfOpen} />

<section bind:this={navWrapper} class="nav" class:open={$navOpen} class:rtl={$rtlStore}>
    <div class="top">
        <LeftNavItem separator label={i18nKey("communities.mainMenu")}>
            <div class="hover logo">
                <MenuIcon position="right" align="start" gutter={20}>
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
        </LeftNavItem>
        {#if user !== undefined}
            <LeftNavItem label={i18nKey("profile.title")} on:click={viewProfile}>
                <Avatar url={client.userAvatarUrl(user)} userId={user.userId} size={avatarSize} />
            </LeftNavItem>
        {/if}
        <LeftNavItem
            selected={$chatListScope.kind === "direct_chat" && !communityExplorer}
            label={i18nKey("communities.directChats")}
            disabled={$anonUser}
            unread={$unreadDirectCounts.chats}
            video={$directVideoCallCounts}
            on:click={directChats}>
            <div class="hover direct">
                <MessageOutline size={iconSize} color={"var(--icon-txt)"} />
            </div>
        </LeftNavItem>
        <LeftNavItem
            selected={$chatListScope.kind === "group_chat" && !communityExplorer}
            label={i18nKey("communities.groupChats")}
            unread={client.mergeCombinedUnreadCounts($unreadGroupCounts)}
            video={$groupVideoCallCounts}
            on:click={groupChats}>
            <div class="hover direct">
                <ForumOutline size={iconSize} color={"var(--icon-txt)"} />
            </div>
        </LeftNavItem>
        {#if $globalState.favourites.size > 0}
            <LeftNavItem
                selected={$chatListScope.kind === "favourite" && !communityExplorer}
                disabled={$anonUser}
                label={i18nKey("communities.favourites")}
                unread={client.mergeCombinedUnreadCounts($unreadFavouriteCounts)}
                video={$favouritesVideoCallCounts}
                on:click={favouriteChats}>
                <div class="hover favs">
                    <HeartOutline size={iconSize} color={"var(--icon-txt)"} />
                </div>
            </LeftNavItem>
        {/if}
        {#if !$anonUser}
            {#if claimChitAvailable}
                <LeftNavItem
                    label={i18nKey("dailyChit.extendStreak")}
                    on:click={() => dispatch("claimDailyChit")}>
                    <div class="hover streak">
                        <LighteningBolt enabled />
                    </div>
                </LeftNavItem>
            {/if}
            {#if $globalState.messageActivitySummary.latestTimestamp > 0n}
                <LeftNavItem
                    separator
                    selected={$activityFeedShowing}
                    label={i18nKey("activity.navLabel")}
                    unread={{ muted: 0, unmuted: $unreadActivityCount, mentions: false }}
                    on:click={showActivityFeed}>
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
        bind:this={scrollingSection}
        on:consider={handleDndConsider}
        on:finalize={handleDndFinalize}
        class="middle">
        {#each communityItems as community (community._id)}
            <div animate:flip={{ duration: flipDurationMs }}>
                <LeftNavItem
                    selected={community.id.communityId === selectedCommunityId &&
                        $chatListScope.kind !== "favourite" &&
                        !communityExplorer}
                    video={$communityChannelVideoCallCounts.get(community.id) ?? {
                        muted: 0,
                        unmuted: 0,
                    }}
                    unread={client.mergeCombinedUnreadCounts(
                        $unreadCommunityChannelCounts.get(community.id) ??
                            emptyCombinedUnreadCounts(),
                    )}
                    label={i18nKey(community.name)}
                    on:click={() => selectCommunity(community)}>
                    <Avatar
                        selected={community.id.communityId === selectedCommunityId &&
                            $chatListScope.kind !== "favourite" &&
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
            on:click={exploreCommunities}>
            <div class="explore hover">
                <Compass size={iconSize} color={"var(--icon-txt)"} />
            </div>
        </LeftNavItem>
        <LeftNavItem label={$navOpen ? i18nKey("collapse") : i18nKey("expand")}>
            <div class:open={$navOpen} on:click|stopPropagation={toggleNav} class="expand hover">
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
        @include nice-scrollbar();
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
