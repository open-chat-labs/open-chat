<script module lang="ts">
    export type Selection = "chats" | "favourites" | "communities" | "notification" | "profile";
</script>

<script lang="ts">
    import { Avatar, Container } from "component-lib";
    import {
        activityFeedShowing,
        allUsersStore,
        currentUserIdStore,
        favouritesStore,
        mergeListOfCombinedUnreadCounts,
        messageActivitySummaryStore,
        OpenChat,
        showProfileStore,
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

    function closeOthers() {
        if ($showProfileStore) {
            client.popRightPanelHistory();
        }
        if ($activityFeedShowing) {
            activityFeedShowing.set(false);
        }
    }

    function itemSelected(s: Selection) {
        switch (s) {
            case "chats":
                closeOthers();
                page("/chats");
                break;
            case "communities":
                // TODO - what do we do if they are not a member of any communities?
                closeOthers();
                client.selectDefaultCommunity();
                break;
            case "favourites":
                closeOthers();
                page("/favourite");
                break;
            case "notification":
                closeOthers();
                activityFeedShowing.set(true);
                break;
            case "profile":
                closeOthers();
                page("/profile_summary");
                break;
        }
    }
</script>

<Container
    supplementalClass={"bottom_nav_bar"}
    padding={["xl", "lg", "md", "lg"]}
    borderWidth={"thick"}
    minWidth={"100%"}
    minHeight={"5.5rem"}
    gap={"xl"}
    borderColour={"var(--background-0)"}
    height={{ kind: "fixed", size: "5.5rem" }}
    borderRadius={["md", "md", "zero", "zero"]}
    background={"var(--background-1)"}
    mainAxisAlignment={"spaceAround"}>
    <div class:showFavourites class={`selection ${props.selection}`}></div>
    <BottomBarItem
        indicator={chatIndicator}
        onSelect={() => itemSelected("chats")}
        selected={props.selection === "chats"}>
        {#snippet icon(color)}
            <ForumOutline {color} />
        {/snippet}
    </BottomBarItem>
    <BottomBarItem
        indicator={communityIndicator}
        onSelect={() => itemSelected("communities")}
        selected={props.selection === "communities"}>
        {#snippet icon(color)}
            <AccountGroup {color} />
        {/snippet}
    </BottomBarItem>
    {#if $favouritesStore.size > 0}
        <BottomBarItem
            indicator={favouritesIndicator}
            onSelect={() => itemSelected("favourites")}
            selected={props.selection === "favourites"}>
            {#snippet icon(color)}
                <HeartOutline {color} />
            {/snippet}
        </BottomBarItem>
    {/if}
    <BottomBarItem
        indicator={activityIndicator}
        onSelect={() => itemSelected("notification")}
        selected={props.selection === "notification"}>
        {#snippet icon(color)}
            <Lightbulb {color} />
        {/snippet}
    </BottomBarItem>
    <BottomBarItem
        onSelect={() => itemSelected("profile")}
        selected={props.selection === "profile"}>
        {#snippet icon()}
            <Avatar size={"lg"} url={avatarUrl} name={avatarName}></Avatar>
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
        --width: calc(25% - 2rem);
        position: absolute;
        width: var(--width);
        left: 0;
        top: 0.375rem;
        height: var(--sp-xs);
        background: var(--gradient);
        border-radius: var(--rad-sm);
        transition: left ease-in-out 200ms;
        transform: translateX(-50%);

        // first and last need to account for the container's padding
        &.chats {
            left: 12.5%;
        }

        &.communities {
            left: 37.5%;
        }

        &.favourites {
            left: 60%;
        }

        &.notification {
            left: 62.5%;
        }

        &.profile {
            left: 87.5%;
        }

        &.showFavourites {
            &.chats {
                left: 10%;
            }

            &.communities {
                left: 30%;
            }

            &.favourites {
                left: 50%;
            }

            &.notification {
                left: 70%;
            }

            &.profile {
                left: 90%;
            }
        }
    }
</style>
