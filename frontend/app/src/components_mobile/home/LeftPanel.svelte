<script lang="ts">
    import { ColourVars, Container } from "component-lib";
    import { activityFeedShowing, chatListScopeStore, routeStore, showLeft } from "openchat-client";
    import { rtlStore } from "../../stores/rtl";
    import ActivityFeed from "./activity/ActivityFeed.svelte";
    import BottomBar, { type Selection } from "./bottom_bar/BottomBar.svelte";
    import ChatList from "./ChatList.svelte";
    import CommunitiesSheet from "./communities_sheet/CommunitiesSheet.svelte";
    import SlidingModals from "./SlidingModals.svelte";
    import UserProfileSummary from "./user_profile/UserProfileSummary.svelte";
    import Wallet from "./wallet/Wallet.svelte";

    let showProfileSummary = $derived($routeStore.kind === "profile_summary_route");
    let showWallet = $derived($routeStore.kind === "wallet_route");
    let showNotifications = $derived($routeStore.kind === "notifications_route");
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
    let communitiesExpanded = $state(false);
    let dimmed = $derived(communitiesExpanded && selection === "communities");

    $effect(() => {
        if (selection !== "communities") {
            communitiesExpanded = false;
        }
    });

    function bottomBarSelection() {
        if (showNotifications) {
            return "notification";
        } else if (showProfileSummary) {
            return "profile";
        } else if (showWallet) {
            return "wallet";
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

<SlidingModals />

<Container
    mainAxisAlignment={"spaceBetween"}
    supplementalClass={sectionClass}
    background={ColourVars.background0}
    tag={"section"}
    height={{ kind: "fill" }}
    direction={"vertical"}>
    <Container
        supplementalClass={`left_panel_inner ${dimmed ? "dimmed" : ""}`}
        gap={"sm"}
        height={{ kind: "fill" }}
        width={{ kind: "fill" }}
        direction={"vertical"}>
        {#if showNotifications}
            <ActivityFeed />
        {:else if showWallet}
            <Wallet />
        {:else if showProfileSummary}
            <UserProfileSummary />
        {:else}
            <ChatList />
        {/if}
    </Container>
    {#if $chatListScopeStore.kind === "community" && !$activityFeedShowing}
        <CommunitiesSheet bind:expanded={communitiesExpanded} />
    {/if}
    <BottomBar {selection} />
</Container>

<style lang="scss">
    :global(.container.left_panel:not(.visible)) {
        display: none !important;
    }

    :global(.container.left_panel_inner) {
        transition: opacity 200ms ease-in-out;
    }

    :global(.container.left_panel_inner.dimmed) {
        opacity: 0.5;
    }
</style>
