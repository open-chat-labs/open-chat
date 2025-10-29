<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
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
        allUsersStore,
        anonUserStore,
        type CommunitySummary,
        currentUserIdStore,
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
    import { updateCommunityState } from "../communities/createOrUpdate/community.svelte";
    import DiamondUpgradeBox from "../DiamondUpgradeBox.svelte";

    const client = getContext<OpenChat>("client");

    let user = $derived($allUsersStore.get($currentUserIdStore) ?? client.nullUser("unknown"));
    let diamond = $derived(user?.diamondStatus !== "inactive");

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
            updateCommunityState.createCommunity(client);
        }
    }
</script>

{#snippet communityRow(community: CommunitySummary)}
    {@const [unread, muted, counts] = props.hasUnread(community)}
    {@const count = muted ? counts.muted : counts.unmuted}
    <Container
        height={{ kind: "hug" }}
        onClick={() => props.onSelect(community)}
        crossAxisAlignment={"center"}
        gap={"md"}>
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
                <BodySmall colour={"textSecondary"} ellipsisTruncate fontWeight={"normal"}>
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

<Container
    padding={["zero", "lg", "zero", "lg"]}
    width={{ kind: "fill" }}
    gap={"xl"}
    direction={"vertical"}
    height={{ kind: "hug" }}>
    <Container width={{ kind: "fill" }} gap={"lg"} direction={"vertical"} height={{ kind: "hug" }}>
        <ListAction onClick={exploreCommunities}>
            {#snippet icon(color)}
                <Compass {color} />
            {/snippet}
            Explore bots & communities
        </ListAction>
        {#if !diamond}
            <DiamondUpgradeBox
                message={i18nKey(
                    "To create a community of your own and enjoy many other benefits.",
                )} />
        {:else}
            <ListAction onClick={createCommunity} colour={"tertiary"}>
                {#snippet icon(color)}
                    <AccountGroupOutline {color} />
                {/snippet}
                Create a community
            </ListAction>
        {/if}
    </Container>
    <Container width={{ kind: "fill" }} gap={"lg"} direction={"vertical"}>
        <Label fontWeight={"bold"} colour={"textSecondary"}>Your communities</Label>

        {#each $sortedCommunitiesStore as community}
            {@render communityRow(community)}
        {/each}
    </Container>
</Container>
