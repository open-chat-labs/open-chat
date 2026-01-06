<script lang="ts">
    import { ColourVars, Container } from "component-lib";
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
    import ChevronLeft from "svelte-material-icons/ChevronLeft.svelte";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import { fade } from "svelte/transition";
    import { updateCommunityState } from "../communities/createOrUpdate/community.svelte";
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

    function hasUnread(community: CommunitySummary): [boolean, UnreadCounts] {
        const unread = client.mergeCombinedUnreadCounts(
            $unreadCommunityChannelCountsStore.get(community.id) ?? emptyCombinedUnreadCounts(),
        );

        const { mentions, unmuted } = unread;

        return [mentions || unmuted > 0, unread];
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

    function createCommunity() {
        updateCommunityState.createCommunity(client);
    }

    function exploreCommunities() {
        page("/communities");
    }

    // SHEET LIKE BEHAVIOUR....

    const MAX_HEIGHT_RATIO = 0.7; // 70% of viewport
    const CLOSED_HEIGHT = 96; // px (peek / handle visible)
    const OPEN_HEIGHT = computeOpenHeight();
    const OPEN_THRESHOLD = 0.2; // 60% → snap open
    const CLOSE_THRESHOLD = 0.9; // 40% → snap closed

    let isOpen = $state(false);
    let openFactor = $state(0);
    let startY: undefined | number;
    let startHeight: undefined | number;
    let currentHeight: undefined | number;
    let handle: HTMLElement;

    let animating = false;
    let animationStart = 0;
    let animationFrom = 0;
    let animationTo: 0 | 1 = 1;
    let animationDuration = 0;
    const SNAP_DURATION = 250; // ms

    function getScrollerOpacity(): number {
        return 1 - openFactor / OPEN_THRESHOLD;
    }

    function viewportHeight() {
        return window.visualViewport?.height ?? window.innerHeight;
    }

    function computeOpenHeight() {
        // TODO recalculate on resize once we modify this for web!
        return Math.round(viewportHeight() * MAX_HEIGHT_RATIO);
    }

    function openness(height: number) {
        return Math.min(1, Math.max(0, (height - CLOSED_HEIGHT) / (OPEN_HEIGHT - CLOSED_HEIGHT)));
    }

    function setSheetHeight(height: number) {
        container.style.height = `${height}px`;
    }

    // Only track movement in y dimension!
    function onDragStart(e: PointerEvent) {
        container.style.transition = "none";

        // Capture immediately
        handle.setPointerCapture(e.pointerId);

        startY = e.clientY;
        startHeight = container.getBoundingClientRect().height;
    }

    function onDrag(e: PointerEvent) {
        if (!handle.hasPointerCapture(e.pointerId)) return;
        if (startY == null || startHeight == null) return;

        const delta = startY - e.clientY;
        currentHeight = Math.min(OPEN_HEIGHT, Math.max(CLOSED_HEIGHT, startHeight + delta));
        openFactor = openness(currentHeight);
        setSheetHeight(currentHeight);
    }

    function onDragStop(e: PointerEvent) {
        // Remove the added transition, and fallback to CSS defined one!
        container.style.transition = "";

        if (handle.hasPointerCapture(e.pointerId)) {
            handle.releasePointerCapture(e.pointerId);
        }

        if (isOpen) {
            // Sheet is open → maybe close it
            if (openFactor <= CLOSE_THRESHOLD) {
                closeSheet();
            } else {
                openSheet();
            }
        } else {
            if (openFactor >= OPEN_THRESHOLD) {
                openSheet();
            } else {
                closeSheet();
            }
        }

        startY = undefined;
        startHeight = undefined;
    }

    function openSheet() {
        isOpen = true;
        snapTo(1);
    }

    function closeSheet() {
        isOpen = false;
        snapTo(0);
    }

    function snapDuration(factor: number, target: 0 | 1) {
        let duration: number;
        if (target === 1) {
            duration = ((1 - factor) / (1 - OPEN_THRESHOLD)) * SNAP_DURATION;
        } else {
            duration = (factor / CLOSE_THRESHOLD) * SNAP_DURATION;
        }
        return Math.max(0, Math.min(SNAP_DURATION, duration));
    }

    function snapTo(target: 0 | 1) {
        animating = true;
        animationStart = performance.now();
        animationFrom = openFactor;
        animationTo = target;
        animationDuration = 2 * snapDuration(animationFrom, target);

        container.style.transition = `height ${animationDuration}ms cubic-bezier(0.2, 0, 0, 1)`;
        setSheetHeight(target === 1 ? OPEN_HEIGHT : CLOSED_HEIGHT);

        // Shorten the duration for the factor change
        animationDuration *= 0.9;
        requestAnimationFrame(trackAnimation);
    }

    function trackAnimation(now: number) {
        if (!animating) return;

        const elapsed = now - animationStart;
        const t = animationDuration === 0 ? 1 : Math.min(elapsed / animationDuration, 1);

        openFactor = animationFrom + (animationTo - animationFrom) * t;

        if (t < 1) {
            requestAnimationFrame(trackAnimation);
        } else {
            openFactor = animationTo;
            animating = false;
        }
    }
</script>

<Container
    bind:ref={container}
    supplementalClass={"communities_sheet"}
    overflow={"hidden"}
    direction={"vertical"}
    padding={["sm", "zero", "sm", "zero"]}
    width={"fill"}
    borderRadius={["md", "md", "zero", "zero"]}
    background={ColourVars.background1}>
    <button
        bind:this={handle}
        onpointerdown={onDragStart}
        onpointermove={onDrag}
        onpointerup={onDragStop}
        onpointercancel={onDragStop}
        oncontextmenu={(e) => e.preventDefault()}
        aria-label="handle"
        class="handle_outer">
        <div class="handle_inner"></div>
    </button>

    {#if unreadRight}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div onclick={() => scrollToUnread(unreadRight)} transition:fade class="right">
            <ChevronRight size={"2.5rem"} color={ColourVars.primary} />
        </div>
    {/if}

    {#if unreadLeft}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div onclick={() => scrollToUnread(unreadLeft)} transition:fade class="left">
            <ChevronLeft size={"2.5rem"} color={ColourVars.primary} />
        </div>
    {/if}

    {#if openFactor < OPEN_THRESHOLD}
        <div class="scroller" style={`opacity: ${getScrollerOpacity()}`}>
            <CommunitiesScroller
                onCreate={createCommunity}
                onExplore={exploreCommunities}
                bind:ref={scroller}
                {hasUnread}
                onSelect={selectCommunity}></CommunitiesScroller>
        </div>
    {:else}
        <div class="list" style={`opacity: ${openFactor}`}>
            <CommunitiesList
                onCreate={createCommunity}
                onExplore={exploreCommunities}
                {hasUnread}
                onSelect={selectCommunity}></CommunitiesList>
        </div>
    {/if}
</Container>

<style lang="scss">
    :global(.container.communities_sheet) {
        margin-bottom: -0.5rem;
    }

    :global(.communities_sheet .left path, .communities_sheet .right path) {
        filter: drop-shadow(1px 1px 1px rgba(0, 0, 0, 0.5));
    }

    .list,
    .scroller {
        width: 100%;
        overflow: hidden;
    }

    .right,
    .left {
        padding-top: toRem(48);
        position: fixed;
        bottom: toRem(110);
        z-index: 1;
        height: toRem(105);
        width: fit-content;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .right {
        right: 0;
    }

    .left {
        // background: linear-gradient(90deg, var(--primary), transparent);
        left: 0;
    }

    .handle_outer {
        all: unset;
        padding-bottom: var(--sp-sm);
        position: sticky;
        touch-action: none;
        user-select: none;
        cursor: grab;
        top: 0rem;
        left: 50%;
        transform: translateX(-50%);
        width: 4rem;
    }

    .handle_inner {
        height: 0.25rem;
        border-radius: var(--rad-circle);
        background-color: var(--text-tertiary);
    }
</style>
