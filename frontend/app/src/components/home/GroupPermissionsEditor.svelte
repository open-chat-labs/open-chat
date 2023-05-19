<script lang="ts">
    import { _ } from "svelte-i18n";
    import SelectPermissionRole from "./SelectPermissionRole.svelte";
    import type { GroupPermissions } from "openchat-client";

    export let permissions: GroupPermissions;
    export let isPublic: boolean;
</script>

<SelectPermissionRole
    label={$_("group.permissions.changePermissions")}
    bind:rolePermission={permissions.changePermissions} />
<SelectPermissionRole
    label={$_("group.permissions.changeRoles")}
    bind:rolePermission={permissions.changeRoles} />
{#if isPublic}
    <SelectPermissionRole
        label={$_("group.permissions.blockUsers")}
        bind:rolePermission={permissions.blockUsers} />
{:else}
    <SelectPermissionRole
        label={$_("group.permissions.removeMembers")}
        bind:rolePermission={permissions.removeMembers} />
    <SelectPermissionRole
        label={$_("group.permissions.inviteUsers")}
        bind:rolePermission={permissions.inviteUsers} />
{/if}
<SelectPermissionRole
    label={$_("group.permissions.deleteMessages")}
    bind:rolePermission={permissions.deleteMessages} />
<SelectPermissionRole
    label={$_("group.permissions.updateGroup")}
    bind:rolePermission={permissions.updateGroup} />
<SelectPermissionRole
    label={$_("group.permissions.pinMessages")}
    bind:rolePermission={permissions.pinMessages} />
<SelectPermissionRole
    label={$_("group.permissions.createPolls")}
    bind:rolePermission={permissions.createPolls} />
<SelectPermissionRole
    label={$_("group.permissions.sendMessages")}
    bind:rolePermission={permissions.sendMessages} />
<SelectPermissionRole
    label={$_("group.permissions.reactToMessages")}
    bind:rolePermission={permissions.reactToMessages} />
<SelectPermissionRole
    label={$_("group.permissions.replyInThread")}
    bind:rolePermission={permissions.replyInThread} />
