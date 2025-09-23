<script lang="ts">
    import { Avatar, Container, NotificationIndicator } from "component-lib";
    import {
        emptyCombinedUnreadCounts,
        OpenChat,
        sortedCommunitiesStore,
        unreadCommunityChannelCountsStore,
        type CommunitySummary,
    } from "openchat-client";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        onSelect: (community: CommunitySummary) => void;
    }

    let props: Props = $props();

    function hasUnread(community: CommunitySummary): [boolean, boolean] {
        const { mentions, unmuted, muted } = client.mergeCombinedUnreadCounts(
            $unreadCommunityChannelCountsStore.get(community.id) ?? emptyCombinedUnreadCounts(),
        );

        return [mentions || unmuted > 0 || muted > 0, !mentions && unmuted === 0 && muted > 0];
    }
</script>

<Container width={{ kind: "fill" }} gap={"lg"}>
    {#each $sortedCommunitiesStore as community}
        {@const [unread, muted] = hasUnread(community)}
        <Container width={{ kind: "hug" }} onClick={() => props.onSelect(community)}>
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
        bottom: -4px;
        left: 50%;
        transform: translateX(-50%);
    }
</style>
