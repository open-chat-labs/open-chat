<script lang="ts">
    import Avatar from "../../Avatar.svelte";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../../stores/rtl";
    import { AvatarSize, OpenChat } from "openchat-client";
    import SectionHeader from "../../SectionHeader.svelte";
    import CommunityMenu from "./CommunityMenu.svelte";
    import { getContext } from "svelte";
    import type { CommunitySummary } from "openchat-shared";
    import VisibilityLabel from "../VisibilityLabel.svelte";

    const client = getContext<OpenChat>("client");

    export let community: CommunitySummary;
</script>

<SectionHeader border={false}>
    <div class="current-selection" class:rtl={$rtlStore}>
        <div class="avatar">
            <Avatar
                url={client.communityAvatarUrl(community.avatar)}
                userId={undefined}
                size={AvatarSize.Default} />
        </div>
        <div class="details">
            <h4 class="name">{community.name}</h4>
            <div class="wrapper">
                <VisibilityLabel isPublic={community.public} />
                <div class="members">
                    <span class="num">{community.memberCount.toLocaleString()}</span>
                    {$_("members")}
                </div>
            </div>
        </div>
    </div>
    <span class="menu">
        <CommunityMenu
            on:newChannel
            on:communityDetails
            on:leaveCommunity
            on:editCommunity
            on:deleteCommunity
            {community} />
    </span>
</SectionHeader>

<style lang="scss">
    .current-selection {
        display: flex;
        flex: 1;
        align-items: center;
        gap: $sp4;
        cursor: pointer;

        @include mobile() {
            padding: 0 $sp3;
        }
    }
    .wrapper {
        display: flex;
        gap: $sp3;
        align-items: center;
        @include font(book, normal, fs-70);
    }

    .members {
        color: var(--txt-light);
        .num {
            color: var(--txt);
            font-weight: 700;
        }
    }
</style>
