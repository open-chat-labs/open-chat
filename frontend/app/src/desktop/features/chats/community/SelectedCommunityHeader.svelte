<script lang="ts">
    import {
        AvatarSize,
        setRightPanelHistory,
        type CommunitySummary,
        type OpenChat,
    } from "@client";
    import { getContext } from "svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import { rtlStore } from "@src/stores/rtl";
    import Avatar from "@src/desktop/shared/Avatar.svelte";
    import WithVerifiedBadge from "@src/desktop/ui/icons/WithVerifiedBadge.svelte";
    import SectionHeader from "@src/desktop/shared/SectionHeader.svelte";
    import Translatable from "@src/ui/Translatable.svelte";
    import VisibilityLabel from "@src/desktop/features/chats/core/VisibilityLabel.svelte";
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

<SectionHeader border={false}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        role="button"
        tabindex="0"
        onclick={showCommunityMembers}
        class="current-selection"
        class:rtl={$rtlStore}>
        <div class="avatar">
            <Avatar
                url={client.communityAvatarUrl(community.id.communityId, community.avatar)}
                userId={undefined}
                size={AvatarSize.Default} />
        </div>
        <div class="details">
            <WithVerifiedBadge verified={community.verified} size={"small"}>
                <h4 class="name">
                    {community.name}
                </h4>
            </WithVerifiedBadge>
            <div class="wrapper">
                <VisibilityLabel isPublic={community.public} />
                <div class="members">
                    <span class="num">{community.memberCount.toLocaleString()}</span>
                    <Translatable resourceKey={i18nKey("members")} />
                </div>
            </div>
        </div>
    </div>
    <span class="menu">
        <CommunityMenu {canMarkAllRead} {community} />
    </span>
</SectionHeader>

<style lang="scss">
    .current-selection {
        display: flex;
        flex: 1;
        align-items: center;
        gap: $sp3;
        cursor: pointer;
    }
    .wrapper {
        display: flex;
        gap: $sp3;
        align-items: center;
        @include font(book, normal, fs-70);
    }

    .name {
        @include font(book, normal, fs-120);
        margin-bottom: $sp1;
    }

    .members {
        color: var(--txt-light);
        .num {
            color: var(--txt);
            font-weight: 700;
        }
    }
</style>
