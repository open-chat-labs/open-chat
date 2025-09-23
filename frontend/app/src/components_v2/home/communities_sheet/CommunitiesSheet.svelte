<script lang="ts">
    import { Container } from "component-lib";
    import { activityFeedShowing, type CommunitySummary } from "openchat-client";
    import page from "page";
    import { fade } from "svelte/transition";
    import CommunitiesList from "./CommunitiesList.svelte";
    import CommunitiesScroller from "./CommunitiesScroller.svelte";

    let expanded = $state(false);

    function selectCommunity(community: CommunitySummary) {
        expanded = false;
        activityFeedShowing.set(false);
        page(`/community/${community.id.communityId}`);
    }
</script>

<Container
    direction={"vertical"}
    padding={["md", "lg", "lg", "lg"]}
    width={{ kind: "fill" }}
    height={{ kind: "fixed", size: expanded ? "65%" : "100px" }}
    backgroundColour={"var(--background-1)"}>
    <button onclick={() => (expanded = !expanded)} aria-label="handle" class="handle_outer">
        <div class="handle_inner"></div>
    </button>

    {#if !expanded}
        <div transition:fade={{ duration: 200 }} class="scroller">
            <CommunitiesScroller onSelect={selectCommunity}></CommunitiesScroller>
        </div>
    {:else}
        <div transition:fade={{ duration: 200 }} class="list">
            <CommunitiesList onSelect={selectCommunity}></CommunitiesList>
        </div>
    {/if}
</Container>

<style lang="scss">
    .list {
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
