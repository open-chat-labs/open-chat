<script lang="ts">
    import { ColourVars, Container } from "component-lib";
    import {
        activityFeedShowing,
        chatListScopeStore,
        showLeft,
        showProfileStore,
    } from "openchat-client";
    import { rtlStore } from "../../stores/rtl";
    import ActivityFeed from "./activity/ActivityFeed.svelte";
    import BottomBar, { type Selection } from "./bottom_bar/BottomBar.svelte";
    import ChatList from "./ChatList.svelte";
    import CommunitiesSheet from "./communities_sheet/CommunitiesSheet.svelte";

    let selection = $derived<Selection>(bottomBarSelection());
    let sectionClass = $derived.by(() => {
        const c = ["left_panel"];
        if ($showLeft) {
            c.push("visible");
        }
        if ($rtlStore) {
            c.push("rtl");
        }
        return c.join(" ");
    });

    function bottomBarSelection() {
        if ($activityFeedShowing) {
            return "notification";
        } else if ($showProfileStore) {
            return "profile";
        } else {
            switch ($chatListScopeStore.kind) {
                case "community":
                    return "communities";
                case "favourite":
                    return "favourites";
                default:
                    return "chats";
            }
        }
    }
</script>

<Container
    mainAxisAlignment={"spaceBetween"}
    supplementalClass={sectionClass}
    backgroundColour={ColourVars.background0}
    tag={"section"}
    height={{ kind: "fill" }}
    direction={"vertical"}>
    <Container gap={"sm"} height={{ kind: "fill" }} width={{ kind: "fill" }} direction={"vertical"}>
        {#if $activityFeedShowing}
            <ActivityFeed />
        {:else}
            <ChatList />
        {/if}
    </Container>
    {#if $chatListScopeStore.kind === "community"}
        <CommunitiesSheet />
    {/if}
    <BottomBar {selection} />
</Container>

<style lang="scss">
    :global(.container.left_panel:not(.visible)) {
        display: none !important;
    }
</style>
