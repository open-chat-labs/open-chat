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
    import { getContext, onMount } from "svelte";
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

    let container: HTMLElement;
    let scroller: HTMLElement;

    let unreadLeft = $state<HTMLElement>();
    let unreadRight = $state<HTMLElement>();

    function offscreenUnreadCheck() {
        const withUnread = container.querySelectorAll(
            ".scroller_item.unread",
        ) as NodeListOf<HTMLElement>;
        const { scrollLeft, clientWidth } = container;
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

    onMount(() => {
        container.addEventListener("scroll", offscreenUnreadCheck);
        offscreenUnreadCheck();
        return () => {
            container.removeEventListener("scroll", offscreenUnreadCheck);
        };
    });
</script>

<Container
    bind:ref={container}
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

    {#if unreadRight}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div onclick={() => scrollToUnread(unreadRight)} transition:fade class="right"></div>
    {/if}

    {#if unreadLeft}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div onclick={() => scrollToUnread(unreadLeft)} transition:fade class="left"></div>
    {/if}

    {#if !expanded}
        <div transition:fade={{ duration: 200 }} class="scroller">
            <CommunitiesScroller bind:ref={scroller} {hasUnread} onSelect={selectCommunity}
            ></CommunitiesScroller>
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

    .right,
    .left {
        position: fixed;
        bottom: toRem(120);
        z-index: 1;
        height: toRem(105);
        // width: toRem(60);
        width: 6px;
        // opacity: 0.6;
    }

    .right {
        background: linear-gradient(90deg, transparent, var(--primary));
        right: 0;
    }

    .left {
        background: linear-gradient(90deg, var(--primary), transparent);
        left: 0;
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
