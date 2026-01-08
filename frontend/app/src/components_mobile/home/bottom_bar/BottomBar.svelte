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
    import BellOutline from "svelte-material-icons/BellOutline.svelte";
    import ForumOutline from "svelte-material-icons/ForumOutline.svelte";
    import HeartOutline from "svelte-material-icons/HeartOutline.svelte";
    import BottomBarItem from "./BottomBarItem.svelte";

    interface Props {
        selection: Selection;
    }

    type MenuIcon =
        | { kind: "icon" }
        | { kind: "svg"; svgPath: string }
        | { kind: "avatar"; url: string; name: string };

    const client = getContext<OpenChat>("client");

    let props: Props = $props();

    let user = $derived($allUsersStore.get($currentUserIdStore));
    let avatarUrl = $derived(user ? client.userAvatarUrl(user) : "/assets/unknownUserAvatar.svg");
    let avatarName = $derived(user?.username ?? "unknown user");
    let unreadCommunities = $derived(
        mergeListOfCombinedUnreadCounts(Array.from($unreadCommunityChannelCountsStore.values())),
    );
    let numIcons = $derived($favouritesStore.size > 0 ? 6 : 5);
    const iconSize = "1.5rem";
    let claimChitAvailable = $derived(
        !$disableChit && $chitStateStore.nextDailyChitClaim < $now500,
    );

    let chatIndicator = $derived.by(() => showIndicator($unreadDirectAndGroupCountsStore.chats));
    let communityIndicator = $derived(showIndicator(unreadCommunities.chats));
    let favouritesIndicator = $derived(
        showIndicator(client.mergeCombinedUnreadCounts($unreadFavouriteCountsStore)),
    );
    let showFavourites = $derived($favouritesStore.size > 0);
    let activityIndicator = $derived.by(() => {
        return $messageActivitySummaryStore.unreadCount > 0;
    });

    function showIndicator({ mentions, unmuted }: UnreadCounts): boolean {
        return unmuted > 0 || mentions;
    }

    function itemSelected(s: Selection) {
        switch (s) {
            case "chats":
                page("/chats");
                break;
            case "communities":
                const selected = client.selectDefaultCommunity();
                if (!selected) {
                    page("/welcome");
                }
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

{#snippet item(selection: Selection, menuIcon: MenuIcon, indicator: boolean)}
    <BottomBarItem
        {indicator}
        onSelect={() => itemSelected(selection)}
        selected={props.selection === selection}>
        {#snippet icon(color)}
            {#if menuIcon.kind == "icon"}
                {#if selection == "chats"}
                    <ForumOutline {color} size={iconSize} />
                {:else if selection == "communities"}
                    <AccountGroup {color} size={iconSize} />
                {:else if selection == "favourites"}
                    <HeartOutline {color} size={iconSize} />
                {:else if selection == "notification"}
                    <BellOutline {color} size={iconSize} />
                {/if}
            {:else if menuIcon.kind == "svg"}
                <svg
                    width={iconSize}
                    height={iconSize}
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg">
                    <path d={menuIcon.svgPath} fill={color} />
                </svg>
            {:else if menuIcon.kind == "avatar"}
                <Avatar customSize={"2rem"} size={"lg"} url={menuIcon.url} name={menuIcon.name}
                ></Avatar>
            {/if}
        {/snippet}
    </BottomBarItem>
{/snippet}

<Container
    supplementalClass={"bottom_nav_bar"}
    padding={["sm", "lg", "zero", "lg"]}
    borderWidth={"thick"}
    minWidth={"100%"}
    {onSwipe}
    borderColour={"var(--background-0)"}
    borderRadius={["md", "md", "zero", "zero"]}
    background={"var(--background-1)"}
    mainAxisAlignment={"spaceAround"}>
    <div style={`--num: ${numIcons}`} class:showFavourites class={`selection ${props.selection}`}>
    </div>
    {@render item("chats", { kind: "icon" }, chatIndicator)}
    {@render item("communities", { kind: "icon" }, communityIndicator)}
    {#if $favouritesStore.size > 0}
        {@render item("favourites", { kind: "icon" }, favouritesIndicator)}
    {/if}
    {@render item("notification", { kind: "icon" }, activityIndicator)}
    {@render item(
        "wallet",
        {
            kind: "svg",
            svgPath:
                "M15.5 15.5C16.33 15.5 17 14.83 17 14C17 13.17 16.33 12.5 15.5 12.5C14.67 12.5 14 13.17 14 14C14 14.83 14.67 15.5 15.5 15.5ZM7 3H17C18.11 3 19 3.9 19 5V7C20.11 7 21 7.9 21 9V19C21 20.11 20.11 21 19 21H7C4.79 21 3 19.21 3 17V7C3 4.79 4.79 3 7 3ZM17 7V5H7C5.9 5 5 5.9 5 7V7.54C5.59 7.2 6.27 7 7 7H17ZM5 17C5 18.11 5.9 19 7 19H19V9H7C5.9 9 5 9.9 5 11V17Z",
        },
        false,
    )}
    {@render item(
        "profile",
        { kind: "avatar", url: avatarUrl, name: avatarName },
        claimChitAvailable,
    )}
</Container>

<style lang="scss">
    :global(.bottom_nav_bar) {
        z-index: 20;
        border-left: none !important;
        border-right: none !important;
        border-bottom: none !important;
    }

    :global {
        body.native-android {
            &:not(.with-button-nav) .bottom_nav_bar {
                padding-bottom: var(--android-inset-without-buttons) !important;
            }

            &.with-button-nav .bottom_nav_bar {
                padding-bottom: var(--android-inset-with-buttons) !important;
            }
        }
    }

    .selection {
        // --width: calc(22% - 2rem);
        --width: calc((100% - 2rem) / var(--num));
        --half: calc(var(--width) / 2);
        --offset: calc(1rem + var(--half));
        position: absolute;
        width: var(--width);
        left: 0;
        top: 0.125rem;
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
