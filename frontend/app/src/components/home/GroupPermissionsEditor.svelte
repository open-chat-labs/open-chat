<script lang="ts">
    import { _ } from "svelte-i18n";
    import SelectPermissionRole from "./SelectPermissionRole.svelte";
    import { GroupPermissions, groupRoles } from "openchat-client";

    export let permissions: GroupPermissions;
    export let isPublic: boolean;
</script>

<SelectPermissionRole
    roles={groupRoles}
    label={$_("permissions.changePermissions")}
    bind:rolePermission={permissions.changePermissions} />
<SelectPermissionRole
    roles={groupRoles}
    label={$_("permissions.changeRoles")}
    bind:rolePermission={permissions.changeRoles} />
{#if isPublic}
    <SelectPermissionRole
        roles={groupRoles}
        label={$_("permissions.blockUsers")}
        bind:rolePermission={permissions.blockUsers} />
{:else}
    <SelectPermissionRole
        roles={groupRoles}
        label={$_("permissions.removeMembers")}
        bind:rolePermission={permissions.removeMembers} />
    <SelectPermissionRole
        roles={groupRoles}
        label={$_("permissions.inviteUsers")}
        bind:rolePermission={permissions.inviteUsers} />
{/if}
<SelectPermissionRole
    roles={groupRoles}
    label={$_("permissions.deleteMessages")}
    bind:rolePermission={permissions.deleteMessages} />
<SelectPermissionRole
    roles={groupRoles}
    label={$_("permissions.updateGroup")}
    bind:rolePermission={permissions.updateGroup} />
<SelectPermissionRole
    roles={groupRoles}
    label={$_("permissions.pinMessages")}
    bind:rolePermission={permissions.pinMessages} />
<SelectPermissionRole
    roles={groupRoles}
    label={$_("permissions.createPolls")}
    bind:rolePermission={permissions.createPolls} />
<SelectPermissionRole
    roles={groupRoles}
    label={$_("permissions.sendMessages")}
    bind:rolePermission={permissions.sendMessages} />
<SelectPermissionRole
    roles={groupRoles}
    label={$_("permissions.reactToMessages")}
    bind:rolePermission={permissions.reactToMessages} />
<SelectPermissionRole
    roles={groupRoles}
    label={$_("permissions.replyInThread")}
    bind:rolePermission={permissions.replyInThread} />
