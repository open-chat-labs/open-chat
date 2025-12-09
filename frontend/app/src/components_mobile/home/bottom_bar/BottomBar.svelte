<script module lang="ts">
    export type Selection =
        | "chats"
        | "favourites"
        | "communities"
        | "notification"
        | "profile"
        | "wallet";
</script>

<script lang="ts">
    import { disableChit } from "@src/stores/settings";
    import { now500 } from "@src/stores/time";
    import { Avatar, Container, type SwipeDirection } from "component-lib";
    import {
        allUsersStore,
        chitStateStore,
        currentUserIdStore,
        favouritesStore,
        mergeListOfCombinedUnreadCounts,
        messageActivitySummaryStore,
        OpenChat,
        unreadCommunityChannelCountsStore,
        unreadDirectAndGroupCountsStore,
        unreadFavouriteCountsStore,
        type UnreadCounts,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import AccountGroup from "svelte-material-icons/AccountGroup.svelte";
    import ForumOutline from "svelte-material-icons/ForumOutline.svelte";
    import HeartOutline from "svelte-material-icons/HeartOutline.svelte";
    import Lightbulb from "svelte-material-icons/LightbulbVariantOutline.svelte";
    import Wallet from "svelte-material-icons/WalletOutline.svelte";
    import BottomBarItem, { type Unread } from "./BottomBarItem.svelte";

    interface Props {
        selection: Selection;
    }

    const client = getContext<OpenChat>("client");

    let props: Props = $props();

    let user = $derived($allUsersStore.get($currentUserIdStore));
    let avatarUrl = $derived(user ? client.userAvatarUrl(user) : "/assets/unknownUserAvatar.svg");
    let avatarName = $derived(user?.username ?? "unknown user");
    let unreadCommunities = $derived(
        mergeListOfCombinedUnreadCounts(Array.from($unreadCommunityChannelCountsStore.values())),
    );
    let numIcons = $derived($favouritesStore.size > 0 ? 6 : 5);
    let iconSize = $derived(numIcons === 6 ? "1.7rem" : "1.9rem");
    let claimChitAvailable = $derived(
        !$disableChit && $chitStateStore.nextDailyChitClaim < $now500,
    );

    let chatIndicator = $derived.by(() => showIndicator($unreadDirectAndGroupCountsStore.chats));
    let communityIndicator = $derived(showIndicator(unreadCommunities.chats));
    let favouritesIndicator = $derived(
        showIndicator(client.mergeCombinedUnreadCounts($unreadFavouriteCountsStore)),
    );
    let showFavourites = $derived($favouritesStore.size > 0);
    // TODO - activity *might* have to account for threads if we do it that way. Something like the below ...
    // let activityIndicator = $derived.by(() => {
    //     const directAndGroup = showIndicator($unreadDirectAndGroupCountsStore.threads);
    //     const communities = showIndicator(unreadCommunities.threads);
    //     const show =
    //         directAndGroup.show ||
    //         communities.show ||
    //         $messageActivitySummaryStore.latestTimestamp > 0n;
    //     return {
    //         show,
    //         muted: false,
    //     };
    // });
    let activityIndicator = $derived.by(() => {
        const show = $messageActivitySummaryStore.unreadCount > 0;
        return {
            show,
            muted: false,
        };
    });

    function showIndicator({ mentions, unmuted, muted }: UnreadCounts): Unread {
        return {
            show: mentions || unmuted > 0 || muted > 0,
            muted: !mentions && unmuted === 0 && muted > 0,
        };
    }

    function itemSelected(s: Selection) {
        switch (s) {
            case "chats":
                page("/chats");
                break;
            case "communities":
                const selected = client.selectDefaultCommunity();
                if (!selected) {
                    console.log("is this happening");
                    // we have to decide what to do here
                    page("/communities");
                }
                // const selected = client.selectDefaultCommunity();
                // if (!selected) {
                //     // this probably means that we are not a member of any communities so
                //     // let's go the the /communities route
                //     page("/communities");
                // }
                break;
            case "favourites":
                page("/favourite");
                break;
            case "notification":
                page("/notifications");
                break;
            case "profile":
                page("/profile_summary");
                break;
            case "wallet":
                page("/wallet");
                break;
        }
    }

    function onSwipe(dir: SwipeDirection) {
        if (dir === "down" || dir === "up") return;
        if (dir === "left") {
            switch (props.selection) {
                case "chats":
                    itemSelected("communities");
                    break;
                case "communities":
                    itemSelected($favouritesStore.size > 0 ? "favourites" : "notification");
                    break;
                case "favourites":
                    itemSelected("notification");
                    break;
                case "notification":
                    itemSelected("wallet");
                    break;
                case "wallet":
                    itemSelected("profile");
                    break;
            }
        }
        if (dir === "right") {
            switch (props.selection) {
                case "profile":
                    itemSelected("wallet");
                    break;
                case "notification":
                    itemSelected($favouritesStore.size > 0 ? "favourites" : "communities");
                    break;
                case "favourites":
                    itemSelected("communities");
                    break;
                case "communities":
                    itemSelected("chats");
                    break;
                case "wallet":
                    itemSelected("notification");
                    break;
            }
        }
    }
</script>

{#snippet item(selection: Selection, Icon: any, indicator?: Unread)}
    <BottomBarItem
        {indicator}
        onSelect={() => itemSelected(selection)}
        selected={props.selection === selection}>
        {#snippet icon(color)}
            <Icon {color} size={iconSize} />
        {/snippet}
    </BottomBarItem>
{/snippet}

<Container
    supplementalClass={"bottom_nav_bar"}
    padding={["xl", "lg", "md", "lg"]}
    borderWidth={"thick"}
    minWidth={"100%"}
    minHeight={"4.875rem"}
    {onSwipe}
    borderColour={"var(--background-0)"}
    height={{ size: "4.875rem" }}
    borderRadius={["md", "md", "zero", "zero"]}
    background={"var(--background-1)"}
    mainAxisAlignment={"spaceAround"}>
    <div style={`--num: ${numIcons}`} class:showFavourites class={`selection ${props.selection}`}>
    </div>
    {@render item("chats", ForumOutline, chatIndicator)}
    {@render item("communities", AccountGroup, communityIndicator)}
    {#if $favouritesStore.size > 0}
        {@render item("favourites", HeartOutline, favouritesIndicator)}
    {/if}
    {@render item("notification", Lightbulb, activityIndicator)}
    {@render item("wallet", Wallet)}
    <BottomBarItem
        indicator={{ show: claimChitAvailable, muted: false, pulse: claimChitAvailable }}
        onSelect={() => itemSelected("profile")}
        selected={props.selection === "profile"}>
        {#snippet icon()}
            <Avatar customSize={"2.5rem"} size={"lg"} url={avatarUrl} name={avatarName}></Avatar>
        {/snippet}
    </BottomBarItem>
</Container>

<style lang="scss">
    :global(.bottom_nav_bar) {
        border-left: none !important;
        border-right: none !important;
        border-bottom: none !important;
    }

    :global(.bottom_nav_bar:after) {
        content: "";
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        height: var(--safe-inset);
        background-color: var(--background-1);
        z-index: 1;
    }

    .selection {
        // --width: calc(22% - 2rem);
        --width: calc((100% - 2rem) / var(--num));
        --half: calc(var(--width) / 2);
        --offset: calc(1rem + var(--half));
        position: absolute;
        width: var(--width);
        left: 0;
        top: 0.375rem;
        height: var(--sp-xs);
        background: var(--gradient);
        border-radius: var(--rad-sm);
        transition: left ease-in-out 200ms;
        transform: translateX(-50%);

        &.chats {
            left: var(--offset);
        }

        &.communities {
            left: calc(var(--offset) + var(--width));
        }

        &.notification {
            left: calc(var(--offset) + (var(--width) * 2));
        }

        &.wallet {
            left: calc(var(--offset) + (var(--width) * 3));
        }

        &.profile {
            left: calc(var(--offset) + (var(--width) * 4));
        }

        &.showFavourites {
            &.favourites {
                left: calc(var(--offset) + (var(--width) * 2));
            }

            &.notification {
                left: calc(var(--offset) + (var(--width) * 3));
            }

            &.wallet {
                left: calc(var(--offset) + (var(--width) * 4));
            }

            &.profile {
                left: calc(var(--offset) + (var(--width) * 5));
            }
        }
    }
</style>
