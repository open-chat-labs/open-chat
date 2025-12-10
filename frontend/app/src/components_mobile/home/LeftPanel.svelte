<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Caption, ColourVars, CommonButton, Container } from "component-lib";
    import {
        activityFeedShowing,
        anonUserStore,
        chatListScopeStore,
        ROLE_NONE,
        routeStore,
        selectedChatIdStore,
        selectedCommunitySummaryStore,
        showLeft,
    } from "openchat-client";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Enter from "svelte-material-icons/LocationEnter.svelte";
    import { rtlStore } from "../../stores/rtl";
    import Translatable from "../Translatable.svelte";
    import ActivityFeed from "./activity/ActivityFeed.svelte";
    import BottomBar, { type Selection } from "./bottom_bar/BottomBar.svelte";
    import ChatList from "./ChatList.svelte";
    import PreviewWrapper from "./communities/PreviewWrapper.svelte";
    import CommunitiesSheet from "./communities_sheet/CommunitiesSheet.svelte";
    import SlidingModals from "./SlidingModals.svelte";
    import UserProfileSummary from "./user_profile/UserProfileSummary.svelte";
    import ActiveCallSummary from "./video/ActiveCallSummary.svelte";
    import Wallet from "./wallet/Wallet.svelte";
    import WelcomePage from "./WelcomePage.svelte";

    let showPreview = $derived(
        !$anonUserStore &&
            $selectedCommunitySummaryStore?.membership.role === ROLE_NONE &&
            $selectedChatIdStore === undefined,
    );
    let showProfileSummary = $derived($routeStore.kind === "profile_summary_route");
    let showWelcome = $derived($routeStore.kind === "welcome_route");
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
        } else if (showWelcome) {
            return "communities";
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
    height={"fill"}
    direction={"vertical"}>
    <Container
        supplementalClass={`left_panel_inner ${dimmed ? "dimmed" : ""}`}
        gap={"sm"}
        height={"fill"}
        width={"fill"}
        direction={"vertical"}>
        {#if showNotifications}
            <ActivityFeed />
        {:else if showWallet}
            <Wallet />
        {:else if showProfileSummary}
            <UserProfileSummary />
        {:else if showWelcome}
            <WelcomePage />
        {:else}
            <ChatList />
        {/if}
        <ActiveCallSummary />
    </Container>

    {#if !$anonUserStore}
        {#if !showPreview && $chatListScopeStore.kind === "community" && !$activityFeedShowing}
            <CommunitiesSheet bind:expanded={communitiesExpanded} />
        {/if}
        {#if showPreview}
            <PreviewWrapper>
                {#snippet children(joiningCommunity, joinCommunity, cancelPreview, gatesInEffect)}
                    <Container
                        gap={"sm"}
                        direction={"vertical"}
                        padding={"lg"}
                        background={ColourVars.background1}>
                        <Container crossAxisAlignment={"center"}>
                            <Container>
                                <CommonButton onClick={cancelPreview} size={"small_text"}>
                                    {#snippet icon(color, size)}
                                        <ArrowLeft {color} {size} />
                                    {/snippet}
                                    <Translatable resourceKey={i18nKey("back")} />
                                </CommonButton>
                            </Container>
                            <CommonButton
                                mode={"active"}
                                loading={joiningCommunity}
                                disabled={joiningCommunity}
                                onClick={joinCommunity}>
                                {#snippet icon(color, size)}
                                    <Enter {color} {size} />
                                {/snippet}
                                <Translatable resourceKey={i18nKey("communities.joinCommunity")} />
                            </CommonButton>
                        </Container>
                        {#if gatesInEffect}
                            <Container padding={["zero", "sm"]} mainAxisAlignment={"end"}>
                                <Caption width={"hug"} fontWeight={"bold"} colour={"textSecondary"}>
                                    <Translatable resourceKey={i18nKey("Access gates enabled")} />
                                </Caption>
                            </Container>
                        {/if}
                    </Container>
                {/snippet}
            </PreviewWrapper>
        {/if}
        <BottomBar {selection} />
    {/if}
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

    /* .join {
        position: sticky;
        bottom: 0;
        padding: $sp3 $sp4;
        background-color: var(--entry-bg);
        width: 100%;
    } */
</style>
