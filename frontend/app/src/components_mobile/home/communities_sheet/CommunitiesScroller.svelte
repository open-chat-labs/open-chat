<script lang="ts">
    import { Avatar, Container, NotificationIndicator } from "component-lib";
    import {
        OpenChat,
        sortedCommunitiesStore,
        type CommunitySummary,
        type UnreadCounts,
    } from "openchat-client";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        onSelect: (community: CommunitySummary) => void;
        hasUnread: (community: CommunitySummary) => [boolean, boolean, UnreadCounts];
    }

    let props: Props = $props();
</script>

<Container supplementalClass="scroller" allowOverflow width={{ kind: "fill" }} gap={"lg"}>
    {#each $sortedCommunitiesStore as community}
        {@const [unread, muted] = props.hasUnread(community)}
        <Container allowOverflow width={{ kind: "hug" }} onClick={() => props.onSelect(community)}>
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
