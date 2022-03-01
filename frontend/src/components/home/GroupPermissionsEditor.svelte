<script lang="ts">
    import { _ } from "svelte-i18n";
    import SelectPermissionRole from "./SelectPermissionRole.svelte";
    import type { GroupPermissions } from "../../domain/chat/chat";

    export let permissions: GroupPermissions;
    export let isPublic: boolean;
    export let viewMode: boolean = false;
</script>

<ul>
    <SelectPermissionRole
        label={$_("group.permissions.changePermissions")}
        bind:rolePermission={permissions.changePermissions}
        {viewMode} />
    <SelectPermissionRole
        label={$_("group.permissions.changeRoles")}
        bind:rolePermission={permissions.changeRoles}
        {viewMode} />
    {#if isPublic}
        <SelectPermissionRole
            label={$_("group.permissions.blockUsers")}
            bind:rolePermission={permissions.blockUsers}
            {viewMode} />
    {:else}
        <SelectPermissionRole
            label={$_("group.permissions.addMembers")}
            bind:rolePermission={permissions.addMembers}
            {viewMode} />
        <SelectPermissionRole
            label={$_("group.permissions.removeMembers")}
            bind:rolePermission={permissions.removeMembers}
            {viewMode} />
    {/if}
    <SelectPermissionRole
        label={$_("group.permissions.deleteMessages")}
        bind:rolePermission={permissions.deleteMessages}
        {viewMode} />
    <SelectPermissionRole
        label={$_("group.permissions.updateGroup")}
        bind:rolePermission={permissions.updateGroup}
        {viewMode} />
    <SelectPermissionRole
        label={$_("group.permissions.pinMessages")}
        bind:rolePermission={permissions.pinMessages}
        {viewMode} />
    <SelectPermissionRole
        label={$_("group.permissions.createPolls")}
        bind:rolePermission={permissions.createPolls}
        {viewMode} />
    <SelectPermissionRole
        label={$_("group.permissions.sendMessages")}
        bind:rolePermission={permissions.sendMessages}
        {viewMode} />
    <SelectPermissionRole
        label={$_("group.permissions.reactToMessages")}
        bind:rolePermission={permissions.reactToMessages}
        {viewMode} />
</ul>

<style type="text/scss">
    ul {
        list-style: none;
    }
</style>
