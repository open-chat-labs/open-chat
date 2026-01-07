<script lang="ts">
    import { ColourVars, AnchoredSheet } from "component-lib";
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
    import ChevronLeft from "svelte-material-icons/ChevronLeft.svelte";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import { fade } from "svelte/transition";
    import { updateCommunityState } from "../communities/createOrUpdate/community.svelte";
    import CommunitiesList from "./CommunitiesList.svelte";
    import CommunitiesScroller from "./CommunitiesScroller.svelte";

    const client = getContext<OpenChat>("client");

    // TODO - what do we do with this?
    interface Props {
        expanded: boolean;
    }

    let { expanded = $bindable(false) }: Props = $props();

    let anchoredSheet: AnchoredSheet;
    let scroller: HTMLElement;

    let unreadLeft = $state<HTMLElement>();
    let unreadRight = $state<HTMLElement>();

    function selectCommunity(community: CommunitySummary) {
        anchoredSheet.collapse();
        activityFeedShowing.set(false);
        page(`/community/${community.id.communityId}`);
    }

    function hasUnread(community: CommunitySummary): [boolean, UnreadCounts] {
        const unread = client.mergeCombinedUnreadCounts(
            $unreadCommunityChannelCountsStore.get(community.id) ?? emptyCombinedUnreadCounts(),
        );

        const { mentions, unmuted } = unread;

        return [mentions || unmuted > 0, unread];
    }

    function offscreenUnreadCheck() {
        if (!scroller) return;

        const withUnread = scroller.querySelectorAll(
            ".scroller_item.unread",
        ) as NodeListOf<HTMLElement>;
        const { scrollLeft, clientWidth } = scroller;
        unreadLeft = undefined;
        unreadRight = undefined;
        for (const el of withUnread) {
            const { offsetLeft, offsetWidth } = el;
            if (offsetLeft - scrollLeft + offsetWidth / 2 > clientWidth) {
                unreadRight = el;
            }
            if (scrollLeft > offsetLeft + offsetWidth / 2) {
                if (unreadLeft === undefined) {
                    unreadLeft = el;
                }
            }
        }
    }

    function scrollToUnread(el?: HTMLElement) {
        if (el !== undefined) {
            el.scrollIntoView({
                behavior: "smooth",
                inline: "center",
            });
        }
    }

    function createCommunity() {
        // Delaying collapse, allows the create community screen to animate in first!
        setTimeout(() => anchoredSheet.collapse(), 500);
        updateCommunityState.createCommunity(client);
    }

    function exploreCommunities() {
        page("/communities");
    }
</script>

{#snippet collapsedContent()}
    <div class="scroller">
        {#if unreadRight}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div onclick={() => scrollToUnread(unreadRight)} transition:fade class="right">
                <ChevronRight size={"2rem"} color={ColourVars.primary} />
            </div>
        {/if}

        {#if unreadLeft}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div onclick={() => scrollToUnread(unreadLeft)} transition:fade class="left">
                <ChevronLeft size={"2rem"} color={ColourVars.primary} />
            </div>
        {/if}

        <CommunitiesScroller
            onCreate={createCommunity}
            onExplore={exploreCommunities}
            bind:ref={scroller}
            {hasUnread}
            onSelect={selectCommunity}></CommunitiesScroller>
    </div>
{/snippet}

{#snippet expandedContent()}
    <CommunitiesList
        onCreate={createCommunity}
        onExplore={exploreCommunities}
        {hasUnread}
        onSelect={selectCommunity}></CommunitiesList>
{/snippet}

<AnchoredSheet
    bind:this={anchoredSheet}
    {collapsedContent}
    {expandedContent}
    onInit={offscreenUnreadCheck}
    onScroll={offscreenUnreadCheck} />

<style lang="scss">
    :global(.communities_sheet .left path, .communities_sheet .right path) {
        filter: drop-shadow(1px 1px 1px rgba(0, 0, 0, 0.5));
    }

    .scroller {
        position: relative;
    }

    .right,
    .left {
        top: 0;
        bottom: 0;
        width: 2.5rem;
        position: absolute;
        display: flex;
        align-items: center;
        z-index: 1;
    }

    .right {
        right: -1px;
        justify-content: flex-end;
        background: #1c1d26;
        background: linear-gradient(
            90deg,
            rgba(28, 29, 38, 0) 0%,
            rgba(28, 29, 38, 0.8) 50%,
            rgba(28, 29, 38, 1) 80%,
            rgba(28, 29, 38, 1) 100%
        );
    }

    .left {
        left: -1px;
        justify-content: flex-start;
        background: #1c1d26;
        background: linear-gradient(
            -90deg,
            rgba(28, 29, 38, 0) 0%,
            rgba(28, 29, 38, 0.8) 50%,
            rgba(28, 29, 38, 1) 80%,
            rgba(28, 29, 38, 1) 100%
        );
    }
</style>
