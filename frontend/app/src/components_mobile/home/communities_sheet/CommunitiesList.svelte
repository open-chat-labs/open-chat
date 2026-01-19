<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import {
        Avatar,
        BodySmall,
        ColourVars,
        Column,
        Container,
        CountBadge,
        Label,
        ListAction,
        Title,
    } from "component-lib";
    import {
        allUsersStore,
        currentUserIdStore,
        OpenChat,
        sortedCommunitiesStore,
        type CommunitySummary,
        type UnreadCounts,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { dragHandle, dragHandleZone, type DndEvent } from "svelte-dnd-action";
    import AccountGroupOutline from "svelte-material-icons/AccountGroupOutline.svelte";
    import Compass from "svelte-material-icons/CompassOutline.svelte";
    import Swap from "svelte-material-icons/MenuSwapOutline.svelte";
    import { flip } from "svelte/animate";
    import DiamondUpgradeBox from "../DiamondUpgradeBox.svelte";

    type CommunityItem = CommunitySummary & { _id: string };

    const client = getContext<OpenChat>("client");

    const flipDurationMs = 300;
    let user = $derived($allUsersStore.get($currentUserIdStore) ?? client.nullUser("unknown"));
    let diamond = $derived(user?.diamondStatus !== "inactive");

    interface Props {
        onSelect: (community: CommunitySummary) => void;
        hasUnread: (community: CommunitySummary) => [boolean, UnreadCounts];
        onCreate: () => void;
        onExplore: () => void;
    }

    let props: Props = $props();

    let communityItems = $state<CommunityItem[]>([]);
    $effect(() => {
        communityItems = $sortedCommunitiesStore.map((c) => ({ ...c, _id: c.id.communityId }));
    });

    function handleDndConsider(e: CustomEvent<DndEvent<CommunityItem>>) {
        communityItems = e.detail.items;
    }

    function handleDndFinalize(e: CustomEvent<DndEvent<CommunityItem>>) {
        client.updateCommunityIndexes(e.detail.items);
    }
</script>

{#snippet communityRow(community: CommunitySummary)}
    {@const [unread, counts] = props.hasUnread(community)}
    {@const count = counts.unmuted}
    {@const mentions = counts.mentions}
    <Container
        supplementalClass={"community_row"}
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

        <div use:dragHandle aria-label="drag-handle for {community.name}" class="handle">
            <Swap color={ColourVars.textSecondary} />
        </div>
    </Container>
{/snippet}

<Column padding={["sm", "xl", "xxxl"]} width={"fill"} gap={"xxl"} height={"hug"}>
    <Column width={"fill"} gap={"lg"} height={"hug"}>
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
    </Column>
    <Container width={"fill"} gap={"lg"} direction={"vertical"}>
        <Label fontWeight={"bold"} colour={"textSecondary"}>Your communities</Label>
        <div
            class={"dropzone"}
            use:dragHandleZone={{
                items: communityItems,
                flipDurationMs,
                dropTargetStyle: {},
            }}
            onconsider={handleDndConsider}
            onfinalize={handleDndFinalize}>
            {#each communityItems as community (community._id)}
                <div animate:flip={{ duration: flipDurationMs }}>
                    {@render communityRow(community)}
                </div>
            {/each}
        </div>
    </Container>
</Column>

<style lang="scss">
    .dropzone {
        width: 100%;
    }
</style>
