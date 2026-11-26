<!-- A community's Channels (native plan 12's Manage → Channels): the user's channels in it, each
     opening its Edit channel (the group settings page, `group_settings`), and New channel for
     someone who may make one (Create group for a channel, `new_group` with `channel`). The plan's
     reorder by the drag grip isn't built: a community's channels have no order the backend keeps
     (GAPS.md, "Native community settings"). -->
<script lang="ts">
    import { anonUserStore, type CommunitySummary, type OpenChat } from "@client";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import SettingsAction from "@openchat/ui/src/native/SettingsAction.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import { communityMenuPermissions } from "@src/logic/groupOrCommunity/detailsPermissions";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { ScreenContext } from "../app/screens";
    import ChannelsCard from "../communities/ChannelsCard.svelte";

    type Props = { community: CommunitySummary; context: ScreenContext };

    let { community, context }: Props = $props();

    const client = getContext<OpenChat>("client");
    const canCreate = $derived(
        !$anonUserStore && communityMenuPermissions(client, community).canCreateChannel,
    );
</script>

<div class="page">
    <NativePageHeader
        title={$_("native.community.manage.channels")}
        sub={community.name}
        onBack={context.back} />

    <div class="body">
        {#if community.channels.length > 0}
            <ChannelsCard
                label={$_("native.communitySettings.channels.yours")}
                note={$_("native.communitySettings.channels.note")}
                channels={community.channels}
                onOpen={(id) => context.push({ kind: "group_settings", chatId: id, page: "edit" })} />
        {/if}

        {#if canCreate}
            <SettingsGroup>
                <SettingsAction
                    icon="plus"
                    label={$_("communities.createChannel")}
                    onClick={() => context.push({ kind: "new_group", channel: community.id })} />
            </SettingsGroup>
        {/if}
    </div>
</div>

<style lang="scss">
    .page {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        gap: 22px;
        padding: 8px var(--space-16) var(--scroll-end);
    }
</style>
