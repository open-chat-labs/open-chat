<!-- A community's permissions (native plan 12's Manage → Permissions, on plan 11's page): the
     Members card (change roles, edit the community, invite, remove) and the Channels card (public
     and private channels, user groups), a row per permission with the lowest role that has it at
     the end (owners, admins or everyone; in the accent where it's not the default) opening the role
     menu, and Reset to defaults. A community has no message or thread permissions: those are each
     channel's. It edits the draft until it's saved. Someone whose role can't change them (the
     owner's, as the backend has it) sees the roles only. -->
<script lang="ts">
    import SettingsAction from "@openchat/ui/src/native/SettingsAction.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import SettingsValue from "@openchat/ui/src/native/SettingsValue.svelte";
    import type { UpdateCommunityState } from "@src/logic/groupOrCommunity/community.svelte";
    import { defaultCommunityPermissions } from "@src/stores/community";
    import { _ } from "svelte-i18n";
    import FactRow from "../details/FactRow.svelte";
    import {
        changedCommunityPermissions,
        COMMUNITY_PERMISSION_CARDS,
        communityPermissionRows,
        communityRoleOf,
        communityRoleOptions,
        type CommunityPermission,
    } from "./communitySettings.adapter";

    type Props = { editor: UpdateCommunityState; readOnly: boolean };

    let { editor, readOnly }: Props = $props();

    const t = (key: string, values?: Record<string, string | number>) => $_(key, { values });
    const permissions = $derived(editor.candidateCommunity.permissions);
    const roles = $derived(communityRoleOptions(t));
    const label = (id: string) => roles.find((r) => r.id === id)?.label ?? "";

    function set(key: CommunityPermission, id: string) {
        const role = communityRoleOf(id);
        if (role !== undefined) {
            editor.candidateCommunity.permissions = { ...permissions, [key]: role };
        }
    }

    function reset() {
        editor.candidateCommunity.permissions = defaultCommunityPermissions();
    }

    const changed = $derived(changedCommunityPermissions(permissions) > 0);
</script>

<div class="permissions">
    {#each COMMUNITY_PERMISSION_CARDS as card (card.card)}
        <SettingsGroup
            label={$_(
                card.card === "members"
                    ? "native.groupSettings.permissions.members"
                    : "native.communitySettings.permissions.channels",
            )}
            note={card.card === "members" ? $_("native.groupSettings.permissions.note") : ""}>
            {#each communityPermissionRows(permissions, card.card, t) as row (row.key)}
                {#if readOnly}
                    <FactRow label={row.label} value={label(row.value)} />
                {:else}
                    <SettingsValue
                        label={row.label}
                        options={roles}
                        value={row.value}
                        accent={row.changed}
                        onChange={(id) => set(row.key as CommunityPermission, id)} />
                {/if}
            {/each}
        </SettingsGroup>
    {/each}

    {#if !readOnly && changed}
        <SettingsGroup>
            <SettingsAction
                icon="rotate-back"
                label={$_("native.groupSettings.permissions.reset")}
                onClick={reset} />
        </SettingsGroup>
    {/if}
</div>

<style lang="scss">
    .permissions {
        display: flex;
        flex-direction: column;
        gap: 22px;
        padding: 8px var(--space-16) 0;
    }
</style>
