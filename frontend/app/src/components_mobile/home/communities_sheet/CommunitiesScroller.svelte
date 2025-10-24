<script lang="ts">
    import { Avatar, Container, NotificationIndicator } from "component-lib";
    import {
        OpenChat,
        selectedCommunityIdStore,
        sortedCommunitiesStore,
        type CommunitySummary,
        type UnreadCounts,
    } from "openchat-client";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        onSelect: (community: CommunitySummary) => void;
        hasUnread: (community: CommunitySummary) => [boolean, boolean, UnreadCounts];
        ref?: HTMLElement;
    }

    let { ref = $bindable(), onSelect, hasUnread }: Props = $props();

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
    padding={["zero", "lg"]}
    supplementalClass="scroller"
    allowOverflow
    width={{ kind: "fill" }}
    gap={"lg"}>
    {#each $sortedCommunitiesStore as community}
        {@const [unread, muted] = hasUnread(community)}
        <Container
            supplementalClass={`scroller_item ${unread && !muted ? "unread" : ""}`}
            id={`scroller_item_${community.id.communityId}`}
            allowOverflow
            width={{ kind: "hug" }}
            onClick={() => onSelect(community)}>
            <Avatar
                url={client.communityAvatarUrl(community.id.communityId, community.avatar)}
                size={"xl"}
                radius={"lg"} />
            {#if unread}
                <div class="unread">
                    <NotificationIndicator {muted}></NotificationIndicator>
                </div>
            {/if}
        </Container>
    {/each}
</Container>

<style lang="scss">
    .unread {
        position: absolute;
        bottom: -6px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
    }
</style>
