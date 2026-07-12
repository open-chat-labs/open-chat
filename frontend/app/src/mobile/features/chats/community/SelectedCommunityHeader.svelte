<script lang="ts">
    import { Avatar, Body, Container, SectionHeader } from "component-lib";
    import {
        anonUserStore,
        publish,
        setRightPanelHistory,
        type CommunitySummary,
        type OpenChat,
    } from "@client";
    import { getContext } from "svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import WithVerifiedBadge from "@src/mobile/ui/icons/WithVerifiedBadge.svelte";
    import Translatable from "@src/mobile/shared/Translatable.svelte";
    import VisibilityLabel from "@src/mobile/features/chats/core/VisibilityLabel.svelte";
    import CommunityMenu from "./CommunityMenu.svelte";
    import OtherChannels from "./OtherChannels.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        community: CommunitySummary;
        canMarkAllRead: boolean;
    }

    let { community, canMarkAllRead }: Props = $props();

    let showOtherChannels = $state(false);

    function showCommunityMembers() {
        setRightPanelHistory([{ kind: "show_community_members" }]);
    }
</script>

{#if showOtherChannels}
    <OtherChannels {community} onClose={() => (showOtherChannels = false)} />
{/if}

{#snippet menu()}
    <CommunityMenu
        onOtherChannels={() => (showOtherChannels = true)}
        {canMarkAllRead}
        {community} />
{/snippet}

<SectionHeader
    onClick={() => publish("communityDetails", community)}
    menu={$anonUserStore ? undefined : menu}>
    {#snippet avatar()}
        <Avatar
            radius={"md"}
            url={client.communityAvatarUrl(community.id.communityId, community.avatar)}
            size={"lg"} />
    {/snippet}
    {#snippet title()}
        <WithVerifiedBadge verified={community.verified}>
            <h4 class="name">
                {community.name}
            </h4>
        </WithVerifiedBadge>
    {/snippet}
    {#snippet subtitle()}
        <Container gap={"sm"} onClick={showCommunityMembers} crossAxisAlignment={"center"}>
            <VisibilityLabel isPublic={community.public} />
            <Body>
                <div class="members">
                    <span class="num">{community.memberCount.toLocaleString()}</span>
                    <Translatable resourceKey={i18nKey("members")} />
                </div>
            </Body>
        </Container>
    {/snippet}
</SectionHeader>

<style lang="scss">
    .members {
        color: var(--txt-light);
        .num {
            color: var(--txt);
            font-weight: 700;
        }
    }
</style>
