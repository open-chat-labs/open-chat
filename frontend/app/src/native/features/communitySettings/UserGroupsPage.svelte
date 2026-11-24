<!-- A community's User groups (native plan 12's Manage → User groups: "members picked from the
     community"): its groups as they're mentioned ("@moderators"), with their size, each opening its
     page (`user_group`), and New user group, for someone who may manage them. The community is the
     selected one, whose user groups the client holds. -->
<script lang="ts">
    import { selectedCommunityUserGroupsStore, type CommunitySummary, type OpenChat } from "@client";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import SettingsAction from "@openchat/ui/src/native/SettingsAction.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import SettingsLink from "@openchat/ui/src/native/SettingsLink.svelte";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { ScreenContext } from "../app/screens";
    import { userGroupRows } from "./communitySettings.adapter";

    type Props = { community: CommunitySummary; context: ScreenContext };

    let { community, context }: Props = $props();

    const client = getContext<OpenChat>("client");
    const t = (key: string, values?: Record<string, string | number>) => $_(key, { values });
    const rows = $derived(userGroupRows($selectedCommunityUserGroupsStore.values(), t));
    const canManage = $derived(client.canManageUserGroups(community.id));

    function open(userGroupId: number | undefined) {
        context.push({ kind: "user_group", communityId: community.id, userGroupId });
    }
</script>

<div class="page">
    <NativePageHeader
        title={$_("native.community.manage.userGroups")}
        sub={community.name}
        onBack={context.back} />

    <div class="body">
        <p class="intro">{$_("native.communitySettings.userGroups.intro")}</p>

        {#if rows.length > 0}
            <SettingsGroup>
                {#each rows as row (row.id)}
                    <SettingsLink
                        icon="at"
                        label={row.mention}
                        value={row.members}
                        onClick={() => open(row.id)} />
                {/each}
            </SettingsGroup>
        {:else}
            <p class="none">{$_("native.communitySettings.userGroups.none")}</p>
        {/if}

        {#if canManage}
            <SettingsGroup>
                <SettingsAction
                    icon="plus"
                    label={$_("native.communitySettings.userGroups.new")}
                    onClick={() => open(undefined)} />
            </SettingsGroup>
        {/if}
    </div>
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

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

    .intro,
    .none {
        margin: 0;
        padding: 0 4px;
        font: var(--weight-regular) text-size(14px) / 1.5 var(--font-sans);
        color: var(--ink-3);
        text-wrap: pretty;
    }

    .none {
        text-align: center;
        padding-block: 12px;
    }
</style>
