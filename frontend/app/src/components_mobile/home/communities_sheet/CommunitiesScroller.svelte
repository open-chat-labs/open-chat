<script lang="ts">
    import { Avatar, Container, ListAction, NotificationIndicator } from "component-lib";
    import {
        communityIdentifiersEqual,
        OpenChat,
        selectedCommunityIdStore,
        sortedCommunitiesStore,
        type CommunitySummary,
        type UnreadCounts,
    } from "openchat-client";
    import { getContext } from "svelte";
    import AccountGroupOutline from "svelte-material-icons/AccountGroupOutline.svelte";
    import Compass from "svelte-material-icons/CompassOutline.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        onSelect: (community: CommunitySummary) => void;
        hasUnread: (community: CommunitySummary) => [boolean, UnreadCounts];
        ref?: HTMLElement;
        onCreate: () => void;
        onExplore: () => void;
    }

    let { ref = $bindable(), onSelect, hasUnread, onCreate, onExplore }: Props = $props();

    $effect(() => {
        if ($selectedCommunityIdStore !== undefined) {
            const id = `scroller_item_${$selectedCommunityIdStore.communityId}`;
            const el = document.getElementById(id);
            if (el) {
                scrollIntoView(el as HTMLDivElement);
            }
        }
    });

    function scrollIntoView(el: HTMLDivElement) {
        el.scrollIntoView({
            behavior: "smooth",
            inline: "center",
        });
    }
</script>

<Container
    bind:ref
    padding={["md", "lg"]}
    supplementalClass="communities_scroller"
    overflow={"auto"}
    width={"fill"}
    gap={"lg"}>
    {#each $sortedCommunitiesStore as community}
        {@const [unread] = hasUnread(community)}
        <Container
            supplementalClass={`scroller_item ${unread ? "unread" : ""} ${
                communityIdentifiersEqual(community.id, $selectedCommunityIdStore) ? "selected" : ""
            }`}
            id={`scroller_item_${community.id.communityId}`}
            overflow={"visible"}
            width={"hug"}
            onClick={() => onSelect(community)}>
            <Avatar
                url={client.communityAvatarUrl(community.id.communityId, community.avatar)}
                size={"md"}
                radius={"md"} />
            {#if unread}
                <div class="unread">
                    <NotificationIndicator border={"secondary"}></NotificationIndicator>
                </div>
            {/if}
        </Container>
    {/each}
    <ListAction size={"default"} onClick={onExplore}>
        {#snippet icon(color)}
            <Compass {color} />
        {/snippet}
    </ListAction>
    <ListAction size={"default"} onClick={onCreate} colour={"tertiary"}>
        {#snippet icon(color)}
            <AccountGroupOutline {color} />
        {/snippet}
    </ListAction>
</Container>

<style lang="scss">
    :global(.scroller_item.selected::before) {
        content: "";
        width: 95%;
        top: -0.75rem;
        left: 2.5%;
        height: 0.25rem;
        border-radius: var(--rad-xl);
        background: var(--gradient);
        position: absolute;
    }
    .unread {
        display: flex;
        position: absolute;
        bottom: -9px;
        left: 50%;
        transform: translateX(-50%);
    }
</style>
