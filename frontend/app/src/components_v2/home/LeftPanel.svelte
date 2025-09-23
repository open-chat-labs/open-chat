<script lang="ts">
    import { ColourVars, Container } from "component-lib";
    import {
        activityFeedShowing,
        chatListScopeStore,
        mobileWidth,
        showLeft,
        showNav,
    } from "openchat-client";
    import { rtlStore } from "../../stores/rtl";
    import ActivityFeed from "./activity/ActivityFeed.svelte";
    import BottomBar, { type Selection } from "./bottom_bar/BottomBar.svelte";
    import ChatList from "./ChatList.svelte";
    import CommunitiesSheet from "./communities_sheet/CommunitiesSheet.svelte";

    let offset = $derived($showNav && !$mobileWidth);
    let selection = $state<Selection>(initialSelection());
    let sectionClass = $derived.by(() => {
        const c = ["left_panel"];
        if ($showLeft) {
            c.push("visible");
        }
        if (offset) {
            c.push("offset");
        }
        if ($rtlStore) {
            c.push("rtl");
        }
        return c.join(" ");
    });

    function initialSelection() {
        switch ($chatListScopeStore.kind) {
            case "community":
                return "communities";
            default:
                return "chats";
        }
    }

    // TODO - on mobile, the right panel is not really a thing. It's feels like it's just a modal really.
    // Doesn't it?
    // And a modal isn't really a thing either. It's just a page that isn't represented by a route.
</script>

<Container
    mainAxisAlignment={"spaceBetween"}
    supplementalClass={sectionClass}
    backgroundColour={ColourVars.background0}
    tag={"section"}
    height={{ kind: "fill" }}
    direction={"vertical"}>
    <Container height={{ kind: "fill" }} width={{ kind: "fill" }} direction={"vertical"}>
        {#if $activityFeedShowing}
            <ActivityFeed />
        {:else}
            <ChatList />
        {/if}
    </Container>
    {#if $mobileWidth}
        {#if $chatListScopeStore.kind === "community"}
            <CommunitiesSheet />
        {/if}
        <BottomBar bind:selection />
    {/if}
</Container>

<style lang="scss">
    :global(.container.left_panel) {
        overflow: auto !important;
        overflow-x: hidden !important;
        max-width: toRem(500) !important;
        min-width: toRem(300) !important;
        flex: 7 !important;
        border-right: var(--bw) solid var(--bd) !important;

        @include mobile() {
            width: 100% !important;
            max-width: unset !important;
            min-width: unset !important;
            flex: auto !important;
            border-right: none !important;
        }
    }

    :global(.container.left_panel.offset) {
        margin-inline-start: toRem(80) !important;
    }

    :global(.container.left_panel.rtl) {
        border-right: none !important;
        border-left: var(--bw) solid var(--bd) !important;
    }

    :global(.container.left_panel:not(.visible)) {
        display: none !important;
    }
</style>
