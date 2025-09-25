<script lang="ts">
    import {
        Avatar,
        BodySmall,
        Container,
        CountBadge,
        Label,
        ListAction,
        Title,
    } from "component-lib";
    import {
        anonUserStore,
        type CommunitySummary,
        isDiamondStore,
        OpenChat,
        publish,
        sortedCommunitiesStore,
        type UnreadCounts,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import AccountGroupOutline from "svelte-material-icons/AccountGroupOutline.svelte";
    import Compass from "svelte-material-icons/CompassOutline.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        onSelect: (community: CommunitySummary) => void;
        hasUnread: (community: CommunitySummary) => [boolean, boolean, UnreadCounts];
    }

    let props: Props = $props();

    function exploreCommunities() {
        page("/communities");
    }

    function createCommunity() {
        if ($anonUserStore) {
            client.updateIdentityState({
                kind: "logging_in",
                postLogin: { kind: "create_community" },
            });
            return;
        }
        if (!$isDiamondStore) {
            publish("upgrade");
        } else {
            publish("createCommunity");
        }
    }
</script>

{#snippet communityRow(community: CommunitySummary)}
    {@const [unread, muted, counts] = props.hasUnread(community)}
    {@const count = muted ? counts.muted : counts.unmuted}
    <Container onClick={() => props.onSelect(community)} crossAxisAlignment={"center"} gap={"md"}>
        <Avatar
            url={client.communityAvatarUrl(community.id.communityId, community.avatar)}
            size={"lg"}
            radius={"lg"} />
        <Container gap={"xxs"} direction={"vertical"} width={{ kind: "fill" }}>
            <Container gap={"xs"} mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"start"}>
                <Title ellipsisTruncate fontWeight={"semi-bold"}>
                    {community.name}
                </Title>
            </Container>
            <Container gap={"xs"} mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"end"}>
                <BodySmall colour={"secondary"} ellipsisTruncate fontWeight={"normal"}>
                    The idea is that we put the latest message here, but not sure how we get that
                    yet
                </BodySmall>
                {#if unread}
                    <CountBadge {muted}>{count}</CountBadge>
                {/if}
            </Container>
        </Container>
    </Container>
{/snippet}

<Container width={{ kind: "fill" }} gap={"xl"} direction={"vertical"} height={{ kind: "hug" }}>
    <Container width={{ kind: "fill" }} gap={"lg"} direction={"vertical"} height={{ kind: "hug" }}>
        <ListAction onClick={exploreCommunities}>
            {#snippet icon(color)}
                <Compass {color} />
            {/snippet}
            Explore communities
        </ListAction>
        <ListAction onClick={createCommunity} colour={"tertiary"}>
            {#snippet icon(color)}
                <AccountGroupOutline {color} />
            {/snippet}
            Create a community
        </ListAction>
    </Container>
    <!-- <Container width={{ kind: "fill" }} gap={"md"} direction={"vertical"} height={{ kind: "hug" }}>
        <Label fontWeight={"bold"} colour={"secondary"}>Your favourites</Label>
    </Container> -->
    <Container width={{ kind: "fill" }} gap={"lg"} direction={"vertical"} height={{ kind: "hug" }}>
        <Label fontWeight={"bold"} colour={"secondary"}>Your communities</Label>

        {#each $sortedCommunitiesStore as community}
            {@render communityRow(community)}
        {/each}
    </Container>
</Container>
