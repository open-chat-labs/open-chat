<script lang="ts">
    import { Container, type SwipeDirection } from "component-lib";
    import {
        activityFeedShowing,
        emptyCombinedUnreadCounts,
        OpenChat,
        unreadCommunityChannelCountsStore,
        type CommunitySummary,
        type UnreadCounts,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import { fade } from "svelte/transition";
    import CommunitiesList from "./CommunitiesList.svelte";
    import CommunitiesScroller from "./CommunitiesScroller.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        expanded: boolean;
    }

    let { expanded = $bindable(false) }: Props = $props();

    function selectCommunity(community: CommunitySummary) {
        expanded = false;
        activityFeedShowing.set(false);
        page(`/community/${community.id.communityId}`);
    }

    function hasUnread(community: CommunitySummary): [boolean, boolean, UnreadCounts] {
        const unread = client.mergeCombinedUnreadCounts(
            $unreadCommunityChannelCountsStore.get(community.id) ?? emptyCombinedUnreadCounts(),
        );

        const { mentions, unmuted, muted } = unread;

        return [
            mentions || unmuted > 0 || muted > 0,
            !mentions && unmuted === 0 && muted > 0,
            unread,
        ];
    }

    function onSwipe(dir: SwipeDirection) {
        if (dir === "up") {
            expanded = true;
        }
        if (dir === "down") {
            expanded = false;
        }
    }
</script>

<Container
    {onSwipe}
    supplementalClass={"communities_sheet"}
    direction={"vertical"}
    padding={["md", "zero", "lg", "zero"]}
    width={{ kind: "fill" }}
    height={{ kind: "fixed", size: expanded ? "70%" : "7rem" }}
    background={"var(--background-1)"}>
    <button onclick={() => (expanded = !expanded)} aria-label="handle" class="handle_outer">
        <div class="handle_inner"></div>
    </button>

    {#if !expanded}
        <div transition:fade={{ duration: 200 }} class="scroller">
            <CommunitiesScroller {hasUnread} onSelect={selectCommunity}></CommunitiesScroller>
        </div>
    {:else}
        <div transition:fade={{ duration: 200 }} class="list">
            <CommunitiesList {hasUnread} onSelect={selectCommunity}></CommunitiesList>
        </div>
    {/if}
</Container>

<style lang="scss">
    :global(.container.communities_sheet) {
        margin-bottom: -6px;
    }

    .list,
    .scroller {
        width: 100%;
    }

    .handle_outer {
        all: unset;
        padding: 0 0 var(--sp-lg) 0;
        position: sticky;
        cursor: pointer;
        top: 0rem;
        left: 50%;
        transform: translateX(-50%);
        width: 4rem;
    }

    .handle_inner {
        border-radius: var(--rad-circle);
        height: 4px;
        background-color: var(--text-tertiary);
    }
</style>
