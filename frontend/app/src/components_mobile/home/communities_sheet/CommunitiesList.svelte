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
        type CommunitySummary,
        currentUserIdStore,
        OpenChat,
        sortedCommunitiesStore,
        type UnreadCounts,
    } from "openchat-client";
    import { getContext } from "svelte";
    import AccountGroupOutline from "svelte-material-icons/AccountGroupOutline.svelte";
    import Compass from "svelte-material-icons/CompassOutline.svelte";
    import DiamondUpgradeBox from "../DiamondUpgradeBox.svelte";

    const client = getContext<OpenChat>("client");

    let user = $derived($allUsersStore.get($currentUserIdStore) ?? client.nullUser("unknown"));
    let diamond = $derived(user?.diamondStatus !== "inactive");

    interface Props {
        onSelect: (community: CommunitySummary) => void;
        hasUnread: (community: CommunitySummary) => [boolean, UnreadCounts];
        onCreate: () => void;
        onExplore: () => void;
    }

    let props: Props = $props();
</script>

{#snippet communityRow(community: CommunitySummary)}
    {@const [unread, counts] = props.hasUnread(community)}
    {@const count = counts.unmuted}
    {@const mentions = counts.mentions}
    <Container
        height={"hug"}
        onClick={() => props.onSelect(community)}
        crossAxisAlignment={"center"}
        padding={["sm", "zero"]}
        gap={"lg"}>
        <Avatar
            url={client.communityAvatarUrl(community.id.communityId, community.avatar)}
            size={"lg"}
            radius={"md"} />
        <Container gap={"xxs"} direction={"vertical"} width={"fill"}>
            <Container gap={"xs"} mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"start"}>
                <Title ellipsisTruncate fontWeight={"semi-bold"}>
                    {community.name}
                </Title>
                {#if mentions}
                    <CountBadge>@</CountBadge>
                {:else if unread}
                    <CountBadge>{count}</CountBadge>
                {/if}
            </Container>
            <Container gap={"xs"} mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"end"}>
                <BodySmall colour={"textSecondary"} ellipsisTruncate fontWeight={"normal"}>
                    {#if community.description === undefined || community.description === ""}
                        {`Public community with ${community.memberCount} members`}
                    {:else}
                        {community.description}
                    {/if}
                </BodySmall>
            </Container>
        </Container>
    </Container>
{/snippet}

<Container
    padding={["sm", "xl", "xxxl"]}
    width={"fill"}
    gap={"xxl"}
    direction={"vertical"}
    height={"hug"}>
    <Container width={"fill"} gap={"lg"} direction={"vertical"} height={"hug"}>
        <ListAction onClick={() => props.onExplore()}>
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
            <ListAction onClick={() => props.onCreate()} colour={"tertiary"}>
                {#snippet icon(color)}
                    <AccountGroupOutline {color} />
                {/snippet}
                Create a community
            </ListAction>
        {/if}
    </Container>
    <Container width={"fill"} gap={"lg"} direction={"vertical"}>
        <Label fontWeight={"bold"} colour={"textSecondary"}>Your communities</Label>

        {#each $sortedCommunitiesStore as community}
            {@render communityRow(community)}
        {/each}
    </Container>
</Container>
