<script lang="ts">
    import Avatar from "../Avatar.svelte";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import { AvatarSize, OpenChat } from "openchat-client";
    import SectionHeader from "../SectionHeader.svelte";
    import CommunityMenu from "./communities/CommunityMenu.svelte";
    import { selectedCommunity } from "../../stores/community";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");
</script>

<SectionHeader border={false}>
    <div class="current-selection" class:rtl={$rtlStore}>
        <div class="avatar">
            <Avatar
                url={client.communityAvatarUrl($selectedCommunity.avatar)}
                userId={undefined}
                size={AvatarSize.Default} />
        </div>
        <h4 class="name">{$selectedCommunity.name}</h4>
    </div>
    <span class="menu">
        <CommunityMenu
            on:newChannel
            on:editCommunity
            on:browseChannels
            community={$selectedCommunity} />
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
</style>
