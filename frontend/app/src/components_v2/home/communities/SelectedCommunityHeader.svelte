<script lang="ts">
    import { Body, Container, SectionHeader } from "component-lib";
    import {
        AvatarSize,
        setRightPanelHistory,
        type CommunitySummary,
        type OpenChat,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Avatar from "../../Avatar.svelte";
    import WithVerifiedBadge from "../../icons/WithVerifiedBadge.svelte";
    import Translatable from "../../Translatable.svelte";
    import VisibilityLabel from "../VisibilityLabel.svelte";
    import CommunityMenu from "./CommunityMenu.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        community: CommunitySummary;
        canMarkAllRead: boolean;
    }

    let { community, canMarkAllRead }: Props = $props();

    function showCommunityMembers() {
        setRightPanelHistory([{ kind: "show_community_members" }]);
    }
</script>

<SectionHeader>
    {#snippet avatar()}
        <Avatar
            url={client.communityAvatarUrl(community.id.communityId, community.avatar)}
            userId={undefined}
            size={AvatarSize.Default} />
    {/snippet}
    {#snippet title()}
        <WithVerifiedBadge verified={community.verified} size={"small"}>
            <h4 class="name">
                {community.name}
            </h4>
        </WithVerifiedBadge>
    {/snippet}
    {#snippet subtitle()}
        <Container onClick={showCommunityMembers} crossAxisAlignment={"center"}>
            <VisibilityLabel isPublic={community.public} />
            <Body>
                <div class="members">
                    <span class="num">{community.memberCount.toLocaleString()}</span>
                    <Translatable resourceKey={i18nKey("members")} />
                </div>
            </Body>
        </Container>
    {/snippet}
    {#snippet menu()}
        <CommunityMenu {canMarkAllRead} {community} />
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
