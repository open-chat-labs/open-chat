<script lang="ts">
    import Avatar from "../../Avatar.svelte";
    import Hamburger from "svelte-material-icons/Menu.svelte";
    import Compass from "svelte-material-icons/CompassOutline.svelte";
    import ArrowRight from "svelte-material-icons/ArrowExpandRight.svelte";
    import {
        AvatarSize,
        type CommunitySummary,
        type OpenChat,
        emptyCombinedUnreadCounts,
    } from "openchat-client";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import { communityListScrollTop } from "../../../stores/scrollPos";
    import { pathParams } from "../../../routes";
    import page from "page";
    import { getContext, onDestroy, onMount, tick } from "svelte";
    import NavItem from "./NavItem.svelte";
    import { layoutStore, navOpen } from "../../../stores/layout";
    import { flip } from "svelte/animate";
    import { type DndEvent, dndzone } from "svelte-dnd-action";
    import { isTouchDevice } from "../../../utils/devices";
    import { rtlStore } from "../../../stores/rtl";
    import { i18nKey } from "../../../i18n/i18n";
    import CommonNavElements from "./CommonNavElements.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import MainMenu from "./MainMenu.svelte";

    const client = getContext<OpenChat>("client");
    const flipDurationMs = 300;

    $: anonUser = client.anonUser;
    $: avatarSize = $mobileWidth ? AvatarSize.Small : AvatarSize.Default;
    $: communities = client.communitiesList;
    $: selectedCommunity = client.selectedCommunity;
    $: chatListScope = client.chatListScope;
    $: unreadCommunityChannelCounts = client.unreadCommunityChannelCounts;
    $: communityChannelVideoCallCounts = client.communityChannelVideoCallCounts;
    $: communityExplorer = $pathParams.kind === "communities_route";
    $: selectedCommunityId = $selectedCommunity?.id.communityId;

    let iconSize = $mobileWidth ? "1.2em" : "1.4em"; // in this case we don't want to use the standard store
    let scrollingSection: HTMLElement;

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

    function handleDndFinalize(e: CustomEvent<DndEvent<CommunityItem>>) {
        dragging = false;
        communityItems = e.detail.items;
        client.updateCommunityIndexes(reindex(e.detail.items));
    }

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

<section class="nav" class:open={$navOpen} class:rtl={$rtlStore}>
    {#if !$layoutStore.showBottomNav}
        <div class="top">
            <CommonNavElements
                menuAlignment={"start"}
                menuPosition={"right"}
                menuGutter={20}
                orientation={"vertical"}
                on:profile
                on:wallet
                on:halloffame
                on:upgrade />
        </div>
    {/if}

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
                <NavItem
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
                </NavItem>
            </div>
        {/each}
    </div>

    <div class="bottom">
        <NavItem
            selected={communityExplorer}
            label={i18nKey("communities.explore")}
            on:click={exploreCommunities}>
            <div class="explore hover">
                <Compass size={iconSize} color={"var(--icon-txt)"} />
            </div>
        </NavItem>
        <NavItem label={$navOpen ? i18nKey("collapse") : i18nKey("expand")}>
            <div class:open={$navOpen} on:click|stopPropagation={toggleNav} class="expand hover">
                <ArrowRight size={iconSize} color={"var(--icon-txt)"} />
            </div>
        </NavItem>
    </div>
    {#if $layoutStore.showBottomNav}
        <div class="corner" class:anonUser={$anonUser}>
            <NavItem orientation={"vertical"} label={i18nKey("communities.mainMenu")}>
                <div class="hover logo">
                    <MenuIcon position={"right"} align={"start"} gutter={20}>
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
        </div>
    {/if}
</section>

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

    :global(.nav-item.selected) {
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
        padding: $sp2 0 0 0;
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
            padding: $sp1 0 0 0;
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

    .bottom {
        padding-bottom: $sp1;
    }

    .corner {
        display: flex;
        border-top: var(--bw) solid var(--bd);

        @include safezone() {
            flex: 0 0 calc(toRem(60) + var(--safe-area-inset-bottom));
            padding-bottom: var(--safe-area-inset-bottom);

            &.anonUser {
                flex: 0 0 toRem(60);
                padding-bottom: 0;
            }
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
